/**
 * GET /api/sofascore/match-stats
 *
 * Returns detailed match statistics from SofaScore for a finished match.
 * Includes ALL / 1ST / 2ND period splits.
 *
 * Query params:
 *   eventId       — SofaScore numeric event ID (required)
 *   halftimeHome  — optional halftime home goals (to populate homeHalfScore)
 *   halftimeAway  — optional halftime away goals
 *
 * Response on success:
 *   { found: true, stats: NormalizedSofascoreStats, raw: SofascoreStatPeriod[] }
 *
 * Response when SofaScore has no stats (404 — e.g. cup playoff):
 *   { found: false }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMatchStatistics, normalizeSofascoreStats, normalizeSofascorePeriodStats } from '@/lib/sofascore-api';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const eventIdParam = searchParams.get('eventId');
  const halftimeHome = searchParams.get('halftimeHome');
  const halftimeAway = searchParams.get('halftimeAway');

  if (!eventIdParam) {
    return NextResponse.json({ error: 'eventId param required' }, { status: 400 });
  }

  const eventId = parseInt(eventIdParam, 10);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: 'eventId must be a number' }, { status: 400 });
  }

  const data = await getMatchStatistics(eventId);

  if (!data) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  const htHome = halftimeHome != null ? parseInt(halftimeHome, 10) : undefined;
  const htAway = halftimeAway != null ? parseInt(halftimeAway, 10) : undefined;

  const stats = normalizeSofascoreStats(data, htHome, htAway);
  const firstHalfStats = normalizeSofascorePeriodStats(data, '1ST');
  const secondHalfStats = normalizeSofascorePeriodStats(data, '2ND');

  return NextResponse.json(
    {
      found: true,
      stats,
      firstHalfStats,
      secondHalfStats,
      raw: data.statistics,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    },
  );
}
