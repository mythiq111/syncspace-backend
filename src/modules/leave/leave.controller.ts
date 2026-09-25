// backend/src/modules/leave/leave.controller.ts

import { Controller, Post, Get, Body, Req, UseGuards, Param } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { AuthGuard, AuthenticatedUserContext } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse, LeaveType } from '../../../shared/types';

@Controller('leave')
@UseGuards(AuthGuard, RolesGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post('request')
  async submitRequest(
    @Req() req: { user: AuthenticatedUserContext },
    @Body() body: { type: LeaveType; startDate: string; endDate: string; reason?: string }
  ): Promise<ApiResponse<any>> {
    const leave = await this.leaveService.createLeaveRequest(
      req.user.id,
      req.user.tenantId,
      body.type,
      body.startDate,
      body.endDate,
      body.reason
    );

    return { data: leave };
  }

  @Get('list')
  async listRequests(@Req() req: { user: AuthenticatedUserContext }): Promise<ApiResponse<any[]>> {
    const leaves = await this.leaveService.getLeaveRequests(
      req.user.id,
      req.user.tenantId,
      req.user.role
    );

    return { data: leaves };
  }

  @Post(':id/approve-manager')
  @Roles('LINE_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')
  async approveByManager(
    @Req() req: { user: AuthenticatedUserContext },
    @Param('id') leaveId: string
  ): Promise<ApiResponse<any>> {
    const leave = await this.leaveService.approveByManager(
      leaveId,
      req.user.id,
      req.user.tenantId
    );

    return { data: leave };
  }

  @Post(':id/approve-hr')
  @Roles('HR_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')
  async approveByHR(
    @Req() req: { user: AuthenticatedUserContext },
    @Param('id') leaveId: string
  ): Promise<ApiResponse<any>> {
    const leave = await this.leaveService.approveByHR(
      leaveId,
      req.user.id,
      req.user.tenantId
    );

    return { data: leave };
  }

  @Post(':id/reject')
  @Roles('LINE_MANAGER', 'HR_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')
  async rejectLeave(
    @Req() req: { user: AuthenticatedUserContext },
    @Param('id') leaveId: string
  ): Promise<ApiResponse<any>> {
    const leave = await this.leaveService.rejectLeave(
      leaveId,
      req.user.id,
      req.user.tenantId
    );

    return { data: leave };
  }
}
