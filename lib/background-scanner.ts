// ============================================
// BACKGROUND SCANNER SERVICE
// ============================================
// Manages background match scanning that persists across page navigation
// Uses Web Workers and Service Workers for continuous background operation

import type { LiveMatch } from '@/lib/types';
import type { Filter } from '@/lib/supabase';
import { applyFiltersToMatch } from '@/lib/filter-engine';
import { enrichMatchesWithSofascore } from '@/lib/sofascore-live-enricher';
import { filtersNeedEvents, enrichMatchesWithEvents } from '@/lib/match-events-enricher';
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
   * Uses navigator.locks for tab leader election — only ONE tab scans
   * Runs every 15 seconds regardless of which page user is on
   * Reduced from 30s to catch goal events faster (minimize late triggers)
   */
  public start(intervalSeconds: number = 15) {
    if (this.intervalId) {
      console.warn('⚠️ Background scanner already running');
      return;
    }

    // Use Web Locks API to elect a single "leader" tab for scanning.
    // Other tabs will queue on the lock and only become leader when the
    // current leader tab is closed. This prevents duplicate notifications
    // when multiple tabs are open.
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      (navigator as any).locks.request(
        'rsq-scanner-leader',
        { mode: 'exclusive' },
        async () => {
          console.log('▶️ Background Scanner: This tab is the leader');
          this._startInternal(intervalSeconds);
          // Hold the lock until tab closes by returning a never-resolving promise
          return new Promise<void>(() => {});
        }
      ).catch(() => {
        // If locks API fails, fallback to normal mode
        console.warn('⚠️ Web Locks not available, starting scanner without leader election');
        this._startInternal(intervalSeconds);
      });
    } else {
      this._startInternal(intervalSeconds);
    }
  }

  /**
   * Internal start — sets up the interval timer
   */
  private _startInternal(intervalSeconds: number) {
    if (this.intervalId) return; // Already running

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

      // Load active filters from database - track ALL active filters, not just notification-enabled
      const allFilters = await dbHelpers.getUserFilters(currentUser.id);
      const activeFilters = allFilters.filter(f => f.is_active);

      if (activeFilters.length === 0) {
        console.log('⏸️ Scanner: No active filters');
        return;
      }

      this.state.activeFilters = activeFilters.length;
      this.state.matchesScanned = matches.length;

      // ── Bzzoiro enriched ML predictions (best-effort, non-blocking) ──────────
      // Fetched once per scan cycle via the server-side route so the BZZOIRO_API_TOKEN
      // never leaks to the browser. Cached 10 min server-side.
      let bzzoiroPredMap: Map<string, any> | null = null;
      const hasMLFilters = activeFilters.some(
        f => f.is_active && (f.conditions as any)?.ml_predictions
      );
      if (hasMLFilters) {
        try {
          const bzRes = await fetch('/api/bzzoiro/enriched', {
            signal: AbortSignal.timeout(5000),
          });
          if (bzRes.ok) {
            const bzData = await bzRes.json();
            if (bzData.configured && Array.isArray(bzData.predictions) && bzData.predictions.length > 0) {
              bzzoiroPredMap = new Map<string, any>();
              for (const pred of bzData.predictions) {
                // Build normalised "home|away" key (mirrors lib/bzzoiro normalizeTeamName)
                const norm = (s: string) =>
                  s.toLowerCase().trim()
                    .replace(/\b(fc|afc|cf|sc|fk|sk|ac|as|us|ss|cd|bk|if|ff|hif|ik|united|city|town)\b/g, '')
                    .replace(/[^a-z0-9\s]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                const key = `${norm(pred.home_team)}|${norm(pred.away_team)}`;
                bzzoiroPredMap.set(key, pred);
              }
              console.log(`[Scanner] Bzzoiro enriched: ${bzzoiroPredMap.size} predictions loaded for ML filter matching`);
            }
          }
        } catch (bzErr) {
          console.warn('[Scanner] Bzzoiro enriched fetch failed (non-fatal):', bzErr instanceof Error ? bzErr.message : bzErr);
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      // ── Pre-match odds enrichment (best-effort, non-blocking) ────────────────
      // Fetch odds once per scan cycle from /api/odds/upcoming (server-cached 5min)
      // and attach to matches by team name so pre_match_odds filter conditions work.
      const hasOddsFilters = activeFilters.some(
        f => f.is_active && ((f.conditions as any)?.pre_match_odds || (f.conditions as any)?.odds || (f.conditions as any)?.goal_line || (f.conditions as any)?.match_goals)
      );
      if (hasOddsFilters) {
        try {
          const oddsRes = await fetch('/api/odds/upcoming', {
            signal: AbortSignal.timeout(5000),
          });
          if (oddsRes.ok) {
            const oddsData = await oddsRes.json();
            const oddsMap = oddsData.oddsMap || {};
            const mapKeys = Object.keys(oddsMap);
            if (mapKeys.length > 0) {
              let enrichedCount = 0;
              const cleanName = (s: string) =>
                s.trim().toLowerCase().replace(/[-_.']/g, ' ').replace(/\s+/g, ' ').trim();
              const looseName = (s: string) =>
                s.trim().toLowerCase().replace(/[-_.']/g, ' ').replace(/\s+/g, ' ')
                  .replace(/\b(\w+)s\b/g, '$1').trim();

              for (const m of matches) {
                if ((m as any).odds) continue; // already has odds
                const hName = cleanName(m.teams?.home?.name || '');
                const aName = cleanName(m.teams?.away?.name || '');
                if (!hName || !aName) continue;

                const entry = oddsMap[`${hName}|${aName}`]
                  ?? oddsMap[`${looseName(m.teams!.home!.name!)}|${looseName(m.teams!.away!.name!)}`];
                if (entry) {
                  (m as any).odds = entry;
                  enrichedCount++;
                }
              }
              if (enrichedCount > 0) {
                console.log(`[Scanner] Odds enrichment: attached odds to ${enrichedCount}/${matches.length} matches`);
              }
            }
          }
        } catch (oddsErr) {
          console.warn('[Scanner] Odds enrichment failed (non-fatal):', oddsErr instanceof Error ? oddsErr.message : oddsErr);
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      let notificationsSentThisScan = 0;
      const completedMatches: { match_id: string; score_home: number; score_away: number }[] = [];

      // Enrich ALL live matches with SofaScore stats (xG, big chances, shots in box, pass accuracy, etc.)
      // SofaScore is now PRIMARY data source — always enrich for maximum filter accuracy
      try {
        await enrichMatchesWithSofascore(matches, activeFilters);
      } catch (e) {
        console.warn('[Scanner] SofaScore enrichment failed (non-fatal):', e instanceof Error ? e.message : e);
      }

      // API-Football stats fallback: if matches still lack statistics (SofaScore blocked/down),
      // try fetching individual match stats from API-Football so filter conditions can still trigger
      const matchesNeedingStats = matches.filter((m: any) => {
        const s = m.fixture?.status?.short;
        if (!s || s === 'NS' || s === 'TBD' || s === 'PST' || s === 'CANC') return false;
        return (!m.statistics || m.statistics.length === 0) && !(m as any).sofascore_stats;
      });
      if (matchesNeedingStats.length > 0) {
        try {
          const { getMatchStatistics } = await import('@/lib/api-football');
          const statsResults = await Promise.allSettled(
            matchesNeedingStats.slice(0, 10).map(async (m: any) => {
              const stats = await getMatchStatistics(m.fixture.id);
              if (stats && stats.length > 0) {
                m.statistics = stats;
              }
            })
          );
          const enriched = statsResults.filter(r => r.status === 'fulfilled').length;
          if (enriched > 0) {
            console.log(`[Scanner] API-Football stats fallback: enriched ${enriched}/${matchesNeedingStats.length} matches`);
          }
        } catch (e) {
          console.warn('[Scanner] API-Football stats fallback failed (non-fatal):', e instanceof Error ? e.message : e);
        }
      }

      // Enrich with match event timelines if any filter uses time_window conditions
      if (filtersNeedEvents(activeFilters)) {
        try {
          await enrichMatchesWithEvents(matches, activeFilters);
        } catch (e) {
          console.warn('[Scanner] Match events enrichment failed (non-fatal):', e instanceof Error ? e.message : e);
        }
      }

      // Scan each match - only process matches that are actually live (in progress)
      for (const match of matches) {
        if (!match || !match.fixture || !match.fixture.id) {
          console.warn('⚠️ Scanner: Skipping invalid match (missing fixture.id)', match);
          continue;
        }

        if (!match.teams || !match.teams.home || !match.teams.away) {
          console.warn('⚠️ Scanner: Skipping match with missing team data', match.fixture.id);
          continue;
        }

        // Skip matches that haven't started yet - no stats to evaluate
        const status = match.fixture?.status?.short;
        if (status === 'NS' || status === 'TBD' || status === 'PST' || status === 'CANC') {
          continue;
        }

        // Look up Bzzoiro ML prediction for this match (used by ml_predictions filter conditions)
        let matchMlPred: any | null = null;
        if (bzzoiroPredMap && match.teams.home.name && match.teams.away.name) {
          const normMatch = (s: string) =>
            s.toLowerCase().trim()
              .replace(/\b(fc|afc|cf|sc|fk|sk|ac|as|us|ss|cd|bk|if|ff|hif|ik|united|city|town)\b/g, '')
              .replace(/[^a-z0-9\s]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
          const matchKey = `${normMatch(match.teams.home.name)}|${normMatch(match.teams.away.name)}`;
          matchMlPred = bzzoiroPredMap.get(matchKey) ?? null;
          // Fuzzy fallback: try partial name matching if exact key not found
          if (!matchMlPred) {
            const homeN = normMatch(match.teams.home.name);
            const awayN = normMatch(match.teams.away.name);
            for (const [k, v] of bzzoiroPredMap) {
              const [kh, ka] = k.split('|');
              const hScore = kh && homeN && (kh.includes(homeN) || homeN.includes(kh)) ? 0.8 : 0;
              const aScore = ka && awayN && (ka.includes(awayN) || awayN.includes(ka)) ? 0.8 : 0;
              if (hScore > 0 && aScore > 0) { matchMlPred = v; break; }
            }
          }
        }

        const matchResults = await applyFiltersToMatch(match, activeFilters, matchMlPred);
        if (matchResults && matchResults.length > 0) {
          console.log(`✅ Match ${match.fixture.id} triggered ${matchResults.length} filter(s)`);

          // CONFLICT DETECTION: Check for contradictory filters on same match
          if (matchResults.length >= 2) {
            const { detectContradictoryFilters } = await import('@/lib/live-filter-matcher');
            const conflicts = detectContradictoryFilters(matchResults as any);
            if (conflicts.length > 0) {
              console.warn(`⚠️ CONFLICT DETECTED for match ${match.fixture.id}:`, conflicts.join('; '));
              // Store conflicts for notification (will be shown in dashboard)
              // Note: For now just log - could extend to add conflict warnings to triggered_matches table
            }
          }

          // Send notifications for each matched filter
          for (const result of matchResults) {
            const notifKey = `${match.fixture.id}-${result.filter.id}`;

            // Check if we already sent this notification (dedup)
            if (!this.hasNotificationBeenSent(notifKey)) {
              // Mark as sent BEFORE sending to prevent cross-tab race condition
              // (Another tab checking localStorage will see this write immediately)
              this.markNotificationAsSent(notifKey);
              await this.sendNotifications(match, result.filter);
              notificationsSentThisScan++;
            }
          }
        }
      }

      // Update completed matches with final scores
      for (const match of matches) {
        const status = match.fixture?.status?.short;
        if (status === 'FT' || status === 'AET' || status === 'PEN') {
          completedMatches.push({
            match_id: String(match.fixture.id),
            score_home: match.goals?.home ?? 0,
            score_away: match.goals?.away ?? 0,
          });
        }
      }

      // Update state
      this.state.totalScans++;
      this.state.lastScanTime = new Date();
      this.state.notificationsSent += notificationsSentThisScan;
      this.saveStateToStorage();

      // Every 5 scans (~2.5 minutes), finalize triggered matches and recalculate success rates
      if (this.state.totalScans % 5 === 0 || completedMatches.length > 0) {
        this.finalizeTriggeredMatches(currentUser.id, completedMatches);
      }

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
        homeTeam: match.teams?.home?.name || 'Home',
        awayTeam: match.teams?.away?.name || 'Away',
        league: match.league?.name || 'Unknown',
        minute: match.fixture?.status?.elapsed || 0,
        matchId: match.fixture!.id,
      };

      // Log to database via API route (bypasses RLS)
      // The server checks for duplicates — if another tab/instance already logged this,
      // it returns { duplicate: true } and we skip sending notifications
      let triggeredMatchId: string | undefined;
      let isDuplicate = false;
      const currentUser = authHelpers.getCurrentUser();
      if (currentUser) {
        try {
          const logResponse = await fetch('/api/triggered-matches/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: currentUser.id,
              match_id: (match.fixture?.id || '').toString(),
              filter_id: filter.id,
              filter_name: filter.name,
              home_team: match.teams?.home?.name || '',
              away_team: match.teams?.away?.name || '',
              league_name: match.league?.name || '',
              triggered_at: new Date().toISOString(),
              match_time: match.fixture.status.elapsed || null,
              // Always ensure we capture scores - use goals if available, fall back to 0
              score_home: (match.goals?.home !== null && match.goals?.home !== undefined) ? match.goals.home : 0,
              score_away: (match.goals?.away !== null && match.goals?.away !== undefined) ? match.goals.away : 0,
              ht_score_home: (match as any).period1Home ?? null,
              ht_score_away: (match as any).period1Away ?? null,
              match_status: match.fixture?.status?.short || 'ongoing',
            }),
          });
          const logResult = await logResponse.json();
          if (logResult.success && logResult.id) {
            triggeredMatchId = logResult.id;
            if (logResult.duplicate) {
              isDuplicate = true;
              console.log(`⏭️ Duplicate trigger (already logged): ${logResult.id} — skipping notifications`);
            } else {
              console.log(`✅ Triggered match logged: ${logResult.id}`);
            }
          } else {
            console.error('❌ Failed to log triggered match:', logResult.error);
          }
        } catch (logErr) {
          console.error('❌ Error calling triggered-matches/log API:', logErr);
        }
      }

      // If server detected this was already logged, skip sending notifications
      // (another tab or previous scan cycle already sent them)
      if (isDuplicate) {
        return;
      }

      // Send web push notification with triggered match ID
      if (filter.notification_enabled) {
        const notificationData = {
          ...matchData,
          triggeredMatchId,
        };
        await sendMatchNotification(notificationData, [filter.name]);
      }

      // Send Telegram notification
      if (filter.telegram_enabled && currentUser) {
        const profile = await dbHelpers.getUserProfile(currentUser.id);
        const chatId = profile?.telegram_chat_id;
        if (chatId) {
          const telegramMatchData = {
            homeTeam: match.teams.home.name,
            awayTeam: match.teams.away.name,
            league: match.league.name,
            score: `${match.goals.home || 0}-${match.goals.away || 0}`,
            minute: match.fixture.status.elapsed || null,
            filters: [filter.name],
            triggeredMatchId: triggeredMatchId,
          };
          await sendTelegramMatchNotification(chatId, telegramMatchData);
        } else {
          console.warn('[Scanner] Telegram enabled on filter but user has no telegram_chat_id configured');
        }
      }

      // Log notification
      if (currentUser) {
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
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  /**
   * Check if notification already sent - checks localStorage FIRST (cross-tab),
   * then in-memory cache
   */
  private hasNotificationBeenSent(key: string): boolean {
    // Check localStorage FIRST — this catches writes from other tabs
    try {
      const stored = localStorage.getItem('rsq_notif_sent');
      if (stored) {
        const sentMap: Record<string, number> = JSON.parse(stored);
        const sentTime = sentMap[key];
        if (sentTime) {
          const hoursSince = (Date.now() - sentTime) / (1000 * 60 * 60);
          if (hoursSince < 24) {
            // Re-populate in-memory map
            this.notificationsSent.set(key, new Date(sentTime));
            return true;
          }
        }
      }
    } catch { /* localStorage not available */ }

    // Then check in-memory (faster for same-tab dedup)
    const lastSent = this.notificationsSent.get(key);
    if (lastSent) {
      const hoursSince = (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) return true;
    }

    return false;
  }

  /**
   * Mark notification as sent - persists to localStorage
   */
  private markNotificationAsSent(key: string) {
    const now = new Date();
    this.notificationsSent.set(key, now);

    // Persist to localStorage
    try {
      const stored = localStorage.getItem('rsq_notif_sent');
      const sentMap: Record<string, number> = stored ? JSON.parse(stored) : {};

      // Add new key
      sentMap[key] = now.getTime();

      // Cleanup entries older than 24 hours
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const k of Object.keys(sentMap)) {
        if (sentMap[k] < cutoff) delete sentMap[k];
      }

      localStorage.setItem('rsq_notif_sent', JSON.stringify(sentMap));
    } catch { /* localStorage not available */ }
  }

  /**
   * Finalize triggered matches and recalculate success rates
   */
  private async finalizeTriggeredMatches(
    userId: string,
    completedMatches: { match_id: string; score_home: number; score_away: number }[]
  ) {
    try {
      await fetch('/api/triggered-matches/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          completed_matches: completedMatches.length > 0 ? completedMatches : undefined,
        }),
      });
    } catch {
      // Non-critical, don't log noise
    }
  }

  /**
   * Reset notifications tracker
   */
  public resetNotifications() {
    this.notificationsSent.clear();
    try { localStorage.removeItem('rsq_notif_sent'); } catch { /* ignore */ }
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
