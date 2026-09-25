// backend/src/common/supabase/mappers.ts
// Database rows (snake_case) -> API/domain types (camelCase).

import {
  DatabaseAttendanceRow,
  DatabaseLeaveRequestRow,
  DatabasePayslipRow,
  DatabaseTenantRow,
  DatabaseUserRow,
} from '../../../shared/schemas/db';
import { Attendance, LeaveRequest, Payslip, Tenant, User } from '../../../shared/types';

export const toTenant = (r: DatabaseTenantRow): Tenant => ({
  id: r.id,
  name: r.name,
  officeLat: r.office_lat,
  officeLng: r.office_lng,
  radius: r.radius,
  timezone: r.timezone,
});

export const toUser = (r: DatabaseUserRow): User => ({
  id: r.id,
  tenantId: r.tenant_id,
  role: r.role,
  email: r.email,
  name: r.name,
  managerId: r.manager_id ?? undefined,
  baseSalary: Number(r.base_salary),
  allowances: Number(r.allowances),
  deductions: Number(r.deductions),
  annualLeaveBalance: r.annual_leave_balance,
  employeeCode: r.employee_code ?? undefined,
  phone: r.phone ?? undefined,
  department: r.department ?? undefined,
  jobTitle: r.job_title ?? undefined,
  employmentType: r.employment_type,
  joiningDate: r.joining_date ?? undefined,
  workLocation: r.work_location ?? undefined,
  isActive: r.is_active,
});

export const toAttendance = (r: DatabaseAttendanceRow): Attendance => ({
  id: r.id,
  userId: r.user_id,
  tenantId: r.tenant_id,
  punchIn: r.punch_in,
  punchOut: r.punch_out ?? undefined,
  status: r.status,
  lat: r.lat,
  lng: r.lng,
});

export const toLeave = (r: DatabaseLeaveRequestRow): LeaveRequest => ({
  id: r.id,
  userId: r.user_id,
  tenantId: r.tenant_id,
  type: r.type,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status,
  reason: r.reason ?? undefined,
  managerApproverId: r.manager_approver_id ?? undefined,
  hrApproverId: r.hr_approver_id ?? undefined,
});

export const toPayslip = (r: DatabasePayslipRow): Payslip => ({
  id: r.id,
  userId: r.user_id,
  tenantId: r.tenant_id,
  month: r.month,
  pdfUrl: r.pdf_url,
  base: Number(r.base),
  allowances: Number(r.allowances),
  deductions: Number(r.deductions),
  unpaidLeaveDeduction: Number(r.unpaid_leave_deduction),
  finalPay: Number(r.final_pay),
  createdAt: r.created_at,
});
