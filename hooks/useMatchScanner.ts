// ============================================
// R$Q - MATCH SCANNER HOOK
// ============================================
// Hook pentru scanare automată meciuri și trimitere notificări
// Pentru începători: învață React hooks, intervals, side effects

import { useEffect, useRef, useState } from 'react';
import { LiveMatch } from '@/lib/football-data';
import type { Filter } from '@/lib/supabase';
import { applyFiltersToMatch, FilterMatchResult } from '@/lib/filter-engine';
import { sendMatchNotification } from '@/lib/notifications';
import { dbHelpers, authHelpers } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

interface ScannerStats {
  totalScans: number;
  notificationsSent: number;
  lastScanTime: Date | null;
  isScanning: boolean;
}

interface NotificationRecord {
  matchId: number;
  filterId: string;
  sentAt: Date;
}

// ============================================
// HOOK
// ============================================

/**
 * useMatchScanner - Hook for automatic match scanning
 *
 * @param matches - Array of live matches
 * @param filters - Array of active filters
 * @param enabled - Whether the scanner is enabled
 * @param intervalSeconds - Interval between scans (default: 45s)
 * @returns stats - Scanner statistics
 *
 * DETAILS:
 * - Every 45s the hook scans all matches
 * - For each match it checks which filters match
 * - If a match is found for the first time -> send a notification
 * - Uses a Map to track sent notifications and prevent duplicates
 */
export function useMatchScanner(
  matches: LiveMatch[],
  filters: Filter[],
  enabled: boolean = true,
  intervalSeconds: number = 45
) {
  
  // ============================================
  // STATE
  // ============================================
  
  const [stats, setStats] = useState<ScannerStats>({
    totalScans: 0,
    notificationsSent: 0,
    lastScanTime: null,
    isScanning: false,
  });
  
  // Map pentru a track notificări trimise
  // Key: "matchId-filterId"
  // Value: NotificationRecord
  const notificationsSentRef = useRef<Map<string, NotificationRecord>>(new Map());
  
  // ============================================
  // SCAN FUNCTION
  // ============================================
  
  const scanMatches = async () => {
    if (!enabled || matches.length === 0 || filters.length === 0) {
      return;
    }
    
    // Filtrează doar filtrele ACTIVE și cu notificări ENABLED
    const activeFilters = filters.filter(f => f.is_active && f.notification_enabled);
    
    if (activeFilters.length === 0) {
      console.log('⏸️ Scanner: No active filters with notifications enabled');
      return;
    }
    
    setStats(prev => ({ ...prev, isScanning: true }));
    
    console.log('🔍 Scanner: Scanning', matches.length, 'matches with', activeFilters.length, 'filters');
    
    let notificationsSentThisScan = 0;
    
    try {
      // Scanează fiecare meci
      for (const match of matches) {
        // Aplică toate filtrele pe acest meci
        const matchResults = await applyFiltersToMatch(match, activeFilters);
        
        // Dacă meciul match-uiește vreun filtru
        if (matchResults.length > 0) {
          console.log(`✅ Match ${match.fixture.id} matches ${matchResults.length} filter(s)`);
          
          // Pentru fiecare filtru matched
          for (const result of matchResults) {
            const notifKey = `${match.fixture.id}-${result.filter.id}`;
            
            // Verifică dacă am mai trimis notificare pentru acest match + filter
            if (!notificationsSentRef.current.has(notifKey)) {
              
              // TRIMITE NOTIFICARE!
              console.log(`🔔 Sending notification for match ${match.fixture.id}, filter "${result.filter.name}"`);
              
              const success = await sendMatchNotification(
                {
                  homeTeam: match.teams.home.name,
                  awayTeam: match.teams.away.name,
                  league: match.league.name,
                  minute: match.fixture.status.elapsed || 0,
                  matchId: match.fixture.id,
                },
                [result.filter.name]
              );
              
              if (success) {
                // Marchează ca trimis
                notificationsSentRef.current.set(notifKey, {
                  matchId: match.fixture.id,
                  filterId: result.filter.id,
                  sentAt: new Date(),
                });
                
                notificationsSentThisScan++;
                
                // Log în Supabase pentru istoric permanent
                const currentUser = authHelpers.getCurrentUser();
                if (currentUser) {
                  await dbHelpers.logNotification({
                    user_id: currentUser.id,
                    match_id: match.fixture.id.toString(),
                    filter_id: result.filter.id,
                    notification_type: 'match_alert',
                    title: '🎯 R$Q Alert - Match Found!',
                    message: `${match.teams.home.name} vs ${match.teams.away.name} - ${result.filter.name}`,
                    delivered: true,
                    read: false,
                  });
                }
              }
            } else {
              console.log(`⏭️ Notification already sent for match ${match.fixture.id}, filter "${result.filter.name}"`);
            }
          }
        }
      }
      
      // Update stats
      setStats(prev => ({
        totalScans: prev.totalScans + 1,
        notificationsSent: prev.notificationsSent + notificationsSentThisScan,
        lastScanTime: new Date(),
        isScanning: false,
      }));
      
      console.log(`✅ Scanner: Scan complete. Sent ${notificationsSentThisScan} notifications.`);
      
    } catch (error) {
      console.error('❌ Scanner error:', error);
      setStats(prev => ({ ...prev, isScanning: false }));
    }
  };
  
  // ============================================
  // EFFECT - AUTO SCAN
  // ============================================
  
  useEffect(() => {
    if (!enabled) {
      console.log('⏸️ Scanner: Disabled');
      return;
    }
    
    console.log(`▶️ Scanner: Starting (interval: ${intervalSeconds}s)`);
    
    // Scanează imediat la start
    scanMatches();
    
    // Apoi la fiecare X secunde
    const interval = setInterval(() => {
      scanMatches();
    }, intervalSeconds * 1000);
    
    // Cleanup când componenta se demontează sau enabled se schimbă
    return () => {
      console.log('⏹️ Scanner: Stopped');
      clearInterval(interval);
    };
  }, [matches, filters, enabled, intervalSeconds]);
  
  // ============================================
  // CLEANUP - RESET NOTIFICATIONS
  // ============================================
  
  /**
   * Resetează lista de notificări trimise
   * Util când user-ul vrea să primească din nou notificări pentru același meci
   */
  const resetNotifications = () => {
    notificationsSentRef.current.clear();
    console.log('🔄 Notifications tracker reset');
  };
  
  // ============================================
  // RETURN
  // ============================================
  
  return {
    stats,
    resetNotifications,
    notificationsSent: Array.from(notificationsSentRef.current.values()),
  };
}

// ============================================
// EXPORT
// ============================================

export default useMatchScanner;

// ============================================
// USAGE EXAMPLE
// ============================================

/*
import { useMatchScanner } from '@/hooks/useMatchScanner';

function LiveMatchesPage() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  
  // Use scanner hook
  const { stats, resetNotifications } = useMatchScanner(
    matches,
    filters,
    scannerEnabled,
    45 // Scan la 45s
  );
  
  return (
    <div>
      <p>Scanner status: {stats.isScanning ? 'Scanning...' : 'Idle'}</p>
      <p>Total scans: {stats.totalScans}</p>
      <p>Notifications sent: {stats.notificationsSent}</p>
      <button onClick={resetNotifications}>Reset</button>
    </div>
  );
}
*/
