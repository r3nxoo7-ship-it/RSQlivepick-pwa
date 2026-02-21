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
 * POST /api/triggered-matches/finalize
 *
 * Finalizes triggered matches that have completed:
 * 1. Finds 'ongoing' triggered matches older than 2 hours
 * 2. Fetches final match data from ESPN
 * 3. Updates triggered_matches with final scores and status='finished'
 * 4. Recalculates filter success_rate
 *
 * Body: { user_id: string, completed_matches?: { match_id: string, score_home: number, score_away: number }[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, completed_matches } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    let updatedCount = 0;

    if (completed_matches && completed_matches.length > 0) {
      // Update triggered matches with provided final scores
      for (const cm of completed_matches) {
        const { error } = await supabaseAdmin
          .from('triggered_matches')
          .update({
            score_home: cm.score_home,
            score_away: cm.score_away,
            match_status: 'finished',
          })
          .eq('user_id', user_id)
          .eq('match_id', String(cm.match_id))
          .eq('match_status', 'ongoing');

        if (!error) updatedCount++;
      }
    } else {
      // Auto-finalize: mark old 'ongoing' matches (>2 hours) as finished
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { error } = await supabaseAdmin
        .from('triggered_matches')
        .update({ match_status: 'finished' })
        .eq('user_id', user_id)
        .eq('match_status', 'ongoing')
        .lt('triggered_at', cutoff);

      if (!error) updatedCount++;
    }

    // Now recalculate success_rate for all user's filters
    // Get all user's filters
    const { data: filters } = await supabaseAdmin
      .from('filters')
      .select('id, trigger_count')
      .eq('user_id', user_id);

    if (filters && filters.length > 0) {
      for (const filter of filters) {
        // Get all triggered matches for this filter
        const { data: triggers } = await supabaseAdmin
          .from('triggered_matches')
          .select('id, match_time, score_home, score_away, match_status')
          .eq('filter_id', filter.id)
          .eq('user_id', user_id);

        if (!triggers || triggers.length === 0) continue;

        const finishedTriggers = triggers.filter(t => t.match_status === 'finished');
        if (finishedTriggers.length === 0) continue;

        // Calculate success: a trigger is "successful" if it happened at a meaningful
        // match time (not minute 0-2) and the match had goals
        let successCount = 0;
        for (const t of finishedTriggers) {
          const matchTime = t.match_time || 0;
          const totalGoals = (t.score_home || 0) + (t.score_away || 0);

          // Success criteria:
          // 1. Triggered after minute 2 (not a false early trigger)
          // 2. Match had at least 1 goal (some activity happened)
          if (matchTime > 2 && totalGoals > 0) {
            successCount++;
          }
        }

        const successRate = finishedTriggers.length > 0
          ? Math.round((successCount / finishedTriggers.length) * 10000) / 100
          : 0;

        // Update filter success_rate
        await supabaseAdmin
          .from('filters')
          .update({
            success_rate: successRate,
            trigger_count: triggers.length, // Also fix trigger_count to match actual
            updated_at: new Date().toISOString(),
          })
          .eq('id', filter.id);
      }
    }

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      message: `Finalized triggers and recalculated success rates`,
    });
  } catch (err) {
    console.error('[triggered-matches/finalize] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
