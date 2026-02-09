// ============================================
// ESPN CRON JOB SERVICE
// ============================================
// Runs every 1 minute automatically via API endpoint
// Prevents 100 users from fetching ESPN 100 times
// Safe for client-side (calls API, doesn't use server secrets)

let cronInterval: NodeJS.Timeout | null = null;
let isInitialized = false;

/**
 * Start the 1-minute ESPN sync cron job
 * Calls /api/espn/sync endpoint (server-side)
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
    // Call the API endpoint (server-side handles Supabase)
    const response = await fetch('/api/espn/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SYNC_KEY || ''}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`✅ [ESPN Cron] Sync complete - ${result.matches?.synced || 0} matches synced`);
  } catch (error) {
    console.warn(`⚠️ [ESPN Cron] Sync request failed (this is optional):`, error instanceof Error ? error.message : String(error));
    // Don't throw - cron should keep running even if sync fails
  }
}
