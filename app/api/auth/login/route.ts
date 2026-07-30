import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = body?.username?.toString().trim();
    const password = body?.password?.toString();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .ilike('username', username)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('❌ Login API error:', error);
      return NextResponse.json(
        { error: 'Database error during authentication' },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const user = users[0] as any;
    const isValidPassword = bcrypt.compareSync(password, user.password_hash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const lastLogin = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ last_login: lastLogin })
      .eq('id', user.id);

    if (updateError) {
      console.warn('⚠️ Failed to update last_login:', updateError);
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email ?? null,
        is_admin: Boolean(user.is_admin),
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: lastLogin,
      }
    });
  } catch (err) {
    console.error('❌ Login API exception:', err);
    return NextResponse.json(
      { error: 'Authentication service unavailable' },
      { status: 500 }
    );
  }
}
