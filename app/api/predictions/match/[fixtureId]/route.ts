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
import { getMatchStats, convertESPNMatchToLiveMatch } from '@/lib/espn-sync';
import { getTeamSchedule } from '@/lib/espn-api';

export const dynamic = 'force-dynamic';

// Cache predictions for 30 minutes
const CACHE_DURATION = 30 * 60 * 1000;
const predictionCache = new Map<string, { data: any; timestamp: number }>();

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

    // 1. Fetch match directly from DB (no HTTP roundtrip)
    const matchRow = await getMatchStats(fixtureId);
    if (!matchRow) {
      return NextResponse.json(
        { error: 'Match not found in database', fixtureId },
        { status: 404 }
      );
    }

    const match = convertESPNMatchToLiveMatch(matchRow);

    if (!match?.teams?.home?.id || !match?.teams?.away?.id) {
      return NextResponse.json(
        { error: 'Match missing team data', fixtureId },
        { status: 404 }
      );
    }

    const homeTeamId = match.teams.home.id;
    const awayTeamId = match.teams.away.id;
    const homeTeamName = match.teams.home.name || 'Home';
    const awayTeamName = match.teams.away.name || 'Away';

    // 2. Fetch team form (ESPN schedule) + H2H (TheSportsDB cache) in parallel
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const [homeSchedule, awaySchedule, h2hResponse] = await Promise.all([
      getTeamSchedule(String(homeTeamId)).catch(() => []),
      getTeamSchedule(String(awayTeamId)).catch(() => []),
      // TheSportsDB H2H — cache-first, returns 20-30 past meetings
      fetch(`${baseUrl}/api/h2h?home=${encodeURIComponent(homeTeamName)}&away=${encodeURIComponent(awayTeamName)}&limit=20`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
    ]);

    // Convert ESPN matches to form data format (goals + stats for Poisson model)
    const convertToFormData = (matches: any[]) =>
      matches.slice(0, 10).map((m: any) => ({
        id: m.id,
        date: m.date,
        home_team_id: m.homeTeam?.id,
        away_team_id: m.awayTeam?.id,
        home_score: m.homeScore || 0,
        away_score: m.awayScore || 0,
        home_corners: m.homeCorners || null,
        away_corners: m.awayCorners || null,
        home_shots_on_target: m.homeShotsOnTarget || null,
        away_shots_on_target: m.awayShotsOnTarget || null,
        home_possession: m.homePossession || null,
        away_possession: m.awayPossession || null,
        home_yellow_cards: m.homeYellowCards || null,
        away_yellow_cards: m.awayYellowCards || null,
      }));

    const homeForm = convertToFormData(homeSchedule);
    const awayForm = convertToFormData(awaySchedule);

    // H2H from TheSportsDB cache (20-30 matches) with fallback to ESPN (0-1 matches)
    let h2hData: any[] = [];
    if (h2hResponse?.matches?.length > 0) {
      // Use TheSportsDB cache — contains home_team_name for name-based matching
      h2hData = h2hResponse.matches.map((m: any) => ({
        home_team_id: m.home_team_id,   // tsdb_* format — aggregateH2HStats handles name fallback
        away_team_id: m.away_team_id,
        home_team_name: m.home_team_name,
        away_team_name: m.away_team_name,
        home_score: m.home_score || 0,
        away_score: m.away_score || 0,
        home_corners: m.home_corners || null,
        away_corners: m.away_corners || null,
      }));
      console.log(`[Predictions] H2H from TheSportsDB: ${h2hData.length} matches (cached: ${h2hResponse.cached})`);
    } else {
      // Fallback: ESPN schedule cross-reference (usually 0-1 matches)
      h2hData = homeSchedule
        .filter((m: any) => {
          const hid = String(m.homeTeam?.id);
          const aid = String(m.awayTeam?.id);
          return (
            (hid === String(homeTeamId) && aid === String(awayTeamId)) ||
            (hid === String(awayTeamId) && aid === String(homeTeamId))
          );
        })
        .slice(0, 10)
        .map((m: any) => ({
          home_team_id: m.homeTeam?.id,
          away_team_id: m.awayTeam?.id,
          home_score: m.homeScore || 0,
          away_score: m.awayScore || 0,
          home_corners: m.homeCorners || null,
          away_corners: m.awayCorners || null,
        }));
      console.log(`[Predictions] H2H fallback ESPN: ${h2hData.length} matches`);
    }

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
        dataSources: ['ESPN Team Schedule', h2hData.length > 2 ? 'TheSportsDB H2H' : 'ESPN H2H', homeForm.length > 0 ? 'Real Form Stats' : 'Defaults'],
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
