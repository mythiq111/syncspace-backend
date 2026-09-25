// backend/src/common/guards/auth.guard.ts

import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../../../shared/types';
import { SupabaseService } from '../supabase/supabase.service';

export interface AuthenticatedUserContext {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

/**
 * Verifies the Supabase access token (Authorization: Bearer <jwt>) and loads the
 * caller's tenant and role from the `users` table. Identity is never taken from headers.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];

    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length).trim();
    const { data: auth, error } = await this.supabase.client.auth.getUser(token);
    if (error || !auth?.user) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    const { data: profile } = await this.supabase.client
      .from('users')
      .select('id, tenant_id, role, email')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (!profile) {
      throw new UnauthorizedException('No employee profile is linked to this account');
    }

    request.user = {
      id: profile.id,
      tenantId: profile.tenant_id,
      role: profile.role,
      email: profile.email,
    } as AuthenticatedUserContext;
    return true;
  }
}
