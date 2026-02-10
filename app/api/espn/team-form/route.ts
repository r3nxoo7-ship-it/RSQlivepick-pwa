import { NextRequest, NextResponse } from 'next/server';
import * as ESPNAPI from '@/lib/espn-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/espn/team-form?teamId=xxx&league=eng.1&limit=10
 *
 * Fetches team match history directly from ESPN schedule API.
 * No database dependency - always returns fresh data.
 */
export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get('teamId');
  const league = request.nextUrl.searchParams.get('league') || undefined;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

  if (!teamId) {
    return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  }

  try {
    console.log(`[Team Form API] Fetching schedule for teamId=${teamId}, league=${league || 'auto-detect'}`);

    // Fetch from ESPN team schedule endpoint (returns 12-15 completed matches)
    const espnMatches = await ESPNAPI.getTeamSchedule(String(teamId), league);

    // Convert ESPNMatch[] to RecentMatchData[] format (what the frontend expects)
    const matches = espnMatches.slice(0, limit).map(m => ({
      id: m.id,
      date: m.date,
      league: m.__league_config?.name || league || 'Soccer',
      sport: 'soccer',
      status: m.status,
      minute: m.minute || null,
      home_team_id: m.homeTeam.id,
      away_team_id: m.awayTeam.id,
      home_team_name: m.homeTeam.displayName || m.homeTeam.name,
      away_team_name: m.awayTeam.displayName || m.awayTeam.name,
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
      home_red_cards: m.homeRedCards || null,
      away_red_cards: m.awayRedCards || null,
      raw_data: { leagueCode: (m as any).__league_config?.league || null },
    }));

    // Sort by date descending (most recent first)
    matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate form stats
    const form = calculateForm(matches, String(teamId));

    console.log(`[Team Form API] teamId=${teamId}: ${matches.length} completed matches found`);

    return NextResponse.json({
      teamId,
      matches,
      form,
    });
  } catch (error) {
    console.error('Error fetching team form:', error);
    return NextResponse.json({ error: 'Failed to fetch team form' }, { status: 500 });
  }
}

function calculateForm(matches: any[], teamId: string) {
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;

  for (const m of matches) {
    const isHome = String(m.home_team_id) === String(teamId);
    const gf = isHome ? m.home_score : m.away_score;
    const ga = isHome ? m.away_score : m.home_score;
    goalsFor += gf;
    goalsAgainst += ga;
    if (gf > ga) wins++;
    else if (gf === ga) draws++;
    else losses++;
  }

  return {
    played: matches.length,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    winRate: matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0,
  };
}
