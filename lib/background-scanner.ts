// ============================================
// BACKGROUND SCANNER SERVICE
// ============================================
// Manages background match scanning that persists across page navigation
// Uses Web Workers and Service Workers for continuous background operation

import type { LiveMatch } from '@/lib/football-data';
import type { Filter } from '@/lib/supabase';
import { applyFiltersToMatch } from '@/lib/filter-engine';
import { sendMatchNotification } from '@/lib/notifications';
import { sendTelegramMatchNotification } from '@/lib/telegram';
import { authHelpers, dbHelpers } from '@/lib/supabase';

// ============================================
// TYPES
// ============================================

export interface BackgroundScannerState {
  isRunning: boolean;
  lastScanTime: Date | null;
  totalScans: number;
  notificationsSent: number;
  activeFilters: number;
  matchesScanned: number;
}

// ============================================
// BACKGROUND SCANNER CLASS
// ============================================

class BackgroundScannerService {
  private intervalId: NodeJS.Timeout | null = null;
  private notificationsSent: Map<string, Date> = new Map();
  private state: BackgroundScannerState = {
    isRunning: false,
    lastScanTime: null,
    totalScans: 0,
    notificationsSent: 0,
    activeFilters: 0,
    matchesScanned: 0,
  };

  /**
   * Start the background scanner
   * Runs every 30 seconds regardless of which page user is on
   */
  public start(intervalSeconds: number = 30) {
    if (this.intervalId) {
      console.warn('⚠️ Background scanner already running');
      return;
    }

    console.log('▶️ Background Scanner: Starting (interval: ' + intervalSeconds + 's)');
    this.state.isRunning = true;

    // Run immediately on start
    this.runScan();

    // Then run at intervals
    this.intervalId = setInterval(() => {
      this.runScan();
    }, intervalSeconds * 1000);

    // Store state in sessionStorage so other tabs know scanner is running
    this.saveStateToStorage();
  }

