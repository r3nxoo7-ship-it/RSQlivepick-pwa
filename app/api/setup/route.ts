import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const CREATE_PROFILES_SQL = `
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT,
  telegram_chat_id BIGINT,
  telegram_username TEXT,
  telegram_enabled BOOLEAN NOT NULL DEFAULT false,
  telegram_verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can view own profile') THEN
    EXECUTE 'CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can create own profile') THEN
    EXECUTE 'CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update own profile') THEN
    EXECUTE 'CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id)';
  END IF;
END $$;
`.trim();

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: check if profiles table already exists
  const { error: checkError } = await (supabase as any)
    .from('profiles')
    .select('id')
    .limit(0);

  const profilesExist = !checkError || !checkError.message?.includes('does not exist');

  if (profilesExist) {
    return NextResponse.json({ ok: true, message: 'profiles table already exists — no action needed.' });
  }

  // Step 2: try the RPC helper (if user already ran create_profiles_rpc_helper.sql)
  const { error: rpcError } = await (supabase as any).rpc('create_profiles_if_missing');

  if (!rpcError) {
    return NextResponse.json({ ok: true, message: 'profiles table created successfully via RPC.' });
  }

  // Step 3: RPC does not exist — return the SQL for manual execution
  return NextResponse.json(
    {
      ok: false,
      message: 'Automatic setup failed. Please run the SQL below in your Supabase SQL Editor (takes ~5 seconds).',
      sql: CREATE_PROFILES_SQL,
    },
    { status: 200 } // 200 so the setup page can render the SQL without an error boundary
  );
}
