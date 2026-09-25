// backend/src/modules/organizations/organizations.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { Tenant } from '../../../shared/types';

const mockTenantsMap: Record<string, Tenant> = {
  'tenant-123': {
    id: 'tenant-123',
    name: 'Acme Corp',
    officeLat: 17.6868,
    officeLng: 83.2185,
    radius: 200,
    timezone: 'Asia/Kolkata',
  },
};

@Injectable()
export class OrganizationsService {
  async createTenant(name: string, officeLat: number, officeLng: number, radius = 200, timezone = 'UTC'): Promise<Tenant> {
    const id = `tenant-${Date.now()}`;
    const newTenant: Tenant = { id, name, officeLat, officeLng, radius, timezone };
    mockTenantsMap[id] = newTenant;
    return newTenant;
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    const tenant = mockTenantsMap[tenantId];
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }
    return tenant;
  }

  async updateTenantConfig(tenantId: string, updates: Partial<Tenant>): Promise<Tenant> {
    const tenant = await this.getTenant(tenantId);
    Object.assign(tenant, updates);
    return tenant;
  }
}
