import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

function isProfileRelationError(msg: string): boolean {
  return (
    /relation\s+"?profiles?"?\s+does\s+not\s+exist/i.test(msg) ||
    /table\s+"?profiles?"?\s+does\s+not\s+exist/i.test(msg)
  );
}

// supabase typed as `any` to avoid unresolvable generic overloads when no schema types are generated
async function insertUser(supabase: any, username: string, fullName: string, hashedPassword: string) {
  return supabase
    .from('users')
    .insert([{ username, full_name: fullName, password_hash: hashedPassword, is_active: true }])
    .select('id')
    .single() as Promise<{ data: { id: string } | null; error: { message: string } | null }>;
}

export async function POST(request: Request) {
  const { username, password, fullName } = await request.json();

  if (!username || !password || !fullName) {
    return NextResponse.json(
      { error: 'Username, password și full name sunt obligatorii.' },
      { status: 400 }
    );
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check for existing username (case-insensitive)
  const { data: existingUsers } = await supabase
    .from('users')
    .select('id')
    .ilike('username', username)
    .limit(1);

  if (existingUsers && existingUsers.length > 0) {
    return NextResponse.json(
      { error: 'Utilizatorul deja există' },
      { status: 409 }
    );
  }

  // --- First attempt ---
  let { data: userData, error: insertError } = await insertUser(supabase, username, fullName, hashedPassword);

  // --- Self-heal: if profiles table is missing, create it via RPC then retry ---
  if (insertError && isProfileRelationError(insertError.message || '')) {
    console.warn('[register] profiles table missing — attempting auto-create via RPC');

    const { error: rpcError } = await supabase.rpc('create_profiles_if_missing');

    if (rpcError) {
      // RPC function itself doesn't exist yet — guide the developer
      console.error('[register] create_profiles_if_missing RPC failed:', rpcError.message);
      return NextResponse.json(
        {
          error:
            'Database schema mismatch: the "profiles" table is missing. ' +
            'Run supabase/migrations/create_profiles_rpc_helper.sql once in the Supabase SQL Editor, ' +
            'then try registering again. If the problem persists, also run create_profiles_table.sql.',
          code: 'PROFILE_RELATION_MISSING',
        },
        { status: 500 }
      );
    }

    // Retry after auto-create
    const retry = await insertUser(supabase, username, fullName, hashedPassword);
    userData = retry.data;
    insertError = retry.error;
  }

  if (insertError) {
    console.error('[register] users insert error:', insertError.message);
    return NextResponse.json({ error: insertError.message || 'Registration failed' }, { status: 400 });
  }

  // --- Explicitly upsert a profile row (don't rely on a DB trigger) ---
  if (userData?.id) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        { id: userData.id, full_name: fullName, username },
        { onConflict: 'id', ignoreDuplicates: true }
      );

    if (profileError) {
      // Non-fatal: user is created; profile can be created on first settings visit
      console.warn('[register] profile row creation warning:', profileError.message);
    }
  }

  return NextResponse.json({ message: 'User creat corect' });
}