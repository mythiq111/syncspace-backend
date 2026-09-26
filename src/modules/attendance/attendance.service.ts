// backend/src/modules/attendance/attendance.service.ts

import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Attendance } from '../../../shared/types';
import { DatabaseAttendanceRow } from '../../../shared/schemas/db';
import { isWithinGeofence } from '../../../shared/utils/haversine';
import { SupabaseService, unwrap } from '../../common/supabase/supabase.service';
import { toAttendance } from '../../common/supabase/mappers';
import { SettingsService } from '../../common/settings/settings.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly settings: SettingsService
  ) {}

  async clockIn(userId: string, tenantId: string, lat: number, lng: number, timestamp?: string): Promise<Attendance> {
    const { data: tenant, error: tenantError } = await this.supabase.client
      .from('tenants')
      .select('office_lat, office_lng, radius')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantError || !tenant) throw new NotFoundException('Organization not found');

    const enforce = (await this.settings.get(tenantId)).geofence.enforce;
    const geofence = isWithinGeofence(lat, lng, tenant.office_lat, tenant.office_lng, tenant.radius);
    if (enforce && !geofence.isInside) {
      throw new ForbiddenException({
        code: 'ERR_OUT_OF_BOUNDS',
        message: `You must be within ${tenant.radius}m of the office. Current distance: ${geofence.distanceMeters}m`,
      });
    }

    const open = await this.findOpenShift(userId, tenantId);
    if (open) return open;

    const { data, error } = await this.supabase.client
      .from('attendance')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        punch_in: timestamp || new Date().toISOString(),
        status: 'PRESENT',
        lat,
        lng,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return toAttendance(data as DatabaseAttendanceRow);
  }

  async clockOut(userId: string, tenantId: string, _lat: number, _lng: number, timestamp?: string): Promise<Attendance> {
    const open = await this.findOpenShift(userId, tenantId);
    if (!open) {
      throw new NotFoundException({ code: 'ERR_NO_OPEN_SHIFT', message: 'No active shift found to clock out.' });
    }
    return this.updateRecord(open.id, tenantId, { punch_out: timestamp || new Date().toISOString() });
  }

  /** userId === 'all' returns every record in the tenant. Newest first. */
  async getAttendanceHistory(userId: string, tenantId: string): Promise<Attendance[]> {
    let query = this.supabase.client.from('attendance').select('*').eq('tenant_id', tenantId);
    if (userId !== 'all') query = query.eq('user_id', userId);
    const rows = unwrap(await query.order('punch_in', { ascending: false })) as DatabaseAttendanceRow[];
    return rows.map(toAttendance);
  }

  async regularizeMissedPunch(
    attendanceId: string,
    tenantId: string,
    punchIn?: string,
    punchOut?: string
  ): Promise<Attendance> {
    const patch: Record<string, unknown> = { status: 'REGULARIZED' };
    if (punchIn) patch.punch_in = punchIn;
    if (punchOut) patch.punch_out = punchOut;
    return this.updateRecord(attendanceId, tenantId, patch, {
      code: 'ERR_ATTENDANCE_NOT_FOUND',
      message: 'Attendance record not found for regularization',
    });
  }

  /** Used by the end-of-day worker: closes a forgotten shift and flags it as an anomaly. */
  async closeAsMissedPunch(attendanceId: string, tenantId: string): Promise<Attendance> {
    return this.updateRecord(attendanceId, tenantId, {
      punch_out: new Date().toISOString(),
      status: 'ANOMALY_MISSED_PUNCH',
    });
  }

  private async findOpenShift(userId: string, tenantId: string): Promise<Attendance | null> {
    const { data, error } = await this.supabase.client
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .is('punch_out', null)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? toAttendance(data as DatabaseAttendanceRow) : null;
  }

  private async updateRecord(
    id: string,
    tenantId: string,
    patch: Record<string, unknown>,
    notFound: object = { code: 'ERR_ATTENDANCE_NOT_FOUND', message: 'Attendance record not found' }
  ): Promise<Attendance> {
    const { data, error } = await this.supabase.client
      .from('attendance')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(notFound);
    return toAttendance(data as DatabaseAttendanceRow);
  }
}
