// backend/src/modules/leave/leave.service.ts

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveRequest, LeaveRequestDetail, LeaveType, UserRole } from '../../../shared/types';
import { DatabaseLeaveRequestRow } from '../../../shared/schemas/db';
import { SupabaseService, unwrap } from '../../common/supabase/supabase.service';
import { toLeave } from '../../common/supabase/mappers';
import { SettingsService } from '../../common/settings/settings.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

const TENANT_WIDE_ROLES = ['SUPER_ADMIN', 'TENANT_ADMIN', 'HR_MANAGER', 'LINE_MANAGER'];

@Injectable()
export class LeaveService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  async createLeaveRequest(
    userId: string,
    tenantId: string,
    type: LeaveType,
    startDate: string,
    endDate: string,
    reason?: string
  ): Promise<LeaveRequest> {
    // Company rules from Settings -> Leave Workflow Rules
    const rules = (await this.settings.get(tenantId)).leave;
    const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1;
    if (!(days >= 1)) throw new BadRequestException('End date cannot be before the start date');
    if (days > rules.maxConsecutiveDays) {
      throw new BadRequestException(`Leave cannot be longer than ${rules.maxConsecutiveDays} consecutive days`);
    }
    const noticeDays = Math.ceil((Date.parse(startDate) - Date.now()) / 86400000);
    if (type === 'ANNUAL' && noticeDays < rules.minNoticeDays) {
      throw new BadRequestException(`Annual leave needs at least ${rules.minNoticeDays} day(s) notice`);
    }

    const { data, error } = await this.supabase.client
      .from('leave_requests')
      .insert({ user_id: userId, tenant_id: tenantId, type, start_date: startDate, end_date: endDate, reason: reason || null })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    const created = toLeave(data as DatabaseLeaveRequestRow);
    await this.audit.log(tenantId, userId, 'leave.requested', 'leave_request', created.id, { type, startDate, endDate });
    void this.notifyAsync(tenantId, async () =>
      `:calendar: *${await this.nameOf(userId)}* requested ${type.toLowerCase()} leave (${this.range(created)}, ${days} day${days > 1 ? 's' : ''}).${reason ? ' Reason: ' + reason : ''}`
    );
    return created;
  }

  /** Managers and HR see the whole company; employees see their own. Every row names who applied, who it goes to, and who decided. */
  async getLeaveRequests(userId: string, tenantId: string, role: string): Promise<LeaveRequestDetail[]> {
    let query = this.supabase.client.from('leave_requests').select('*').eq('tenant_id', tenantId);
    if (!TENANT_WIDE_ROLES.includes(role)) query = query.eq('user_id', userId);
    const rows = unwrap(await query.order('created_at', { ascending: false })) as DatabaseLeaveRequestRow[];
    if (rows.length === 0) return [];

    // One lookup for every person that appears on any request (requester, their manager, approvers)
    const ids = new Set<string>();
    rows.forEach((r) => [r.user_id, r.manager_approver_id, r.hr_approver_id].forEach((id) => id && ids.add(id)));
    const people = new Map<string, { name: string; email: string; role: UserRole; manager_id: string | null }>();
    const fetchPeople = async (list: string[]) => {
      if (list.length === 0) return;
      const found = unwrap(
        await this.supabase.client.from('users').select('id, name, email, role, manager_id').eq('tenant_id', tenantId).in('id', list)
      ) as Array<{ id: string; name: string; email: string; role: UserRole; manager_id: string | null }>;
      found.forEach((p) => people.set(p.id, p));
    };
    await fetchPeople(Array.from(ids));
    const managerIds = new Set<string>();
    rows.forEach((r) => {
      const m = people.get(r.user_id)?.manager_id;
      if (m && !people.has(m)) managerIds.add(m);
    });
    await fetchPeople(Array.from(managerIds));

    return rows.map((r) => {
      const requester = people.get(r.user_id);
      const managerApprover = r.manager_approver_id ? people.get(r.manager_approver_id)?.name : undefined;
      const hrApprover = r.hr_approver_id ? people.get(r.hr_approver_id)?.name : undefined;
      const reportsTo = requester?.manager_id ? people.get(requester.manager_id)?.name : undefined;
      return {
        ...toLeave(r),
        requesterName: requester?.name ?? 'Former employee',
        requesterEmail: requester?.email ?? '',
        requesterRole: requester?.role ?? 'EMPLOYEE',
        reportsToName: reportsTo,
        managerApproverName: r.status === 'REJECTED' ? undefined : managerApprover,
        hrApproverName: r.status === 'REJECTED' ? undefined : hrApprover,
        // A rejection stores who rejected it in whichever approver slot matches their role
        rejectedByName: r.status === 'REJECTED' ? hrApprover ?? managerApprover : undefined,
      };
    });
  }

  async approveByManager(leaveId: string, managerId: string, tenantId: string): Promise<LeaveRequest> {
    const leave = await this.getOne(leaveId, tenantId);
    if (leave.status !== 'PENDING') {
      throw new BadRequestException(`Cannot manager-approve leave in state ${leave.status}`);
    }
    return this.decide(leave, tenantId, managerId, 'leave.manager_approved', ':white_check_mark: approved by the manager', {
      status: 'MANAGER_APPROVED',
      manager_approver_id: managerId,
    });
  }

  async approveByHR(leaveId: string, hrId: string, tenantId: string): Promise<LeaveRequest> {
    const leave = await this.getOne(leaveId, tenantId);
    if (leave.status !== 'MANAGER_APPROVED' && leave.status !== 'PENDING') {
      throw new BadRequestException(`Cannot HR-approve leave in state ${leave.status}`);
    }
    return this.decide(leave, tenantId, hrId, 'leave.hr_approved', ':white_check_mark: approved by HR', {
      status: 'HR_APPROVED',
      hr_approver_id: hrId,
    });
  }

  async rejectLeave(leaveId: string, approverId: string, tenantId: string): Promise<LeaveRequest> {
    const leave = await this.getOne(leaveId, tenantId);
    if (leave.status === 'HR_APPROVED' || leave.status === 'REJECTED') {
      throw new BadRequestException(`Cannot reject leave in state ${leave.status}`);
    }
    // Record who rejected it, in the approver slot that matches their role
    const { data: actor } = await this.supabase.client.from('users').select('role').eq('id', approverId).maybeSingle();
    const slot = actor?.role === 'HR_MANAGER' ? 'hr_approver_id' : 'manager_approver_id';
    return this.decide(leave, tenantId, approverId, 'leave.rejected', ':x: rejected', { status: 'REJECTED', [slot]: approverId });
  }

  // ---- helpers ----

  private async decide(leave: LeaveRequest, tenantId: string, actorId: string, action: string, verb: string, patch: Record<string, unknown>) {
    const updated = await this.transition(leave.id, tenantId, patch);
    await this.audit.log(tenantId, actorId, action, 'leave_request', leave.id, { employeeId: leave.userId });
    void this.notifyAsync(
      tenantId,
      async () => `Leave for *${await this.nameOf(leave.userId)}* (${this.range(leave)}) ${verb} by *${await this.nameOf(actorId)}*.`
    );
    return updated;
  }

  private async notifyAsync(tenantId: string, build: () => Promise<string>) {
    try {
      await this.notifications.notifyLeaveEvent(tenantId, await build());
    } catch {
      /* notifications must never break the action */
    }
  }

  private async nameOf(userId: string): Promise<string> {
    const { data } = await this.supabase.client.from('users').select('name').eq('id', userId).maybeSingle();
    return data?.name ?? 'An employee';
  }

  private range(l: { startDate: string; endDate: string }) {
    return l.startDate === l.endDate ? l.startDate : `${l.startDate} to ${l.endDate}`;
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
