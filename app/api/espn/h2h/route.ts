import { NextRequest, NextResponse } from 'next/server';
import * as ESPNAPI from '@/lib/espn-api';

export const dynamic = 'force-dynamic';
export const revalidate = 120; // Cache short-lived

/**
 * GET /api/espn/h2h?homeId=xxx&awayId=yyy&limit=10
 * Returns recent head-to-head matches between two teams (most recent first)
 */
export async function GET(request: NextRequest) {
  const homeId = request.nextUrl.searchParams.get('homeId');
  const awayId = request.nextUrl.searchParams.get('awayId');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

  if (!homeId || !awayId) return NextResponse.json({ error: 'homeId and awayId required' }, { status: 400 });

  try {
    // Fetch completed schedules for home team (limit search across leagues)
    const homeMatches = await ESPNAPI.getTeamSchedule(String(homeId));

    // Find matches where opponent is awayId
    const h2h = homeMatches.filter(m => {
      const hid = String(m.homeTeam.id);
      const aid = String(m.awayTeam.id);
      return hid === String(homeId) && aid === String(awayId) || hid === String(awayId) && aid === String(homeId);
    }).slice(0, limit).map(m => ({
      id: m.id,
      date: m.date,
      league: (m as any).__league_config?.name || null,
      status: m.status,
      home_team_id: m.homeTeam.id,
      away_team_id: m.awayTeam.id,
      home_team_name: m.homeTeam.displayName || m.homeTeam.name,
      away_team_name: m.awayTeam.displayName || m.awayTeam.name,
      home_score: m.homeScore || 0,
      away_score: m.awayScore || 0,
    }));

    return NextResponse.json({ homeId, awayId, matches: h2h }, { headers: { 'Cache-Control': 'private, max-age=120' } });
  } catch (err) {
    console.error('Error fetching H2H:', err);
    return NextResponse.json({ error: 'Failed to fetch H2H' }, { status: 500 });
  }
}
