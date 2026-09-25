// shared/schemas/db.ts

import { AttendanceStatus, LeaveStatus, LeaveType, UserRole } from '../types';

export interface DatabaseTenantRow {
  id: string;
  name: string;
  office_lat: number;
  office_lng: number;
  radius: number;
  timezone: string;
  created_at: string;
}

export interface DatabaseUserRow {
  id: string;
  tenant_id: string;
  role: UserRole;
  email: string;
  name: string;
  manager_id: string | null;
  base_salary: number;
  allowances: number;
  deductions: number;
  annual_leave_balance: number;
  created_at: string;
}

export interface DatabaseAttendanceRow {
  id: string;
  user_id: string;
  tenant_id: string;
  punch_in: string;
  punch_out: string | null;
  status: AttendanceStatus;
  lat: number;
  lng: number;
  created_at: string;
}

export interface DatabaseLeaveRequestRow {
  id: string;
  user_id: string;
  tenant_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  reason: string | null;
  manager_approver_id: string | null;
  hr_approver_id: string | null;
  created_at: string;
}

export interface DatabasePayslipRow {
  id: string;
  user_id: string;
  tenant_id: string;
  month: string;
  pdf_url: string;
  base: number;
  allowances: number;
  deductions: number;
  unpaid_leave_deduction: number;
  final_pay: number;
  created_at: string;
}
