/**
 * GET/POST /api/cron/scan
 *
 * Vercel Cron Job — runs every minute (configured in vercel.json).
 * Scans live football matches against every user's active Telegram-enabled filters
 * and sends notifications when conditions are met.
 *
 * Protected by CRON_SECRET environment variable.
 * Vercel also sends Authorization: Bearer {CRON_SECRET} automatically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getLiveMatches, getMatchStatistics } from '@/lib/api-football';
import { matchesFilter } from '@/lib/filter-engine';
import * as espnSync from '@/lib/espn-sync';
import type { Filter } from '@/lib/supabase';
import { normalizeCompetitionName, isUEFACompetition } from '@/lib/competition-aliases';

export const maxDuration = 30;

// ─── Supabase service-role client (bypasses RLS) ─────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BOT_TOKEN = (
  process.env.TELEGRAM_BOT_TOKEN ||
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN ||
  ''
).trim();
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendTelegram(chatId: string | number, text: string): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Batch-load all recent notifications for the given user+match combos (last 4h) */
async function loadRecentNotifications(userIds: string[]): Promise<Set<string>> {
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('triggered_matches')
    .select('user_id, match_id, filter_id')
    .in('user_id', userIds)
    .gte('created_at', since);
  const set = new Set<string>();
  for (const row of data ?? []) {
    set.add(`${row.user_id}::${row.match_id}::${row.filter_id}`);
  }
  return set;
}

async function logTriggered(params: {
  userId: string; matchId: string; filterId: string; filterName: string;
  homeTeam: string; awayTeam: string; leagueName: string;
  scoreHome: number; scoreAway: number; matchTime: number | null;
}) {
  await supabase.from('triggered_matches').insert({
    user_id: params.userId,
    match_id: params.matchId,
    filter_id: params.filterId,
    filter_name: params.filterName,
    home_team: params.homeTeam,
    away_team: params.awayTeam,
    league_name: params.leagueName,
    score_home: params.scoreHome,
    score_away: params.scoreAway,
    match_time: params.matchTime,
    match_status: 'live',
    notification_type: 'cron_scan',
    triggered_at: new Date().toISOString(),
  });
}

// ─── Stats to format a notification message ──────────────────────────────────

function buildMessage(match: any, filter: Filter, matchedConditions: string[]): string {
  const home = match.teams?.home?.name ?? 'Home';
  const away = match.teams?.away?.name ?? 'Away';
  const league = match.league?.name ?? 'Unknown League';
  const scoreH = match.goals?.home ?? 0;
  const scoreA = match.goals?.away ?? 0;
  const min = match.fixture?.status?.elapsed;

  const lines = [
    `🎯 <b>LivePick Alert — Filter Triggered!</b>`,
    ``,
    `⚽ <b>${home} vs ${away}</b>`,
    `🏆 ${league}`,
    `🔢 Score: <b>${scoreH} – ${scoreA}</b>${min ? `  ⏱️ ${min}'` : ''}`,
    ``,
    `📋 Filter: <b>${filter.name}</b>`,
  ];

  if (matchedConditions.length > 0) {
    lines.push(``, `✅ Matched conditions:`);
    for (const c of matchedConditions.slice(0, 8)) lines.push(`  • ${c}`);
  }

  lines.push(``, `<i>Open LivePick to view full details.</i>`);
  return lines.join('\n');
}

function normalizeMatchLeague(match: any): string {
  const leagueName = match?.league?.name || match?.league_name || '';
  const normalized = normalizeCompetitionName(leagueName);
  if (normalized) return normalized;
  return leagueName;
}

