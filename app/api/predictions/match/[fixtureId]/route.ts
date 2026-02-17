/**
 * API Route: /api/predictions/match/:fixtureId
 *
 * Generate ML-powered predictions for a specific match using real ESPN data.
 *
 * Data sources:
 * - Team form: /api/espn/team-form (ESPN schedule API - real stats)
 * - H2H: /api/espn/h2h (ESPN schedule cross-reference)
 * - Odds: ESPN scoreboard pre-match odds (no API-Football needed)
 * - Match details: /api/espn/matches (synced ESPN data)
 *
 * GET /api/predictions/match/123456?cache=false
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateFullPredictions, calculateConfidenceScore } from '@/lib/prediction-engine';
import {
  aggregateMatchContext,
  validateContextQuality,
} from '@/lib/prediction-data-aggregation';

export const dynamic = 'force-dynamic';

// Cache predictions for 30 minutes
const CACHE_DURATION = 30 * 60 * 1000;
const predictionCache = new Map<string, { data: any; timestamp: number }>();

// Resolve the internal API base URL for server-to-server calls
function getBaseUrl(): string {
  // On Vercel, use VERCEL_URL; locally use localhost
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  return `http://localhost:${process.env.PORT || 3000}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { fixtureId: string } }
) {
  const { fixtureId } = params;
  const noCache = request.nextUrl.searchParams.get('cache') === 'false';

  try {
    // Check cache first
    const cacheKey = `predictions_${fixtureId}`;
    if (!noCache && predictionCache.has(cacheKey)) {
      const cached = predictionCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        return NextResponse.json(cached.data, {
          headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=300' },
        });
      }
    }

    console.log(`[Predictions] Generating for fixture ${fixtureId}`);
    const baseUrl = getBaseUrl();

    // 1. Fetch match details from ESPN synced data
    let match: any = null;
    try {
      const matchRes = await fetch(`${baseUrl}/api/espn/matches`, { cache: 'no-store' });
      if (matchRes.ok) {
        const body = await matchRes.json();
        // Search all categories for this fixture
        const allMatches = [
          ...(body.live?.matches || []),
          ...(body.upcoming?.matches || []),
          ...(body.scheduled?.matches || []),
          ...(Array.isArray(body.matches) ? body.matches : []),
        ];
        match = allMatches.find((m: any) => String(m.fixture?.id) === String(fixtureId));
      }
    } catch (err) {
      console.warn(`[Predictions] ESPN matches fetch failed:`, err);
    }

    if (!match?.teams?.home?.id || !match?.teams?.away?.id) {
      return NextResponse.json(
        { error: 'Match not found or missing team data', fixtureId },
        { status: 404 }
      );
    }

    const homeTeamId = match.teams.home.id;
    const awayTeamId = match.teams.away.id;
    const homeTeamName = match.teams.home.name || 'Home';
    const awayTeamName = match.teams.away.name || 'Away';

    // 2. Fetch team form + H2H in parallel (all from ESPN - real data)
    const [homeFormRes, awayFormRes, h2hRes] = await Promise.all([
      fetch(`${baseUrl}/api/espn/team-form?teamId=${homeTeamId}&limit=10`, { cache: 'no-store' }).catch(() => null),
      fetch(`${baseUrl}/api/espn/team-form?teamId=${awayTeamId}&limit=10`, { cache: 'no-store' }).catch(() => null),
      fetch(`${baseUrl}/api/espn/h2h?homeId=${homeTeamId}&awayId=${awayTeamId}&limit=10`, { cache: 'no-store' }).catch(() => null),
    ]);

    const homeForm = homeFormRes?.ok ? (await homeFormRes.json()).matches || [] : [];
    const awayForm = awayFormRes?.ok ? (await awayFormRes.json()).matches || [] : [];
    const h2hData = h2hRes?.ok ? (await h2hRes.json()).matches || [] : [];

    // 3. Extract pre-match odds from ESPN match data (already in match object)
    // ESPN scoreboard includes odds in match.fixture.odds or similar
    // We pass the match itself and let aggregateMatchContext handle it
    // No API-Football call needed (ESPN IDs != API-Football IDs)

    // 4. Aggregate context from real data
    const context = await aggregateMatchContext(
      match,
      homeForm,
      awayForm,
      h2hData,
      null // No separate odds data - ESPN odds extracted from match if available
    );

    // Validate data quality
    const quality = validateContextQuality(context);
    console.log(`[Predictions] ${homeTeamName} vs ${awayTeamName} | form: ${homeForm.length}+${awayForm.length} matches, H2H: ${h2hData.length}, quality: ${quality.quality}`);

    // 5. Calculate confidence score based on actual data availability
    const confidenceScore = calculateConfidenceScore({
      historicalMatches: Math.min(context.homeTeam.matchesAnalyzed, context.awayTeam.matchesAnalyzed),
      h2hMatches: context.h2hStats.totalMatches,
      dataRecency: homeForm.length > 0 ? 3 : 30, // Recent if we have form data
      sourceAgreement: h2hData.length > 2 ? 80 : 60, // Higher if good H2H data
    });

    // 6. Generate predictions
    const predictions = generateFullPredictions(
      parseInt(fixtureId),
      homeTeamName,
      awayTeamName,
      context,
      new Date(match.fixture?.date || new Date())
    );

    // Attach data quality info
    const response = {
      ...predictions,
      overallConfidence: Math.round((confidenceScore + predictions.overallConfidence) / 2),
      dataQuality: {
        quality: quality.quality,
        warnings: quality.warnings,
        homeFormMatches: context.homeTeam.matchesAnalyzed,
        awayFormMatches: context.awayTeam.matchesAnalyzed,
        h2hMatches: context.h2hStats.totalMatches,
        dataSources: ['ESPN Team Schedule', 'ESPN H2H', homeForm.length > 0 ? 'Real Form Stats' : 'Defaults'],
      },
    };

    // Cache
    predictionCache.set(cacheKey, { data: response, timestamp: Date.now() });

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error(`[Predictions] Error for fixture ${fixtureId}:`, error);
    return NextResponse.json(
      { error: 'Failed to generate predictions', fixtureId, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
