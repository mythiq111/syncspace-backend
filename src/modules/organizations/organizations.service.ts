// backend/src/modules/organizations/organizations.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Tenant } from '../../../shared/types';
import { DatabaseTenantRow } from '../../../shared/schemas/db';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { toTenant } from '../../common/supabase/mappers';
import { SettingsService, SettingsSection, TenantSettings } from '../../common/settings/settings.service';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService
  ) {}

  async createTenant(name: string, officeLat: number, officeLng: number, radius = 200, timezone = 'UTC'): Promise<Tenant> {
    const { data, error } = await this.supabase.client
      .from('tenants')
      .insert({ name, office_lat: officeLat, office_lng: officeLng, radius, timezone })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return toTenant(data as DatabaseTenantRow);
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    const { data, error } = await this.supabase.client.from('tenants').select('*').eq('id', tenantId).maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Tenant ${tenantId} not found`);
    return toTenant(data as DatabaseTenantRow);
  }

  async updateTenantConfig(tenantId: string, updates: Partial<Tenant>, actorId?: string): Promise<Tenant> {
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) {
      if (!String(updates.name).trim()) throw new BadRequestException('Company name is required');
      patch.name = String(updates.name).trim();
    }
    if (updates.officeLat !== undefined) patch.office_lat = updates.officeLat;
    if (updates.officeLng !== undefined) patch.office_lng = updates.officeLng;
    if (updates.radius !== undefined) patch.radius = updates.radius;
    if (updates.timezone !== undefined) patch.timezone = updates.timezone;
    if (Object.keys(patch).length === 0) return this.getTenant(tenantId);

    const { data, error } = await this.supabase.client
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select('*')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Tenant ${tenantId} not found`);
    await this.audit.log(tenantId, actorId ?? null, 'organization.updated', 'tenant', tenantId, { fields: Object.keys(patch) });
    return toTenant(data as DatabaseTenantRow);
  }

  // ---- company rules (Settings page) ----

  getSettings(tenantId: string): Promise<TenantSettings> {
    return this.settings.get(tenantId);
  }

  async updateSettings(tenantId: string, section: SettingsSection, values: Record<string, unknown>, actorId?: string) {
    const result = await this.settings.update(tenantId, section, values as never);
    await this.audit.log(tenantId, actorId ?? null, 'settings.updated', 'settings', undefined, { section, values });
    return result;
  }

  // ---- integrations (Slack) ----

  async getIntegrations(tenantId: string): Promise<{ slackConfigured: boolean; slackHint: string | null }> {
    const url = await this.notifications.getSlackWebhook(tenantId);
    return { slackConfigured: !!url, slackHint: url ? `…${url.slice(-6)}` : null };
  }

  async setSlackWebhook(tenantId: string, url: string | null, actorId?: string) {
    const clean = url?.trim() || null;
    if (clean && !NotificationsService.isValidSlackWebhook(clean)) {
      throw new BadRequestException('That does not look like a Slack incoming webhook URL (https://hooks.slack.com/services/…)');
    }
    const { error } = await this.supabase.client
      .from('tenant_secrets')
      .upsert({ tenant_id: tenantId, slack_webhook_url: clean }, { onConflict: 'tenant_id' });
    if (error) throw new BadRequestException(error.message);
    await this.audit.log(tenantId, actorId ?? null, clean ? 'integration.slack_connected' : 'integration.slack_removed', 'integration');
    return this.getIntegrations(tenantId);
  }

  async testSlack(tenantId: string, actorName: string) {
    const url = await this.notifications.getSlackWebhook(tenantId);
    if (!url) throw new BadRequestException('Save a Slack webhook URL first');
    try {
      await this.notifications.sendSlack(url, `:white_check_mark: PulseHR test message from ${actorName}. Slack notifications are working.`);
    } catch (e) {
      throw new BadRequestException(`Slack rejected the message: ${(e as Error).message}`);
    }
    return { ok: true };
  }

  listAudit(tenantId: string) {
    return this.audit.list(tenantId);
  }
}
