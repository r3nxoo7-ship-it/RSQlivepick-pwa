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
 * Get live soccer matches from Supabase (FIFA only)
 * Returns data synced in the last minute, filtered for soccer sport
 */
export async function GET(request: NextRequest) {
  try {
    const rawMatches = await espnSync.getLiveMatchesFromDB();
    
    // Filter for soccer only, and ensure we have valid team data
    const soccerMatches = rawMatches.filter(row => 
      (row.sport === 'soccer' || !row.sport) && 
      row.home_team_name && 
      row.away_team_name &&
      row.id
    );
    
    // Convert raw database rows to LiveMatch format
    const matches = soccerMatches.map(row => espnSync.convertESPNMatchToLiveMatch(row));
    
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
