// backend/src/modules/organizations/organizations.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Tenant } from '../../../shared/types';
import { DatabaseTenantRow } from '../../../shared/schemas/db';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { toTenant } from '../../common/supabase/mappers';

@Injectable()
export class OrganizationsService {
  constructor(private readonly supabase: SupabaseService) {}

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

  async updateTenantConfig(tenantId: string, updates: Partial<Tenant>): Promise<Tenant> {
    const patch: Record<string, unknown> = {};
    if (updates.name !== undefined) patch.name = updates.name;
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
    return toTenant(data as DatabaseTenantRow);
  }
}
