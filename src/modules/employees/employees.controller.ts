// backend/src/modules/employees/employees.controller.ts

import { Controller, Post, Get, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { AuthGuard, AuthenticatedUserContext } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse, User, UserRole } from '../../../shared/types';

@Controller('employees')
@UseGuards(AuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  async getTenantEmployees(@Req() req: { user: AuthenticatedUserContext }): Promise<ApiResponse<User[]>> {
    const list = await this.employeesService.getEmployeesByTenant(req.user.tenantId);
    return { data: list };
  }

  @Get('me')
  async getMyProfile(@Req() req: { user: AuthenticatedUserContext }): Promise<ApiResponse<User>> {
    const user = await this.employeesService.getEmployeeById(req.user.id, req.user.tenantId);
    return { data: user };
  }

  @Post('invite')
  @Roles('TENANT_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN')
  async inviteEmployee(
    @Req() req: { user: AuthenticatedUserContext },
    @Body() body: { email: string; name: string; role: UserRole; managerId?: string; baseSalary?: number; allowances?: number; deductions?: number; password?: string }
  ): Promise<ApiResponse<User>> {
    const created = await this.employeesService.inviteEmployee(
      req.user.tenantId,
      body.email,
      body.name,
      body.role,
      body.managerId,
      body.baseSalary,
      body.allowances,
      body.deductions,
      body.password
    );
    return { data: created };
  }

  @Patch(":id")
  @Roles("TENANT_ADMIN", "HR_MANAGER", "SUPER_ADMIN")
  async updateEmployee(
    @Req() req: { user: AuthenticatedUserContext },
    @Param("id") id: string,
    @Body() body: Partial<User>
  ): Promise<ApiResponse<User>> {
    const updated = await this.employeesService.updateEmployee(id, req.user.tenantId, {
      name: body.name,
      role: body.role,
      managerId: body.managerId,
      baseSalary: body.baseSalary,
      allowances: body.allowances,
      deductions: body.deductions,
      annualLeaveBalance: body.annualLeaveBalance,
    });
    return { data: updated };
  }
}
