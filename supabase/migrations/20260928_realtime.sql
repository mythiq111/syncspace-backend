-- Live updates: lets Supabase Realtime push changes to every open screen (laptop, phone, other managers).
-- Run once in Supabase SQL Editor. Safe to re-run. Row-level security still decides who receives what.
-- (Without this the app still refreshes itself every few seconds; this makes it instant.)

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'attendance', 'leave_requests', 'payslips', 'tenants']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
