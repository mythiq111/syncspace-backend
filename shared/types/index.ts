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

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

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
  employeeCode?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  employmentType?: EmploymentType;
  joiningDate?: string; // YYYY-MM-DD
  workLocation?: string;
  isActive?: boolean;
}

/** Sensitive details; readable only by the employee and HR/admins. */
export interface EmployeePrivate {
  dateOfBirth?: string;
  gender?: Gender;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  taxId?: string;
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
  createdAt?: string;
}

/** A leave request plus the people involved, so every viewer sees the full trail. */
export interface LeaveRequestDetail extends LeaveRequest {
  requesterName: string;
  requesterEmail: string;
  requesterRole: UserRole;
  reportsToName?: string; // the requester's manager (who the request goes to)
  managerApproverName?: string;
  hrApproverName?: string;
  rejectedByName?: string;
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
