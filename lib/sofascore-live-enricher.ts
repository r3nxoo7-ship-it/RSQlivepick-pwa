/**
 * SofaScore Live Enricher
 *
 * Enriches a list of live matches with SofaScore stats (xG, big chances,
 * shots in box, pass accuracy, etc.) for use in the filter engine.
 *
 * Call this in the background scanner BEFORE running applyFiltersToMatch so
 * that conditions like `xg`, `big_chances`, `shots_in_box`, `pass_accuracy`
 * are satisfied.
 *
 * Strategy:
 * 1. Only enrich matches that have at least one SofaScore-exclusive condition
 *    in any active filter — avoids unnecessary API calls.
 * 2. Batch all find-event API calls in parallel (one per live match).
 * 3. Cache event-ID lookups for the lifetime of the page session.
 * 4. Stats cache: 90 seconds (plenty for a 30s scanner interval).
 */

import type { LiveMatch } from '@/lib/types';
import type { Filter } from '@/lib/supabase';

// ─── Constants ───────────────────────────────────────────────────────────────

const SS_STATS_TTL_MS = 90_000; // 90 seconds
const SS_EVENT_TTL_MS = 3_600_000; // 1 hour (event ID doesn't change during match)

// ─── In-memory caches (module-level, persist between scanner ticks) ───────────

/** fixtureId → { eventId, homeTeamId, awayTeamId, fetchedAt } */
const eventIdCache = new Map<number, {
  eventId: number;
  homeTeamId: number;
  awayTeamId: number;
  fetchedAt: number;
}>();

/** sofascoreEventId → { stats, fetchedAt } */
const statsCache = new Map<number, {
  stats: NonNullable<LiveMatch['sofascore_stats']>;
  fetchedAt: number;
}>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** SofaScore-exclusive conditions in FilterConditions */
const SS_CONDITION_KEYS = ['xg', 'big_chances', 'shots_in_box', 'pass_accuracy', 'interceptions', 'clearances'] as const;

function filtersNeedSofascore(filters: Filter[]): boolean {
  return filters.some(f => {
    if (!f.is_active) return false;
    const c = f.conditions as any;
    return SS_CONDITION_KEYS.some(k => c?.[k] != null);
  });
}

// ─── Main enrichment function ─────────────────────────────────────────────────

/**
 * Enrich live matches with SofaScore stats.
 * Mutates the `sofascore_stats` field on each match in-place.
 *
 * @param matches    Live matches currently in progress
 * @param filters    Active user filters (used to decide if enrichment is needed)
 * @param onlyLive   When true, skip matches that haven't started (default: true)
 */
export async function enrichMatchesWithSofascore(
  matches: LiveMatch[],
  filters: Filter[],
  onlyLive = true,
): Promise<void> {
  // Fast-path: skip entirely if no filter uses SofaScore conditions
  if (!filtersNeedSofascore(filters)) return;

  const now = Date.now();

  // Step 1 — Resolve SofaScore event IDs for matches that need enrichment
  const liveMatches = onlyLive
    ? matches.filter(m => {
        const s = m.fixture?.status?.short;
        return s && s !== 'NS' && s !== 'TBD' && s !== 'PST' && s !== 'CANC' && s !== 'FT' && s !== 'AET' && s !== 'PEN';
      })
    : matches;

  const needsLookup = liveMatches.filter(m => {
    const cached = eventIdCache.get(m.fixture.id);
    return !cached || now - cached.fetchedAt > SS_EVENT_TTL_MS;
  });

  if (needsLookup.length > 0) {
    const matchDate = new Date().toISOString().split('T')[0];
    const lookups = needsLookup.map(async m => {
      if (!m.teams?.home?.name || !m.teams?.away?.name) return;
      try {
        const res = await fetch(
          `/api/sofascore/find-event?home=${encodeURIComponent(m.teams.home.name)}&away=${encodeURIComponent(m.teams.away.name)}&date=${matchDate}`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.found && data.eventId) {
          eventIdCache.set(m.fixture.id, {
            eventId: data.eventId,
            homeTeamId: data.homeTeamId,
            awayTeamId: data.awayTeamId,
            fetchedAt: now,
          });
        }
      } catch { /* non-fatal */ }
    });
    await Promise.all(lookups);
  }

  // Step 2 — Fetch stats for matches where we have a SofaScore event ID
  const statsFetches = liveMatches.map(async m => {
    const eventEntry = eventIdCache.get(m.fixture.id);
    if (!eventEntry) return;

    const { eventId } = eventEntry;

    // Check stats cache
    const cachedStats = statsCache.get(eventId);
    if (cachedStats && now - cachedStats.fetchedAt < SS_STATS_TTL_MS) {
      (m as any).sofascore_stats = cachedStats.stats;
      return;
    }

    try {
      const res = await fetch(
        `/api/sofascore/match-stats?eventId=${eventId}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.found || !data.stats) return;

      const s = data.stats;
      const enriched: NonNullable<LiveMatch['sofascore_stats']> = {
        sofascoreEventId: eventId,
        homeXg: s.homeXg ?? 0,
        awayXg: s.awayXg ?? 0,
        homeBigChances: s.homeBigChances ?? 0,
        awayBigChances: s.awayBigChances ?? 0,
        homeShotsInBox: s.homeShotsInBox ?? 0,
        awayShotsInBox: s.awayShotsInBox ?? 0,
        homePassPct: s.homePassPct ?? 0,
        awayPassPct: s.awayPassPct ?? 0,
        homeInterceptions: s.homeInterceptions ?? 0,
        awayInterceptions: s.awayInterceptions ?? 0,
        homeClearances: s.homeClearances ?? 0,
        awayClearances: s.awayClearances ?? 0,
        homeFouls: s.homeFouls ?? 0,
        awayFouls: s.awayFouls ?? 0,
        fetchedAt: now,
      };

      statsCache.set(eventId, { stats: enriched, fetchedAt: now });
      (m as any).sofascore_stats = enriched;

      // Persist to DB (fire-and-forget) so data survives scanner restarts / Vercel cold starts
      void fetch('/api/espn/persist-sofascore-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId: m.fixture.id, sofascore_stats: enriched }),
        signal: AbortSignal.timeout(3000),
      }).catch(() => { /* non-fatal — DB persist failed */ });
    } catch { /* non-fatal */ }
  });

  await Promise.all(statsFetches);
}

/** Clear all caches — call on sign-out or explicit refresh */
export function clearSofascoreEnricherCaches(): void {
  eventIdCache.clear();
  statsCache.clear();
}
