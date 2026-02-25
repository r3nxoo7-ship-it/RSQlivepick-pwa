import { NextRequest, NextResponse } from 'next/server';
import * as ESPNAPI from '@/lib/espn-api';

export const dynamic = 'force-dynamic';

// Hard deadline well within Vercel's 10s timeout
const DEADLINE_MS = 8000;
// Parallel batch size — try N leagues at once, take first with stats
const BATCH_SIZE = 6;

/**
 * GET /api/espn/match-stats?eventId=xxx&league=eng.1
 * Fetches detailed match statistics from ESPN summary endpoint.
 * Tries leagues in parallel batches to avoid sequential timeout.
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('eventId');
  const league = request.nextUrl.searchParams.get('league');

  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  const allLeagueCodes = ESPNAPI.ALL_SOCCER_LEAGUES.map(l => l.code);
  // Try specified league first, then the rest in batches
  const leaguesToTry = league
    ? [league, ...allLeagueCodes.filter(l => l !== league)]
    : allLeagueCodes;

  const deadline = Date.now() + DEADLINE_MS;

  /**
   * Try a single league — returns stats object or null
   */
  const tryLeague = async (leagueCode: string): Promise<{ league: string; stats: any } | null> => {
    try {
      // Short 3s timeout per probe — we're trying many leagues in parallel
      const summary = await ESPNAPI.getMatchSummary('soccer', leagueCode, eventId, 3000);
      if (!summary) return null;

      const parsed = ESPNAPI.parseSummaryStats(summary, '', '');
      const stats = {
        homePoss: parsed.home['possessionPct'] || 0,
        awayPoss: parsed.away['possessionPct'] || 0,
        homeSoT: parsed.home['shotsOnTarget'] || 0,
        awaySoT: parsed.away['shotsOnTarget'] || 0,
        homeShots: parsed.home['totalShots'] || 0,
        awayShots: parsed.away['totalShots'] || 0,
        homeCorners: parsed.home['wonCorners'] || 0,
        awayCorners: parsed.away['wonCorners'] || 0,
        homeYellow: parsed.home['yellowCards'] || 0,
        awayYellow: parsed.away['yellowCards'] || 0,
        homeRed: parsed.home['redCards'] || 0,
        awayRed: parsed.away['redCards'] || 0,
        homeFouls: parsed.home['foulsCommitted'] || 0,
        awayFouls: parsed.away['foulsCommitted'] || 0,
        homeOffsides: parsed.home['offsides'] || 0,
        awayOffsides: parsed.away['offsides'] || 0,
        // Halftime scores from linescores (period 1)
        homeHalfScore: parsed.homeHalfScore,
        awayHalfScore: parsed.awayHalfScore,
      };

      const hasAnyStats = Object.values(stats).some(v => v != null && v > 0);
      return hasAnyStats ? { league: leagueCode, stats } : null;
    } catch {
      return null;
    }
  };

  // Process in batches; within each batch run in parallel — stop on first success
  for (let i = 0; i < leaguesToTry.length; i += BATCH_SIZE) {
    if (Date.now() >= deadline) break;

    const batch = leaguesToTry.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(code => tryLeague(code));

    // Race the batch against remaining deadline
    const remaining = deadline - Date.now();
    const timeoutSentinel = new Promise<null>(resolve => setTimeout(() => resolve(null), remaining));

    const batchResult = await Promise.race([
      // Resolve as soon as any league returns stats (first non-null wins)
      new Promise<{ league: string; stats: any } | null>(async (resolve) => {
        const results = await Promise.allSettled(batchPromises);
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value !== null) {
            resolve(r.value);
            return;
          }
        }
        resolve(null);
      }),
      timeoutSentinel,
    ]);

    if (batchResult && batchResult !== null) {
      const { league: matchedLeague, stats } = batchResult as { league: string; stats: any };
      return NextResponse.json({ eventId, league: matchedLeague, stats });
    }

    if (Date.now() >= deadline) break;
  }

  return NextResponse.json({ eventId, stats: null });
}
