// shared/services/api.ts
// Central API Service Client for both Web Frontend and Expo Mobile App

import { Attendance, LeaveRequest, User, Payslip } from '../types';

export const API_BASE_URL = 'http://localhost:4000/api/v1';

// Shared In-Memory Data Store (Provides fallback sync between Web & Mobile)
export const initialEmployeesList: User[] = [
  { id: '1042', tenantId: '8492', role: 'EMPLOYEE', email: 'm.chen@acme.corp', name: 'Marcus Chen', baseSalary: 8500 },
  { id: '0891', tenantId: '8492', role: 'EMPLOYEE', email: 'a.okonjo@acme.corp', name: 'Amara Okonjo', baseSalary: 9200 },
  { id: '1205', tenantId: '8492', role: 'EMPLOYEE', email: 'e.rostova@acme.corp', name: 'Elena Rostova', baseSalary: 7800 },
  { id: '0743', tenantId: '8492', role: 'EMPLOYEE', email: 'd.miller@acme.corp', name: 'David Miller', baseSalary: 9500 },
  { id: '1120', tenantId: '8492', role: 'EMPLOYEE', email: 'p.sharma@acme.corp', name: 'Priya Sharma', baseSalary: 8100 },
  { id: '1314', tenantId: '8492', role: 'EMPLOYEE', email: 'l.campbell@acme.corp', name: 'Liam Campbell', baseSalary: 7200 },
];

export const initialAttendanceList: Attendance[] = [
  { id: 'att-1', userId: '1042', tenantId: '8492', punchIn: '2026-09-23T08:52:00Z', status: 'PRESENT', lat: 17.6868, lng: 83.2185 },
  { id: 'att-2', userId: '0891', tenantId: '8492', punchIn: '2026-09-23T08:58:00Z', status: 'PRESENT', lat: 17.6869, lng: 83.2186 },
  { id: 'att-3', userId: '1205', tenantId: '8492', punchIn: '2026-09-23T09:04:00Z', status: 'ANOMALY_MISSED_PUNCH', lat: 17.6910, lng: 83.2200 },
];

export const initialLeaveList: LeaveRequest[] = [
  { id: 'leave-1', userId: '1042', tenantId: '8492', type: 'ANNUAL', startDate: '2026-11-04', endDate: '2026-11-07', status: 'PENDING', reason: 'Family gathering abroad' },
  { id: 'leave-2', userId: '0891', tenantId: '8492', type: 'SICK', startDate: '2026-10-24', endDate: '2026-10-25', status: 'MANAGER_APPROVED', reason: 'Medical cert' },
];

// Unified API Service
export class PulseHRApiService {
  private static employees: User[] = [...initialEmployeesList];
  private static attendance: Attendance[] = [...initialAttendanceList];
  private static leaves: LeaveRequest[] = [...initialLeaveList];

  // Fetch Employees
  static async getEmployees(): Promise<User[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`);
      if (res.ok) {
        const json = await res.json();
        return json.data || json;
      }
    } catch {
      // Return shared sync store if offline/local dev
    }
    return this.employees;
  }

  // Add Employee (Syncs web & mobile)
  static async addEmployee(user: Partial<User>): Promise<User> {
    const newEmp: User = {
      id: String(Math.floor(1000 + Math.random() * 9000)),
      tenantId: '8492',
      role: user.role || 'EMPLOYEE',
      email: user.email || 'employee@acme.corp',
      name: user.name || 'New Employee',
      baseSalary: user.baseSalary || 7500,
    };
    this.employees.unshift(newEmp);
    try {
      await fetch(`${API_BASE_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmp),
      });
    } catch {
      // Fallback to memory store
    }
    return newEmp;
  }

  // Clock In / Punch Attendance
  static async punchAttendance(userId: string, lat: number, lng: number, status: Attendance['status']): Promise<Attendance> {
    const punch: Attendance = {
      id: `att-${Date.now()}`,
      userId,
      tenantId: '8492',
      punchIn: new Date().toISOString(),
      status,
      lat,
      lng,
    };
    this.attendance.unshift(punch);
    try {
      await fetch(`${API_BASE_URL}/attendance/punch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(punch),
      });
    } catch {
      // Fallback to memory store
    }
    return punch;
  }

  // Fetch Attendance Logs
  static async getAttendanceLogs(): Promise<Attendance[]> {
    return this.attendance;
  }

  // Fetch Leaves
  static async getLeaveRequests(): Promise<LeaveRequest[]> {
    return this.leaves;
  }

  // Request Leave
  static async requestLeave(leave: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const created: LeaveRequest = {
      id: `leave-${Date.now()}`,
      userId: leave.userId || '1042',
      tenantId: '8492',
      type: leave.type || 'ANNUAL',
      startDate: leave.startDate || new Date().toISOString().slice(0, 10),
      endDate: leave.endDate || new Date().toISOString().slice(0, 10),
      status: 'PENDING',
      reason: leave.reason || 'Personal request',
    };
    this.leaves.unshift(created);
    return created;
  }
}
