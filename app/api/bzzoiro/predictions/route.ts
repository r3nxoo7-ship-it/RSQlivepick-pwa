/**
 * GET /api/bzzoiro/predictions
 *
 * Fetches and caches Bzzoiro ML predictions for upcoming matches.
 * All predictions are pre-fetched in bulk (one call) then served fast per-match.
 *
 * Cache: 30 minutes in-memory (predictions retrain weekly, 30min is plenty)
 * Auth:  BZZOIRO_API_TOKEN env variable (free, register at sports.bzzoiro.com)
 */

import { NextResponse } from 'next/server';
import { fetchBzzoiroPredictions, type BzzoiroPrediction } from '@/lib/bzzoiro';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

// In-memory cache: avoids hammering Bzzoiro on every prediction request
const cache: { data: BzzoiroPrediction[]; fetchedAt: number } | null = (global as any).__bzzoiroCache ?? null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCache(): BzzoiroPrediction[] | null {
  const c: typeof cache = (global as any).__bzzoiroCache;
  if (!c) return null;
  if (Date.now() - c.fetchedAt > CACHE_TTL) return null;
  return c.data;
}

function setCache(data: BzzoiroPrediction[]): void {
  (global as any).__bzzoiroCache = { data, fetchedAt: Date.now() };
}

export async function GET() {
  try {
    // Serve from cache if fresh
    const cached = getCache();
    if (cached) {
      return NextResponse.json(
        { predictions: cached, count: cached.length, cached: true },
        { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=300' } }
      );
    }

    if (!process.env.BZZOIRO_API_TOKEN) {
      return NextResponse.json(
        { predictions: [], count: 0, error: 'BZZOIRO_API_TOKEN not configured' },
        { status: 200 } // Soft fail — don't break the app
      );
    }

    const predictions = await fetchBzzoiroPredictions();
    setCache(predictions);

    console.log(`[Bzzoiro] Fetched ${predictions.length} predictions, cached for 30min`);

    return NextResponse.json(
      { predictions, count: predictions.length, cached: false },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=300' } }
    );
  } catch (err) {
    console.error('[Bzzoiro] Predictions fetch error:', err);
    return NextResponse.json(
      { predictions: [], count: 0, error: err instanceof Error ? err.message : 'Fetch failed' },
      { status: 200 } // Soft fail — caller checks for empty array
    );
  }
}
