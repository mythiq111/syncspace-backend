// backend/src/modules/leave/leave.service.ts

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveRequest, LeaveType } from '../../../shared/types';
import { DatabaseLeaveRequestRow } from '../../../shared/schemas/db';
import { SupabaseService, unwrap } from '../../common/supabase/supabase.service';
import { toLeave } from '../../common/supabase/mappers';

const TENANT_WIDE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER', 'LINE_MANAGER'];

@Injectable()
export class LeaveService {
  constructor(private readonly supabase: SupabaseService) {}

  async createLeaveRequest(
    userId: string,
    tenantId: string,
    type: LeaveType,
    startDate: string,
    endDate: string,
    reason?: string
  ): Promise<LeaveRequest> {
    const { data, error } = await this.supabase.client
      .from('leave_requests')
      .insert({ user_id: userId, tenant_id: tenantId, type, start_date: startDate, end_date: endDate, reason: reason || null })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return toLeave(data as DatabaseLeaveRequestRow);
  }

  async getLeaveRequests(userId: string, tenantId: string, role: string): Promise<LeaveRequest[]> {
    let query = this.supabase.client.from('leave_requests').select('*').eq('tenant_id', tenantId);
    if (!TENANT_WIDE_ROLES.includes(role)) query = query.eq('user_id', userId);
    const rows = unwrap(await query.order('created_at', { ascending: false })) as DatabaseLeaveRequestRow[];
    return rows.map(toLeave);
  }

  async approveByManager(leaveId: string, managerId: string, tenantId: string): Promise<LeaveRequest> {
    const leave = await this.getOne(leaveId, tenantId);
    if (leave.status !== 'PENDING') {
      throw new BadRequestException(`Cannot manager-approve leave in state ${leave.status}`);
    }
    return this.transition(leaveId, tenantId, { status: 'MANAGER_APPROVED', manager_approver_id: managerId });
  }

  async approveByHR(leaveId: string, hrId: string, tenantId: string): Promise<LeaveRequest> {
    const leave = await this.getOne(leaveId, tenantId);
    if (leave.status !== 'MANAGER_APPROVED' && leave.status !== 'PENDING') {
      throw new BadRequestException(`Cannot HR-approve leave in state ${leave.status}`);
    }
    return this.transition(leaveId, tenantId, { status: 'HR_APPROVED', hr_approver_id: hrId });
  }

  async rejectLeave(leaveId: string, _approverId: string, tenantId: string): Promise<LeaveRequest> {
    await this.getOne(leaveId, tenantId);
    return this.transition(leaveId, tenantId, { status: 'REJECTED' });
  }

  private async getOne(leaveId: string, tenantId: string): Promise<LeaveRequest> {
    const { data, error } = await this.supabase.client
      .from('leave_requests')
      .select('*')
      .eq('id', leaveId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Leave request not found');
    return toLeave(data as DatabaseLeaveRequestRow);
  }

  private async transition(leaveId: string, tenantId: string, patch: Record<string, unknown>): Promise<LeaveRequest> {
    const { data, error } = await this.supabase.client
      .from('leave_requests')
      .update(patch)
      .eq('id', leaveId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return toLeave(data as DatabaseLeaveRequestRow);
  }
}