  /**
   * Stop the background scanner
   */
  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Background Scanner: Stopped');
    }
    this.state.isRunning = false;
    this.saveStateToStorage();
  }

  /**
   * Main scan function
   * Fetches matches, loads filters, evaluates all filters
   */
  private async runScan() {
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (!currentUser) {
        console.log('⏸️ Scanner: No user logged in');
        return;
      }

      // Fetch live matches
      const { getLiveMatches } = await import('@/lib/unified-api');
      const matches = await getLiveMatches();

      if (!matches || matches.length === 0) {
        console.log('⏸️ Scanner: No live matches');
        return;
      }

      // Load active filters from database
      const allFilters = await dbHelpers.getUserFilters(currentUser.id);
      const activeFilters = allFilters.filter(f => f.is_active && f.notification_enabled);

      if (activeFilters.length === 0) {
        console.log('⏸️ Scanner: No active filters with notifications');
        return;
      }

      this.state.activeFilters = activeFilters.length;
      this.state.matchesScanned = matches.length;

      let notificationsSentThisScan = 0;

      // Scan each match
      for (const match of matches) {
        const matchResults = await applyFiltersToMatch(match, activeFilters);

        if (matchResults.length > 0) {
          console.log(`✅ Match ${match.fixture.id} triggered ${matchResults.length} filter(s)`);

          // Send notifications for each matched filter
          for (const result of matchResults) {
            const notifKey = `${match.fixture.id}-${result.filter.id}`;

            // Check if we already sent this notification (dedup)
            if (!this.hasNotificationBeenSent(notifKey)) {
              await this.sendNotifications(match, result.filter);
              this.markNotificationAsSent(notifKey);
              notificationsSentThisScan++;
            }
          }
        }
      }

      // Update state
      this.state.totalScans++;
      this.state.lastScanTime = new Date();
      this.state.notificationsSent += notificationsSentThisScan;
      this.saveStateToStorage();

      console.log(`✅ Background Scanner: Scan complete. Sent ${notificationsSentThisScan} notifications.`);
    } catch (error) {
      console.error('❌ Background Scanner error:', error);
    }
  }

  /**
   * Send notifications via web push and telegram
   */
  private async sendNotifications(match: LiveMatch, filter: Filter) {
    try {
      const matchData = {
        homeTeam: match.teams.home.name,
        awayTeam: match.teams.away.name,
        league: match.league.name,
        minute: match.fixture.status.elapsed || 0,
        matchId: match.fixture.id,
      };

      // Send web push notification
      if (filter.notification_enabled) {
        await sendMatchNotification(matchData, [filter.name]);
      }

      // Send Telegram notification
      if (filter.telegram_enabled) {
        const currentUser = authHelpers.getCurrentUser();
        if (currentUser) {
          const telegramMatchData = {
            homeTeam: match.teams.home.name,
            awayTeam: match.teams.away.name,
            league: match.league.name,
            score: `${match.goals.home || 0}-${match.goals.away || 0}`,
            minute: match.fixture.status.elapsed || null,
            filters: [filter.name],
          };
          await sendTelegramMatchNotification(currentUser.id, telegramMatchData);
        }
      }

      // Log to database
      const currentUser = authHelpers.getCurrentUser();
      if (currentUser) {
        // Log notification
        await dbHelpers.logNotification({
          user_id: currentUser.id,
          match_id: match.fixture.id.toString(),
          filter_id: filter.id,
          notification_type: 'background_scan',
          title: '🎯 R$Q Alert - Match Found!',
          message: `${match.teams.home.name} vs ${match.teams.away.name} - ${filter.name}`,
          delivered: true,
          read: false,
        });

        // Log triggered match for history/analytics
        await dbHelpers.logTriggeredMatch({
          user_id: currentUser.id,
          match_id: match.fixture.id.toString(),
          filter_id: filter.id,
          filter_name: filter.name,
          home_team: match.teams.home.name,
          away_team: match.teams.away.name,
          league_name: match.league.name,
          triggered_at: new Date().toISOString(),
          match_time: match.fixture.status.elapsed || null,
          score_home: match.goals.home || null,
          score_away: match.goals.away || null,
          match_status: match.fixture.status.short || 'ongoing',
        });
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  /**
   * Check if notification already sent
   */
  private hasNotificationBeenSent(key: string): boolean {
    const lastSent = this.notificationsSent.get(key);
    if (!lastSent) return false;

    // Consider notification "already sent" for 24 hours
    const hoursSinceLastNotification = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastNotification < 24;
  }

  /**
   * Mark notification as sent
   */
  private markNotificationAsSent(key: string) {
    this.notificationsSent.set(key, new Date());
  }

  /**
   * Reset notifications tracker
   */
  public resetNotifications() {
    this.notificationsSent.clear();
    console.log('🔄 Background Scanner: Notifications reset');
  }

  /**
   * Get current state
   */
  public getState(): BackgroundScannerState {
    return { ...this.state };
  }

  /**
   * Save state to sessionStorage for cross-tab communication
   */
  private saveStateToStorage() {
    try {
      sessionStorage.setItem('rsq_scanner_state', JSON.stringify(this.state));
    } catch (e) {
      // sessionStorage might not be available in all contexts
    }
  }

  /**
   * Load state from sessionStorage
   */
  public loadStateFromStorage(): BackgroundScannerState | null {
    try {
      const stored = sessionStorage.getItem('rsq_scanner_state');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let scannerInstance: BackgroundScannerService | null = null;

export function getBackgroundScanner(): BackgroundScannerService {
  if (!scannerInstance) {
    scannerInstance = new BackgroundScannerService();
  }
  return scannerInstance;
}

// ============================================
// HOOK FOR REACT COMPONENTS
// ============================================

export function useBackgroundScanner(initialEnabled: boolean = true) {
  const scanner = getBackgroundScanner();

  const start = (intervalSeconds?: number) => {
    scanner.start(intervalSeconds);
  };

  const stop = () => {
    scanner.stop();
  };

  const getState = () => scanner.getState();
  const resetNotifications = () => scanner.resetNotifications();

  return {
    start,
    stop,
    getState,
    resetNotifications,
  };
}
