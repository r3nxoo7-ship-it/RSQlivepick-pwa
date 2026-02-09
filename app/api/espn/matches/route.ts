// ============================================
// GET LIVE MATCHES FROM SUPABASE
// ============================================
// GET /api/espn/matches
// Users read from here, not from ESPN directly
// Data is synced every 1 minute via cron

import { NextRequest, NextResponse } from 'next/server';
import * as espnSync from '@/lib/espn-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/espn/matches
 * Get live matches from Supabase
 * Returns data synced in the last minute
 */
export async function GET(request: NextRequest) {
  try {
    const rawMatches = await espnSync.getLiveMatchesFromDB();
    
    // Convert raw database rows to LiveMatch format
    const matches = rawMatches.map(row => espnSync.convertESPNMatchToLiveMatch(row));
    
    return NextResponse.json({
      success: true,
      count: matches.length,
      matches,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=5', // Can cache for 5 seconds
        'X-Data-Source': 'Supabase (synced from ESPN)',
      }
    });
  } catch (error) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch matches',
        matches: [],
      },
      { status: 500 }
    );
  }
}
