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
 * Called every 10 minute by client-side cron
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📨 [API] ESPN sync endpoint called');

    // Main sync: today's matches (happens every call)
    const matchResult = await espnSync.syncAllMatches();

    // Occasional sync: teams (approx 10% of calls)
    let teamResult = { count: 0, duration: 0 };
    if (Math.random() < 0.1) {
      teamResult = await espnSync.syncAllTeams();
    }

    // Occasional sync: upcoming 7 days (~1% of calls)
    let upcomingResult = { count: 0, duration: 0 };
    if (Math.random() < 0.01) {
      upcomingResult = await espnSync.syncUpcomingDays(7);
    }

    // Occasional sync: past 14 days for team form history (~0.5% of calls)
    let recentResult = { count: 0, duration: 0 };
    if (Math.random() < 0.005) {
      recentResult = await espnSync.syncRecentDays(14);
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
      upcoming: {
        synced: upcomingResult.count,
        duration_ms: upcomingResult.duration,
      },
      recent: {
        synced: recentResult.count,
        duration_ms: recentResult.duration,
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
