// backend/src/modules/employees/employees.controller.ts

import { Controller, Post, Get, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { EmployeeInput, EmployeesService } from './employees.service';
import { AuthGuard, AuthenticatedUserContext } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse, EmployeePrivate, User } from '../../../shared/types';

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
    @Body() body: EmployeeInput
  ): Promise<ApiResponse<User>> {
    const created = await this.employeesService.inviteEmployee(req.user.tenantId, body, req.user.id);
    return { data: created };
  }

  @Get(':id/private')
  @Roles('TENANT_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN')
  async getPrivate(
    @Req() req: { user: AuthenticatedUserContext },
    @Param('id') id: string
  ): Promise<ApiResponse<EmployeePrivate>> {
    return { data: await this.employeesService.getPrivateDetails(id, req.user.tenantId) };
  }

  @Patch(':id')
  @Roles('TENANT_ADMIN', 'HR_MANAGER', 'SUPER_ADMIN')
  async updateEmployee(
    @Req() req: { user: AuthenticatedUserContext },
    @Param('id') id: string,
    @Body() body: EmployeeInput
  ): Promise<ApiResponse<User>> {
    const { email: _email, password: _password, ...updates } = body; // login credentials are not editable here
    return { data: await this.employeesService.updateEmployee(id, req.user.tenantId, updates, req.user.id) };
  }
}
