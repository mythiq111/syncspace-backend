// backend/src/modules/attendance/attendance.service.ts

import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Attendance, Tenant } from '../../../shared/types';
import { isWithinGeofence } from '../../../shared/utils/haversine';

const mockTenantsStore: Record<string, Tenant> = {
  'tenant-123': {
    id: 'tenant-123',
    name: 'Acme Corp',
    officeLat: 17.6868,
    officeLng: 83.2185,
    radius: 200,
    timezone: 'Asia/Kolkata',
  },
};

const mockAttendanceStore: Attendance[] = [];

@Injectable()
export class AttendanceService {
  async clockIn(
    userId: string,
    tenantId: string,
    lat: number,
    lng: number,
    timestamp?: string
  ): Promise<Attendance> {
    const tenant = mockTenantsStore[tenantId] || {
      id: tenantId,
      name: 'Default Org',
      officeLat: 17.6868,
      officeLng: 83.2185,
      radius: 200,
      timezone: 'UTC',
    };

    const geofenceCheck = isWithinGeofence(
      lat,
      lng,
      tenant.officeLat,
      tenant.officeLng,
      tenant.radius
    );

    if (!geofenceCheck.isInside) {
      throw new ForbiddenException({
        code: 'ERR_OUT_OF_BOUNDS',
        message: `You must be within ${tenant.radius}m of the office. Current distance: ${geofenceCheck.distanceMeters}m`,
      });
    }

    const existingOpenShift = mockAttendanceStore.find(
      (a) => a.userId === userId && a.tenantId === tenantId && !a.punchOut
    );

    if (existingOpenShift) {
      return existingOpenShift;
    }

    const newRecord: Attendance = {
      id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      tenantId,
      punchIn: timestamp || new Date().toISOString(),
      status: 'PRESENT',
      lat,
      lng,
    };

    mockAttendanceStore.push(newRecord);
    return newRecord;
  }

  async clockOut(
    userId: string,
    tenantId: string,
    lat: number,
    lng: number,
    timestamp?: string
  ): Promise<Attendance> {
    const openRecord = mockAttendanceStore.find(
      (a) => a.userId === userId && a.tenantId === tenantId && !a.punchOut
    );

    if (!openRecord) {
      throw new NotFoundException({
        code: 'ERR_NO_OPEN_SHIFT',
        message: 'No active shift found to clock out.',
      });
    }

    openRecord.punchOut = timestamp || new Date().toISOString();
    return openRecord;
  }

  async getAttendanceHistory(userId: string, tenantId: string): Promise<Attendance[]> {
    return mockAttendanceStore.filter(
      (a) => a.tenantId === tenantId && (a.userId === userId || userId === 'all')
    );
  }

  async regularizeMissedPunch(
    attendanceId: string,
    tenantId: string,
    punchIn?: string,
    punchOut?: string
  ): Promise<Attendance> {
    const record = mockAttendanceStore.find((a) => a.id === attendanceId && a.tenantId === tenantId);

    if (!record) {
      throw new NotFoundException({
        code: 'ERR_ATTENDANCE_NOT_FOUND',
        message: 'Attendance record not found for regularization',
      });
    }

    if (punchIn) record.punchIn = punchIn;
    if (punchOut) record.punchOut = punchOut;
    record.status = 'REGULARIZED';

    return record;
  }
}
