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
 */
export async function syncAllMatches(): Promise<{ count: number; duration: number }> {
  const startTime = Date.now();
  
  try {
    console.log('🔄 [ESPN Sync] Starting match sync...');
    const matches = await ESPNAPI.getAllLiveMatches();
    
    if (matches.length === 0) {
      console.log('⚠️ [ESPN Sync] No matches to sync');
      return { count: 0, duration: Date.now() - startTime };
    }

    const rows = matches.map(match => ({
      id: match.id,
      event_id: match.eventId || match.id,
      sport: detectSport(match),
      league: detectLeague(match),
      date: new Date(match.date),
      status: match.status,
      home_team_id: match.homeTeam.id,
      away_team_id: match.awayTeam.id,
      home_team_name: match.homeTeam.displayName,
      away_team_name: match.awayTeam.displayName,
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
      odds: match.odds,
      raw_data: match,
    }));

    // Batch upsert - single operation, all users benefit
    const { error } = await supabase
      .from('espn_matches')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.error('❌ [ESPN Sync] Upsert failed:', error);
      throw error;
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ [ESPN Sync] Synced ${rows.length} matches in ${duration}ms`);
    
    lastSyncTime = Date.now();
    return { count: rows.length, duration };
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
 */
export async function getLiveMatchesFromDB(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('espn_matches')
      .select('*')
      .neq('status', 'completed')
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
