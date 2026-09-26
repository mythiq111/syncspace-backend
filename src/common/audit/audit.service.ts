// backend/src/common/audit/audit.service.ts
// Writes an accountability trail (who did what) to audit_logs. Never breaks the action being logged.

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface AuditEntry {
  id: string;
  action: string;
  entity: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  actorName: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async log(tenantId: string, actorId: string | null, action: string, entity?: string, entityId?: string, details: Record<string, unknown> = {}) {
    const { error } = await this.supabase.client.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: actorId,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      details,
    });
    if (error) this.logger.warn(`Could not write audit log "${action}": ${error.message}`);
  }

  async list(tenantId: string, limit = 100): Promise<AuditEntry[]> {
    const { data } = await this.supabase.client
      .from('audit_logs')
      .select('id, action, entity, details, created_at, actor:users!audit_logs_actor_id_fkey(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      details: r.details ?? {},
      createdAt: r.created_at,
      actorName: r.actor?.name ?? null,
    }));
  }
}
