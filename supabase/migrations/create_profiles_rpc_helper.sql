-- One-time setup: creates a SECURITY DEFINER helper function so the
-- register API can auto-create the profiles table if it is missing.
--
-- Run this ONCE in the Supabase SQL Editor.
-- After this, new user registration will self-heal without any manual steps.

CREATE OR REPLACE FUNCTION public.create_profiles_if_missing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profiles table if absent
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    CREATE TABLE public.profiles (
      id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
      full_name TEXT,
      username TEXT,
      telegram_chat_id TEXT UNIQUE,
      telegram_username TEXT,
      telegram_enabled BOOLEAN NOT NULL DEFAULT false,
      telegram_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_profiles_telegram_chat_id ON public.profiles (telegram_chat_id);
    CREATE INDEX idx_profiles_telegram_username ON public.profiles (telegram_username);

    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own profile"
      ON public.profiles FOR SELECT USING (auth.uid() = id);

    CREATE POLICY "Users can create own profile"
      ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

    CREATE POLICY "Users can update own profile"
      ON public.profiles FOR UPDATE USING (auth.uid() = id);

    RAISE NOTICE 'profiles table created successfully';
  ELSE
    RAISE NOTICE 'profiles table already exists, no action needed';
  END IF;
END;
$$;

-- Allow authenticated and service_role to call this function
GRANT EXECUTE ON FUNCTION public.create_profiles_if_missing() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_profiles_if_missing() TO authenticated;
