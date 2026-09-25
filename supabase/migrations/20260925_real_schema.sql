-- PulseHR / EmpFlow: production schema for Supabase (Postgres)
-- Run once on a clean project (SQL Editor -> paste -> Run). Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.
-- Multi-tenant: every row carries tenant_id; RLS isolates tenants and enforces roles.

-- =====================================================================
-- 1. Enums
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE user_role         AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ANOMALY_MISSED_PUNCH', 'REGULARIZED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE leave_type        AS ENUM ('SICK', 'ANNUAL', 'UNPAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE leave_status      AS ENUM ('PENDING', 'MANAGER_APPROVED', 'HR_APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 2. Shared trigger: keep updated_at fresh
-- =====================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$;

-- =====================================================================
-- 3. Tables
-- =====================================================================

-- Tenants (companies). `settings` backs the Settings page (leave rules, payroll, security...).
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  office_lat  DOUBLE PRECISION NOT NULL DEFAULT 17.6868 CHECK (office_lat BETWEEN -90 AND 90),
  office_lng  DOUBLE PRECISION NOT NULL DEFAULT 83.2185 CHECK (office_lng BETWEEN -180 AND 180),
  radius      INT NOT NULL DEFAULT 200 CHECK (radius > 0),
  timezone    TEXT NOT NULL DEFAULT 'UTC',
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users: profile row for each Supabase auth user.
CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role                 user_role NOT NULL DEFAULT 'EMPLOYEE',
  email                TEXT NOT NULL,
  name                 TEXT NOT NULL,
  manager_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  base_salary          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  allowances           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  deductions           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deductions >= 0),
  annual_leave_balance INT NOT NULL DEFAULT 20 CHECK (annual_leave_balance >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_not_own_manager CHECK (manager_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_key ON users (tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS users_tenant_idx  ON users (tenant_id);
CREATE INDEX IF NOT EXISTS users_manager_idx ON users (manager_id);

-- Attendance: one row per punch-in/punch-out pair.
CREATE TABLE IF NOT EXISTS attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  punch_in    TIMESTAMPTZ NOT NULL,
  punch_out   TIMESTAMPTZ,
  status      attendance_status NOT NULL DEFAULT 'PRESENT',
  lat         DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_out_after_in CHECK (punch_out IS NULL OR punch_out >= punch_in)
);
CREATE INDEX IF NOT EXISTS attendance_tenant_day_idx ON attendance (tenant_id, punch_in DESC);
CREATE INDEX IF NOT EXISTS attendance_user_day_idx   ON attendance (user_id, punch_in DESC);
-- An employee can only have one open (not yet punched-out) shift.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_one_open_shift ON attendance (user_id) WHERE punch_out IS NULL;

-- Leave requests (two-step approval: manager, then HR).
CREATE TABLE IF NOT EXISTS leave_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type                 leave_type NOT NULL DEFAULT 'ANNUAL',
  start_date           DATE NOT NULL,
  end_date             DATE NOT NULL,
  status               leave_status NOT NULL DEFAULT 'PENDING',
  reason               TEXT,
  manager_approver_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  hr_approver_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_dates_ordered CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS leave_tenant_status_idx ON leave_requests (tenant_id, status);
CREATE INDEX IF NOT EXISTS leave_user_idx          ON leave_requests (user_id, start_date DESC);

-- Payslips: one per employee per month.
CREATE TABLE IF NOT EXISTS payslips (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month                   VARCHAR(7) NOT NULL CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'), -- YYYY-MM
  pdf_url                 TEXT NOT NULL,
  base                    NUMERIC(12,2) NOT NULL,
  allowances              NUMERIC(12,2) NOT NULL,
  deductions              NUMERIC(12,2) NOT NULL,
  unpaid_leave_deduction  NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_pay               NUMERIC(12,2) NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, month)
);
CREATE INDEX IF NOT EXISTS payslips_tenant_month_idx ON payslips (tenant_id, month DESC);

-- Audit log (Settings -> Audit log, and general accountability).
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   UUID,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_tenant_time_idx ON audit_logs (tenant_id, created_at DESC);

-- updated_at triggers
DROP TRIGGER IF EXISTS tenants_updated_at        ON tenants;
DROP TRIGGER IF EXISTS users_updated_at          ON users;
DROP TRIGGER IF EXISTS attendance_updated_at     ON attendance;
DROP TRIGGER IF EXISTS leave_requests_updated_at ON leave_requests;
CREATE TRIGGER tenants_updated_at        BEFORE UPDATE ON tenants        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_updated_at          BEFORE UPDATE ON users          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER attendance_updated_at     BEFORE UPDATE ON attendance     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- 4. RLS helper functions
--    SECURITY DEFINER so they can read `users` without recursing into its own policies.
-- =====================================================================
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID
LANGUAGE SQL STABLE AS $$ SELECT auth.uid() $$;

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS user_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$;

-- Roles that can see/manage the whole tenant (HR side).
CREATE OR REPLACE FUNCTION is_hr_or_admin() RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(current_user_role() IN ('HR_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'), FALSE)
$$;

-- Roles that can view team data and approve leave.
CREATE OR REPLACE FUNCTION is_manager_or_above() RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(current_user_role() IN ('LINE_MANAGER', 'HR_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN'), FALSE)
$$;

-- =====================================================================
-- 5. Row Level Security
--    The NestJS backend uses the service_role key (bypasses RLS). These policies
--    protect any direct client access (anon/authenticated keys).
-- =====================================================================
ALTER TABLE tenants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;

-- tenants
DROP POLICY IF EXISTS tenants_read_own   ON tenants;
DROP POLICY IF EXISTS tenants_admin_edit ON tenants;
CREATE POLICY tenants_read_own ON tenants FOR SELECT
  USING (id = current_tenant_id());
CREATE POLICY tenants_admin_edit ON tenants FOR UPDATE
  USING (id = current_tenant_id() AND current_user_role() IN ('TENANT_ADMIN', 'SUPER_ADMIN'))
  WITH CHECK (id = current_tenant_id());

-- users: everyone sees themselves; managers+ see the tenant; only HR/admin write.
DROP POLICY IF EXISTS users_read        ON users;
DROP POLICY IF EXISTS users_hr_insert   ON users;
DROP POLICY IF EXISTS users_hr_update   ON users;
DROP POLICY IF EXISTS users_hr_delete   ON users;
CREATE POLICY users_read ON users FOR SELECT
  USING (id = auth.uid() OR (tenant_id = current_tenant_id() AND is_manager_or_above()));
CREATE POLICY users_hr_insert ON users FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() AND is_hr_or_admin());
CREATE POLICY users_hr_update ON users FOR UPDATE
  USING (tenant_id = current_tenant_id() AND is_hr_or_admin())
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY users_hr_delete ON users FOR DELETE
  USING (tenant_id = current_tenant_id() AND is_hr_or_admin() AND id <> auth.uid());

