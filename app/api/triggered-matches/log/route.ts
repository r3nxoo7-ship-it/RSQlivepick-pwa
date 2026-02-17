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
 * POST /api/triggered-matches/log
 * Logs a triggered match to the database using service role key (bypasses RLS)
 * Also increments filter trigger_count
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      match_id,
      filter_id,
      filter_name,
      home_team,
      away_team,
      league_name,
      triggered_at,
      match_time,
      score_home,
      score_away,
      match_status,
    } = body;

    if (!user_id || !match_id || !filter_id) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, match_id, filter_id' },
        { status: 400 }
      );
    }

    // Server-side dedup: check if this match+filter combo already exists for this user
    const { data: existing } = await supabaseAdmin
      .from('triggered_matches')
      .select('id')
      .eq('user_id', user_id)
      .eq('match_id', String(match_id))
      .eq('filter_id', filter_id)
      .limit(1);

    if (existing && existing.length > 0) {
      // Already logged - return existing ID without inserting duplicate
      return NextResponse.json({
        success: true,
        id: existing[0].id,
        duplicate: true,
      });
    }

    // Insert triggered match
    const { data, error } = await supabaseAdmin
      .from('triggered_matches')
      .insert([{
        user_id,
        match_id: String(match_id),
        filter_id,
        filter_name: filter_name || 'Unknown Filter',
        home_team: home_team || '',
        away_team: away_team || '',
        league_name: league_name || '',
        triggered_at: triggered_at || new Date().toISOString(),
        match_time: match_time || null,
        score_home: score_home ?? null,
        score_away: score_away ?? null,
        match_status: match_status || 'ongoing',
        created_at: new Date().toISOString(),
      }])
      .select('id');

    if (error) {
      console.error('[triggered-matches/log] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const triggeredMatchId = data?.[0]?.id;

    // Also increment filter trigger_count
    try {
      const { data: filter } = await supabaseAdmin
        .from('filters')
        .select('trigger_count')
        .eq('id', filter_id)
        .single();

      const newCount = (filter?.trigger_count || 0) + 1;

      await supabaseAdmin
        .from('filters')
        .update({
          trigger_count: newCount,
          last_triggered: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', filter_id);
    } catch (incrementErr) {
      // Non-critical - log but don't fail the response
      console.error('[triggered-matches/log] Error incrementing trigger_count:', incrementErr);
    }

    return NextResponse.json({
      success: true,
      id: triggeredMatchId,
    });
  } catch (err) {
    console.error('[triggered-matches/log] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
