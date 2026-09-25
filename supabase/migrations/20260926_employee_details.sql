-- Employee details for real HR use.
-- Run once in Supabase SQL Editor AFTER 20260925_real_schema.sql. Safe to re-run.

-- 1. Work details on the employee record (visible to managers and above, like the rest of `users`)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS employee_code   TEXT,
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS department      TEXT,
  ADD COLUMN IF NOT EXISTS job_title       TEXT,
  ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
  ADD COLUMN IF NOT EXISTS joining_date    DATE,
  ADD COLUMN IF NOT EXISTS work_location   TEXT,
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT TRUE;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_employment_type_check
    CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_code_key
  ON users (tenant_id, lower(employee_code)) WHERE employee_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_department_idx ON users (tenant_id, department);

-- 2. Sensitive personal, bank and tax details: only the employee themselves and HR/admins can read.
CREATE TABLE IF NOT EXISTS employee_private (
  user_id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date_of_birth            DATE,
  gender                   TEXT CHECK (gender IN ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY')),
  address                  TEXT,
  emergency_contact_name   TEXT,
  emergency_contact_phone  TEXT,
  bank_name                TEXT,
  bank_account_number      TEXT,
  bank_ifsc                TEXT,
  tax_id                   TEXT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS employee_private_tenant_idx ON employee_private (tenant_id);

DROP TRIGGER IF EXISTS employee_private_updated_at ON employee_private;
CREATE TRIGGER employee_private_updated_at BEFORE UPDATE ON employee_private
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE employee_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_private_read     ON employee_private;
DROP POLICY IF EXISTS employee_private_hr_write ON employee_private;
CREATE POLICY employee_private_read ON employee_private FOR SELECT
  USING (tenant_id = current_tenant_id() AND (user_id = auth.uid() OR is_hr_or_admin()));
CREATE POLICY employee_private_hr_write ON employee_private FOR ALL
  USING (tenant_id = current_tenant_id() AND is_hr_or_admin())
  WITH CHECK (tenant_id = current_tenant_id() AND is_hr_or_admin());
