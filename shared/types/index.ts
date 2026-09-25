// shared/types/index.ts

export type UserRole = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'HR_MANAGER' | 'LINE_MANAGER' | 'EMPLOYEE';

export interface Tenant {
  id: string;
  name: string;
  officeLat: number; 
  officeLng: number; 
  radius: number; // in meters, default 200
  timezone: string;
}

export interface User {
  id: string;
  tenantId: string; 
  role: UserRole; 
  email: string;
  name?: string;
  managerId?: string; 
  baseSalary?: number;
  allowances?: number;
  deductions?: number;
  annualLeaveBalance?: number;
}

export type AttendanceStatus = 'PRESENT' | 'ANOMALY_MISSED_PUNCH' | 'REGULARIZED';

export interface Attendance {
  id: string;
  userId: string; 
  tenantId: string; 
  punchIn: string; // ISO 8601
  punchOut?: string; // ISO 8601
  status: AttendanceStatus; 
  lat: number; 
  lng: number; 
}

export type LeaveType = 'SICK' | 'ANNUAL' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'MANAGER_APPROVED' | 'HR_APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
  userId: string;
  tenantId: string;
  type: LeaveType;
  startDate: string; // ISO YYYY-MM-DD
  endDate: string; // ISO YYYY-MM-DD
  status: LeaveStatus;
  reason?: string;
  managerApproverId?: string;
  hrApproverId?: string;
}

export interface Payslip {
  id: string;
  userId: string; 
  tenantId: string; 
  month: string; // YYYY-MM
  pdfUrl: string; 
  base: number; 
  allowances: number; 
  deductions: number; 
  unpaidLeaveDeduction: number;
  finalPay: number;
  createdAt: string;
}

// Standard API Envelopes
export interface ApiRequest<T> {
  data: T;
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    pagination?: { page: number; limit: number; total: number };
  };
}

export interface ApiErrorDetails {
  code: string;
  message: string;
  details?: any;
}

export interface ApiError {
  error: ApiErrorDetails;
}
