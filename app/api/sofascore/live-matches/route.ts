/**
 * GET /api/sofascore/live-matches
 *
 * Server-side proxy for SofaScore live + scheduled matches.
 * This route MUST stay server-side — SofaScore blocks direct browser requests (403).
 *
 * Response: { matches: LiveMatch[], count: number }
 */

import { NextResponse } from 'next/server';
import { getLiveMatchesFromSofascore } from '@/lib/sofascore-api';
import * as espnSync from '@/lib/espn-sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let matches = await getLiveMatchesFromSofascore();

    // Production-safe fallback: if SofaScore is blocked/unavailable on the host,
    // serve live+upcoming matches from synced ESPN data instead of returning empty.
    if (!matches || matches.length === 0) {
      try {
        const [liveRaw, upcomingRaw] = await Promise.all([
          espnSync.getLiveMatchesOnly(),
          espnSync.getUpcomingMatches(),
        ]);

        const fallbackMatches = [
          ...liveRaw.map((row: any) => espnSync.convertESPNMatchToLiveMatch(row)),
          ...upcomingRaw.map((row: any) => espnSync.convertESPNMatchToLiveMatch(row)),
        ];

        if (fallbackMatches.length > 0) {
          matches = fallbackMatches;
        }
      } catch (fallbackErr) {
        console.warn('[/api/sofascore/live-matches] ESPN fallback failed:', fallbackErr);
      }
    }

    return NextResponse.json(
      { matches: matches ?? [], count: matches?.length ?? 0 },
      {
        headers: {
          // Short cache — live data changes frequently
          'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
        },
      }
    );
  } catch (err) {
    console.error('[/api/sofascore/live-matches] Error:', err);
    return NextResponse.json(
      { matches: [], count: 0, error: err instanceof Error ? err.message : 'Failed' },
      { status: 200 } // Return empty array instead of 500 so caller falls through to ESPN
    );
  }
}
