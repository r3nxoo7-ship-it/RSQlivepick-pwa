/**
 * GET /api/sofascore/team-form
 *
 * Returns a team's recent match history from SofaScore.
 * Converts events into the RecentMatchData-compatible shape.
 *
 * Query params:
 *   teamId  — SofaScore numeric team ID (required)
 *   page    — pagination page (default 0 = most recent ~20 matches)
 *   limit   — max matches to return (default 10)
 *
 * Response:
 *   { teamId, matches, allEvents, form }
 *   matches — RecentMatchData-compatible array (finished matches only)
 *   allEvents — raw converted events (includes finished + recent inprogress)
 *   form — { played, wins, draws, losses, winRate }
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getTeamLastEvents,
  sofascoreEventToMatch,
  computeFormSummary,
  type SofascoreRecentMatch,
} from '@/lib/sofascore-api';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const teamIdParam = searchParams.get('teamId');
  const page = parseInt(searchParams.get('page') ?? '0', 10);
  const limit = parseInt(searchParams.get('limit') ?? '10', 10);

  if (!teamIdParam) {
    return NextResponse.json({ error: 'teamId param required' }, { status: 400 });
  }

  const teamId = parseInt(teamIdParam, 10);
  if (isNaN(teamId)) {
    return NextResponse.json({ error: 'teamId must be a number' }, { status: 400 });
  }

  const { events, hasNextPage } = await getTeamLastEvents(teamId, page);

  if (!events.length) {
    return NextResponse.json({ teamId, matches: [], allEvents: [], form: null, hasNextPage: false });
  }

  // Convert all events; we return finished ones as matches, all as allEvents
  const allConverted: SofascoreRecentMatch[] = events.map(sofascoreEventToMatch);

  const finished = allConverted.filter(m => m.status === 'finished').slice(0, limit);

  const form = computeFormSummary(finished, teamId);

  return NextResponse.json(
    {
      teamId,
      matches: finished,
      allEvents: allConverted,
      form,
      hasNextPage,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    },
  );
}
