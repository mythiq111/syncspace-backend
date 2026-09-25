// backend/src/modules/employees/employees.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '../../../shared/types';

const mockUsersStore: User[] = [
  {
    id: 'user-123',
    tenantId: 'tenant-123',
    role: 'EMPLOYEE',
    email: 'alex.employee@acme.com',
    name: 'Alex Johnson',
    managerId: 'manager-1',
    baseSalary: 4500,
    allowances: 500,
    deductions: 200,
    annualLeaveBalance: 18,
  },
  {
    id: 'manager-1',
    tenantId: 'tenant-123',
    role: 'LINE_MANAGER',
    email: 'sarah.manager@acme.com',
    name: 'Sarah Connor',
    baseSalary: 6500,
    allowances: 1000,
    deductions: 300,
    annualLeaveBalance: 22,
  },
  {
    id: 'hr-1',
    tenantId: 'tenant-123',
    role: 'HR_MANAGER',
    email: 'mark.hr@acme.com',
    name: 'Mark Davis',
    baseSalary: 7000,
    allowances: 1200,
    deductions: 400,
    annualLeaveBalance: 25,
  },
];

@Injectable()
export class EmployeesService {
  async getEmployeesByTenant(tenantId: string): Promise<User[]> {
    return mockUsersStore.filter((u) => u.tenantId === tenantId);
  }

  async getEmployeeById(id: string, tenantId: string): Promise<User> {
    const user = mockUsersStore.find((u) => u.id === id && u.tenantId === tenantId);
    if (!user) {
      throw new NotFoundException(`Employee ${id} not found in tenant ${tenantId}`);
    }
    return user;
  }

  async inviteEmployee(
    tenantId: string,
    email: string,
    name: string,
    role: UserRole,
    managerId?: string,
    baseSalary = 4000,
    allowances = 500,
    deductions = 200
  ): Promise<User> {
    const newEmp: User = {
      id: `user-${Date.now()}`,
      tenantId,
      email,
      name,
      role,
      managerId,
      baseSalary,
      allowances,
      deductions,
      annualLeaveBalance: 20,
    };

    mockUsersStore.push(newEmp);
    return newEmp;
  }
}
