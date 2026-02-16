// ============================================
// ESPN SUPABASE SYNC SERVICE
// ============================================
// Syncs ESPN data to Supabase tables
// Fetches once, saves to Supabase, users read from DB

import { createClient } from '@supabase/supabase-js';
import * as ESPNAPI from './espn-api';

// Use service role for server-side operations (no RLS restrictions)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

// ============================================
// SYNC FUNCTIONS
// ============================================

let lastSyncTime = 0;

/**
 * Sync all live matches to Supabase (deduplicated)
 * Fetches from ESPN once, saves to DB, all users read from Supabase
 * Fetches soccer leagues ONLY to avoid duplicates and multi-sport confusion
 */
export async function syncAllMatches(): Promise<{ count: number; duration: number }> {
  const startTime = Date.now();
  
  try {
    console.log('⚽ [ESPN Sync] Starting soccer match sync (FIFA leagues only)...');
    
    // Use curated sync leagues (top leagues + cups + continental)
    const soccerLeagues = ESPNAPI.SYNC_SOCCER_LEAGUES;

    const allMatches: ESPNAPI.ESPNMatch[] = [];

    // Fetch all leagues in parallel for speed
    const leagueResults = await Promise.allSettled(
      soccerLeagues.map(async (config) => {
        const matches = await ESPNAPI.getLeagueMatches(config.sport, config.league);
        matches.forEach(m => { (m as any).__league_config = config; });
        return { config, matches };
      })
    );
    for (const r of leagueResults) {
      if (r.status === 'fulfilled') {
        console.log(`  ⚽ ${r.value.config.name}: ${r.value.matches.length} matches`);
        allMatches.push(...r.value.matches);
      } else {
        console.warn(`⚠️ [ESPN Sync] Failed to fetch a league:`, r.reason);
      }
    }
    
    if (allMatches.length === 0) {
      console.log('⚠️ [ESPN Sync] No soccer matches to sync');
      return { count: 0, duration: Date.now() - startTime };
    }

    // Enrich live/completed matches with detailed stats from ESPN summary endpoint
    const matchesToEnrich = allMatches.filter(m => m.status === 'in_progress' || m.status === 'completed');
    if (matchesToEnrich.length > 0) {
      console.log(`📊 [ESPN Sync] Enriching ${matchesToEnrich.length} live/completed matches with summary stats...`);
      for (const match of matchesToEnrich) {
        try {
          const config = (match as any).__league_config;
          if (!config) continue;
          const summary = await ESPNAPI.getMatchSummary(config.sport, config.league, match.id);
          if (summary) {
            const enriched = ESPNAPI.enrichMatchWithSummary(match, summary);
            // Copy enriched stats back to the match object
            Object.assign(match, enriched);
          }
        } catch (err) {
          // Non-critical: continue without stats for this match
          console.warn(`⚠️ [ESPN Sync] Summary fetch failed for match ${match.id}:`, err);
        }
      }
    }

    const rows = allMatches.map(match => {
      const leagueConfig = (match as any).__league_config || {};
      return {
        id: match.id,
        event_id: match.eventId || match.id,
        sport: 'soccer', // Explicit soccer only
        league: leagueConfig.name || 'Soccer',
        date: new Date(match.date),
        status: match.status,
        home_team_id: match.homeTeam.id,
        away_team_id: match.awayTeam.id,
        home_team_name: match.homeTeam.displayName || match.homeTeam.name,
        away_team_name: match.awayTeam.displayName || match.awayTeam.name,
        home_score: match.homeScore || 0,
        away_score: match.awayScore || 0,
        home_goals: match.homeGoals,
        away_goals: match.awayGoals,
        home_corners: match.homeCorners,
        away_corners: match.awayCorners,
        home_shots_on_target: match.homeShotsOnTarget,
        away_shots_on_target: match.awayShotsOnTarget,
        home_possession: match.homePossession,
        away_possession: match.awayPossession,
        home_yellow_cards: match.homeYellowCards,
        away_yellow_cards: match.awayYellowCards,
        home_red_cards: match.homeRedCards,
        away_red_cards: match.awayRedCards,
        period: match.period,
        minute: match.minute,
        venue_id: match.venue?.id,
        venue_name: match.venue?.name,
        broadcast: match.broadcast,
        odds: match.odds ? JSON.stringify(match.odds) : null,
        raw_data: match,
      };
    });

    // Deduplicate by fixture ID before upserting
    const uniqueMatches = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      if (!uniqueMatches.has(row.id)) {
        uniqueMatches.set(row.id, row);
      }
    }

    // Upsert teams first
    try {
      const teamMap: Record<string, any> = {};
      for (const m of allMatches) {
        if (m.homeTeam) {
          const teamId = String(m.homeTeam.id);
          if (!teamMap[teamId]) {
            teamMap[teamId] = {
              id: teamId,
              name: m.homeTeam.name,
              display_name: m.homeTeam.displayName,
              abbreviation: m.homeTeam.abbreviation,
              logo: m.homeTeam.logo,
              color: m.homeTeam.color,
              alternate_color: m.homeTeam.alternateColor,
              venue_id: m.homeTeam.venueId,
              sport: 'soccer',
              league: (m as any).__league_config?.name || 'Soccer',
            };
          }
        }
        if (m.awayTeam) {
          const teamId = String(m.awayTeam.id);
          if (!teamMap[teamId]) {
            teamMap[teamId] = {
              id: teamId,
              name: m.awayTeam.name,
              display_name: m.awayTeam.displayName,
              abbreviation: m.awayTeam.abbreviation,
              logo: m.awayTeam.logo,
              color: m.awayTeam.color,
              alternate_color: m.awayTeam.alternateColor,
              venue_id: m.awayTeam.venueId,
              sport: 'soccer',
              league: (m as any).__league_config?.name || 'Soccer',
            };
          }
        }
      }

      const teamRows = Object.values(teamMap);
      if (teamRows.length > 0) {
        const { error: teamError } = await supabase
          .from('espn_teams')
          .upsert(teamRows, { onConflict: 'id' });
        if (teamError) {
          console.warn('⚠️ [ESPN Sync] Upserting teams failed:', teamError);
        } else {
          console.log(`✅ [ESPN Sync] Upserted ${teamRows.length} teams`);
        }
      }
    } catch (teamUpsertErr) {
      console.warn('⚠️ [ESPN Sync] Team upsert threw error:', teamUpsertErr);
    }

    // Batch upsert matches (deduplicated) - single operation, all users benefit
    const uniqueRows = Array.from(uniqueMatches.values());
    const { error } = await supabase
      .from('espn_matches')
      .upsert(uniqueRows, { onConflict: 'id' });

    if (error) {
      console.error('❌ [ESPN Sync] Upsert failed:', error);
      throw error;
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ [ESPN Sync] Synced ${uniqueRows.length} matches in ${duration}ms`);
    
    lastSyncTime = Date.now();
    return { count: uniqueRows.length, duration };
  } catch (error) {
    console.error('❌ [ESPN Sync] Sync failed:', error);
    throw error;
  }
}

/**
 * Sync teams for all configured leagues
 * Happens less frequently (every 6-12 hours via random probability)
 */
export async function syncAllTeams(): Promise<{ count: number; duration: number }> {
  const startTime = Date.now();
  
  try {
    console.log('🔄 [ESPN Sync] Starting team sync...');
    
    const leagueList = Object.values(ESPNAPI.LEAGUES);
    let totalTeams = 0;
    
    for (const leagueConfig of leagueList) {
      const teams = await ESPNAPI.getLeagueTeams(leagueConfig.sport, leagueConfig.league);
      
      if (teams.length === 0) continue;
      
      const rows = teams.map(team => ({
        id: team.id,
        name: team.name,
        display_name: team.displayName,
        abbreviation: team.abbreviation,
        logo: team.logo,
        color: team.color,
        alternate_color: team.alternateColor,
        venue_id: team.venueId,
        sport: leagueConfig.sport,
        league: leagueConfig.league,
      }));

      const { error } = await supabase
        .from('espn_teams')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error(`❌ [ESPN Sync] Team sync failed for ${leagueConfig.name}:`, error);
        continue;
      }
      
      totalTeams += rows.length;
      console.log(`  ✅ ${leagueConfig.name}: ${rows.length} teams`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ [ESPN Sync] Synced ${totalTeams} teams in ${duration}ms`);
    return { count: totalTeams, duration };
  } catch (error) {
    console.error('❌ [ESPN Sync] Team sync failed:', error);
    throw error;
  }
}

