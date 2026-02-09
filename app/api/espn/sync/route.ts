// ============================================
// ESPN SYNC API ROUTE
// ============================================
// POST /api/espn/sync
// Called every 1 minute by cron job
// Fetches from ESPN once, saves to Supabase
// All users read from Supabase

import { NextRequest, NextResponse } from 'next/server';
import * as espnSync from '@/lib/espn-sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/espn/sync
 * Sync ESPN data to Supabase
 * Called every 1 minute by client-side cron
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📨 [API] ESPN sync endpoint called');

    // Main sync: matches (happens every call)
    const matchResult = await espnSync.syncAllMatches();
    
    // Occasional sync: teams (1 in 10 calls = ~every 10 minutes)
    let teamResult = { count: 0, duration: 0 };
    if (Math.random() < 0.1) {
      teamResult = await espnSync.syncAllTeams();
    }

    return NextResponse.json({
      success: true,
      matches: {
        synced: matchResult.count,
        duration_ms: matchResult.duration,
      },
      teams: {
        synced: teamResult.count,
        duration_ms: teamResult.duration,
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
      }
    });
  } catch (error) {
    console.error('❌ [API] Sync error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Sync failed', 
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/espn/sync
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'ESPN sync endpoint. POST to trigger sync.',
    lastSync: new Date().toISOString(),
  });
}
