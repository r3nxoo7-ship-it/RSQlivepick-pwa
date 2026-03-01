// ============================================
// MATCH EVENTS ENRICHER
// ============================================
// Fetches individual match events (yellow cards, substitutions, etc.) with
// minute-level data from SofaScore incidents API. Used by the filter engine
// to evaluate time-windowed conditions like "yellow card between min 18-26".
//
// Design:
// - Only runs when at least one active filter has a time_window condition
// - Uses SofaScore event ID already resolved by sofascore-live-enricher
// - Caches events per match for 90 seconds (same as stats)
// - Attaches events to LiveMatch.match_events[] for filter engine consumption

import type { LiveMatch, MatchTimelineEvent } from '@/lib/types';
import type { Filter } from '@/lib/supabase';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENTS_TTL_MS = 90_000; // 90 seconds (same as SofaScore stats)

// ─── In-memory cache ─────────────────────────────────────────────────────────

/** fixtureId → { events, fetchedAt } */
const eventsCache = new Map<number, {
  events: MatchTimelineEvent[];
  fetchedAt: number;
}>();

// ─── Condition keys that support time_window ─────────────────────────────────

const TIMED_CONDITION_KEYS = ['yellow_cards', 'red_cards', 'substitutions'] as const;

/**
 * Check if any active filter uses time_window conditions.
 * If none do, we skip the enrichment entirely (no extra API calls).
 */
export function filtersNeedEvents(filters: Filter[]): boolean {
  return filters.some(f => {
    if (!f.is_active) return false;
    const c = f.conditions as any;
    return TIMED_CONDITION_KEYS.some(k => c?.[k]?.time_window != null);
  });
}

// ─── SofaScore incidents → MatchTimelineEvent mapping ────────────────────────

function mapIncidentType(incidentType: string): string | null {
  switch (incidentType) {
    case 'card':
    case 'yellowCard':
      return 'yellow-card';
    case 'redCard':
      return 'red-card';
    case 'yellowRedCard':
      return 'red-card'; // second yellow = red
    case 'substitution':
      return 'substitution';
    case 'goal':
      return 'goal';
    case 'ownGoal':
      return 'own-goal';
    case 'penaltyGoal':
    case 'penalty':
      return 'penalty-goal';
    case 'penaltyMiss':
    case 'missedPenalty':
      return 'penalty-miss';
    case 'corner':
      return 'corner';
    case 'var':
    case 'varDecision':
      return 'var';
    default:
      return incidentType || null;
  }
}

function parseIncidents(incidents: any[], homeTeamId: number, awayTeamId: number): MatchTimelineEvent[] {
  const events: MatchTimelineEvent[] = [];

  for (const inc of incidents) {
    // SofaScore incidents have: incidentType, time, player, playerIn/playerOut, etc.
    const incType = inc.incidentType || inc.type;
    if (!incType) continue;

    // Determine if this is a card (yellow vs red)
    let mappedType: string | null = null;
    if (incType === 'card') {
      // SofaScore uses incidentClass for card color
      const cardType = inc.incidentClass || inc.cardType || '';
      if (cardType === 'yellow') mappedType = 'yellow-card';
      else if (cardType === 'red' || cardType === 'yellowRed') mappedType = 'red-card';
      else mappedType = 'yellow-card'; // default to yellow
    } else {
      mappedType = mapIncidentType(incType);
    }

    if (!mappedType) continue;

    const minute = inc.time ?? inc.minute ?? 0;
    const period = minute <= 45 ? 1 : 2; // approximate

    // Determine team
    const isHome = inc.isHome === true || inc.homeScore !== undefined;
    const teamId = isHome ? String(homeTeamId) : String(awayTeamId);
    const teamSide = isHome ? 'home' : 'away';

    // Player info
    const player = inc.player?.name || inc.player?.shortName || inc.playerName || null;
    let playerOut: string | null = null;
    if (mappedType === 'substitution') {
      playerOut = inc.playerOut?.name || inc.playerOut?.shortName || null;
    }

    events.push({
      minute,
      period,
      type: mappedType,
      teamId,
      teamName: teamSide,
      player,
      playerOut,
      isScoring: mappedType === 'goal' || mappedType === 'penalty-goal' || mappedType === 'own-goal',
    });
  }

  return events;
}

// ─── Main enrichment function ────────────────────────────────────────────────

/**
 * Enrich live matches with match events timeline from SofaScore incidents.
 * Only fetches for matches that need it (have time_window filter conditions).
 * Mutates match.match_events in-place.
 */
