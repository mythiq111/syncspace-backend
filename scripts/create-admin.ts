// backend/scripts/create-admin.ts
// Creates (or repairs) the first company + TENANT_ADMIN login.
// Usage:  ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='...' [ADMIN_NAME=..] [TENANT_NAME=..] npm run create-admin

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  const name = process.env.ADMIN_NAME || 'Admin';
  const tenantName = process.env.TENANT_NAME || 'My Company';
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD');

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 1. Auth login (reuse if it already exists, and reset its password to the one given)
  let userId: string;
  const created = await db.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true });
  if (created.data.user) {
    userId = created.data.user.id;
    console.log('Created auth user', ADMIN_EMAIL);
  } else {
    const list = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list.data?.users.find((u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    if (!existing) throw new Error(`Could not create auth user: ${created.error?.message}`);
    userId = existing.id;
    const upd = await db.auth.admin.updateUserById(userId, { password: ADMIN_PASSWORD, email_confirm: true });
    if (upd.error) throw upd.error;
    console.log('Auth user already existed; password updated');
  }

  // 2. Profile row (skip if already linked)
  const { data: profile } = await db.from('users').select('id, tenant_id, role').eq('id', userId).maybeSingle();
  if (profile) {
    console.log(`Profile already exists (role ${profile.role}, tenant ${profile.tenant_id}). Nothing to do.`);
    return;
  }

  const tenant = await db.from('tenants').insert({ name: tenantName }).select('id').single();
  if (tenant.error) throw tenant.error;
  const user = await db
    .from('users')
    .insert({ id: userId, tenant_id: tenant.data.id, role: 'TENANT_ADMIN', email: ADMIN_EMAIL, name })
    .select('id')
    .single();
  if (user.error) {
    await db.from('tenants').delete().eq('id', tenant.data.id);
    throw user.error;
  }
  console.log(`Created tenant "${tenantName}" (${tenant.data.id}) and TENANT_ADMIN ${ADMIN_EMAIL}`);
}

main().catch((e) => {
  console.error('FAILED:', e.message || e);
  process.exit(1);
});
