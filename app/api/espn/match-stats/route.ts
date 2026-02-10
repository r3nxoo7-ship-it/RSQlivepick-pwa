import { NextRequest, NextResponse } from 'next/server';
import * as ESPNAPI from '@/lib/espn-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/espn/match-stats?eventId=xxx&league=eng.1
 * Fetches detailed match statistics from ESPN summary endpoint
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('eventId');
  const league = request.nextUrl.searchParams.get('league');

  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  // Try specified league first, then all others
  const allLeagueCodes = ESPNAPI.ALL_SOCCER_LEAGUES.map(l => l.code);
  const leaguesToTry = league
    ? [league, ...allLeagueCodes.filter(l => l !== league)]
    : allLeagueCodes;

  for (const leagueCode of leaguesToTry) {
    try {
      const summary = await ESPNAPI.getMatchSummary('soccer', leagueCode, eventId);
      if (!summary) continue;

      const parsed = ESPNAPI.parseSummaryStats(summary, '', '');
      // parseSummaryStats returns { home: Record<string, number>, away: Record<string, number> }

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
      };

      const hasAnyStats = Object.values(stats).some(v => v > 0);
      if (!hasAnyStats) continue;

      return NextResponse.json({ eventId, league: leagueCode, stats });
    } catch {
      // Try next league
    }
  }

  return NextResponse.json({ eventId, stats: null });
}
