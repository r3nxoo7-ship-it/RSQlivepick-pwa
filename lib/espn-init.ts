// ============================================
// ESPN SYNC INITIALIZATION
// ============================================
// Call this once on app startup to begin automatic syncing

import { startESPNCron, isESPNCronRunning } from './espn-cron';

export async function initializeESPNSync() {
  // Don't re-initialize if already running
  if (typeof window === 'undefined' && !isESPNCronRunning()) {
    // Server-side initialization
    try {
      console.log('🎬 Initializing ESPN sync service...');
      startESPNCron();
      console.log('✅ ESPN sync service ready');
    } catch (error) {
      console.error('❌ Failed to initialize ESPN sync:', error);
    }
  }
}

// Export as utility for manual calls
export { startESPNCron, isESPNCronRunning } from './espn-cron';
