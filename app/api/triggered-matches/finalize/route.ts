import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { matchesFilter } from '@/lib/filter-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 25;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

type FinalScore = { home: number; away: number };

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function teamNamesRoughlyMatch(a: string, b: string): boolean {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

async function fetchFinalScoreFromApiFootball(matchId: string): Promise<FinalScore | null> {
  const apiKey = process.env.NEXT_PUBLIC_API_FOOTBALL_KEY;
  const apiHost = process.env.NEXT_PUBLIC_API_FOOTBALL_HOST || 'v3.football.api-sports.io';
  const fixtureId = Number(matchId);

  if (!apiKey) return null;
  if (!Number.isFinite(fixtureId)) return null;

  const url = `https://${apiHost}/fixtures?id=${fixtureId}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': apiHost,
      },
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data: any = await res.json();
    const fixture = data?.response?.[0];
    const statusShort: string | undefined = fixture?.fixture?.status?.short;

    // Only trust completed matches
    if (!statusShort || !['FT', 'AET', 'PEN'].includes(statusShort)) return null;

    const homeGoals = fixture?.goals?.home;
    const awayGoals = fixture?.goals?.away;
    if (typeof homeGoals === 'number' && typeof awayGoals === 'number') {
      return { home: homeGoals, away: awayGoals };
    }

    const ftHome = fixture?.score?.fulltime?.home;
    const ftAway = fixture?.score?.fulltime?.away;
    if (typeof ftHome === 'number' && typeof ftAway === 'number') {
      return { home: ftHome, away: ftAway };
    }

    return null;
  } catch {
    return null;
  }
}

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
 * 1. Finds 'ongoing' triggered matches older than 30 minutes
 * 2. Fetches final match data from ESPN
 * 3. Updates triggered_matches with final scores and status='finished'
 * 4. Recalculates filter success_rate
 *
 * Body: { user_id: string, completed_matches?: { match_id: string, score_home: number, score_away: number }[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, completed_matches, repair } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    let updatedCount = 0;

    // Optional repair mode: re-fetch FT scores for recent finished matches and correct wrong stored finals.
    // Opt-in to avoid unexpected writes and API usage.
    if (repair === true) {
      const { data: recentFinished } = await supabaseAdmin
        .from('triggered_matches')
        .select('match_id, home_team, away_team, final_score_home, final_score_away')
        .eq('user_id', user_id)
        .eq('match_status', 'finished')
        .order('triggered_at', { ascending: false })
        .limit(200);

      const unique = new Map<string, { homeTeam: string; awayTeam: string }>();
      for (const t of recentFinished || []) {
        if (!unique.has(t.match_id)) {
          unique.set(t.match_id, { homeTeam: t.home_team, awayTeam: t.away_team });
        }
        if (unique.size >= 25) break; // cap per call
      }

      let repairedMatches = 0;
      for (const [matchId, teams] of unique) {
        let score: FinalScore | null = null;

        // 1) ESPN by id only if teams match (prevents ID collision)
        try {
          const { data: espnMatch } = await supabaseAdmin
            .from('espn_matches')
            .select('home_team_name, away_team_name, home_score, away_score, status')
            .eq('id', matchId)
            .single();

          if (
            espnMatch &&
            espnMatch.status === 'completed' &&
            teamNamesRoughlyMatch(teams.homeTeam, espnMatch.home_team_name) &&
            teamNamesRoughlyMatch(teams.awayTeam, espnMatch.away_team_name) &&
            typeof espnMatch.home_score === 'number' &&
            typeof espnMatch.away_score === 'number'
          ) {
            score = { home: espnMatch.home_score, away: espnMatch.away_score };
          }
        } catch {
          // ignore
        }

        // 2) API-Football fallback (numeric fixture ids)
        if (!score) {
          score = await fetchFinalScoreFromApiFootball(matchId);
        }

        if (!score) continue;

        const { data: currentRows } = await supabaseAdmin
          .from('triggered_matches')
          .select('final_score_home, final_score_away')
          .eq('user_id', user_id)
          .eq('match_id', matchId)
          .eq('match_status', 'finished');

        const needsUpdate = (currentRows || []).some((r: any) =>
          r.final_score_home == null ||
          r.final_score_away == null ||
          r.final_score_home !== score!.home ||
          r.final_score_away !== score!.away
        );

        if (!needsUpdate) continue;

        const { error } = await supabaseAdmin
          .from('triggered_matches')
          .update({ final_score_home: score.home, final_score_away: score.away })
          .eq('user_id', user_id)
          .eq('match_id', matchId)
          .eq('match_status', 'finished');

        if (!error) repairedMatches++;
      }

      return NextResponse.json({
        success: true,
        repaired: repairedMatches,
        message: 'Repair complete',
      });
    }

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
      // Auto-finalize: mark old 'ongoing' matches (>30 minutes) as finished
      // Most matches end within ~105 min of kickoff; 30 min after trigger is safe
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: ongoingMatches } = await supabaseAdmin
        .from('triggered_matches')
        .select('id, match_id, home_team, away_team')
        .eq('user_id', user_id)
        .eq('match_status', 'ongoing')
        .lt('triggered_at', cutoff);

      if (ongoingMatches && ongoingMatches.length > 0) {
        // Get unique match IDs to look up final scores
        const uniqueMatchIds = [...new Set(ongoingMatches.map(m => m.match_id))];

        const teamsByMatchId = new Map<string, { homeTeam: string; awayTeam: string }>();
        for (const m of ongoingMatches as any[]) {
          if (!teamsByMatchId.has(m.match_id)) {
            teamsByMatchId.set(m.match_id, { homeTeam: m.home_team, awayTeam: m.away_team });
          }
        }

        // Look up final scores from ESPN when (and only when) the teams match.
        // match_id may come from other providers; querying ESPN by raw id can collide and produce wrong scores.
        const scoreMap = new Map<string, { home: number | null; away: number | null }>();
        for (const matchId of uniqueMatchIds) {
          try {
            const { data: espnMatch } = await supabaseAdmin
              .from('espn_matches')
              .select('home_team_name, away_team_name, home_score, away_score, status')
              .eq('id', matchId)
              .single();

            const teams = teamsByMatchId.get(matchId);
            if (
              espnMatch &&
              teams &&
              espnMatch.status === 'completed' &&
              teamNamesRoughlyMatch(teams.homeTeam, espnMatch.home_team_name) &&
              teamNamesRoughlyMatch(teams.awayTeam, espnMatch.away_team_name)
            ) {
              scoreMap.set(matchId, { home: espnMatch.home_score ?? null, away: espnMatch.away_score ?? null });
            }
          } catch {
            // Match not found in ESPN data, will finalize without score
          }

          // Fallback: API-Football FT score for numeric fixture IDs
          if (!scoreMap.has(matchId)) {
            const afScore = await fetchFinalScoreFromApiFootball(matchId);
            if (afScore) {
              scoreMap.set(matchId, { home: afScore.home, away: afScore.away });
            }
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
      .select('id, match_id, home_team, away_team')
      .eq('user_id', user_id)
      .eq('match_status', 'finished')
      .is('final_score_home', null)
      .limit(50);

    if (missingScores && missingScores.length > 0) {
      const backfillMatchIds = [...new Set(missingScores.map(m => m.match_id))];
      const backfillScoreMap = new Map<string, { home: number | null; away: number | null }>();

      for (const matchId of backfillMatchIds) {
        const tm = (missingScores as any[]).find((m) => m.match_id === matchId);
        try {
          const { data: espnMatch } = await supabaseAdmin
            .from('espn_matches')
            .select('home_team_name, away_team_name, home_score, away_score, status')
            .eq('id', matchId)
            .single();

          if (
            tm &&
            espnMatch &&
            espnMatch.status === 'completed' &&
            teamNamesRoughlyMatch(tm.home_team, espnMatch.home_team_name) &&
            teamNamesRoughlyMatch(tm.away_team, espnMatch.away_team_name) &&
            espnMatch.home_score !== null
          ) {
            backfillScoreMap.set(matchId, { home: espnMatch.home_score, away: espnMatch.away_score });
          }
        } catch {
          // Not found, skip
        }

        if (!backfillScoreMap.has(matchId)) {
          const afScore = await fetchFinalScoreFromApiFootball(matchId);
          if (afScore) backfillScoreMap.set(matchId, { home: afScore.home, away: afScore.away });
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
          .select('id, match_time, score_home, score_away, final_score_home, final_score_away, match_status')
          .eq('filter_id', filter.id)
          .eq('user_id', user_id);

        if (!triggers || triggers.length === 0) continue;

        const finishedTriggers = triggers.filter(t => t.match_status === 'finished');
        if (finishedTriggers.length === 0) continue;

        // Calculate success: count how many matches had the predicted outcome at full time
        let successCount = 0;
        let evaluableCount = 0;
        for (const t of finishedTriggers) {
          // Only evaluate if we have a final score — trigger-time score is always
          // true (that's why it triggered) so using it inflates success rate to 100%
          if (t.final_score_home == null || t.final_score_away == null) continue;
          evaluableCount++;
          const finalScore = {
            home: t.final_score_home as number,
            away: t.final_score_away as number,
            elapsed: 90,
          };
          if (evaluateFilterCondition(filter, finalScore)) {
            successCount++;
          }
        }

        const scoreBasedRate = evaluableCount > 0
          ? Math.round((successCount / evaluableCount) * 10000) / 100
          : null; // null = no data yet, don't overwrite existing rate

        // Check if user has given feedback — feedback-based rate takes priority
        const { data: feedbackTriggers } = await supabaseAdmin
          .from('triggered_matches')
          .select('user_feedback')
          .eq('filter_id', filter.id)
          .eq('user_id', user_id)
          .not('user_feedback', 'is', null);

        let successRate: number | null = scoreBasedRate;
        if (feedbackTriggers && feedbackTriggers.length > 0) {
          const positive = feedbackTriggers.filter((t: any) => t.user_feedback === true).length;
          successRate = Math.round((positive / feedbackTriggers.length) * 10000) / 100;
        }

        // Only update success_rate if we actually have data to compute it from
        const updatePayload: Record<string, any> = {
          trigger_count: triggers.length,
          updated_at: new Date().toISOString(),
        };
        if (successRate !== null) updatePayload.success_rate = successRate;

        // Update filter
        await supabaseAdmin
          .from('filters')
          .update(updatePayload)
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
