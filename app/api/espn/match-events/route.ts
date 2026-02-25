import { NextRequest, NextResponse } from 'next/server';
import { LEAGUE_NAME_TO_CODE } from '@/lib/espn-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/espn/match-events?eventId=704646&league=eng.1
 *
 * Fetches key match events (goals, cards, substitutions) from ESPN summary endpoint.
 * Returns structured event timeline data for momentum visualization.
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get('eventId');
  const league = request.nextUrl.searchParams.get('league') || 'eng.1';

  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  try {
    // Map league display names to ESPN codes (full list from espn-api.ts)
    const leagueCode = LEAGUE_NAME_TO_CODE[league] || league;

    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/summary?event=${eventId}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'LivePick-PWA/1.0' },
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return NextResponse.json({ error: `ESPN returned ${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const keyEvents = data.keyEvents || [];

    // Parse events into our format
    const events: MatchEvent[] = [];

    for (const evt of keyEvents) {
      const type = evt.type?.type;
      if (!type) continue;

      // Only include meaningful events (skip kickoff, halftime markers for the bar chart)
      const eventType = mapEventType(type);
      if (!eventType) continue;

      const minute = parseMinute(evt.clock?.displayValue || '');
      const period = evt.period?.number || 1;
      const teamId = evt.team?.id ? String(evt.team.id) : null;
      const teamName = evt.team?.displayName || null;
      // For substitutions extract both players (in/out)
      let player = evt.participants?.[0]?.athlete?.displayName || null;
      let playerOut: string | null = null;
      if (eventType === 'substitution' && evt.participants?.length >= 2) {
        const inP = evt.participants.find((p: any) => p.type?.type === 'subbedIn' || p.type?.name === 'subbedIn');
        const outP = evt.participants.find((p: any) => p.type?.type === 'subbedOut' || p.type?.name === 'subbedOut');
        player = inP?.athlete?.displayName || evt.participants[0]?.athlete?.displayName || null;
        playerOut = outP?.athlete?.displayName || evt.participants[1]?.athlete?.displayName || null;
      }

      events.push({
        minute,
        period,
        type: eventType,
        teamId,
        teamName,
        player,
        playerOut,
        isScoring: evt.scoringPlay || false,
        text: evt.shortText || evt.text || '',
      });
    }

    // Also extract header details for goal scorer info
    const headerDetails = data.header?.competitions?.[0]?.details || [];
    const goalDetails = headerDetails
      .filter((d: any) => d.scoringPlay)
      .map((d: any) => ({
        minute: parseMinute(d.clock?.displayValue || ''),
        teamId: d.team?.id ? String(d.team.id) : null,
        teamName: d.team?.displayName || null,
        player: d.participants?.[0]?.athlete?.displayName || null,
        isPenalty: (d.penaltyKick === true) || false,
      }));

    // Extract home/away team IDs from header
    const competitors = data.header?.competitions?.[0]?.competitors || [];
    let homeTeamId: string | null = null;
    let awayTeamId: string | null = null;
    for (const comp of competitors) {
      if (comp.homeAway === 'home') homeTeamId = String(comp.id);
      if (comp.homeAway === 'away') awayTeamId = String(comp.id);
    }

    return NextResponse.json({
      eventId,
      homeTeamId,
      awayTeamId,
      events,
      goalDetails,
    }, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=60' },
    });
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'ESPN timeout' }, { status: 504 });
    }
    console.error('[match-events] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch match events' }, { status: 500 });
  }
}

interface MatchEvent {
  minute: number;
  period: number;
  type: string;
  teamId: string | null;
  teamName: string | null;
  player: string | null;
  playerOut: string | null;
  isScoring: boolean;
  text: string;
}

function mapEventType(espnType: string): string | null {
  switch (espnType) {
    case 'goal': return 'goal';
    case 'penalty---scored': return 'penalty-goal';
    case 'penalty---missed': return 'penalty-miss';
    case 'own-goal': return 'own-goal';
    case 'yellow-card': return 'yellow-card';
    case 'red-card': return 'red-card';
    case 'second-yellow-card': return 'red-card';
    case 'substitution': return 'substitution';
    case 'corner-kick':
    case 'corner': return 'corner';
    case 'var': return 'var';
    case 'shot-on-target': return 'shot-on-target';
    case 'shot-off-target': return 'shot-off-target';
    case 'shot': return 'shot-off-target';
    case 'save': return 'shot-on-target';
    case 'blocked-shot': return 'shot-off-target';
    // Skip these non-actionable events
    case 'kickoff':
    case 'halftime':
    case 'start-2nd-half':
    case 'end-regular-time':
    case 'full-time':
      return null;
    default: return espnType;
  }
}

function parseMinute(displayValue: string): number {
  if (!displayValue) return 0;
  // Handle "45'+2'" → 47, "90'+3'" → 93
  const match = displayValue.match(/(\d+)'(?:\+(\d+)')?/);
  if (match) {
    return parseInt(match[1]) + (parseInt(match[2]) || 0);
  }
  return parseInt(displayValue) || 0;
}
