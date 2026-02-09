// ============================================
// ESPN CRON JOB SERVICE
// ============================================
// Runs every 1 minute automatically
// Fetches from ESPN, saves to Supabase
// Prevents 100 users from fetching ESPN 100 times

import * as espnSync from './espn-sync';

let cronInterval: NodeJS.Timeout | null = null;
let isInitialized = false;

/**
 * Start the 1-minute ESPN sync cron job
 * Call this on app startup/initialization
 */
export function startESPNCron() {
  if (isInitialized) {
    console.log('📊 [ESPN Cron] Already initialized');
    return;
  }

  console.log('🚀 [ESPN Cron] Starting 1-minute sync job...');

  // Run immediately on startup
  syncAndLog();

  // Then run every 60 seconds
  cronInterval = setInterval(syncAndLog, 60000);

  isInitialized = true;
  console.log('✅ [ESPN Cron] Initialized - will sync every 60 seconds');
}

/**
 * Stop the cron job (for cleanup)
 */
export function stopESPNCron() {
  if (cronInterval) {
    clearInterval(cronInterval);
    cronInterval = null;
    isInitialized = false;
    console.log('⏹️ [ESPN Cron] Stopped');
  }
}

/**
 * Check if cron is running
 */
export function isESPNCronRunning(): boolean {
  return isInitialized;
}

// ============================================
// INTERNAL
// ============================================

async function syncAndLog() {
  const timestamp = new Date().toISOString();
  console.log(`⏱️ [ESPN Cron] Executing sync at ${timestamp}`);

  try {
    const result = await espnSync.syncAllMatches();
    console.log(`✅ [ESPN Cron] Sync complete - ${result.count} matches in ${result.duration}ms`);
  } catch (error) {
    console.error(`❌ [ESPN Cron] Sync failed:`, error instanceof Error ? error.message : String(error));
  }
}
