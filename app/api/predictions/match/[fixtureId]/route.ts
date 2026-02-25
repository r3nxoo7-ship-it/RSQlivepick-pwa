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
import { getMatchStats, convertESPNMatchToLiveMatch, getTeamRecentMatches } from '@/lib/espn-sync';
import { getTeamSchedule } from '@/lib/espn-api';
import { findBzzoiroPrediction, fetchBzzoiroPredictions, type BzzoiroMatchedPrediction } from '@/lib/bzzoiro';

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

    // 2. Fetch team form: Supabase DB first (fast, no external calls, 10 recent completed matches)
    // Fall back to live ESPN schedule only if DB has < 4 matches for this team
    // VERCEL_URL is set automatically by Vercel on all deployments (without https://);
    // NEXT_PUBLIC_APP_URL overrides it when explicitly configured
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Convert ESPN schedule match → form data (both DB rows and live ESPN matches share same fields)
    const convertDBRowToFormData = (rows: any[]) =>
      rows.slice(0, 10).map((m: any) => ({
        id: m.id,
        date: m.date,
        home_team_id: String(m.home_team_id || m.homeTeam?.id || ''),
        away_team_id: String(m.away_team_id || m.awayTeam?.id || ''),
        home_score: m.home_score ?? m.home_goals ?? m.homeScore ?? 0,
        away_score: m.away_score ?? m.away_goals ?? m.awayScore ?? 0,
        home_corners: m.home_corners ?? m.homeCorners ?? null,
        away_corners: m.away_corners ?? m.awayCorners ?? null,
        home_shots_on_target: m.home_shots_on_target ?? m.homeShotsOnTarget ?? null,
        away_shots_on_target: m.away_shots_on_target ?? m.awayShotsOnTarget ?? null,
        home_possession: m.home_possession ?? m.homePossession ?? null,
        away_possession: m.away_possession ?? m.awayPossession ?? null,
        home_yellow_cards: m.home_yellow_cards ?? m.homeYellowCards ?? null,
        away_yellow_cards: m.away_yellow_cards ?? m.awayYellowCards ?? null,
      }));

    // Helper: fetch ESPN schedule with a 5s timeout to avoid blocking the Vercel function
    const fetchESPNScheduleSafe = async (teamId: string) => {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      try { return await getTeamSchedule(teamId); } catch { return []; } finally { clearTimeout(t); }
    };

    // DB-first form data
    const [homeDBMatches, awayDBMatches] = await Promise.all([
      getTeamRecentMatches(String(homeTeamId), 10),
      getTeamRecentMatches(String(awayTeamId), 10),
    ]);

    // Fall back to live ESPN API only when DB has sparse data for this team
    const [homeSchedule, awaySchedule] = await Promise.all([
      homeDBMatches.length >= 4
        ? Promise.resolve(homeDBMatches)
        : fetchESPNScheduleSafe(String(homeTeamId)).then(r => r.length >= homeDBMatches.length ? r : homeDBMatches),
      awayDBMatches.length >= 4
        ? Promise.resolve(awayDBMatches)
        : fetchESPNScheduleSafe(String(awayTeamId)).then(r => r.length >= awayDBMatches.length ? r : awayDBMatches),
    ]);

    const h2hResponse = await fetch(
      `${baseUrl}/api/h2h?home=${encodeURIComponent(homeTeamName)}&away=${encodeURIComponent(awayTeamName)}&limit=20`,
      { signal: AbortSignal.timeout(7000) }
    ).then(r => r.ok ? r.json() : null).catch(() => null);

    // Convert ESPN schedule/DB matches to form data format (goals + stats for Poisson model)
    const convertToFormData = (matches: any[]) => convertDBRowToFormData(matches);

    const homeForm = convertToFormData(homeSchedule);
    const awayForm = convertToFormData(awaySchedule);
    console.log(`[Predictions] Form data: home=${homeForm.length} matches (DB: ${homeDBMatches.length}), away=${awayForm.length} matches (DB: ${awayDBMatches.length})`);

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

    // 6. Generate base predictions (Poisson + H2H engine)
    const predictions = generateFullPredictions(
      parseInt(fixtureId),
      homeTeamName,
      awayTeamName,
      context,
      new Date(match.fixture?.date || new Date())
    );

    // 7. Fetch Bzzoiro ML predictions directly (no HTTP round-trip — avoids baseUrl issues on Vercel)
    // Shares the same 30-min in-memory cache used by /api/bzzoiro/predictions
    let bzzoiro: BzzoiroMatchedPrediction | null = null;
    try {
      if (process.env.BZZOIRO_API_TOKEN) {
        const BZZOIRO_CACHE_TTL = 30 * 60 * 1000;
        const globalCache = (global as any).__bzzoiroCache as { data: any[]; fetchedAt: number } | undefined;
        let bzzoiroPredictions: any[] | null = null;

        if (globalCache && Date.now() - globalCache.fetchedAt < BZZOIRO_CACHE_TTL) {
          bzzoiroPredictions = globalCache.data;
          console.log(`[Predictions] Bzzoiro: using cached ${bzzoiroPredictions!.length} predictions`);
        } else {
          bzzoiroPredictions = await fetchBzzoiroPredictions();
          (global as any).__bzzoiroCache = { data: bzzoiroPredictions, fetchedAt: Date.now() };
          console.log(`[Predictions] Bzzoiro: fetched ${bzzoiroPredictions.length} fresh predictions`);
        }

        if (bzzoiroPredictions?.length) {
          bzzoiro = findBzzoiroPrediction(
            homeTeamName,
            awayTeamName,
            bzzoiroPredictions,
            match.fixture?.date,
          );
          if (bzzoiro) {
            console.log(`[Predictions] Bzzoiro match found for ${homeTeamName} vs ${awayTeamName} (score: ${bzzoiro.matchScore?.toFixed(2)}, confidence: ${bzzoiro.confidence})`);
          }
        }
      }
    } catch (e) {
      // Bzzoiro is optional enrichment — never block the response
      console.warn('[Predictions] Bzzoiro fetch failed (non-fatal):', e instanceof Error ? e.message : e);
    }

    // Override Poisson-computed markets with Bzzoiro ML probabilities
    // confidence is already 0-1 (normalized in lib/bzzoiro.ts)
    // Bzzoiro covers: over1_5, over2_5, btts_yes — local engine keeps corners, cards, 1st half
    if (bzzoiro && bzzoiro.confidence >= 0.45) {
      // Use confidence as blend weight: e.g. 0.75 confidence → 75% Bzzoiro, 25% Poisson
      const w = bzzoiro.confidence;
      const wPct = Math.round(w * 100);

      // Blend: Bzzoiro * w + local * (1-w)
      const blend = (bzzoiroProb: number, localProb: number) =>
        Math.round(bzzoiroProb * w + localProb * (1 - w));

      predictions.predictions.fullMatch.over1_5.probability = blend(
        bzzoiro.prob_over_15,
        predictions.predictions.fullMatch.over1_5.probability
      );
      predictions.predictions.fullMatch.over1_5.reasoning =
        `Bzzoiro ML (${wPct}% weight) + Poisson blend`;

      predictions.predictions.fullMatch.over2_5.probability = blend(
        bzzoiro.prob_over_25,
        predictions.predictions.fullMatch.over2_5.probability
      );
      predictions.predictions.fullMatch.over2_5.reasoning =
        `Bzzoiro ML (${wPct}% weight) + Poisson blend`;

      predictions.predictions.btts.yes.probability = blend(
        bzzoiro.prob_btts_yes,
        predictions.predictions.btts.yes.probability
      );
      predictions.predictions.btts.yes.reasoning =
        `Bzzoiro ML (${wPct}% weight) + Poisson blend`;

      // Boost overall confidence
      predictions.overallConfidence = Math.min(95, predictions.overallConfidence + (w >= 0.7 ? 10 : 5));
    }

    // Attach data quality info
    const dataSources = [
      homeDBMatches.length >= 4 ? 'Supabase DB (home form)' : 'ESPN API (home form)',
      awayDBMatches.length >= 4 ? 'Supabase DB (away form)' : 'ESPN API (away form)',
      h2hData.length > 2 ? 'TheSportsDB H2H' : 'ESPN H2H fallback',
      ...(bzzoiro ? [`Bzzoiro ML (confidence: ${Math.round(bzzoiro.confidence * 100)}%)`] : []),
    ];

    const response = {
      ...predictions,
      overallConfidence: Math.round((confidenceScore + predictions.overallConfidence) / 2),
      // Bzzoiro 1X2 predictions attached directly (new fields, not in FullPredictions type)
      bzzoiro: bzzoiro ? {
        prob_home_win: bzzoiro.prob_home_win,
        prob_draw: bzzoiro.prob_draw,
        prob_away_win: bzzoiro.prob_away_win,
        predicted_result: bzzoiro.predicted_result,
        confidence: bzzoiro.confidence,
        model_version: bzzoiro.model_version,
      } : null,
      dataQuality: {
        quality: quality.quality,
        warnings: quality.warnings,
        homeFormMatches: context.homeTeam.matchesAnalyzed,
        awayFormMatches: context.awayTeam.matchesAnalyzed,
        h2hMatches: context.h2hStats.totalMatches,
        dataSources,
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
