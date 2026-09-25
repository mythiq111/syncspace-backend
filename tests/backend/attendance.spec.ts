// tests/backend/attendance.spec.ts

import { AttendanceService } from '../../src/modules/attendance/attendance.service';

describe('Attendance Service Integration', () => {
  let service: AttendanceService;

  beforeEach(() => {
    service = new AttendanceService();
  });

  it('should successfully clock-in when inside geofence', async () => {
    // Office is at (17.6868, 83.2185) with 200m radius
    const result = await service.clockIn('user-123', 'tenant-123', 17.6869, 83.2186);

    expect(result.id).toBeDefined();
    expect(result.status).toBe('PRESENT');
    expect(result.lat).toBe(17.6869);
  });

  it('should reject clock-in with ERR_OUT_OF_BOUNDS when outside 200m radius', async () => {
    // Far away coordinates
    await expect(
      service.clockIn('user-123', 'tenant-123', 17.7500, 83.3000)
    ).rejects.toThrow('You must be within 200m of the office');
  });

  it('should clock-out an existing open shift', async () => {
    await service.clockIn('user-123', 'tenant-123', 17.6868, 83.2185);
    const clockOutResult = await service.clockOut('user-123', 'tenant-123', 17.6868, 83.2185);

    expect(clockOutResult.punchOut).toBeDefined();
  });
});
