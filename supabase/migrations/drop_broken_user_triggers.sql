-- Fix: drop broken auto-profile trigger(s) on public.users.
--
-- Symptoms: INSERT into users fails with:
--   ERROR: relation "profiles" does not exist
-- even though the profiles table exists.
--
-- Cause: a trigger on users was created to auto-insert a profiles row,
-- but the trigger function runs with a search_path that does not include
-- the public schema, so it cannot find public.profiles.
--
-- This migration drops ALL triggers on public.users.
-- The register API creates profile rows explicitly, so no trigger is needed.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'users'
  LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.users CASCADE';
    RAISE NOTICE 'Dropped trigger: %', r.trigger_name;
  END LOOP;
END $$;
