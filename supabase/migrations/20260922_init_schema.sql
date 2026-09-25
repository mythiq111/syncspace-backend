-- Supabase Schema & Row-Level Security (RLS) Policies for EmpFlow

-- 1. Create Custom Types
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ANOMALY_MISSED_PUNCH', 'REGULARIZED');
CREATE TYPE leave_type AS ENUM ('SICK', 'ANNUAL', 'UNPAID');
CREATE TYPE leave_status AS ENUM ('PENDING', 'MANAGER_APPROVED', 'HR_APPROVED', 'REJECTED');

-- 2. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  office_lat DOUBLE PRECISION NOT NULL DEFAULT 17.6868,
  office_lng DOUBLE PRECISION NOT NULL DEFAULT 83.2185,
  radius INT NOT NULL DEFAULT 200,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Users Table (Maps to Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY, -- Linked to auth.users.id
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'EMPLOYEE',
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  base_salary NUMERIC(12,2) DEFAULT 0,
  allowances NUMERIC(12,2) DEFAULT 0,
  deductions NUMERIC(12,2) DEFAULT 0,
  annual_leave_balance INT DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  punch_in TIMESTAMPTZ NOT NULL,
  punch_out TIMESTAMPTZ,
  status attendance_status NOT NULL DEFAULT 'PRESENT',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type leave_type NOT NULL DEFAULT 'ANNUAL',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status leave_status NOT NULL DEFAULT 'PENDING',
  reason TEXT,
  manager_approver_id UUID REFERENCES users(id),
  hr_approver_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Payslips Table
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- Format YYYY-MM
  pdf_url TEXT NOT NULL,
  base NUMERIC(12,2) NOT NULL,
  allowances NUMERIC(12,2) NOT NULL,
  deductions NUMERIC(12,2) NOT NULL,
  unpaid_leave_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_pay NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Enable Row Level Security (RLS) on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

-- Helper function to extract tenant_id from JWT metadata
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::UUID,
    (current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'tenant_id')::UUID
  );
$$ LANGUAGE SQL STABLE;

-- Helper function to extract user_id from JWT
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- 8. RLS Policies

-- TENANTS Policies
CREATE POLICY tenants_super_admin_all ON tenants
  FOR ALL USING (
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'SUPER_ADMIN'
  );

CREATE POLICY tenants_tenant_member_read ON tenants
  FOR SELECT USING (
    id = current_tenant_id()
  );

-- USERS Policies
CREATE POLICY users_tenant_isolation ON users
  FOR ALL USING (
    tenant_id = current_tenant_id()
  );

-- ATTENDANCE Policies
CREATE POLICY attendance_tenant_isolation ON attendance
  FOR ALL USING (
    tenant_id = current_tenant_id()
  );

-- LEAVE REQUESTS Policies
CREATE POLICY leave_requests_tenant_isolation ON leave_requests
  FOR ALL USING (
    tenant_id = current_tenant_id()
  );

-- PAYSLIPS Policies
CREATE POLICY payslips_tenant_isolation ON payslips
  FOR ALL USING (
    tenant_id = current_tenant_id() AND (
      user_id = current_user_id() OR 
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') IN ('HR_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')
    )
  );

-- 9. Private Storage Bucket setup for payslips
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payslips', 'payslips', false) 
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_payslip_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'payslips' AND (
      auth.role() = 'service_role' OR
      (storage.foldername(name))[1] = current_user_id()::text
    )
  );
