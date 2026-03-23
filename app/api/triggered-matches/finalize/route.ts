import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { computeAutoSuccess, getEvaluationType, getEffectiveSuccess } from '@/lib/analytics';

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
 * Evaluates if a triggered match was successful based on goals added after trigger.
 * Uses the new goals-based approach instead of checking filter conditions at FT.
 */
function evaluateFilterCondition(
  filter: any,
  triggerMatch: {
    match_time: number;
    score_home: number;
    score_away: number;
    final_score_home: number;
    final_score_away: number;
  }
): boolean {
  const evalType = getEvaluationType(filter.template_id, filter.name);
  const result = computeAutoSuccess(
    triggerMatch.match_time,
    triggerMatch.score_home,
    triggerMatch.score_away,
    triggerMatch.final_score_home,
    triggerMatch.final_score_away,
    evalType
  );
  return result ?? false;
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
      // Only write scores that are actual numbers (not null/0-fallback)
      for (const cm of completed_matches) {
        const hasValidScores = typeof cm.score_home === 'number' && typeof cm.score_away === 'number';

        // If scanner reports 0-0, verify against ESPN/API-Football before storing
        // (0-0 can be a real result, but also a common false value from stale API data)
        if (hasValidScores && cm.score_home === 0 && cm.score_away === 0) {
          // Look up the match to get team names for ESPN cross-check
          const { data: tmRow } = await supabaseAdmin
            .from('triggered_matches')
            .select('home_team, away_team')
            .eq('user_id', user_id)
            .eq('match_id', String(cm.match_id))
            .eq('match_status', 'ongoing')
            .limit(1)
            .single();

          if (tmRow) {
            // Try ESPN verification
            let verifiedScore: { home: number; away: number } | null = null;
            try {
              const { data: espnMatch } = await supabaseAdmin
                .from('espn_matches')
                .select('home_team_name, away_team_name, home_score, away_score, status')
                .eq('id', String(cm.match_id))
                .single();

              if (
                espnMatch &&
                espnMatch.status === 'completed' &&
                teamNamesRoughlyMatch(tmRow.home_team, espnMatch.home_team_name) &&
                teamNamesRoughlyMatch(tmRow.away_team, espnMatch.away_team_name) &&
                typeof espnMatch.home_score === 'number' &&
                typeof espnMatch.away_score === 'number'
              ) {
                verifiedScore = { home: espnMatch.home_score, away: espnMatch.away_score };
              }
            } catch { /* ignore */ }

            // Try API-Football fallback
            if (!verifiedScore) {
              verifiedScore = await fetchFinalScoreFromApiFootball(String(cm.match_id));
            }

            if (verifiedScore) {
              // Use verified score instead of scanner's 0-0
              const { error } = await supabaseAdmin
                .from('triggered_matches')
                .update({
                  match_status: 'finished',
                  final_score_home: verifiedScore.home,
                  final_score_away: verifiedScore.away,
                })
                .eq('user_id', user_id)
                .eq('match_id', String(cm.match_id))
                .eq('match_status', 'ongoing');
              if (!error) updatedCount++;
            } else {
              // Can't verify — don't write 0-0, let the auto-finalize (2h) handle it
              // Just mark as finished without score so backfill can fix it later
              const { error } = await supabaseAdmin
                .from('triggered_matches')
                .update({ match_status: 'finished' })
                .eq('user_id', user_id)
                .eq('match_id', String(cm.match_id))
                .eq('match_status', 'ongoing');
              if (!error) updatedCount++;
            }
          }
          continue; // Skip the normal write below
        }

        const updateData: Record<string, any> = { match_status: 'finished' };
        if (hasValidScores) {
          updateData.final_score_home = cm.score_home;
          updateData.final_score_away = cm.score_away;
        }

        const { error } = await supabaseAdmin
          .from('triggered_matches')
          .update(updateData)
          .eq('user_id', user_id)
          .eq('match_id', String(cm.match_id))
          .eq('match_status', 'ongoing');

        if (!error) updatedCount++;
      }
    } else {
      // Auto-finalize: mark old 'ongoing'/'LIVE' matches (>2 hours) as finished
      // Most matches end within ~105 min of kickoff; 2h after last trigger is safe
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: ongoingMatches } = await supabaseAdmin
        .from('triggered_matches')
        .select('id, match_id, home_team, away_team')
        .eq('user_id', user_id)
        .in('match_status', ['ongoing', 'LIVE', '1H', '2H', 'HT'])
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
    // Get all user's filters with their conditions and template_id
    const { data: filters } = await supabaseAdmin
      .from('filters')
      .select('id, trigger_count, conditions, name, template_id')
      .eq('user_id', user_id);

    if (filters && filters.length > 0) {
      for (const filter of filters) {
        // Get all triggered matches for this filter
        const { data: triggers } = await supabaseAdmin
          .from('triggered_matches')
          .select('id, match_time, score_home, score_away, final_score_home, final_score_away, match_status, user_feedback, auto_success')
          .eq('filter_id', filter.id)
          .eq('user_id', user_id);

        if (!triggers || triggers.length === 0) continue;

        const finishedTriggers = triggers.filter(t => t.match_status === 'finished');
        if (finishedTriggers.length === 0) continue;

        // Calculate auto_success for each finished trigger and store it
        let successCount = 0;
        let evaluableCount = 0;
        for (const t of finishedTriggers) {
          if (t.final_score_home == null || t.final_score_away == null) continue;
          if (t.score_home == null || t.score_away == null) continue;
          evaluableCount++;

          const autoSuccess = evaluateFilterCondition(filter, {
            match_time: t.match_time ?? 60,
            score_home: t.score_home as number,
            score_away: t.score_away as number,
            final_score_home: t.final_score_home as number,
            final_score_away: t.final_score_away as number,
          });

          // Store auto_success if not already set
          if (t.auto_success == null) {
            await supabaseAdmin
              .from('triggered_matches')
              .update({ auto_success: autoSuccess })
              .eq('id', t.id);
          }

          // Use effective success: user_feedback > auto_success
          const effective = getEffectiveSuccess(t.user_feedback, autoSuccess);
          if (effective === true) successCount++;
        }

        const successRate = evaluableCount > 0
          ? Math.round((successCount / evaluableCount) * 10000) / 100
          : null;

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
