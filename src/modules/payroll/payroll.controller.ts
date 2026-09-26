// backend/src/modules/payroll/payroll.controller.ts

import { Controller, Post, Get, Body, Req, UseGuards, Param } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { AuthGuard, AuthenticatedUserContext } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse } from '../../../shared/types';

@Controller('payroll')
@UseGuards(AuthGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post('calculate')
  @Roles('HR_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')
  async calculateSalary(
    @Req() req: { user: AuthenticatedUserContext },
    @Body() body: { baseSalary: number; allowances: number; deductions: number; unpaidLeaveDays: number }
  ): Promise<ApiResponse<any>> {
    const calc = await this.payrollService.calculateUserPayroll(
      req.user.id,
      req.user.tenantId,
      body.baseSalary,
      body.allowances,
      body.deductions,
      body.unpaidLeaveDays
    );

    return { data: calc };
  }

  @Post('run-batch')
  @Roles('HR_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')
  async runBatchPayroll(
    @Req() req: { user: AuthenticatedUserContext },
    @Body() body: { month: string; employees?: any[] }
  ): Promise<ApiResponse<any>> {
    const payslips = body.employees
      ? await this.payrollService.generateMonthlyBatchPayroll(req.user.tenantId, body.month, body.employees)
      : await this.payrollService.runMonthlyPayroll(req.user.tenantId, body.month, req.user.id);

    return { data: payslips };
  }

  @Get('payslips')
  async getMyPayslips(@Req() req: { user: AuthenticatedUserContext }): Promise<ApiResponse<any[]>> {
    const payslips = await this.payrollService.getPayslipsForUser(req.user.id, req.user.tenantId);
    return { data: payslips };
  }

  @Get('payslips/:id/signed-url')
  async getSignedUrl(
    @Req() req: { user: AuthenticatedUserContext },
    @Param('id') payslipId: string
  ): Promise<ApiResponse<{ signedUrl: string; expiresAt: string }>> {
    const signedUrl = await this.payrollService.getSignedPayslipUrl(
      payslipId,
      req.user.id,
      req.user.tenantId
    );

    return {
      data: {
        signedUrl,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    };
  }
}
