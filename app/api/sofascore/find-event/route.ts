/**
 * GET /api/sofascore/find-event
 *
 * Resolves a live/scheduled match to its SofaScore event ID and team IDs.
 * Searches the SofaScore scheduled-events list for the given date.
 *
 * Query params:
 *   home  — home team name (e.g. "Celtic")
 *   away  — away team name (e.g. "Stuttgart")
 *   date  — ISO date YYYY-MM-DD (defaults to today)
 *
 * Response:
 *   { found: true,  eventId, homeTeamId, awayTeamId }
 *   { found: false }
 */
import { NextRequest, NextResponse } from 'next/server';
import { findSofascoreEvent } from '@/lib/sofascore-api';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const home = searchParams.get('home')?.trim();
  const away = searchParams.get('away')?.trim();
  const date = searchParams.get('date')?.trim() || new Date().toISOString().split('T')[0];

  if (!home || !away) {
    return NextResponse.json({ error: 'home and away params required' }, { status: 400 });
  }

  const result = await findSofascoreEvent(home, away, date);

  if (!result) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  return NextResponse.json(
    {
      found: true,
      eventId: result.eventId,
      homeTeamId: result.homeTeamId,
      awayTeamId: result.awayTeamId,
      homeTeamName: result.event.homeTeam.name,
      awayTeamName: result.event.awayTeam.name,
      // Halftime scores (period 1) — available for finished/live matches
      period1Home: result.event.homeScore?.period1 ?? null,
      period1Away: result.event.awayScore?.period1 ?? null,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    },
  );
}
