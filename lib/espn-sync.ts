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
    
    // Soccer leagues only - avoid NBA, NFL, etc.
    const soccerLeagues = [
      { sport: 'soccer', league: 'eng.1', name: 'Premier League' },
      { sport: 'soccer', league: 'esp.1', name: 'La Liga' },
      { sport: 'soccer', league: 'ita.1', name: 'Serie A' },
      { sport: 'soccer', league: 'ger.1', name: 'Bundesliga' },
      { sport: 'soccer', league: 'fra.1', name: 'Ligue 1' },
      { sport: 'soccer', league: 'usa.1', name: 'MLS' },
      { sport: 'soccer', league: 'uefa.champions', name: 'Champions League' },
    ];

    const allMatches: ESPNAPI.ESPNMatch[] = [];

    for (const config of soccerLeagues) {
      try {
        const matches = await ESPNAPI.getLeagueMatches(config.sport, config.league);
        console.log(`  ⚽ ${config.name}: ${matches.length} matches`);
        
        // Add league info to each match for better tracking
        matches.forEach(m => {
          (m as any).__league_config = config;
        });
        
        allMatches.push(...matches);
      } catch (err) {
        console.warn(`⚠️ [ESPN Sync] Failed to fetch ${config.name}:`, err);
      }
    }
    
    if (allMatches.length === 0) {
      console.log('⚠️ [ESPN Sync] No soccer matches to sync');
      return { count: 0, duration: Date.now() - startTime };
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
        home: null, // ESPN data doesn't always separate halftime
        away: null,
      },
      fulltime: {
        home: row.home_score || null,
        away: row.away_score || null,
      },
    },
    statistics: row.statistics ? JSON.parse(row.statistics) : [],
    odds: row.odds ? JSON.parse(row.odds) : null,
  };
}
