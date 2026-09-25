// tests/backend/leave.spec.ts

import { LeaveService } from '../../src/modules/leave/leave.service';

describe('Leave Service 2-Step Approval Workflow', () => {
  let leaveService: LeaveService;

  beforeEach(() => {
    leaveService = new LeaveService();
  });

  it('should flow through 2-step approval (Pending -> Manager Approved -> HR Approved)', async () => {
    // 1. Employee submits
    const req = await leaveService.createLeaveRequest(
      'user-123',
      'tenant-123',
      'ANNUAL',
      '2026-10-01',
      '2026-10-03',
      'Vacation'
    );
    expect(req.status).toBe('PENDING');

    // 2. Line Manager approves
    const mgrApproved = await leaveService.approveByManager(req.id, 'manager-1', 'tenant-123');
    expect(mgrApproved.status).toBe('MANAGER_APPROVED');
    expect(mgrApproved.managerApproverId).toBe('manager-1');

    // 3. HR approves
    const hrApproved = await leaveService.approveByHR(req.id, 'hr-1', 'tenant-123');
    expect(hrApproved.status).toBe('HR_APPROVED');
    expect(hrApproved.hrApproverId).toBe('hr-1');
  });

  it('should support rejection by manager or HR', async () => {
    const req = await leaveService.createLeaveRequest(
      'user-123',
      'tenant-123',
      'SICK',
      '2026-10-05',
      '2026-10-06'
    );

    const rejected = await leaveService.rejectLeave(req.id, 'manager-1', 'tenant-123');
    expect(rejected.status).toBe('REJECTED');
  });
});
