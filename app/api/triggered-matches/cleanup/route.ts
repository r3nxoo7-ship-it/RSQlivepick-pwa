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
 * POST /api/triggered-matches/cleanup
 * Removes duplicate triggered_matches rows (keeps the oldest entry per
 * user_id + match_id + filter_id combo). Also cleans up notifications_log.
 *
 * Body: { user_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // Fetch all triggered matches for this user, oldest first
    const { data: allMatches, error: fetchError } = await supabaseAdmin
      .from('triggered_matches')
      .select('id, match_id, filter_id, created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!allMatches || allMatches.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No matches found' });
    }

    // Group by match_id + filter_id — keep the first (oldest), mark rest as duplicates
    const seen = new Map<string, string>(); // key → first id
    const duplicateIds: string[] = [];

    for (const row of allMatches) {
      const key = `${row.match_id}::${row.filter_id}`;
      if (seen.has(key)) {
        duplicateIds.push(row.id);
      } else {
        seen.set(key, row.id);
      }
    }

    if (duplicateIds.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No duplicates found' });
    }

    // Delete duplicates in batches of 50
    let totalDeleted = 0;
    for (let i = 0; i < duplicateIds.length; i += 50) {
      const batch = duplicateIds.slice(i, i + 50);
      const { error: deleteError } = await supabaseAdmin
        .from('triggered_matches')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error('[cleanup] Delete error for batch:', deleteError);
      } else {
        totalDeleted += batch.length;
      }
    }

    // Also fix filter trigger_counts to match actual unique entries
    const filterCounts = new Map<string, number>();
    for (const [, firstId] of seen) {
      const row = allMatches.find(m => m.id === firstId);
      if (row) {
        filterCounts.set(row.filter_id, (filterCounts.get(row.filter_id) || 0) + 1);
      }
    }

    for (const [filterId, count] of filterCounts) {
      await supabaseAdmin
        .from('filters')
        .update({
          trigger_count: count,
          updated_at: new Date().toISOString(),
        })
        .eq('id', filterId)
        .eq('user_id', user_id);
    }

    return NextResponse.json({
      deleted: totalDeleted,
      total: allMatches.length,
      remaining: allMatches.length - totalDeleted,
      filtersUpdated: filterCounts.size,
      message: `Removed ${totalDeleted} duplicate entries`,
    });
  } catch (err) {
    console.error('[cleanup] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
