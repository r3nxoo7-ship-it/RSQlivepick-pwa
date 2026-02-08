import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this route uses request parameters
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Create a FRESH Supabase client for each request to avoid cache issues
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables on server!');
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    },
  });
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

    // First, count ALL filters for this user (including any with different states)
    const { count: totalCount } = await supabaseAdmin
      .from('filters')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    console.log('📊 Total filters in DB for this user:', totalCount);

    // Force fresh data by using the same query pattern as count
    // This bypasses Supabase's PostgREST cache
    const { data, error } = await supabaseAdmin
      .from('filters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1000); // Add limit to force query re-evaluation

    if (error) {
      console.error('❌ Error reading filters:', error);
      return NextResponse.json(
        { error: error.message || 'Error reading filters' },
        { status: 400 }
      );
    }

    console.log('✅ Filters read successfully:', data?.length || 0);
    console.log('🔍 Discrepancy check: totalCount=%d, data.length=%d', totalCount, data?.length || 0);

    // Log filter IDs and is_active status for debugging
    if (data && data.length > 0) {
      console.log('📋 Filter IDs:', data.map(f => `${f.id.substring(0, 8)}... (${f.name}) [active=${f.is_active}]`).join(', '));

      const activeCount = data.filter(f => f.is_active).length;
      const inactiveCount = data.filter(f => !f.is_active).length;
      console.log('📊 Active: %d, Inactive: %d', activeCount, inactiveCount);
    }

    // Return with no-cache headers to prevent stale data
    return NextResponse.json(
      { data: data || [], error: null },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
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
