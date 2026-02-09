'use client';

import { useEffect } from 'react';

/**
 * Periodically syncs ESPN data to Supabase
 * Runs on component mount and every 60 seconds thereafter
 * Ensures fresh match data is always available
 */
export default function ESPNSyncScheduler() {
  useEffect(() => {
    // Sync immediately on mount
    const syncNow = async () => {
      try {
        console.log('📊 [ESPNSyncScheduler] Syncing ESPN data...');
        const response = await fetch('/api/espn/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ [ESPNSyncScheduler] Synced: ${data.matches.synced} matches`);
        } else {
          console.warn('⚠️ [ESPNSyncScheduler] Sync failed:', response.status);
        }
      } catch (error) {
        console.error('❌ [ESPNSyncScheduler] Sync error:', error);
      }
    };

    // Initial sync
    syncNow();

    // Set up periodic sync every 60 seconds
    const interval = setInterval(syncNow, 60000);

    // Cleanup
    return () => clearInterval(interval);
  }, []);

  // Invisible component - only for scheduling syncs
  return null;
}
