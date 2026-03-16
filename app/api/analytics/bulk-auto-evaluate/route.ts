import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { computeAutoSuccess, getEvaluationType } from '@/lib/analytics';
import { RAW_TEMPLATES } from '@/lib/filter-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_FOOTBALL_KEY = process.env.NEXT_PUBLIC_API_FOOTBALL_KEY;
const API_FOOTBALL_HOST = process.env.NEXT_PUBLIC_API_FOOTBALL_HOST || 'v3.football.api-sports.io';

// Build template evaluationType lookup
const templateEvalMap = new Map<string, ReturnType<typeof getEvaluationType>>();
for (const t of RAW_TEMPLATES) {
  templateEvalMap.set(t.id, t.evaluationType);
}

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

async function fetchFinalScoreFromApiFootball(matchId: string): Promise<{ home: number; away: number } | null> {
  if (!API_FOOTBALL_KEY) return null;
  const fixtureId = Number(matchId);
  if (!Number.isFinite(fixtureId)) return null;

  try {
    const res = await fetch(`https://${API_FOOTBALL_HOST}/fixtures?id=${fixtureId}`, {
      headers: { 'x-rapidapi-key': API_FOOTBALL_KEY, 'x-rapidapi-host': API_FOOTBALL_HOST },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const fixture = data?.response?.[0];
    const statusShort: string | undefined = fixture?.fixture?.status?.short;
    if (!statusShort || !['FT', 'AET', 'PEN'].includes(statusShort)) return null;

    const homeGoals = fixture?.goals?.home;
    const awayGoals = fixture?.goals?.away;
    if (typeof homeGoals === 'number' && typeof awayGoals === 'number') {
      return { home: homeGoals, away: awayGoals };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * POST /api/analytics/bulk-auto-evaluate
 *
 * Retroactively computes auto_success for all finished triggered matches.
 * Uses the user's evaluation criteria:
 *   - If triggered at min 1-55: success if goals_added >= 2
 *   - If triggered at min 56+:  success if goals_added >= 1
 *   - Excluded templates (defensive/under/draw) get separate logic
 *
 * Body: { user_id: string }
 * Returns: { evaluated, skipped, successCount, failCount }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  }

  // STEP 1: Finalize old LIVE matches (older than 2 hours = definitely completed)
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: liveMatches } = await supabase
    .from('triggered_matches')
    .select('id, match_id, home_team, away_team')
    .eq('user_id', user_id)
    .in('match_status', ['LIVE', 'ongoing'])
    .lt('triggered_at', cutoff)
    .limit(5000);

  let finalized = 0;
  let scoreFetched = 0;

  if (liveMatches && liveMatches.length > 0) {
    // Get unique match IDs and look up final scores
    const uniqueMatchIds = [...new Set(liveMatches.map(m => m.match_id))];
    const scoreMap = new Map<string, { home: number; away: number }>();

    // Build team lookup for ESPN matching
    const teamsByMatch = new Map<string, { homeTeam: string; awayTeam: string }>();
    for (const m of liveMatches) {
      if (!teamsByMatch.has(m.match_id)) {
        teamsByMatch.set(m.match_id, { homeTeam: m.home_team, awayTeam: m.away_team });
      }
    }

    // Fetch scores: ESPN first, then API-Football fallback (limited to avoid rate limits)
    let apiFetchCount = 0;
    for (const matchId of uniqueMatchIds) {
      // Try ESPN
      try {
        const { data: espnMatch } = await supabase
          .from('espn_matches')
          .select('home_team_name, away_team_name, home_score, away_score, status')
          .eq('id', matchId)
          .single();

        const teams = teamsByMatch.get(matchId);
        if (
          espnMatch && teams &&
          espnMatch.status === 'completed' &&
          teamNamesRoughlyMatch(teams.homeTeam, espnMatch.home_team_name) &&
          teamNamesRoughlyMatch(teams.awayTeam, espnMatch.away_team_name) &&
          typeof espnMatch.home_score === 'number' &&
          typeof espnMatch.away_score === 'number'
        ) {
          scoreMap.set(matchId, { home: espnMatch.home_score, away: espnMatch.away_score });
        }
      } catch {
        // Not found in ESPN
      }

      // API-Football fallback (limit to 50 lookups to stay within rate limits)
      if (!scoreMap.has(matchId) && apiFetchCount < 50) {
        const afScore = await fetchFinalScoreFromApiFootball(matchId);
        if (afScore) scoreMap.set(matchId, afScore);
        apiFetchCount++;
      }
    }

    // Update all LIVE matches to finished with scores
    for (const m of liveMatches) {
      const scores = scoreMap.get(m.match_id);
      const updateData: Record<string, any> = { match_status: 'finished' };
      if (scores) {
        updateData.final_score_home = scores.home;
        updateData.final_score_away = scores.away;
        scoreFetched++;
      }

      const { error: updateErr } = await supabase
        .from('triggered_matches')
        .update(updateData)
        .eq('id', m.id);

      if (!updateErr) finalized++;
    }
  }

  // STEP 2: Get all finished matches with final scores for auto-evaluation
  const { data: matches, error } = await supabase
    .from('triggered_matches')
    .select('id, filter_id, filter_name, match_time, score_home, score_away, final_score_home, final_score_away')
    .eq('user_id', user_id)
    .eq('match_status', 'finished')
    .not('final_score_home', 'is', null)
    .not('final_score_away', 'is', null)
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ evaluated: 0, skipped: 0, successCount: 0, failCount: 0, message: 'No matches to evaluate' });
  }

  // Look up template_id for each filter
  const filterIds = [...new Set(matches.map(m => m.filter_id))];
  const { data: filters } = await supabase
    .from('filters')
    .select('id, template_id, name')
    .in('id', filterIds);

  const filterTemplateMap = new Map<string, string>();
  const filterNameMap = new Map<string, string>();
  for (const f of filters || []) {
    if (f.template_id) filterTemplateMap.set(f.id, f.template_id);
    filterNameMap.set(f.id, f.name);
  }

  let evaluated = 0;
  let skipped = 0;
  let successCount = 0;
  let failCount = 0;

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize);
    const updates: { id: string; auto_success: boolean | null }[] = [];

    for (const m of batch) {
      const templateId = filterTemplateMap.get(m.filter_id);
      const filterName = filterNameMap.get(m.filter_id) || m.filter_name;
      const evalType = templateId
        ? (templateEvalMap.get(templateId) || getEvaluationType(templateId, filterName))
        : getEvaluationType(undefined, filterName);

      const result = computeAutoSuccess(
        m.match_time,
        m.score_home,
        m.score_away,
        m.final_score_home,
        m.final_score_away,
        evalType
      );

      if (result !== null) {
        updates.push({ id: m.id, auto_success: result });
        evaluated++;
        if (result) successCount++;
        else failCount++;
      } else {
        skipped++;
      }
    }

    // Bulk update this batch
    for (const u of updates) {
      await supabase
        .from('triggered_matches')
        .update({ auto_success: u.auto_success })
        .eq('id', u.id);
    }
  }

  // Recalculate success rates for all filters using effective success
  for (const filterId of filterIds) {
    const { data: allTriggers } = await supabase
      .from('triggered_matches')
      .select('user_feedback, auto_success')
      .eq('filter_id', filterId)
      .eq('user_id', user_id);

    if (!allTriggers || allTriggers.length === 0) continue;

    // Count effective successes: user_feedback overrides auto_success
    let ratedCount = 0;
    let positiveCount = 0;
    for (const t of allTriggers) {
      const effective = t.user_feedback ?? t.auto_success;
      if (effective !== null && effective !== undefined) {
        ratedCount++;
        if (effective === true) positiveCount++;
      }
    }

    if (ratedCount >= 2) {
      const successRate = Math.round((positiveCount / ratedCount) * 10000) / 100;
      await supabase
        .from('filters')
        .update({ success_rate: successRate, updated_at: new Date().toISOString() })
        .eq('id', filterId);
    }
  }

  return NextResponse.json({
    finalized,
    scoreFetched,
    evaluated,
    skipped,
    successCount,
    failCount,
    successRate: evaluated > 0 ? Math.round((successCount / evaluated) * 100) : null,
    message: `Finalized ${finalized} matches (${scoreFetched} with scores). Auto-evaluated ${evaluated} matches. ${successCount} good, ${failCount} bad. ${skipped} skipped.`,
  });
}
