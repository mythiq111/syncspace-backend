// backend/src/modules/leave/leave.service.ts

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveRequest, LeaveType, LeaveStatus } from '../../../shared/types';

const mockLeaveStore: LeaveRequest[] = [];

@Injectable()
export class LeaveService {
  async createLeaveRequest(
    userId: string,
    tenantId: string,
    type: LeaveType,
    startDate: string,
    endDate: string,
    reason?: string
  ): Promise<LeaveRequest> {
    const newRequest: LeaveRequest = {
      id: `leave-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      tenantId,
      type,
      startDate,
      endDate,
      status: 'PENDING',
      reason: reason || '',
    };

    mockLeaveStore.push(newRequest);
    return newRequest;
  }

  async getLeaveRequests(userId: string, tenantId: string, role: string): Promise<LeaveRequest[]> {
    if (role === 'SUPER_ADMIN' || role === 'TENANT_ADMIN' || role === 'HR_MANAGER' || role === 'LINE_MANAGER') {
      return mockLeaveStore.filter((l) => l.tenantId === tenantId);
    }
    return mockLeaveStore.filter((l) => l.tenantId === tenantId && l.userId === userId);
  }

  async approveByManager(leaveId: string, managerId: string, tenantId: string): Promise<LeaveRequest> {
    const leave = mockLeaveStore.find((l) => l.id === leaveId && l.tenantId === tenantId);
    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }
    if (leave.status !== 'PENDING') {
      throw new BadRequestException(`Cannot manager-approve leave in state ${leave.status}`);
    }

    leave.status = 'MANAGER_APPROVED';
    leave.managerApproverId = managerId;
    return leave;
  }

  async approveByHR(leaveId: string, hrId: string, tenantId: string): Promise<LeaveRequest> {
    const leave = mockLeaveStore.find((l) => l.id === leaveId && l.tenantId === tenantId);
    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }
    if (leave.status !== 'MANAGER_APPROVED' && leave.status !== 'PENDING') {
      throw new BadRequestException(`Cannot HR-approve leave in state ${leave.status}`);
    }

    leave.status = 'HR_APPROVED';
    leave.hrApproverId = hrId;
    return leave;
  }

  async rejectLeave(leaveId: string, approverId: string, tenantId: string): Promise<LeaveRequest> {
    const leave = mockLeaveStore.find((l) => l.id === leaveId && l.tenantId === tenantId);
    if (!leave) {
      throw new NotFoundException('Leave request not found');
    }

    leave.status = 'REJECTED';
    return leave;
  }
}
