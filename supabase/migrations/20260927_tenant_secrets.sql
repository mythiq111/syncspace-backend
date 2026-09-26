-- Secrets that belong to a company but must never be readable by its employees (e.g. Slack webhook).
-- RLS is enabled with NO policies: only the backend (service_role key) can read or write this table.
-- Run once in Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS tenant_secrets (
  tenant_id          UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  slack_webhook_url  TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tenant_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tenant_secrets FROM anon, authenticated;

DROP TRIGGER IF EXISTS tenant_secrets_updated_at ON tenant_secrets;
CREATE TRIGGER tenant_secrets_updated_at BEFORE UPDATE ON tenant_secrets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
