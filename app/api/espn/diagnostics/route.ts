// ============================================
// ESPN SYNC DIAGNOSTICS ENDPOINT
// ============================================
// GET /api/espn/diagnostics
// Reports sync status, data source health, and DB counts

import { NextRequest, NextResponse } from 'next/server';
import * as espnSync from '@/lib/espn-sync';
import { registry } from '@/lib/data-sources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/espn/diagnostics
 * Returns detailed sync and data source status
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Diagnostics] Generating sync report...');

    // Get current counts by league
    const countsByLeague = await espnSync.getMatchCountsByLeague();
    const totalMatches = Object.values(countsByLeague).reduce((sum, c) => sum + c, 0);

    // Get per-source stats from the registry
    const sourceStats = registry.getStats();
    const dataSourceStatus = registry.getStatusSummary();

    // List registered sources and their status
    const sources = registry.getOrderedSources().map(s => ({
      name: s.name,
      priority: s.priority,
      enabled: s.enabled,
    }));

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        totalMatches,
        matchesByLeague: countsByLeague,
      },
      sources,
      sourceStats,
      dataSourceStatus,
      lastSyncTime: new Date(espnSync.getLastSyncTime()).toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=10',
      }
    });
  } catch (error) {
    console.error('❌ [Diagnostics] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Diagnostics failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
