// backend/src/modules/organizations/organizations.controller.ts

import { Controller, Post, Get, Body, Req, UseGuards, Patch } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { AuthGuard, AuthenticatedUserContext } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse, Tenant } from '../../../shared/types';

@Controller('organizations')
@UseGuards(AuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  async createTenant(
    @Body() body: { name: string; officeLat: number; officeLng: number; radius?: number; timezone?: string }
  ): Promise<ApiResponse<Tenant>> {
    const tenant = await this.orgsService.createTenant(
      body.name,
      body.officeLat,
      body.officeLng,
      body.radius,
      body.timezone
    );
    return { data: tenant };
  }

  @Get('current')
  async getCurrentTenant(@Req() req: { user: AuthenticatedUserContext }): Promise<ApiResponse<Tenant>> {
    const tenant = await this.orgsService.getTenant(req.user.tenantId);
    return { data: tenant };
  }

  @Patch('current')
  @Roles('TENANT_ADMIN', 'SUPER_ADMIN')
  async updateConfig(
    @Req() req: { user: AuthenticatedUserContext },
    @Body() body: Partial<Tenant>
  ): Promise<ApiResponse<Tenant>> {
    const tenant = await this.orgsService.updateTenantConfig(req.user.tenantId, body);
    return { data: tenant };
  }
}
