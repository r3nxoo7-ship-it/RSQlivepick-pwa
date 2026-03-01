/**
 * GET /api/sofascore/match-incidents
 *
 * Returns individual match events (incidents) from SofaScore for time-windowed
 * filter evaluation. Includes yellow cards, red cards, substitutions, goals, etc.
 * with minute-level data.
 *
 * Query params:
 *   eventId — SofaScore numeric event ID (required)
 *
 * Response on success:
 *   { incidents: [...], homeTeamId, awayTeamId }
 *
 * Response when no data:
 *   { incidents: [] }
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE = 'https://www.sofascore.com/api/v1';
const FETCH_HEADERS: Record<string, string> = {
  Accept: '*/*',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Referer: 'https://www.sofascore.com/',
};

export async function GET(req: NextRequest) {
  const eventIdParam = req.nextUrl.searchParams.get('eventId');

  if (!eventIdParam) {
    return NextResponse.json({ error: 'eventId param required' }, { status: 400 });
  }

  const eventId = parseInt(eventIdParam, 10);
  if (isNaN(eventId)) {
    return NextResponse.json({ error: 'eventId must be a number' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${BASE}/event/${eventId}/incidents`, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json({ incidents: [] }, {
        status: 200,
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    const data = await res.json();
    const incidents = data.incidents || [];

    // Also fetch event header for team IDs
    let homeTeamId: number | null = null;
    let awayTeamId: number | null = null;

    try {
      const eventRes = await fetch(`${BASE}/event/${eventId}`, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      });
      if (eventRes.ok) {
        const eventData = await eventRes.json();
        const event = eventData.event;
        if (event) {
          homeTeamId = event.homeTeam?.id ?? null;
          awayTeamId = event.awayTeam?.id ?? null;
        }
      }
    } catch {
      // Non-fatal — we can still use incidents without team IDs
    }

    // Process incidents to mark home/away based on team IDs
    const processedIncidents = incidents.map((inc: any) => {
      const isHome = (homeTeamId && inc.player?.team?.id === homeTeamId) ||
                     (inc.isHome === true) ||
                     (inc.homeScore !== undefined && inc.incidentType !== 'period');
      return {
        ...inc,
        isHome,
      };
    });

    return NextResponse.json({
      incidents: processedIncidents,
      homeTeamId,
      awayTeamId,
    }, {
      status: 200,
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=60' },
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ incidents: [] }, { status: 200 });
    }
    console.error('[match-incidents] Error:', error);
    return NextResponse.json({ incidents: [] }, { status: 200 });
  }
}
