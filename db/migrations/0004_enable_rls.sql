-- Supabase exposes the public schema over its Data API (anon key). The app talks to Postgres directly as the table
-- owner, which bypasses RLS, so enabling RLS with no policies locks the Data API out of every table. Harmless locally.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
