import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivate = process.env.VAPID_PRIVATE_KEY || '';

if (!vapidPublic || !vapidPrivate) {
  console.warn('VAPID keys are not configured. /api/push/send will fail without VAPID_PRIVATE_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY');
}


export async function POST(request: NextRequest) {
  try {
    // Configure VAPID at request time to avoid build-time errors when env vars
    // are not present in local dev/build environments.
    if (vapidPublic && vapidPrivate) {
      try {
        webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
      } catch (e) {
        console.warn('Failed to set VAPID details:', e);
      }
    }
    const body = await request.json();
    const { user_id, payload } = body;

    if (!payload || !payload.title || !payload.body) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Fetch subscriptions: either for specific user or all
    let query = supabaseAdmin.from('push_subscriptions').select('*');
    if (user_id) query = query.eq('user_id', user_id);

    const { data: subs, error } = await query;
    if (error) {
      console.error('Error fetching subscriptions:', {
        message: error.message,
        code: (error as any).code,
        hint: (error as any).hint,
        details: (error as any).details,
        user_id,
        fullError: error
      });
      
      // Check if it's a table not found error
      const errorStr = error.message?.toLowerCase() || '';
      if (errorStr.includes('relation') || errorStr.includes('does not exist')) {
        console.error('⚠️ SETUP REQUIRED: push_subscriptions table does not exist.');
        console.error('Run: PUSH_SUBSCRIPTIONS_SETUP.sql in Supabase SQL Editor');
        return NextResponse.json({ 
          error: 'Push subscriptions table not set up',
          details: 'Run PUSH_SUBSCRIPTIONS_SETUP.sql in Supabase',
          code: 'TABLE_NOT_FOUND'
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Error fetching subscriptions',
        details: error.message,
        code: (error as any).code
      }, { status: 500 });
    }

    if (!subs || subs.length === 0) {
      console.log('ℹ️ No push subscriptions found for user:', user_id);
      return NextResponse.json({ 
        message: 'No subscriptions found',
        info: 'User has not subscribed to push notifications yet'
      });
    }

    const results: any[] = [];

    await Promise.all(subs.map(async (s: any) => {
      const subscription = {
        endpoint: s.endpoint,
        keys: {
          p256dh: s.p256dh,
          auth: s.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        results.push({ endpoint: s.endpoint, status: 'sent' });
      } catch (err: any) {
        console.error('Error sending push to', s.endpoint, err && err.statusCode ? err.statusCode : err);
        results.push({ endpoint: s.endpoint, status: 'error', error: err?.body || err?.message || String(err) });
        // If subscription is gone, remove it
        if (err && (err.statusCode === 410 || err.statusCode === 404)) {
          try {
            await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
            console.log('Removed stale subscription:', s.endpoint);
          } catch (removeErr) {
            console.error('Failed to remove stale subscription:', removeErr);
          }
        }
      }
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Error in /api/push/send:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
