// backend/src/modules/jobs/shift-closure.worker.ts

import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { AttendanceService } from '../attendance/attendance.service';

export interface ShiftClosureJobPayload {
  tenantId: string;
  tenantTimezone: string;
}

@Injectable()
export class ShiftClosureWorker {
  private readonly logger = new Logger(ShiftClosureWorker.name);

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly notificationsService: NotificationsService
  ) {}

  async processShiftClosureJob(jobData: ShiftClosureJobPayload): Promise<{ closedCount: number }> {
    this.logger.log(`[BullMQ Worker] Executing 23:59 shift closure for tenant: ${jobData.tenantId} (Timezone: ${jobData.tenantTimezone})`);

    const openRecords = await this.attendanceService.getAttendanceHistory('all', jobData.tenantId);
    const unclosedPunches = openRecords.filter((r) => !r.punchOut && r.status === 'PRESENT');

    let closedCount = 0;
    for (const record of unclosedPunches) {
      await this.attendanceService.closeAsMissedPunch(record.id, jobData.tenantId);
      closedCount++;

      await this.notificationsService.notifyMissedPunchAlert(record.userId);
    }

    this.logger.log(`[BullMQ Worker] Successfully closed ${closedCount} active shifts as ANOMALY_MISSED_PUNCH.`);
    return { closedCount };
  }
}
