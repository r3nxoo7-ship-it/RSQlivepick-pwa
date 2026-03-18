import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * GET /api/filters/cleanup-stale?user_id=...
 * Returns filters that have never triggered (trigger_count = 0, last_triggered IS NULL)
 * and are older than 7 days.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'user_id required' }, { status: 401 });
    }

    // Find filters with trigger_count = 0, older than 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('filters')
      .select('id, name, is_active, trigger_count, last_triggered, created_at, conditions')
      .eq('user_id', userId)
      .eq('trigger_count', 0)
      .is('last_triggered', null)
      .lt('created_at', sevenDaysAgo)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error querying stale filters:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      staleFilters: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    console.error('❌ Error in /filters/cleanup-stale GET:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/filters/cleanup-stale
 * Body: { user_id, action: 'deactivate' | 'delete', filter_ids?: string[] }
 * 
 * If filter_ids provided, operates on those specific filters.
 * Otherwise operates on all never-triggered filters older than 7 days.
 */
export async function POST(request: NextRequest) {
  try {
    const { user_id, action, filter_ids } = await request.json();

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id required' }, { status: 401 });
    }

    if (action !== 'deactivate' && action !== 'delete') {
      return NextResponse.json({ error: 'action must be "deactivate" or "delete"' }, { status: 400 });
    }

    // If specific IDs provided, validate they belong to user and are stale
    let targetIds: string[] = [];

    if (filter_ids && Array.isArray(filter_ids) && filter_ids.length > 0) {
      // Validate ownership and stale status
      const { data: owned, error: checkErr } = await supabaseAdmin
        .from('filters')
        .select('id')
        .eq('user_id', user_id)
        .eq('trigger_count', 0)
        .is('last_triggered', null)
        .in('id', filter_ids);

      if (checkErr) {
        return NextResponse.json({ error: checkErr.message }, { status: 500 });
      }
      targetIds = (owned || []).map(f => f.id);
    } else {
      // All stale filters older than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error: fetchErr } = await supabaseAdmin
        .from('filters')
        .select('id')
        .eq('user_id', user_id)
        .eq('trigger_count', 0)
        .is('last_triggered', null)
        .lt('created_at', sevenDaysAgo);

      if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }
      targetIds = (data || []).map(f => f.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ affected: 0, message: 'No stale filters found' });
    }

    if (action === 'deactivate') {
      const { error: updateErr } = await supabaseAdmin
        .from('filters')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in('id', targetIds)
        .eq('user_id', user_id);

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({
        affected: targetIds.length,
        action: 'deactivated',
        filter_ids: targetIds,
      });
    }

    // action === 'delete'
    const { error: deleteErr } = await supabaseAdmin
      .from('filters')
      .delete()
      .in('id', targetIds)
      .eq('user_id', user_id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({
      affected: targetIds.length,
      action: 'deleted',
      filter_ids: targetIds,
    });
  } catch (err) {
    console.error('❌ Error in /filters/cleanup-stale POST:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
