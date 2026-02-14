import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this route uses request parameters
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 60 seconds

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterId = searchParams.get('filterId');

    if (!filterId) {
      return NextResponse.json({ error: 'Missing filterId' }, { status: 400 });
    }

    console.log('🔍 API /filters/get-by-id: Getting filter:', filterId);

    // Select only needed columns to reduce bandwidth
    const { data, error } = await supabaseAdmin
      .from('filters')
      .select('id, user_id, name, description, conditions, is_active, is_shared, is_public, notification_enabled, telegram_enabled, last_triggered, trigger_count, success_rate, created_at, updated_at, color, template_id, forked_from_id, forked_from_user, version, is_editable')
      .eq('id', filterId)
      .single();

    if (error) {
      console.error('❌ Error getting filter:', error);
      return NextResponse.json(
        { error: error.message || 'Filter not found' },
        { status: 400 }
      );
    }

    console.log('✅ Filter fetched successfully');
    return NextResponse.json({ data, error: null }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=60',
      }
    });
  } catch (err) {
    console.error('❌ Error in /filters/get-by-id:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
