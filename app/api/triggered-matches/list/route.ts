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
 * GET /api/triggered-matches/list?user_id=xxx&filter_id=yyy&range=7d&limit=50&offset=0
 * Reads triggered matches using service role key (bypasses RLS)
 *
 * Query params:
 * - user_id (required) OR filter_id (if filter_id provided, uses it to find user_id)
 * - filter_id: optional, filter by specific filter
 * - range: '24h' | '7d' | '30d' | 'all' (default: '7d')
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - match_id: optional, filter by specific match
 */
export async function GET(request: NextRequest) {
  try {
    let userId = request.nextUrl.searchParams.get('user_id');
    const filterId = request.nextUrl.searchParams.get('filter_id');
    const range = request.nextUrl.searchParams.get('range') || '7d';
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');
    const matchId = request.nextUrl.searchParams.get('match_id');
    const triggeredId = request.nextUrl.searchParams.get('id');

    // If filter_id is provided, get the user_id from the filter
    if (filterId && !userId) {
      const { data: filter } = await supabaseAdmin
        .from('filters')
        .select('user_id')
        .eq('id', filterId)
        .single();

      if (filter) {
        userId = filter.user_id;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'user_id or filter_id is required' }, { status: 400 });
    }

    // If looking for a specific triggered match by ID
    if (triggeredId) {
      const { data, error } = await supabaseAdmin
        .from('triggered_matches')
        .select('id, user_id, match_id, filter_id, filter_name, home_team, away_team, league_name, triggered_at, match_time, score_home, score_away, ht_score_home, ht_score_away, match_status, user_feedback, feedback_at, final_score_home, final_score_away, created_at')
        .eq('user_id', userId)
        .eq('id', triggeredId)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      return NextResponse.json({ match: data });
    }

    // Build query
    let query = supabaseAdmin
      .from('triggered_matches')
      .select('id, user_id, match_id, filter_id, filter_name, home_team, away_team, league_name, triggered_at, match_time, score_home, score_away, ht_score_home, ht_score_away, match_status, user_feedback, feedback_at, final_score_home, final_score_away, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filter_id filter if provided
    if (filterId) {
      query = query.eq('filter_id', filterId);
    }

    // Apply time range filter
    if (range !== 'all') {
      const minutesMap: Record<string, number> = {
        '30m': 30,
        '2h': 2 * 60,
        '24h': 24 * 60,
        '7d': 7 * 24 * 60,
        '30d': 30 * 24 * 60,
      };
      const minutes = minutesMap[range] || 24 * 60;
      const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
      query = query.gte('created_at', cutoff);
    }

    // Apply match_id filter
    if (matchId) {
      query = query.eq('match_id', matchId);
    }

    // Apply pagination — fetch enough to deduplicate, then trim
    query = query.range(offset, offset + limit * 2 - 1);

    const { data, error } = await query;

    if (error) {
      console.error('[triggered-matches/list] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Deduplicate: keep only the FIRST (newest) entry per match_id+filter_id combo
    const seen = new Set<string>();
    const deduped = (data || []).filter(row => {
      const key = `${row.match_id}::${row.filter_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);

    return NextResponse.json({
      triggers: deduped,
      matches: deduped, // For backward compatibility
      count: deduped.length,
    });
  } catch (err) {
    console.error('[triggered-matches/list] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
