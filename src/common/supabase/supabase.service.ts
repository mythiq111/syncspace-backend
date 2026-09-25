// backend/src/common/supabase/supabase.service.ts

import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the service_role key (bypasses RLS).
 * Tenant isolation and role checks are enforced in the API layer (AuthGuard + services).
 * NEVER expose this client or key to the browser or mobile app.
 */
@Injectable()
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env');
    }
    this.client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
}

/** Throws a 500 with the database message when a query fails; returns the data otherwise. */
export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) {
    throw new InternalServerErrorException(result.error.message);
  }
  return result.data as T;
}
