/**
 * GET /api/sofascore/h2h
 *
 * Returns head-to-head aggregate + full event list for two teams via SofaScore.
 *
 * Strategy:
 *   1. Try /event/{eventId}/h2h for W/D/L aggregate
 *   2. Try /event/{eventId}/h2h/events for the full match list
 *   3. If h2h/events is unavailable (404), build H2H by cross-referencing
 *      both teams' recent event histories (requires homeTeamId + awayTeamId)
 *
 * Query params:
 *   eventId    — SofaScore event ID (required)
 *   homeTeamId — SofaScore home team ID (optional, used for cross-ref fallback)
 *   awayTeamId — SofaScore away team ID (optional, used for cross-ref fallback)
 *
 * Response:
 *   { homeWins, awayWins, draws, matches: RecentMatchData[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getH2HForEvent,
  getTeamLastEvents,
  extractH2HFromEvents,
  sofascoreEventToMatch,
} from '@/lib/sofascore-api';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const eventIdParam = searchParams.get('eventId');
  const homeTeamIdParam = searchParams.get('homeTeamId');
  const awayTeamIdParam = searchParams.get('awayTeamId');

  if (!eventIdParam) {
    return NextResponse.json({ error: 'eventId param required' }, { status: 400 });
  }

  const eventId = parseInt(eventIdParam, 10);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: 'eventId must be a number' }, { status: 400 });
  }

  // Step 1: Get aggregate + try h2h/events endpoint
  const h2h = await getH2HForEvent(eventId);

  if (!h2h) {
    return NextResponse.json({ homeWins: 0, awayWins: 0, draws: 0, matches: [] });
  }

  // If h2h/events returned a match list, use it
  if (h2h.events && h2h.events.length > 0) {
    const matches = h2h.events.map(sofascoreEventToMatch);
    return NextResponse.json(
      { homeWins: h2h.homeWins, awayWins: h2h.awayWins, draws: h2h.draws, matches },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  }

  // Step 2: Cross-reference fallback using individual team histories
  const homeTeamId = homeTeamIdParam ? parseInt(homeTeamIdParam, 10) : null;
  const awayTeamId = awayTeamIdParam ? parseInt(awayTeamIdParam, 10) : null;

  if (homeTeamId && awayTeamId && !isNaN(homeTeamId) && !isNaN(awayTeamId)) {
    // Fetch both teams' last events and merge — 2 pages each for better coverage
    const [homePage0, homePage1, awayPage0] = await Promise.all([
      getTeamLastEvents(homeTeamId, 0),
      getTeamLastEvents(homeTeamId, 1),
      getTeamLastEvents(awayTeamId, 0),
    ]);

    const allHomeEvents = [...homePage0.events, ...homePage1.events];
    const allAwayEvents = awayPage0.events;

    // Combine and de-duplicate by event ID
    const seen = new Set<number>();
    const combined = [...allHomeEvents, ...allAwayEvents].filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    const h2hEvents = extractH2HFromEvents(combined, homeTeamId, awayTeamId);
    const matches = h2hEvents.map(sofascoreEventToMatch);

    return NextResponse.json(
      { homeWins: h2h.homeWins, awayWins: h2h.awayWins, draws: h2h.draws, matches },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
    );
  }

  // Fallback: return aggregate only with no match list
  return NextResponse.json(
    { homeWins: h2h.homeWins, awayWins: h2h.awayWins, draws: h2h.draws, matches: [] },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  );
}
