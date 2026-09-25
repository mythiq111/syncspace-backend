// backend/src/modules/attendance/attendance.controller.ts

import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AuthGuard, AuthenticatedUserContext } from '../../common/guards/auth.guard';
import { ApiResponse } from '../../../shared/types';

@Controller('attendance')
@UseGuards(AuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('clock-in')
  async clockIn(
    @Req() req: { user: AuthenticatedUserContext },
    @Body() body: { lat: number; lng: number; timestamp?: string }
  ): Promise<ApiResponse<{ status: string; id: string }>> {
    const record = await this.attendanceService.clockIn(
      req.user.id,
      req.user.tenantId,
      body.lat,
      body.lng,
      body.timestamp
    );

    return {
      data: {
        status: record.status,
        id: record.id,
      },
    };
  }

  @Post('clock-out')
  async clockOut(
    @Req() req: { user: AuthenticatedUserContext },
    @Body() body: { lat: number; lng: number; timestamp?: string }
  ): Promise<ApiResponse<{ status: string; id: string }>> {
    const record = await this.attendanceService.clockOut(
      req.user.id,
      req.user.tenantId,
      body.lat,
      body.lng,
      body.timestamp
    );

    return {
      data: {
        status: record.status,
        id: record.id,
      },
    };
  }

  @Get('history')
  async getHistory(
    @Req() req: { user: AuthenticatedUserContext }
  ): Promise<ApiResponse<any[]>> {
    const history = await this.attendanceService.getAttendanceHistory(
      req.user.id,
      req.user.tenantId
    );

    return { data: history };
  }

  @Post('regularize')
  async regularize(
    @Req() req: { user: AuthenticatedUserContext },
    @Body() body: { attendanceId: string; punchIn?: string; punchOut?: string }
  ): Promise<ApiResponse<any>> {
    const updated = await this.attendanceService.regularizeMissedPunch(
      body.attendanceId,
      req.user.tenantId,
      body.punchIn,
      body.punchOut
    );

    return { data: updated };
  }
}
