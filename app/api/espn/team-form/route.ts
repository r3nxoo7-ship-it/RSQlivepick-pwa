import { NextRequest, NextResponse } from 'next/server';
import { getTeamRecentMatches, calculateTeamForm } from '@/lib/espn-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get('teamId');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

  if (!teamId) {
    return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  }

  try {
    console.log(`[Team Form API] Fetching form for teamId=${teamId}, limit=${limit}`);
    const recentMatches = await getTeamRecentMatches(String(teamId), limit);
    console.log(`[Team Form API] teamId=${teamId}: ${recentMatches.length} matches found`);
    const form = calculateTeamForm(recentMatches, String(teamId));

    return NextResponse.json({
      teamId,
      matches: recentMatches,
      form,
    });
  } catch (error) {
    console.error('Error fetching team form:', error);
    return NextResponse.json({ error: 'Failed to fetch team form' }, { status: 500 });
  }
}
