// backend/src/modules/employees/employees.controller.ts

import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
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
    @Body() body: { email: string; name: string; role: UserRole; managerId?: string; baseSalary?: number }
  ): Promise<ApiResponse<User>> {
    const created = await this.employeesService.inviteEmployee(
      req.user.tenantId,
      body.email,
      body.name,
      body.role,
      body.managerId,
      body.baseSalary
    );
    return { data: created };
  }
}
