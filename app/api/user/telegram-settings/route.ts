import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, userId, chatId } = body || {};

    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('rsq_session');

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized - no session' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (action === 'get') {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, telegram_chat_id, telegram_enabled, telegram_verified_at, telegram_username')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, profile: data || null });
    }

    if (action === 'update') {
      if (!chatId) {
        return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
      }

      const updatePayload = {
        id: userId,
        telegram_chat_id: String(chatId),
        telegram_enabled: true,
        telegram_verified_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert(updatePayload, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, profile: data });
    }

    if (action === 'disconnect') {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          telegram_chat_id: null,
          telegram_enabled: false,
          telegram_verified_at: null,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, profile: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Telegram settings API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