export async function enrichMatchesWithEvents(
  matches: LiveMatch[],
  filters: Filter[],
): Promise<void> {
  // Early exit: don't make any API calls if no filter uses time_window
  if (!filtersNeedEvents(filters)) return;

  const now = Date.now();

  // Only process live matches (in progress)
  const liveMatches = matches.filter(m => {
    const s = m.fixture?.status?.short;
    return s && s !== 'NS' && s !== 'TBD' && s !== 'PST' && s !== 'CANC' && s !== 'FT' && s !== 'AET' && s !== 'PEN';
  });

  const fetches = liveMatches.map(async (m) => {
    const fixtureId = m.fixture.id;

    // Check cache first
    const cached = eventsCache.get(fixtureId);
    if (cached && now - cached.fetchedAt < EVENTS_TTL_MS) {
      m.match_events = cached.events;
      return;
    }

    // We need the SofaScore event ID to fetch incidents.
    // If sofascore_stats is present, it has sofascoreEventId.
    // Otherwise, fixture.id itself might be the SofaScore event ID (when SofaScore is primary source).
    const ssEventId = (m as any).sofascore_stats?.sofascoreEventId ?? fixtureId;

    try {
      const res = await fetch(
        `/api/sofascore/match-incidents?eventId=${ssEventId}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!res.ok) {
        // Fallback: try ESPN match-events if SofaScore incidents not available
        await fallbackToESPN(m, fixtureId, now);
        return;
      }

      const data = await res.json();
      if (!data.incidents || !Array.isArray(data.incidents)) {
        await fallbackToESPN(m, fixtureId, now);
        return;
      }

      const homeTeamId = data.homeTeamId ?? m.teams?.home?.id ?? 0;
      const awayTeamId = data.awayTeamId ?? m.teams?.away?.id ?? 0;

      const events = parseIncidents(data.incidents, homeTeamId, awayTeamId);
      eventsCache.set(fixtureId, { events, fetchedAt: now });
      m.match_events = events;
    } catch {
      // Non-fatal — try ESPN fallback
      await fallbackToESPN(m, fixtureId, now);
    }
  });

  await Promise.all(fetches);
}

/**
 * Fallback: try ESPN match-events API for event timeline data
 */
async function fallbackToESPN(m: LiveMatch, fixtureId: number, now: number): Promise<void> {
  try {
    // ESPN needs eventId and league code. We can try using the fixture ID directly
    // and a generic league code. The ESPN endpoint handles league name lookups.
    const leagueName = m.league?.name || '';
    const res = await fetch(
      `/api/espn/match-events?eventId=${fixtureId}&league=${encodeURIComponent(leagueName)}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) return;

    const data = await res.json();
    if (!data.events || !Array.isArray(data.events)) return;

    const events: MatchTimelineEvent[] = data.events.map((evt: any) => ({
      minute: evt.minute ?? 0,
      period: evt.period ?? 1,
      type: evt.type ?? '',
      teamId: evt.teamId ?? null,
      teamName: evt.teamName ?? null,
      player: evt.player ?? null,
      playerOut: evt.playerOut ?? null,
      isScoring: evt.isScoring ?? false,
    }));

    eventsCache.set(fixtureId, { events, fetchedAt: now });
    m.match_events = events;
  } catch {
    // Non-fatal — events data not available
  }
}

/**
 * Count events of a given type within a time window, optionally filtered by team side.
 * Used by the filter engine for time-windowed conditions.
 *
 * @param events   - The match events timeline
 * @param eventType - Event type to count (e.g., 'yellow-card', 'substitution')
 * @param from     - Start minute (inclusive)
 * @param to       - End minute (inclusive)
 * @param teamSide - 'home', 'away', or 'total' (undefined = total)
 * @param homeTeamId - Home team's ID string for matching
 * @param awayTeamId - Away team's ID string for matching
 */
export function countEventsInWindow(
  events: MatchTimelineEvent[],
  eventType: string,
  from: number,
  to: number,
  teamSide?: 'home' | 'away' | 'total',
  homeTeamId?: string,
  awayTeamId?: string,
): number {
  return events.filter(evt => {
    if (evt.type !== eventType) return false;
    if (evt.minute < from || evt.minute > to) return false;
    if (teamSide === 'home') {
      // Match by teamId if available, fallback to teamName
      if (homeTeamId && evt.teamId) return evt.teamId === homeTeamId;
      return evt.teamName === 'home';
    }
    if (teamSide === 'away') {
      if (awayTeamId && evt.teamId) return evt.teamId === awayTeamId;
      return evt.teamName === 'away';
    }
    return true; // 'total' or undefined — count all
  }).length;
}

/** Clear events cache — call on sign-out or explicit refresh */
export function clearEventsEnricherCache(): void {
  eventsCache.clear();
}
