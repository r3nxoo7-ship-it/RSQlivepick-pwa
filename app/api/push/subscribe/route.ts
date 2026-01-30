import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Server-side Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, subscription } = body;

    if (!user_id || !subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Normalize keys from subscription
    const endpoint: string = subscription.endpoint;
    const keys = subscription.keys || {};
    const p256dh = keys.p256dh || null;
    const auth = keys.auth || null;

    // Upsert subscription by endpoint (unique)
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert([
        {
          user_id,
          endpoint,
          p256dh,
          auth,
          raw: subscription,
          updated_at: new Date().toISOString(),
        }
      ], { onConflict: 'endpoint' })
      .select()
      .single();

    if (error) {
      console.error('Error saving push subscription:', error);
      return NextResponse.json({ error: 'Error saving subscription' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('Error in /api/push/subscribe:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