function shouldIncludeMatch(match: any): boolean {
  const leagueName = normalizeMatchLeague(match);
  if (isUEFACompetition(leagueName)) return true;
  return Boolean(match.fixture?.status?.short && match.fixture.status.short !== 'NS' && match.fixture.status.short !== 'TBD' && match.fixture.status.short !== 'PST' && match.fixture.status.short !== 'CANC');
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Vercel sends Authorization: Bearer {CRON_SECRET} for cron invocations
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    // 0. Refresh ESPN data in Supabase (fire-and-forget; non-critical) ─────────
    espnSync.syncAllMatches().catch(err =>
      console.warn('[CronScan] ESPN sync failed (non-critical):', err instanceof Error ? err.message : err)
    );

    // 1. Fetch live matches ────────────────────────────────────────────────────
    const matches = await getLiveMatches();

    if (matches.length === 0) {
      return NextResponse.json({ ok: true, message: 'No live matches', notifications: 0 });
    }

    // 1b. Enrich matches with stats from API-Football ─────────────────────────
    //     /fixtures?live=all does NOT include statistics; fetch them per-match.
    //     Limit to first 15 live matches to stay within rate limits.
    const liveOnly = matches.filter(shouldIncludeMatch);
    const statsResults = await Promise.allSettled(
      liveOnly.slice(0, 15).map(async m => {
        if (m.statistics && m.statistics.length > 0) return; // already has stats
        try {
          const stats = await getMatchStatistics(m.fixture.id);
          if (stats && stats.length > 0) m.statistics = stats;
        } catch { /* non-fatal */ }
      })
    );
    const enrichedCount = statsResults.filter(r => r.status === 'fulfilled').length;
    console.log(`[CronScan] Enriched ${enrichedCount}/${liveOnly.length} matches with stats`);


    // 2. Load all Telegram-enabled active filters (across all users) ──────────
    //    We join profiles to get the telegram_chat_id in one query.
    const { data: filterRows, error: filterErr } = await supabase
      .from('filters')
      .select(`
        id, name, conditions, user_id, is_active, telegram_enabled, notification_enabled
      `)
      .eq('is_active', true)
      .eq('telegram_enabled', true);

    if (filterErr) {
      console.error('[CronScan] Error fetching filters:', filterErr);
      return NextResponse.json({ error: 'DB error fetching filters' }, { status: 500 });
    }

    if (!filterRows || filterRows.length === 0) {
      return NextResponse.json({ ok: true, message: 'No telegram-enabled active filters', notifications: 0 });
    }

    // 3. Build a map of userId → telegram_chat_id ─────────────────────────────
    const userIds = [...new Set(filterRows.map(f => f.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, telegram_chat_id')
      .in('id', userIds);

    const chatIdByUser = new Map<string, string>();
    for (const p of profiles ?? []) {
      if (p.telegram_chat_id) chatIdByUser.set(p.id, p.telegram_chat_id);
    }

    // Discard filters for users without a configured chat_id
    const activeFilters = filterRows.filter(f => chatIdByUser.has(f.user_id)) as Filter[];

    if (activeFilters.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No users have telegram_chat_id configured',
        notifications: 0,
      });
    }

    // 3b. Batch-load recent notifications to avoid per-pair DB queries ────────
    const activeUserIds = [...new Set(activeFilters.map(f => f.user_id))];
    const notifiedSet = await loadRecentNotifications(activeUserIds);

    // 4. Run filter matching for every match × filter combo ────────────────────
    let notificationsSent = 0;

    for (const match of liveOnly) {
      const status = match.fixture?.status?.short;
      if (!status || status === 'NS' || status === 'TBD' || status === 'PST' || status === 'CANC') continue;

      const matchId = String(match.fixture?.id);

      for (const filter of activeFilters) {
        const chatId = chatIdByUser.get(filter.user_id);
        if (!chatId) continue;

        try {
          const result = await matchesFilter(match, filter as any);
          if (!result.matches) continue;

          // Dedup — skip if already notified in last 4h (checked via batch-loaded set)
          if (notifiedSet.has(`${filter.user_id}::${matchId}::${filter.id}`)) continue;

          // Send Telegram message
          const text = buildMessage(match, filter as any, result.matchedConditions ?? []);
          const sent = await sendTelegram(chatId, text);

          // Log regardless (so we don't spam even if Telegram fails)
          await logTriggered({
            userId: filter.user_id,
            matchId,
            filterId: filter.id,
            filterName: filter.name,
            homeTeam: match.teams?.home?.name ?? '',
            awayTeam: match.teams?.away?.name ?? '',
            leagueName: normalizeMatchLeague(match),
            scoreHome: match.goals?.home ?? 0,
            scoreAway: match.goals?.away ?? 0,
            matchTime: match.fixture?.status?.elapsed ?? null,
          });

          if (sent) notificationsSent++;

          // Rate-limit: respect Telegram's 30 msg/s limit
          if (notificationsSent % 25 === 0) await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
          console.error(`[CronScan] Error processing filter ${filter.id}:`, e);
        }
      }
    }

    const elapsed = Date.now() - startedAt;
    console.log(`[CronScan] Done. ${notificationsSent} notifications sent in ${elapsed}ms`);

    return NextResponse.json({
      ok: true,
      matchesScanned: matches.length,
      filtersChecked: activeFilters.length,
      notifications: notificationsSent,
      elapsedMs: elapsed,
    });
  } catch (err) {
    console.error('[CronScan] Fatal error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Vercel Cron Jobs use GET by default. POST alias for manual testing.
export const POST = GET;