/**
 * Get live matches from Supabase (not ESPN!)
 * Users read from this, not directly from ESPN API
 * Shows: currently live matches + upcoming matches for next 3 hours
 */
export async function getLiveMatchesFromDB(limit = 100) {
  try {
    // Calculate time range: now to now + 3 hours (for upcoming matches)
    const now = new Date();
    const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('espn_matches')
      .select('*')
      .eq('sport', 'soccer') // Only soccer matches
      .neq('league', 'multi') // Filter out multi-sport matches
      .or(`status.eq.in_progress,status.eq.live,status.eq.scheduled`) // Live or scheduled
      .gte('date', now.toISOString()) // Matches from now onwards
      .lte('date', threeHoursLater.toISOString()) // Up to 3 hours from now
      .order('date', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching live matches from Supabase:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error reading from Supabase:', error);
    return [];
  }
}

/**
 * Get only currently live matches (in_progress status)
 */
export async function getLiveMatchesOnly() {
  try {
    const { data, error } = await supabase
      .from('espn_matches')
      .select('*')
      .eq('sport', 'soccer')
      .neq('league', 'multi')
      .or(`status.eq.in_progress,status.eq.live`) // Only live
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching live-only matches:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error reading from Supabase:', error);
    return [];
  }
}

/**
 * Get all today's scheduled matches (rest of day)
 */
export async function getUpcomingMatches() {
  try {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('espn_matches')
      .select('*')
      .eq('sport', 'soccer')
      .neq('league', 'multi')
      .eq('status', 'scheduled')
      .gte('date', now.toISOString())
      .lte('date', endOfToday.toISOString())
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching upcoming matches:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error reading from Supabase:', error);
    return [];
  }
}

/**
 * Get scheduled matches for next N days (tomorrow onwards) for Predicted section
 */
export async function getScheduledMatchesRange(daysAhead: number = 7) {
  try {
    const now = new Date();
    const startOfTomorrow = new Date(now);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    startOfTomorrow.setHours(0, 0, 0, 0);

    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + daysAhead);
    endDate.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('espn_matches')
      .select('*')
      .eq('sport', 'soccer')
      .neq('league', 'multi')
      .eq('status', 'scheduled')
      .gte('date', startOfTomorrow.toISOString())
      .lte('date', endDate.toISOString())
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching scheduled range:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error reading from Supabase:', error);
    return [];
  }
}

