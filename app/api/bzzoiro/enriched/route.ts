/**
 * API Route: GET /api/bzzoiro/enriched
 *
 * Returns an array of Bzzoiro enriched predictions (ML probabilities + bookmaker
 * odds from the events endpoint merged together).  Cached 15 minutes server-side
 * via the global in-memory cache in lib/bzzoiro.ts.
 *
 * Used by the client-side background scanner so it never needs to expose
 * BZZOIRO_API_TOKEN to the browser.
 *
 * Response:
 *   { configured: true, predictions: BzzoiroEnrichedPrediction[], fetchedAt: number }
 * or
 *   { configured: false } when BZZOIRO_API_TOKEN is not set
 */

import { NextResponse } from 'next/server';
import { getBzzoiroEnrichedMap } from '@/lib/bzzoiro';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
  if (!process.env.BZZOIRO_API_TOKEN) {
    return NextResponse.json({ configured: false, predictions: [] });
  }

  try {
    const map = await getBzzoiroEnrichedMap();
    const predictions = [...map.values()];

    return NextResponse.json(
      {
        configured: true,
        predictions,
        fetchedAt: Date.now(),
        count: predictions.length,
      },
      {
        headers: {
          // Allow the client to cache for 10 minutes; revalidate up to 15
          'Cache-Control': 'public, max-age=600, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('[/api/bzzoiro/enriched] Error:', error);
    return NextResponse.json(
      {
        configured: true,
        predictions: [],
        error: error instanceof Error ? error.message : 'Failed to fetch',
      },
      { status: 500 }
    );
  }
}
