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

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const matches = await getLiveMatchesFromSofascore();
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
