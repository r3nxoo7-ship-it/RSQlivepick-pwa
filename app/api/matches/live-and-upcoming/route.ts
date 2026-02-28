/**
 * GET /api/matches/live-and-upcoming
 * 
 * Returns live + upcoming matches from unified API (SofaScore PRIMARY)
 * Server-side only to avoid CORS issues with direct SofaScore API calls
 */
import { NextResponse } from 'next/server';
import { getLiveAndUpcomingMatches } from '@/lib/unified-api';

export async function GET() {
  try {
    const data = await getLiveAndUpcomingMatches();
    return NextResponse.json(data, { 
      headers: { 
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' 
      } 
    });
  } catch (error) {
    console.error('[API] /api/matches/live-and-upcoming error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch matches',
        live: [],
        upcoming: [],
        scheduled: [],
        teamForm: {}
      },
      { status: 500 }
    );
  }
}