/**
 * Sync upcoming days' matches from ESPN (next 7 days)
 * Called infrequently (~every 15 min) to populate schedule for Predicted section
 */
export async function syncUpcomingDays(days: number = 7): Promise<{ count: number; duration: number }> {
  const startTime = Date.now();

  try {
    console.log(`📅 [ESPN Sync] Syncing upcoming ${days} days of matches...`);

    const soccerLeagues = ESPNAPI.SYNC_SOCCER_LEAGUES;

    const allMatches: ESPNAPI.ESPNMatch[] = [];

    // Build all fetch tasks and run in parallel (like syncRecentDays)
    const fetchTasks: Array<{ config: typeof soccerLeagues[0]; dateStr: string }> = [];
    for (let d = 1; d <= days; d++) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + d);
      const dateStr = futureDate.toISOString().slice(0, 10).replace(/-/g, '');
      for (const config of soccerLeagues) {
        fetchTasks.push({ config, dateStr });
      }
    }

    const results = await Promise.allSettled(
      fetchTasks.map(async ({ config, dateStr }) => {
        const matches = await ESPNAPI.getLeagueMatches(config.sport, config.league, dateStr);
        matches.forEach(m => { (m as any).__league_config = config; });
        return matches;
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allMatches.push(...result.value);
      }
    }

    if (allMatches.length === 0) {
      console.log('📅 [ESPN Sync] No upcoming matches found');
      return { count: 0, duration: Date.now() - startTime };
    }

    // Upsert teams referenced by upcoming matches first to avoid FK violations
    try {
      const teamMap: Record<string, any> = {};
      for (const m of allMatches) {
        if (m.homeTeam) {
          const teamId = String(m.homeTeam.id);
          if (!teamMap[teamId]) {
            teamMap[teamId] = {
              id: teamId,
              name: m.homeTeam.name,
              display_name: m.homeTeam.displayName,
              abbreviation: m.homeTeam.abbreviation,
              logo: m.homeTeam.logo,
              venue_id: m.homeTeam.venueId,
              sport: 'soccer',
              league: (m as any).__league_config?.name || 'Soccer',
            };
          }
        }
        if (m.awayTeam) {
          const teamId = String(m.awayTeam.id);
          if (!teamMap[teamId]) {
            teamMap[teamId] = {
              id: teamId,
              name: m.awayTeam.name,
              display_name: m.awayTeam.displayName,
              abbreviation: m.awayTeam.abbreviation,
              logo: m.awayTeam.logo,
              venue_id: m.awayTeam.venueId,
              sport: 'soccer',
              league: (m as any).__league_config?.name || 'Soccer',
            };
          }
        }
      }

      const teamRows = Object.values(teamMap);
      if (teamRows.length > 0) {
        const { error: teamError } = await supabase
          .from('espn_teams')
          .upsert(teamRows, { onConflict: 'id' });
        if (teamError) {
          console.warn('⚠️ [ESPN Sync] Upcoming teams upsert failed:', teamError);
        } else {
          console.log(`✅ [ESPN Sync] Upserted ${teamRows.length} upcoming teams`);
        }
      }
    } catch (teamUpsertErr) {
      console.warn('⚠️ [ESPN Sync] Upcoming team upsert threw error:', teamUpsertErr);
    }

    const rows = allMatches.map(match => {
      const leagueConfig = (match as any).__league_config || {};
      return {
        id: match.id,
        event_id: match.eventId || match.id,
        sport: 'soccer',
        league: leagueConfig.name || 'Soccer',
        date: new Date(match.date),
        status: match.status,
        home_team_id: match.homeTeam.id,
        away_team_id: match.awayTeam.id,
        home_team_name: match.homeTeam.displayName || match.homeTeam.name,
        away_team_name: match.awayTeam.displayName || match.awayTeam.name,
        home_score: match.homeScore || 0,
        away_score: match.awayScore || 0,
        home_goals: match.homeGoals,
        away_goals: match.awayGoals,
        home_corners: match.homeCorners,
        away_corners: match.awayCorners,
        home_shots_on_target: match.homeShotsOnTarget,
        away_shots_on_target: match.awayShotsOnTarget,
        home_possession: match.homePossession,
        away_possession: match.awayPossession,
        home_yellow_cards: match.homeYellowCards,
        away_yellow_cards: match.awayYellowCards,
        home_red_cards: match.homeRedCards,
        away_red_cards: match.awayRedCards,
        period: match.period,
        minute: match.minute,
        venue_id: match.venue?.id,
        venue_name: match.venue?.name,
        broadcast: match.broadcast,
        odds: match.odds ? JSON.stringify(match.odds) : null,
        raw_data: match,
      };
    });

    // Deduplicate
    const uniqueMatches = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      if (!uniqueMatches.has(row.id)) {
        uniqueMatches.set(row.id, row);
      }
    }

    const uniqueRows = Array.from(uniqueMatches.values());
    const { error } = await supabase
      .from('espn_matches')
      .upsert(uniqueRows, { onConflict: 'id' });

    if (error) {
      console.error('❌ [ESPN Sync] Upcoming days upsert failed:', error);
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [ESPN Sync] Synced ${uniqueRows.length} upcoming matches (${days} days) in ${duration}ms`);
    return { count: uniqueRows.length, duration };
  } catch (error) {
    console.error('❌ [ESPN Sync] Upcoming sync failed:', error);
    throw error;
  }
}

/**
 * Sync recent past days of matches from ESPN scoreboard
 * Fetches matches from the past N days so team form has historical data
 * Uses parallel requests to stay within Vercel serverless timeout
 */
export async function syncRecentDays(days: number = 7): Promise<{ count: number; duration: number }> {
  const startTime = Date.now();

  try {
    console.log(`📅 [ESPN Sync] Syncing past ${days} days of matches (parallel)...`);

    const soccerLeagues = ESPNAPI.SYNC_SOCCER_LEAGUES;

    // Build all fetch tasks upfront
    const fetchTasks: Array<{ config: typeof soccerLeagues[0]; dateStr: string }> = [];
    for (let d = 1; d <= days; d++) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - d);
      const dateStr = pastDate.toISOString().slice(0, 10).replace(/-/g, '');
      for (const config of soccerLeagues) {
        fetchTasks.push({ config, dateStr });
      }
    }

    // Execute ALL fetches in parallel (ESPN has no rate limit)
    const allMatches: ESPNAPI.ESPNMatch[] = [];
    const results = await Promise.allSettled(
      fetchTasks.map(async ({ config, dateStr }) => {
        const matches = await ESPNAPI.getLeagueMatches(config.sport, config.league, dateStr);
        matches.forEach(m => { (m as any).__league_config = config; });
        return matches;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allMatches.push(...result.value);
      }
    }

    console.log(`📅 [ESPN Sync] Fetched ${allMatches.length} past matches from ${fetchTasks.length} parallel requests`);

    if (allMatches.length === 0) {
      console.log('📅 [ESPN Sync] No past matches found');
      return { count: 0, duration: Date.now() - startTime };
    }

    // NOTE: Skip enrichment for past matches (too slow for serverless).
    // Basic scoreboard data (scores, teams, status) is enough for team form.
    // Detailed stats are enriched via periodic sync for today's matches only.

    const rows = allMatches.map(match => {
      const leagueConfig = (match as any).__league_config || {};
      return {
        id: match.id,
        event_id: match.eventId || match.id,
        sport: 'soccer',
        league: leagueConfig.name || 'Soccer',
        date: new Date(match.date),
        status: match.status,
        home_team_id: match.homeTeam.id,
        away_team_id: match.awayTeam.id,
        home_team_name: match.homeTeam.displayName || match.homeTeam.name,
        away_team_name: match.awayTeam.displayName || match.awayTeam.name,
        home_score: match.homeScore || 0,
        away_score: match.awayScore || 0,
        home_goals: match.homeGoals,
        away_goals: match.awayGoals,
        home_corners: match.homeCorners,
        away_corners: match.awayCorners,
        home_shots_on_target: match.homeShotsOnTarget,
        away_shots_on_target: match.awayShotsOnTarget,
        home_possession: match.homePossession,
        away_possession: match.awayPossession,
        home_yellow_cards: match.homeYellowCards,
        away_yellow_cards: match.awayYellowCards,
        home_red_cards: match.homeRedCards,
        away_red_cards: match.awayRedCards,
        period: match.period,
        minute: match.minute,
        venue_id: match.venue?.id,
        venue_name: match.venue?.name,
        broadcast: match.broadcast,
        odds: match.odds ? JSON.stringify(match.odds) : null,
        raw_data: match,
      };
    });

    // Deduplicate
    const uniqueMatches = new Map<string, typeof rows[0]>();
    for (const row of rows) {
      if (!uniqueMatches.has(row.id)) {
        uniqueMatches.set(row.id, row);
      }
    }

    const uniqueRows = Array.from(uniqueMatches.values());
    const { error } = await supabase
      .from('espn_matches')
      .upsert(uniqueRows, { onConflict: 'id' });

    if (error) {
      console.error('❌ [ESPN Sync] Recent days upsert failed:', error);
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [ESPN Sync] Synced ${uniqueRows.length} past matches (${days} days) in ${duration}ms`);
    return { count: uniqueRows.length, duration };
  } catch (error) {
    console.error('❌ [ESPN Sync] Recent sync failed:', error);
    throw error;
  }
}

