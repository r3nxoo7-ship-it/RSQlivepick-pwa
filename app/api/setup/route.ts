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

  if (!profilesExist) {
    // Try RPC helper first
    const { error: rpcError } = await (supabase as any).rpc('create_profiles_if_missing');
    if (!rpcError) {
      return NextResponse.json({ ok: true, message: 'profiles table created successfully via RPC.' });
    }
    // RPC not available — return SQL
    return NextResponse.json(
      {
        ok: false,
        message: 'Automatic setup failed. Please run the SQL below in your Supabase SQL Editor (takes ~5 seconds).',
        sql: CREATE_PROFILES_SQL,
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, profilesExist: true, message: 'profiles table exists.' });
}

// POST — full diagnostic: attempts a dry-run insert to catch trigger/policy errors
export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const testUsername = `__diag_test_${Date.now()}`;

  // Try inserting a test user row
  const { data: inserted, error: insertErr } = await (supabase as any)
    .from('users')
    .insert([{
      username: testUsername,
      full_name: 'Diagnostic Test',
      password_hash: 'diag',
      is_active: false,
    }])
    .select('id')
    .single();

  if (insertErr) {
    return NextResponse.json({
      ok: false,
      stage: 'users_insert',
      error: insertErr.message,
      hint: 'The users table INSERT is failing. This is the real cause of registration errors.',
    });
  }

  // Try inserting a matching profile row
  const { error: profileErr } = await (supabase as any)
    .from('profiles')
    .insert([{ id: inserted.id, full_name: 'Diagnostic Test', username: testUsername }]);

  // Clean up regardless
  await (supabase as any).from('users').delete().eq('id', inserted.id);

  if (profileErr) {
    return NextResponse.json({
      ok: false,
      stage: 'profiles_insert',
      error: profileErr.message,
      hint: 'The users row was created but the profiles INSERT failed.',
    });
  }

  return NextResponse.json({ ok: true, message: 'Full diagnostic passed — registration should work.' });
}
