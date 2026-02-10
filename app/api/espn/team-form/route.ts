import { NextRequest, NextResponse } from 'next/server';
import { getTeamRecentMatches, calculateTeamForm, getCompletedMatchCount, syncRecentDays } from '@/lib/espn-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get('teamId');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

  if (!teamId) {
    return NextResponse.json({ error: 'teamId required' }, { status: 400 });
  }

  try {
    console.log(`[Team Form API] Fetching form for teamId=${teamId}, limit=${limit}`);
    let recentMatches = await getTeamRecentMatches(String(teamId), limit);

    // On-demand: if no matches found for this team, check if DB has any completed matches at all
    if (recentMatches.length === 0) {
      const completedCount = await getCompletedMatchCount();
      if (completedCount < 10) {
        console.log(`[Team Form API] No matches for team ${teamId}, DB has ${completedCount} completed. Syncing past 14 days...`);
        try {
          await syncRecentDays(14);
          recentMatches = await getTeamRecentMatches(String(teamId), limit);
          console.log(`[Team Form API] After sync: ${recentMatches.length} matches for team ${teamId}`);
        } catch (syncErr) {
          console.error('[Team Form API] On-demand sync failed:', syncErr);
        }
      }
    }

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
