/**
 * GET /api/matches/live
 * 
 * Returns live matches from unified API (SofaScore PRIMARY)
 * Server-side only to avoid CORS issues with direct SofaScore API calls
 */
import { NextResponse } from 'next/server';
import { getLiveMatches } from '@/lib/unified-api';

export async function GET() {
  try {
    const matches = await getLiveMatches();
    return NextResponse.json({ matches }, { 
      headers: { 
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' 
      } 
    });
  } catch (error) {
    console.error('[API] /api/matches/live error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live matches', matches: [] },
      { status: 500 }
    );
  }
}