-- attendance
DROP POLICY IF EXISTS attendance_read        ON attendance;
DROP POLICY IF EXISTS attendance_insert_self ON attendance;
DROP POLICY IF EXISTS attendance_update      ON attendance;
DROP POLICY IF EXISTS attendance_hr_delete   ON attendance;
CREATE POLICY attendance_read ON attendance FOR SELECT
  USING (user_id = auth.uid() OR (tenant_id = current_tenant_id() AND is_manager_or_above()));
CREATE POLICY attendance_insert_self ON attendance FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = current_tenant_id());
CREATE POLICY attendance_update ON attendance FOR UPDATE
  USING (tenant_id = current_tenant_id() AND (user_id = auth.uid() OR is_hr_or_admin()))
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY attendance_hr_delete ON attendance FOR DELETE
  USING (tenant_id = current_tenant_id() AND is_hr_or_admin());

-- leave_requests
DROP POLICY IF EXISTS leave_read           ON leave_requests;
DROP POLICY IF EXISTS leave_insert_self    ON leave_requests;
DROP POLICY IF EXISTS leave_approve        ON leave_requests;
DROP POLICY IF EXISTS leave_cancel_pending ON leave_requests;
CREATE POLICY leave_read ON leave_requests FOR SELECT
  USING (user_id = auth.uid() OR (tenant_id = current_tenant_id() AND is_manager_or_above()));
CREATE POLICY leave_insert_self ON leave_requests FOR INSERT
  WITH CHECK (user_id = auth.uid() AND tenant_id = current_tenant_id() AND status = 'PENDING');
CREATE POLICY leave_approve ON leave_requests FOR UPDATE
  USING (tenant_id = current_tenant_id() AND is_manager_or_above() AND user_id <> auth.uid())
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY leave_cancel_pending ON leave_requests FOR DELETE
  USING (user_id = auth.uid() AND status = 'PENDING');

-- payslips: employees read their own; HR/admin manage.
DROP POLICY IF EXISTS payslips_read      ON payslips;
DROP POLICY IF EXISTS payslips_hr_write  ON payslips;
CREATE POLICY payslips_read ON payslips FOR SELECT
  USING (tenant_id = current_tenant_id() AND (user_id = auth.uid() OR is_hr_or_admin()));
CREATE POLICY payslips_hr_write ON payslips FOR ALL
  USING (tenant_id = current_tenant_id() AND is_hr_or_admin())
  WITH CHECK (tenant_id = current_tenant_id() AND is_hr_or_admin());

-- audit_logs
DROP POLICY IF EXISTS audit_hr_read   ON audit_logs;
DROP POLICY IF EXISTS audit_insert    ON audit_logs;
CREATE POLICY audit_hr_read ON audit_logs FOR SELECT
  USING (tenant_id = current_tenant_id() AND is_hr_or_admin());
CREATE POLICY audit_insert ON audit_logs FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id() AND actor_id = auth.uid());

-- =====================================================================
-- 6. Private storage bucket for payslip PDFs (path: <tenant_id>/<user_id>/<file>.pdf)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payslips', 'payslips', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_payslip_read ON storage.objects;
CREATE POLICY storage_payslip_read ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payslips' AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR ((storage.foldername(name))[1] = current_tenant_id()::text AND is_hr_or_admin())
    )
  );

-- =====================================================================
-- 7. Bootstrap: create the first company + admin
--    1) Dashboard -> Authentication -> Users -> Add user (email + password, tick "Auto confirm")
--    2) Run:  SELECT bootstrap_tenant_admin('you@company.com', 'Your Name', 'Your Company');
--    Callable only from the SQL editor / service_role, never from the client.
-- =====================================================================
CREATE OR REPLACE FUNCTION bootstrap_tenant_admin(p_email TEXT, p_name TEXT, p_tenant_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID;
  v_tid UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No auth user with email %. Create it first under Authentication -> Users.', p_email;
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE id = v_uid) THEN
    RAISE EXCEPTION 'User % is already set up.', p_email;
  END IF;

  INSERT INTO tenants (name) VALUES (p_tenant_name) RETURNING id INTO v_tid;
  INSERT INTO users (id, tenant_id, role, email, name)
  VALUES (v_uid, v_tid, 'TENANT_ADMIN', p_email, p_name);
  RETURN v_tid;
END $$;

REVOKE ALL ON FUNCTION bootstrap_tenant_admin(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