/**
 * Quick check: count completed matches in DB
 * Used for on-demand sync trigger (if 0, we need to sync past days)
 */
export async function getCompletedMatchCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('espn_matches')
      .select('id', { count: 'exact', head: true })
      .eq('sport', 'soccer')
      .eq('status', 'completed');

    if (error) {
      console.error('Error checking completed match count:', error);
      return 0;
    }
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Get recent completed matches for a team (last 5)
 */
export async function getTeamRecentMatches(teamId: string, limit = 5) {
  const normalizedId = String(teamId);
  try {
    const { data, error } = await supabase
      .from('espn_matches')
      .select('*')
      .eq('sport', 'soccer')
      .neq('league', 'multi')
      .eq('status', 'completed')
      .or(`home_team_id.eq.${normalizedId},away_team_id.eq.${normalizedId}`)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error fetching recent matches for team ${normalizedId}:`, error);
      return [];
    }

    console.log(`[Team Form] teamId=${normalizedId}, found ${data?.length || 0} completed matches`);
    return data || [];
  } catch (error) {
    console.error('Error reading from Supabase:', error);
    return [];
  }
}

/**
 * Calculate team form statistics from recent matches
 */
export function calculateTeamForm(
  matches: any[],
  teamId: string
): {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number;
} {
  let played = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const match of matches) {
    const isHome = match.home_team_id === teamId;
    const isAway = match.away_team_id === teamId;

    if (!isHome && !isAway) continue;

    played++;
    const homeScore = match.home_score || 0;
    const awayScore = match.away_score || 0;

    if (isHome) {
      goalsFor += homeScore;
      goalsAgainst += awayScore;
      if (homeScore > awayScore) wins++;
      else if (homeScore === awayScore) draws++;
      else losses++;
    } else {
      goalsFor += awayScore;
      goalsAgainst += homeScore;
      if (awayScore > homeScore) wins++;
      else if (awayScore === homeScore) draws++;
      else losses++;
    }
  }

  const goalDifference = goalsFor - goalsAgainst;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference,
    winRate,
  };
}

/**
 * Get match statistics from Supabase
 */
export async function getMatchStats(matchId: string) {
  try {
    const { data, error } = await supabase
      .from('espn_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (error) {
      console.error('Error fetching match:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

// ============================================
// UTILITIES
// ============================================

function detectSport(match: ESPNAPI.ESPNMatch): string {
  // Try to detect from match data
  if (match.homeGoals !== undefined) return 'soccer';
  if (match.homeScore !== undefined) return 'football';
  return 'soccer';
}

function detectLeague(match: ESPNAPI.ESPNMatch): string {
  // TODO: implement league detection based on teams
  return 'multi';
}

export function getLastSyncTime(): number {
  return lastSyncTime;
}

/**
 * Build statistics array from DB row columns + raw_data (enriched from ESPN summary)
 * raw_data stores the full ESPNMatch object including homeTotalShots, homeFouls, homeOffsides
 */
function buildStatisticsArray(row: any): any[] {
  const raw = row.raw_data || {};
  // Read from DB columns first, fall back to raw_data for extra stats
  const homePoss = row.home_possession || raw.homePossession || 0;
  const awayPoss = row.away_possession || raw.awayPossession || 0;
  const homeSoT = row.home_shots_on_target || raw.homeShotsOnTarget || 0;
  const awaySoT = row.away_shots_on_target || raw.awayShotsOnTarget || 0;
  const homeTotalShots = raw.homeTotalShots || 0;
  const awayTotalShots = raw.awayTotalShots || 0;
  const homeCorners = row.home_corners || raw.homeCorners || 0;
  const awayCorners = row.away_corners || raw.awayCorners || 0;
  const homeYellow = row.home_yellow_cards || raw.homeYellowCards || 0;
  const awayYellow = row.away_yellow_cards || raw.awayYellowCards || 0;
  const homeRed = row.home_red_cards || raw.homeRedCards || 0;
  const awayRed = row.away_red_cards || raw.awayRedCards || 0;
  const homeFouls = raw.homeFouls || 0;
  const awayFouls = raw.awayFouls || 0;
  const homeOffsides = raw.homeOffsides || 0;
  const awayOffsides = raw.awayOffsides || 0;

  // Only return stats if at least some data exists
  const hasAnyStats = homePoss || awayPoss || homeSoT || awaySoT || homeCorners || awayCorners;
  if (!hasAnyStats) return [];

  return [
    {
      team: { id: row.home_team_id, name: row.home_team_name || 'Unknown' },
      statistics: [
        { type: 'Ball Possession', value: homePoss ? `${homePoss}%` : '0%' },
        { type: 'Shots on Goal', value: homeSoT },
        { type: 'Total Shots', value: homeTotalShots },
        { type: 'Corners', value: homeCorners },
        { type: 'Yellow Cards', value: homeYellow },
        { type: 'Red Cards', value: homeRed },
        { type: 'Fouls', value: homeFouls },
        { type: 'Offsides', value: homeOffsides },
      ],
    },
    {
      team: { id: row.away_team_id, name: row.away_team_name || 'Unknown' },
      statistics: [
        { type: 'Ball Possession', value: awayPoss ? `${awayPoss}%` : '0%' },
        { type: 'Shots on Goal', value: awaySoT },
        { type: 'Total Shots', value: awayTotalShots },
        { type: 'Corners', value: awayCorners },
        { type: 'Yellow Cards', value: awayYellow },
        { type: 'Red Cards', value: awayRed },
        { type: 'Fouls', value: awayFouls },
        { type: 'Offsides', value: awayOffsides },
      ],
    },
  ];
}

/**
 * Convert raw Supabase ESPN match row to LiveMatch format
 * Transforms database structure to API response format
 */
export function convertESPNMatchToLiveMatch(row: any): any {
  // Extract date and calculate timestamp
  const dateStr = row.date || new Date().toISOString();
  const date = new Date(dateStr);
  const timestamp = Math.floor(date.getTime() / 1000);

  // Parse status
  let statusLong = 'Not Started';
  let statusShort = 'NS';
  let elapsed: number | null = null;

  if (row.status === 'in_progress' || row.status === 'live') {
    statusLong = 'Match in Progress';
    statusShort = 'LIVE';
    elapsed = row.minute || null;
  } else if (row.status === 'completed' || row.status === 'finished') {
    statusLong = 'Match Finished';
    statusShort = 'FT';
    elapsed = row.minute || null;
  } else if (row.status === 'paused') {
    statusLong = 'Match Paused';
    statusShort = 'PAUSED';
    elapsed = row.minute || null;
  }

  return {
    fixture: {
      id: row.id,
      date: dateStr,
      timestamp,
      status: {
        long: statusLong,
        short: statusShort,
        elapsed,
      },
    },
    league: {
      id: 0, // ESPN data doesn't have league ID, use 0 as placeholder
      name: row.league || 'Soccer',
      country: '', // Could be extracted from league name
      logo: '', // Not available from ESPN sync
      flag: '', // Not available from ESPN sync
    },
    teams: {
      home: {
        id: row.home_team_id,
        name: row.home_team_name || 'Unknown',
        logo: '', // Could be stored in teams table if needed
      },
      away: {
        id: row.away_team_id,
        name: row.away_team_name || 'Unknown',
        logo: '', // Could be stored in teams table if needed
      },
    },
    goals: {
      home: row.home_goals || row.home_score || null,
      away: row.away_goals || row.away_score || null,
    },
    score: {
      halftime: {
        home: null,
        away: null,
      },
      fulltime: {
        home: row.home_score || null,
        away: row.away_score || null,
      },
    },
    // Build statistics array from DB columns + raw_data (enriched by ESPN summary)
    statistics: buildStatisticsArray(row),
    odds: row.odds ? (typeof row.odds === 'string' ? JSON.parse(row.odds) : row.odds) : null,
  };
}
