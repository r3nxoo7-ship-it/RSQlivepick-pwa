import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Route must remain dynamic (uses request parameters / user_id)
export const dynamic = 'force-dynamic';

// Allow caching for 60 seconds before revalidation (HTTP cache)
// This reduces Supabase read costs significantly for active users
export const revalidate = 60;

// Singleton client with connection pooling (REVERT to original approach)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId || userId === 'anon' || typeof userId !== 'string') {
      console.error('❌ API: Invalid user_id:', userId);
      return NextResponse.json(
        { error: 'Invalid user authentication' },
        { status: 401 }
      );
    }

    console.log('📖 API /filters/get: Reading filters for user:', userId);

    // Fetch only needed columns to reduce bandwidth and response size
    const { data, error } = await supabaseAdmin
      .from('filters')
      .select('id, user_id, name, description, conditions, is_active, is_shared, is_public, notification_enabled, telegram_enabled, last_triggered, trigger_count, success_rate, created_at, updated_at, color, template_id, forked_from_id, forked_from_user, version, is_editable')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error reading filters:', error);
      return NextResponse.json(
        { error: error.message || 'Error reading filters' },
        { status: 400 }
      );
    }

    console.log('✅ Filters read successfully:', data?.length || 0);

    return NextResponse.json(
      { data: data || [], error: null },
      {
        headers: {
          // Cache private per user: 60 seconds fresh + 60 second stale-while-revalidate
          // This significantly reduces Supabase read costs
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=60',
          'X-Content-Type-Options': 'nosniff',
          'X-Cached': 'true',
          'X-timestamp': new Date().toISOString(),
        }
      }
    );
  } catch (err) {
    console.error('❌ Error in /filters/get:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
