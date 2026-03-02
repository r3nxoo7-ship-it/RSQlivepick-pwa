import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filterId = searchParams.get('filter_id');
  const userId = searchParams.get('user_id');

  if (!filterId || !userId) {
    return NextResponse.json({ error: 'filter_id and user_id required' }, { status: 400 });
  }

  const { data: rows, error } = await supabase
    .from('triggered_matches')
    .select(
      'league_name, match_time, score_home, score_away, final_score_home, final_score_away, user_feedback, triggered_at'
    )
    .eq('filter_id', filterId)
    .eq('user_id', userId)
    .order('triggered_at', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const matches = rows || [];

  // ── 1. LEAGUE BREAKDOWN ────────────────────────────────────────
  const leagueMap = new Map<string, { count: number; positive: number; negative: number }>();
  for (const m of matches) {
    const l = m.league_name || 'Unknown';
    if (!leagueMap.has(l)) leagueMap.set(l, { count: 0, positive: 0, negative: 0 });
    const e = leagueMap.get(l)!;
    e.count++;
    if (m.user_feedback === true) e.positive++;
    if (m.user_feedback === false) e.negative++;
  }
  const leagues = Array.from(leagueMap.entries())
    .map(([name, s]) => {
      const rated = s.positive + s.negative;
      return {
        name,
        count: s.count,
        rated,
        successRate: rated >= 2 ? Math.round((s.positive / rated) * 100) : null,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // ── 2. MINUTE BUCKETS ──────────────────────────────────────────
  type Bucket = { count: number; positive: number; negative: number };
  const buckets: Record<string, Bucket> = {
    '1-45':  { count: 0, positive: 0, negative: 0 },
    '46-60': { count: 0, positive: 0, negative: 0 },
    '61-75': { count: 0, positive: 0, negative: 0 },
    '76+':   { count: 0, positive: 0, negative: 0 },
  };
  for (const m of matches) {
    const t = m.match_time ?? 0;
    const key = t <= 45 ? '1-45' : t <= 60 ? '46-60' : t <= 75 ? '61-75' : '76+';
    buckets[key].count++;
    if (m.user_feedback === true) buckets[key].positive++;
    if (m.user_feedback === false) buckets[key].negative++;
  }
  const minuteBreakdown = Object.entries(buckets)
    .filter(([, s]) => s.count > 0)
    .map(([range, s]) => {
      const rated = s.positive + s.negative;
      return {
        range,
        count: s.count,
        rated,
        successRate: rated >= 2 ? Math.round((s.positive / rated) * 100) : null,
      };
    });

  // ── 3. SCORE STATE AT TRIGGER ──────────────────────────────────
  type ScoreState = { count: number; goalsAdded: number[] };
  const scoreStates: Record<string, ScoreState> = {
    '0-0':     { count: 0, goalsAdded: [] },
    '1 goal':  { count: 0, goalsAdded: [] },
    '2 goals': { count: 0, goalsAdded: [] },
    '3+ goals':{ count: 0, goalsAdded: [] },
  };
  const allGoalsAdded: number[] = [];

  for (const m of matches) {
    const goalsAtTrigger = (m.score_home ?? 0) + (m.score_away ?? 0);
    const key =
      goalsAtTrigger === 0 ? '0-0' :
      goalsAtTrigger === 1 ? '1 goal' :
      goalsAtTrigger === 2 ? '2 goals' : '3+ goals';
    scoreStates[key].count++;
    if (m.final_score_home != null && m.final_score_away != null) {
      const added = (m.final_score_home + m.final_score_away) - goalsAtTrigger;
      scoreStates[key].goalsAdded.push(Math.max(0, added));
      allGoalsAdded.push(Math.max(0, added));
    }
  }

  const scoreBreakdown = Object.entries(scoreStates)
    .filter(([, s]) => s.count > 0)
    .map(([state, s]) => ({
      state,
      count: s.count,
      avgGoalsAfter:
        s.goalsAdded.length > 0
          ? Math.round((s.goalsAdded.reduce((a, b) => a + b, 0) / s.goalsAdded.length) * 10) / 10
          : null,
    }));

  // ── 4. OVERALL GOALS ADDED ─────────────────────────────────────
  const avgGoalsAdded =
    allGoalsAdded.length > 0
      ? Math.round((allGoalsAdded.reduce((a, b) => a + b, 0) / allGoalsAdded.length) * 10) / 10
      : null;

  // ── 5. OVERALL FEEDBACK ────────────────────────────────────────
  const withFeedback = matches.filter(m => m.user_feedback !== null && m.user_feedback !== undefined);
  const positiveCount = withFeedback.filter(m => m.user_feedback === true).length;
  const overallSuccessRate =
    withFeedback.length >= 3
      ? Math.round((positiveCount / withFeedback.length) * 100)
      : null;

  // ── 6. BEST / WORST LEAGUE ─────────────────────────────────────
  const ratedLeagues = leagues.filter(l => l.successRate !== null && l.rated >= 2);
  const bestLeague  = ratedLeagues.sort((a, b) => (b.successRate ?? 0) - (a.successRate ?? 0))[0] ?? null;
  const worstLeague = ratedLeagues.sort((a, b) => (a.successRate ?? 0) - (b.successRate ?? 0))[0] ?? null;

  return NextResponse.json({
    total: matches.length,
    withFeedback: withFeedback.length,
    overallSuccessRate,
    avgGoalsAdded,
    bestLeague,
    worstLeague,
    leagues,
    minuteBreakdown,
    scoreBreakdown,
  });
}
