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
 * GET /api/triggered-matches/list?user_id=xxx&range=7d&limit=50&offset=0
 * Reads triggered matches using service role key (bypasses RLS)
 *
 * Query params:
 * - user_id (required)
 * - range: '24h' | '7d' | '30d' | 'all' (default: '7d')
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - match_id: optional, filter by specific match
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('user_id');
    const range = request.nextUrl.searchParams.get('range') || '7d';
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');
    const matchId = request.nextUrl.searchParams.get('match_id');
    const triggeredId = request.nextUrl.searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // If looking for a specific triggered match by ID
    if (triggeredId) {
      const { data, error } = await supabaseAdmin
        .from('triggered_matches')
        .select('id, user_id, match_id, filter_id, filter_name, home_team, away_team, league_name, triggered_at, match_time, score_home, score_away, match_status, created_at')
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
      .select('id, user_id, match_id, filter_id, filter_name, home_team, away_team, league_name, triggered_at, match_time, score_home, score_away, match_status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

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

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('[triggered-matches/list] Query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      matches: data || [],
      count: data?.length || 0,
    });
  } catch (err) {
    console.error('[triggered-matches/list] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
