-- Create missing profiles table (safe, idempotent)
-- Use this when signup fails with: relation "profiles" does not exist

BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT,
  telegram_chat_id TEXT UNIQUE,
  telegram_username TEXT,
  telegram_enabled BOOLEAN DEFAULT false,
  telegram_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON public.profiles (telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_username ON public.profiles (telegram_username);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can view own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can create own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users can update own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id)';
  END IF;
END $$;

COMMIT;
