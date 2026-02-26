-- Fix: legacy code/trigger references "profile" (singular)
-- while current schema uses "profiles" (plural).
--
-- Run this in Supabase SQL Editor if signup fails with:
--   relation "profile" does not exist
--
-- This creates a compatibility view so old SQL keeps working.

BEGIN;

-- Ensure canonical table exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT UNIQUE,
  telegram_username TEXT,
  telegram_enabled BOOLEAN DEFAULT false,
  telegram_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If a legacy object named "profile" is missing, create an alias view
DO $$
DECLARE
  obj_kind "char";
BEGIN
  SELECT c.relkind
  INTO obj_kind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'profile'
  LIMIT 1;

  IF obj_kind IS NULL THEN
    EXECUTE 'CREATE VIEW public.profile AS SELECT * FROM public.profiles';
  ELSIF obj_kind = 'v' THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.profile AS SELECT * FROM public.profiles';
  ELSE
    RAISE NOTICE 'Object public.profile exists and is not a view (relkind=%). No changes made.', obj_kind;
  END IF;
END $$;

-- Helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON public.profiles (telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_username ON public.profiles (telegram_username);

COMMIT;
