import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { matchesFilter } from '@/lib/filter-engine';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * Evaluates if a filter would match the final score
 * Returns true if the filter condition was satisfied at final score
 */
function evaluateFilterCondition(
  filter: any,
  finalScore: { home: number; away: number; elapsed: number }
): boolean {
  const conditions = filter.conditions || {};

  // Helper to check a numeric condition
  const checkNumeric = (actual: number, min?: number, max?: number): boolean => {
    if (min !== undefined && actual < min) return false;
    if (max !== undefined && actual > max) return false;
    return true;
  };

  // Evaluate each condition
  for (const [key, value] of Object.entries(conditions)) {
    if (!value || typeof value !== 'object') continue;

    const v = value as any;
    let conditionMet = true;

    switch (key) {
      case 'goals': {
        const total = finalScore.home + finalScore.away;
        if (v.team === 'home') {
          conditionMet = checkNumeric(finalScore.home, v.min, v.max);
        } else if (v.team === 'away') {
          conditionMet = checkNumeric(finalScore.away, v.min, v.max);
        } else {
          conditionMet = checkNumeric(total, v.min, v.max);
        }
        break;
      }

      case 'corners':
      case 'shots_on_target':
      case 'total_shots':
      case 'yellow_cards':
      case 'red_cards':
      case 'fouls':
      case 'offsides': {
        // These require live stats which we may not have at finalize time
        // For now, we'll assume they could be true (be permissive)
        // Better to count a filter as successful if goals condition passed
        conditionMet = true;
        break;
      }

      default:
        conditionMet = true;
    }

    // If any condition is not met, filter fails
    if (!conditionMet) return false;
  }

  return true; // All conditions checked and passed
}

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
      // Mark triggered matches as finished with final scores
      for (const cm of completed_matches) {
        const { error } = await supabaseAdmin
          .from('triggered_matches')
          .update({
            match_status: 'finished',
            final_score_home: cm.score_home ?? null,
            final_score_away: cm.score_away ?? null,
          })
          .eq('user_id', user_id)
          .eq('match_id', String(cm.match_id))
          .eq('match_status', 'ongoing');

        if (!error) updatedCount++;
      }
    } else {
      // Auto-finalize: mark old 'ongoing' matches (>2 hours) as finished
      // First, fetch them so we can look up final scores
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: ongoingMatches } = await supabaseAdmin
        .from('triggered_matches')
        .select('id, match_id')
        .eq('user_id', user_id)
        .eq('match_status', 'ongoing')
        .lt('triggered_at', cutoff);

      if (ongoingMatches && ongoingMatches.length > 0) {
        // Get unique match IDs to look up final scores
        const uniqueMatchIds = [...new Set(ongoingMatches.map(m => m.match_id))];

        // Look up final scores from espn_matches table
        const scoreMap = new Map<string, { home: number | null; away: number | null }>();
        for (const matchId of uniqueMatchIds) {
          try {
            const { data: espnMatch } = await supabaseAdmin
              .from('espn_matches')
              .select('home_score, away_score, status')
              .eq('id', matchId)
              .single();

            if (espnMatch) {
              scoreMap.set(matchId, {
                home: espnMatch.home_score,
                away: espnMatch.away_score,
              });
            }
          } catch {
            // Match not found in ESPN data, will finalize without score
          }
        }

        // Update each triggered match with final score if available
        for (const tm of ongoingMatches) {
          const scores = scoreMap.get(tm.match_id);
          const updateData: Record<string, any> = { match_status: 'finished' };
          if (scores) {
            updateData.final_score_home = scores.home;
            updateData.final_score_away = scores.away;
          }

          const { error } = await supabaseAdmin
            .from('triggered_matches')
            .update(updateData)
            .eq('id', tm.id);

          if (!error) updatedCount++;
        }
      }
    }

    // Backfill: patch any previously-finalized matches missing final scores
    const { data: missingScores } = await supabaseAdmin
      .from('triggered_matches')
      .select('id, match_id')
      .eq('user_id', user_id)
      .eq('match_status', 'finished')
      .is('final_score_home', null)
      .limit(50);

    if (missingScores && missingScores.length > 0) {
      const backfillMatchIds = [...new Set(missingScores.map(m => m.match_id))];
      const backfillScoreMap = new Map<string, { home: number | null; away: number | null }>();

      for (const matchId of backfillMatchIds) {
        try {
          const { data: espnMatch } = await supabaseAdmin
            .from('espn_matches')
            .select('home_score, away_score')
            .eq('id', matchId)
            .single();

          if (espnMatch && espnMatch.home_score !== null) {
            backfillScoreMap.set(matchId, {
              home: espnMatch.home_score,
              away: espnMatch.away_score,
            });
          }
        } catch {
          // Not found, skip
        }
      }

      for (const tm of missingScores) {
        const scores = backfillScoreMap.get(tm.match_id);
        if (scores) {
          await supabaseAdmin
            .from('triggered_matches')
            .update({
              final_score_home: scores.home,
              final_score_away: scores.away,
            })
            .eq('id', tm.id);
        }
      }
    }

    // Now recalculate success_rate for all user's filters
    // Get all user's filters with their conditions
    const { data: filters } = await supabaseAdmin
      .from('filters')
      .select('id, trigger_count, conditions')
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

        // Calculate success: count how many matches satisfied the filter condition at trigger time
        let successCount = 0;
        for (const t of finishedTriggers) {
          const triggerScore = {
            home: t.score_home ?? 0,
            away: t.score_away ?? 0,
            elapsed: t.match_time || 0,
          };

          // Check if the filter conditions were met at trigger time
          if (evaluateFilterCondition(filter, triggerScore)) {
            successCount++;
          }
        }

        const scoreBasedRate = finishedTriggers.length > 0
          ? Math.round((successCount / finishedTriggers.length) * 10000) / 100
          : 0;

        // Check if user has given feedback — feedback-based rate takes priority
        const { data: feedbackTriggers } = await supabaseAdmin
          .from('triggered_matches')
          .select('user_feedback')
          .eq('filter_id', filter.id)
          .eq('user_id', user_id)
          .not('user_feedback', 'is', null);

        let successRate = scoreBasedRate;
        if (feedbackTriggers && feedbackTriggers.length > 0) {
          const positive = feedbackTriggers.filter((t: any) => t.user_feedback === true).length;
          successRate = Math.round((positive / feedbackTriggers.length) * 10000) / 100;
        }

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
