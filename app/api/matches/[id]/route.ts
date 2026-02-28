/**
 * GET /api/matches/[id]
 * 
 * Returns match data by ID from unified API
 * Server-side only to avoid CORS issues
 */
import { NextRequest, NextResponse } from 'next/server';
import { getMatchById } from '@/lib/unified-api';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const matchId = params.id;
    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 });
    }

    const match = await getMatchById(matchId);
    
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    return NextResponse.json({ match }, { 
      headers: { 
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' 
      } 
    });
  } catch (error) {
    console.error(`[API] /api/matches/${params.id} error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch match data', match: null },
      { status: 500 }
    );
  }
}
