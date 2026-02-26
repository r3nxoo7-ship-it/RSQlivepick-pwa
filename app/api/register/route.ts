import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

function isProfilesRelationError(msg: string): boolean {
  return /relation\s+["']?public\.profiles["']?\s+does\s+not\s+exist|relation\s+["']?profiles["']?\s+does\s+not\s+exist/i.test(msg);
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
  const { data: existingUsers } = await (supabase as any)
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

  // Insert the user row
  const { data: userData, error: insertError } = await (supabase as any)
    .from('users')
    .insert([{ username, full_name: fullName, password_hash: hashedPassword, is_active: true }])
    .select('id')
    .single();

  if (insertError) {
    const msg: string = insertError.message || '';
    console.error('[register] insert error:', msg);

    // profiles table missing — can be auto-fixed, guide the user
    if (isProfilesRelationError(msg)) {
      return NextResponse.json(
        {
          error: 'Database setup needed: the "profiles" table is missing. Visit /setup to fix this in one step.',
          code: 'PROFILE_RELATION_MISSING',
          setupUrl: '/setup',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: msg || 'Registration failed' }, { status: 400 });
  }

  // Upsert a profile row — non-fatal if profiles table does not yet exist
  if (userData?.id) {
    try {
      await (supabase as any)
        .from('profiles')
        .upsert(
          { id: userData.id, full_name: fullName, username },
          { onConflict: 'id', ignoreDuplicates: true }
        );
    } catch (_) {
      // Profile will be created on first settings visit
    }
  }

  return NextResponse.json({ message: 'User creat corect' });
}