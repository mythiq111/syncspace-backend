// backend/src/modules/organizations/organizations.controller.ts

import { Controller, Post, Get, Put, Body, Req, UseGuards, Patch } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { AuthGuard, AuthenticatedUserContext } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiResponse, Tenant } from '../../../shared/types';
import { SettingsSection, TenantSettings } from '../../common/settings/settings.service';
import { AuditEntry } from '../../common/audit/audit.service';

type Req_ = { user: AuthenticatedUserContext };

@Controller('organizations')
@UseGuards(AuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  async createTenant(
    @Body() body: { name: string; officeLat: number; officeLng: number; radius?: number; timezone?: string }
  ): Promise<ApiResponse<Tenant>> {
    const tenant = await this.orgsService.createTenant(body.name, body.officeLat, body.officeLng, body.radius, body.timezone);
    return { data: tenant };
  }

  @Get('current')
  async getCurrentTenant(@Req() req: Req_): Promise<ApiResponse<Tenant>> {
    return { data: await this.orgsService.getTenant(req.user.tenantId) };
  }

  @Patch('current')
  @Roles('TENANT_ADMIN', 'SUPER_ADMIN')
  async updateConfig(@Req() req: Req_, @Body() body: Partial<Tenant>): Promise<ApiResponse<Tenant>> {
    return { data: await this.orgsService.updateTenantConfig(req.user.tenantId, body, req.user.id) };
  }

  // ---- company rules ----

  @Get('current/settings')
  async getSettings(@Req() req: Req_): Promise<ApiResponse<TenantSettings>> {
    return { data: await this.orgsService.getSettings(req.user.tenantId) };
  }

  @Patch('current/settings')
  @Roles('TENANT_ADMIN', 'SUPER_ADMIN')
  async updateSettings(
    @Req() req: Req_,
    @Body() body: { section: SettingsSection; values: Record<string, unknown> }
  ): Promise<ApiResponse<TenantSettings>> {
    return { data: await this.orgsService.updateSettings(req.user.tenantId, body.section, body.values, req.user.id) };
  }

  // ---- integrations ----

  @Get('current/integrations')
  @Roles('TENANT_ADMIN', 'SUPER_ADMIN')
  async getIntegrations(@Req() req: Req_) {
    return { data: await this.orgsService.getIntegrations(req.user.tenantId) };
  }

  @Put('current/integrations')
  @Roles('TENANT_ADMIN', 'SUPER_ADMIN')
  async setIntegrations(@Req() req: Req_, @Body() body: { slackWebhookUrl: string | null }) {
    return { data: await this.orgsService.setSlackWebhook(req.user.tenantId, body.slackWebhookUrl, req.user.id) };
  }

  @Post('current/integrations/test')
  @Roles('TENANT_ADMIN', 'SUPER_ADMIN')
  async testSlack(@Req() req: Req_) {
    return { data: await this.orgsService.testSlack(req.user.tenantId, req.user.email) };
  }

  // ---- audit log ----

  @Get('audit-log')
  @Roles('HR_MANAGER', 'TENANT_ADMIN', 'SUPER_ADMIN')
  async auditLog(@Req() req: Req_): Promise<ApiResponse<AuditEntry[]>> {
    return { data: await this.orgsService.listAudit(req.user.tenantId) };
  }
}
