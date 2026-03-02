// ============================================
// R$Q - SUPABASE CLIENT & HELPERS
// ============================================
// Versiune completă cu TOATE funcțiile CRUD pentru filtre

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// ============================================
// SUPABASE CONFIGURATION
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables!');
}

// Enable client-side session persistence and auto-refresh where applicable.
// Note: the app uses a custom users table + bcrypt; Supabase auth is optional,
// but enabling persistence here helps if Supabase auth/session tokens are used.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// ============================================
// TYPESCRIPT INTERFACES
// ============================================

export interface User {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  email: string | null;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface Filter {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  conditions: FilterConditions;
  is_active: boolean;
  is_shared: boolean;
  is_public: boolean; // Can other users import this filter?
  notification_enabled: boolean;
  telegram_enabled: boolean;
  last_triggered: string | null;
  trigger_count: number;
  success_rate: number | null;
  created_at: string;
  updated_at: string;
  // Optional fields (added via future migration)
  color?: 'cyan' | 'green' | 'amber' | 'purple' | 'blue' | 'red' | 'gray'; // Color theme for card display
  template_id?: string; // Reference to template this was created from
  forked_from_id?: string; // ID of the original filter this was forked from
  forked_from_user?: string; // Username of original creator (read-only reference)
  version?: number; // v1.0 = original, v2.0+ = user's modified version (default: 1)
  is_editable?: boolean; // Can this be edited? (default: true)
}

export interface FilterConditions {
  // ============ LIVE STATS ============
  // Goals (total, by team, by half, by time)
  goals?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  goals_first_half?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  goals_second_half?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  goals_last_5min?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  goals_last_10min?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  goals_last_15min?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  goals_last_20min?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  goals_last_25min?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  
  // Shots
  shots_on_target?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
    compare_to_opponent?: boolean; // If true, min/max is percentage compared
  };
  shots_off_target?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
    compare_to_opponent?: boolean;
  };
  total_shots?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
    compare_to_opponent?: boolean;
  };
  
  // Attacks
  attacks?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
    compare_to_opponent?: boolean;
  };
  dangerous_attacks?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
    compare_to_opponent?: boolean;
  };
  attacks_and_dangerous?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
    compare_to_opponent?: boolean;
  };

  // Corners
  corners?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
    compare_to_opponent?: boolean;
  };

  // Possession
  possession?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away';
  };

  // Cards
  yellow_cards?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
    compare_to_opponent?: boolean;
    /** Optional time window: only count cards that happened between these minutes */
    time_window?: { from: number; to: number };
  };
  red_cards?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
    compare_to_opponent?: boolean;
    /** Optional time window: only count cards that happened between these minutes */
    time_window?: { from: number; to: number };
  };

  // Advanced stats
  xg?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  penalties?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };

  // Substitutions
  substitutions?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
    /** Optional time window: only count substitutions that happened between these minutes */
    time_window?: { from: number; to: number };
  };

  // ============ SOFASCORE-EXCLUSIVE LIVE STATS ============
  // These require SofaScore enrichment; automatically skipped when data unavailable
  big_chances?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  shots_in_box?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  pass_accuracy?: {
    min?: number;    // percentage 0-100
    max?: number;
    team?: 'home' | 'away';
  };
  interceptions?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  clearances?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };

  // ============ LIVE ODDS ============
  match_goals?: {
    type: 'over' | 'under';
    value: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5 | 6.5 | 7.5 | 8.5 | 9.5;
    from_current_score?: boolean;
  };
  first_half_goals?: {
    type: 'over' | 'under';
    value: 0.5 | 1.5 | 2.5 | 3.5 | 4.5 | 5.5;
    from_current_score?: boolean;
  };
  goal_line?: {
    type: 'over' | 'under';
    value: number; // 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10
  };
  first_half_goal_line?: {
    type: 'over' | 'under';
    value: number;
  };
  match_corners?: {
    type: 'over' | 'under';
    value: number; // 1-25
    from_current_corners?: boolean;
  };
  asian_corners?: {
    type: 'over' | 'under';
    value: number; // 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, etc.
    from_current_corners?: boolean;
  };
  first_half_asian_corners?: {
    type: 'over' | 'under';
    value: number;
    from_current_corners?: boolean;
  };

  // Match Result Odds
  fulltime_result?: 'home' | 'draw' | 'away';
  draw_no_bet?: 'home' | 'away';
  double_chance?: 'home_draw' | 'draw_away' | 'home_away';
  halftime_result?: 'home' | 'draw' | 'away';
  
  // Goal Odds
  goals_odd_or_even?: 'odd' | 'even';
  next_goal_scorer?: 'home' | 'away' | 'nobody';

  // Both Teams to Score
  both_teams_score?: boolean;
  both_teams_score_first_half?: boolean;
  both_teams_score_second_half?: boolean;
  home_team_score_first_half?: boolean;
  away_team_score_first_half?: boolean;
  home_team_score_second_half?: boolean;
  away_team_score_second_half?: boolean;
  home_team_score_both_halves?: boolean;
  away_team_score_both_halves?: boolean;

  // Clean Sheets
  home_clean_sheet?: boolean;
  away_clean_sheet?: boolean;

  // Asian Handicap (with current score)
  asian_handicap?: {
    value: number;
    team?: 'home' | 'away';
    from_current_score?: boolean;
  };

  // ============ MOMENTUM ============
  momentum_last_5min?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away';
  };
  momentum_last_10min?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away';
  };
  momentum_last_15min?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away';
  };
  custom_momentum?: {
    shot_on_target_points?: number;
    shot_off_target_points?: number;
    dangerous_attack_points?: number;
    attack_points?: number;
    corner_points?: number;
  };

  // ============ LEGACY / COMMON ============
  score?: {
    home?: number;
    away?: number;
    type?: 'exact' | 'range';
  };
  match_time?: {
    min?: number;
    max?: number;
  };
  odds?: {
    min?: number;
    max?: number;
  };

  // ============ ML PREDICTIONS (Bzzoiro) ============
  // Trigger filter based on CatBoost ML probability thresholds.
  // Probabilities are 0-100. Use recommended=true to only trigger on model-recommended bets.
  ml_predictions?: {
    // 1X2 win probabilities (0-100)
    prob_home_win?: { min?: number; max?: number };
    prob_draw?: { min?: number; max?: number };
    prob_away_win?: { min?: number; max?: number };
    // Specific predicted result ('H', 'D', 'A')
    predicted_result?: 'H' | 'D' | 'A';
    // Goal O/U probabilities (0-100)
    prob_over_15?: { min?: number; max?: number };
    prob_over_25?: { min?: number; max?: number };
    prob_over_35?: { min?: number; max?: number };
    // BTTS probability (0-100)
    prob_btts_yes?: { min?: number; max?: number };
    // Overall model confidence (0-100, normalized from favorite probability)
    confidence?: { min?: number; max?: number };
    // Model recommendation flags (true = model recommends this bet)
    over_25_recommend?: boolean;
    btts_recommend?: boolean;
    winner_recommend?: boolean;
    // Pre-match bookmaker odds from Bzzoiro events API (decimal)
    odds_home?: { min?: number; max?: number };
    odds_draw?: { min?: number; max?: number };
    odds_away?: { min?: number; max?: number };
    odds_over_25?: { min?: number; max?: number };
    odds_btts_yes?: { min?: number; max?: number };
  };
}

export interface MatchHistory {
  id: string;
  filter_id: string;
  user_id: string;
  match_id: string;
  league_name: string;
  home_team: string;
  away_team: string;
  match_time: string;
  score_home: number | null;
  score_away: number | null;
  statistics: any;
  picked_at: string;
  match_date: string;
  bet_placed: boolean;
  bet_result: string | null;
  bet_odds: number | null;
  notes: string | null;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  match_id: string;
  filter_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  sent_at: string;
  delivered: boolean;
  read: boolean;
  read_at: string | null;
  error_message: string | null;
  retry_count: number;
}

export interface TriggeredMatch {
  id: string;
  user_id: string;
  match_id: string;
  filter_id: string;
  filter_name: string;
  home_team: string;
  away_team: string;
  league_name: string;
  triggered_at: string; // When the match triggered this filter
  match_time: number | null; // Elapsed minutes when triggered
  score_home: number | null;
  score_away: number | null;
  // Final score (filled by finalize endpoint once match is finished)
  final_score_home: number | null;
  final_score_away: number | null;
  match_status: string; // 'ongoing', 'finished', 'scheduled'
  // Optional user feedback
  user_feedback?: boolean | null;
  feedback_at?: string | null;
  created_at: string; // When this record was created
}

// ============================================
// AUTH HELPERS
// ============================================

export const authHelpers = {
  /**
   * Login utilizator
   */
  // Login user using the local users table (bcrypt).
  // keepLoggedIn: when true (default) store user in localStorage; when false use sessionStorage.
  async login(username: string, password: string, keepLoggedIn: boolean = true): Promise<{ user: User | null; error: string | null }> {
    try {
      // Caută user-ul în database (case-insensitive)
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', username)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('🔴 Supabase login query error:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        
        // Check if it's an RLS policy error
        if (error.code === 'PGRST100' || error.message?.includes('policy')) {
          console.error('❌ RLS Policy Error: Login query blocked. Check RLS policies on users table.');
          return { user: null, error: 'RLS policy error - contact admin' };
        }
        
        return { user: null, error: 'Database error' };
      }

      if (!users || users.length === 0) {
        return { user: null, error: 'Invalid credentials' };
      }

      const user = users[0] as User;

      // Verifică parola cu bcrypt
      const isValidPassword = bcrypt.compareSync(password, user.password_hash);

      if (!isValidPassword) {
        return { user: null, error: 'Invalid credentials' };
      }

      // Update last_login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // Persist user according to preference (localStorage vs sessionStorage)
      if (typeof window !== 'undefined') {
        const payload = JSON.stringify({
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          is_admin: user.is_admin,
        });

        if (keepLoggedIn) {
          localStorage.setItem('rsq_user', payload);
          localStorage.setItem('rsq_keep_logged_in', '1');
        } else {
          sessionStorage.setItem('rsq_user', payload);
          localStorage.removeItem('rsq_keep_logged_in');
        }

        // Set lightweight cookies for middleware detection
        try {
          document.cookie = `rsq_session=${new Date().toISOString()}; path=/`;
          document.cookie = `rsq_is_admin=${user.is_admin}; path=/`;
        } catch (e) {
          console.warn('Could not set auth cookies in login flow', e);
        }
      }

      return { user, error: null };
    } catch (err) {
      console.error('Login error:', err);
      return { user: null, error: 'Login failed' };
    }
  },

  /**
   * Logout
   */
  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('rsq_user');
      sessionStorage.removeItem('rsq_user');
      localStorage.removeItem('rsq_keep_logged_in');
      try {
        document.cookie = 'rsq_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'rsq_is_admin=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      } catch (e) {
        console.warn('Could not clear auth cookies on logout', e);
      }
    }
  },

  /**
   * Verifică dacă user e autentificat
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    // Check both persistent and session storage
    const ls = localStorage.getItem('rsq_user');
    const ss = sessionStorage.getItem('rsq_user');
    return !!(ls || ss);
  },

  /**
   * Obține user-ul curent din localStorage
   */
  getCurrentUser(): { id: string; username: string; full_name: string; is_admin: boolean } | null {
    if (typeof window === 'undefined') return null;
    // Prefer persistent storage, fallback to sessionStorage
    const userStr = localStorage.getItem('rsq_user') || sessionStorage.getItem('rsq_user');
    if (!userStr) {
      console.log('No user in localStorage');
      return null;
    }
    try {
      const user = JSON.parse(userStr);
      // CRITICAL: Validate user when retrieved
      if (!user || !user.id || user.id === 'anon' || typeof user.id !== 'string' || user.id.length === 0) {
        console.error('CRITICAL: Invalid user in localStorage, clearing it:', { user });
        localStorage.removeItem('rsq_user');
        return null;
      }
      return user;
    } catch (err) {
      console.error('Error parsing user from localStorage:', err);
      localStorage.removeItem('rsq_user');
      return null;
    }
  },

  /**
   * Verifică dacă user-ul curent e admin
   */
  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.is_admin || false;
  },

  /**
   * Salvează user în localStorage (pentru AuthWrapper)
   */
  saveUser(user: any): void {
    if (typeof window !== 'undefined') {
      // CRITICAL: Validate user before saving
      if (!user || !user.id || typeof user.id !== 'string' || user.id.length === 0 || user.id === 'anon') {
        console.error('CRITICAL: Cannot save invalid user to localStorage', { user });
        console.warn('User ID is:', user?.id);
        return;
      }
      console.log('Saving user to localStorage:', { id: user.id, username: user.username });
      localStorage.setItem('rsq_user', JSON.stringify(user));
    }
  },
  
  /**
   * Keep-me-logged-in helpers
   */
  setKeepLoggedIn(value: boolean) {
    if (typeof window === 'undefined') return;
    if (value) localStorage.setItem('rsq_keep_logged_in', '1');
    else localStorage.removeItem('rsq_keep_logged_in');
  },
  isKeepLoggedIn(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('rsq_keep_logged_in') === '1';
  },
};

// ============================================
// DATABASE HELPERS
// ============================================

export const dbHelpers = {
  // ============================================
  // FILTERS - COMPLETE CRUD
  // ============================================

  /**
   * Obține toate filtrele unui utilizator
   */
  async getUserFilters(userId: string): Promise<Filter[]> {
    try {
      console.log('🔍 getUserFilters: Fetching filters for user:', userId);
      
      if (!userId || userId === 'anon') {
        console.error('❌ getUserFilters: Invalid user_id');
        return [];
      }

      // Call server-side API route that uses service role key
      // Add multiple cache-busting parameters: timestamp + random to force fresh data
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const url = `/api/filters/get?user_id=${encodeURIComponent(userId)}&_t=${timestamp}&_r=${random}`;
      console.log('📡 Fetching from:', url);

      // Try fetch with one retry for eventual consistency issues
      let attempt = 0;
      let lastResult: any = null;
      while (attempt < 2) {
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        console.log('📡 Response status:', response.status, 'attempt', attempt + 1);
        const result = await response.json();
        console.log('📡 Response data:', result);

        // Expose diagnostic info on window for UI debugging
        try {
          if (typeof window !== 'undefined') (window as any).__lastFiltersApi = { status: response.status, result };
        } catch (e) {
          /* ignore */
        }

        lastResult = { response, result };

        // If authentication issue returned from server, clear local cache and force re-login
        if (response.status === 401 || (result && result.error && String(result.error).toLowerCase().includes('invalid user'))) {
          console.error('❌ getUserFilters: Authentication invalid according to server response. Clearing local session.');
          try { authHelpers.logout(); } catch (e) { /* ignore */ }
          return [];
        }

        if (response.ok && !result.error && Array.isArray(result.data)) {
          console.log('✅ Filters fetched successfully:', result.data.length);
          return result.data as Filter[];
        }

        // If we got an OK response but empty data, wait briefly and retry once
        if (response.ok && Array.isArray(result.data) && result.data.length === 0 && attempt === 0) {
          console.warn('⚠️ Empty filter list received, retrying once...');
          await new Promise(r => setTimeout(r, 300));
          attempt += 1;
          continue;
        }

        // If non-ok or error, break and return empty
        break;
      }

      console.error('❌ Error fetching filters or no filters found. Last result:', lastResult?.result || lastResult?.response?.status);
      return [];
    } catch (err) {
      console.error('❌ Error in getUserFilters:', err);
      return [];
    }
  },

  /**
   * Creează un filtru nou
   */
  async createFilter(filter: Partial<Filter>): Promise<{ data: Filter | null; error: string | null }> {
    try {
      // CRITICAL: Log and validate user_id before database operation
      console.log('🔍 createFilter: Received filter with user_id:', filter.user_id);
      
      // Validate user_id is not "anon" or empty
      if (!filter.user_id || filter.user_id === 'anon' || typeof filter.user_id !== 'string' || filter.user_id.length === 0) {
        console.error('❌ CRITICAL: createFilter rejected - invalid user_id:', { user_id: filter.user_id });
        return { 
          data: null, 
          error: 'Invalid user authentication. Please log in again.' 
        };
      }
      
      console.log('✅ createFilter: user_id validated, calling API');
      
      // Call server-side API route that uses service role key
      const response = await fetch('/api/filters/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: filter.user_id,
          name: filter.name,
          description: filter.description,
          conditions: filter.conditions,
          is_active: filter.is_active,
          notification_enabled: filter.notification_enabled,
          telegram_enabled: filter.telegram_enabled,
          is_public: (filter as any).is_public || false,
          combined_filter_ids: (filter as any).combined_filter_ids || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle different error codes
        if (response.status === 409) {
          // Duplicate filter
          console.warn('⚠️ Duplicate filter detected:', result.message);
          return { 
            data: null, 
            error: result.message || 'Duplicate filter - you cannot import the same filter twice' 
          };
        } else if (response.status === 400) {
          // Validation error
          console.warn('⚠️ Validation error:', result.error);
          const errorMsg = Array.isArray(result.details) 
            ? result.details.join(', ') 
            : result.error;
          return { 
            data: null, 
            error: errorMsg 
          };
        } else {
          console.error('Error creating filter via API:', result.error);
          return { data: null, error: result.error || 'Error creating filter' };
        }
      }

      if (result.error) {
        console.error('Error creating filter via API:', result.error);
        return { data: null, error: result.error || 'Error creating filter' };
      }

      console.log('✅ Filter created successfully via API');
      return { data: result.data as Filter, error: null };
    } catch (err) {
      console.error('Error in createFilter:', err);
      return { data: null, error: 'Error creating filter' };
    }
  },

  /**
   * Update filtru existent
   */
  async updateFilter(
    filterId: string, 
    updates: Partial<Filter>
  ): Promise<{ data: Filter | null; error: string | null }> {
    try {
      const response = await fetch('/api/filters/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filterId, updates }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('Error updating filter via API:', result.error);
        return { data: null, error: 'Error updating filter' };
      }

      return { data: result.data as Filter, error: null };
    } catch (err) {
      console.error('Error in updateFilter:', err);
      return { data: null, error: 'Error updating filter' };
    }
  },

  /**
   * Toggle filter active/inactive
   */
  async toggleFilterActive(
    filterId: string, 
    currentStatus: boolean
  ): Promise<{ data: Filter | null; error: string | null }> {
    try {
      const response = await fetch('/api/filters/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          filterId, 
          updates: { is_active: !currentStatus } 
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('Error toggling filter via API:', result.error);
        return { data: null, error: 'Error changing status' };
      }

      console.log('✅ Filter toggled:', result.data);
      return { data: result.data as Filter, error: null };
    } catch (err) {
      console.error('Error in toggleFilterActive:', err);
      return { data: null, error: 'Error changing status' };
    }
  },

  /**
   * Șterge un filtru
   */
  async deleteFilter(filterId: string): Promise<{ error: string | null }> {
    try {
      const response = await fetch(`/api/filters/delete?filterId=${encodeURIComponent(filterId)}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      // Treat 404 as success (filter already gone) — idempotent delete
      if (response.status === 404 || (response.ok && !result.error)) {
        console.log('✅ Filter deleted (or already gone):', filterId);
        return { error: null };
      }

      if (!response.ok || result.error) {
        console.error('Error deleting filter via API:', result.error || result);
        return { error: (result && result.error) ? result.error : `Error deleting filter (status ${response.status})` };
      }

      console.log('✅ Filter deleted:', filterId);
      return { error: null };
    } catch (err) {
      console.error('Error in deleteFilter:', err);
      return { error: 'Error deleting filter' };
    }
  },

  /**
   * Obține un filtru specific
   */
  async getFilterById(filterId: string): Promise<Filter | null> {
    try {
      const response = await fetch(`/api/filters/get-by-id?filterId=${encodeURIComponent(filterId)}`);
      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('Error fetching filter via API:', result.error);
        return null;
      }

      return result.data as Filter;
    } catch (err) {
      console.error('Error in getFilterById:', err);
      return null;
    }
  },

  /**
   * Obține toate filtrele publice (community filters)
   */
  async getPublicFilters(): Promise<Filter[]> {
    try {
      const response = await fetch('/api/filters/public');
      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('Error fetching public filters:', result.error);
        return [];
      }

      return result.data as Filter[];
    } catch (err) {
      console.error('Error in getPublicFilters:', err);
      return [];
    }
  },

  /**
   * Importează un filtru public (creează o copie pentru utilizator curent - v2.0)
   */
  async importPublicFilter(
    sourceFilterId: string,
    userId: string
  ): Promise<{ data: Filter | null; error: string | null }> {
    try {
      if (!userId || userId === 'anon') {
        return { data: null, error: 'Invalid user authentication' };
      }

      const response = await fetch('/api/filters/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_filter_id: sourceFilterId,
          user_id: userId,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('Error importing filter:', result.error);
        return { data: null, error: result.error || 'Error importing filter' };
      }

      console.log('✅ Filter imported successfully');
      return { data: result.data as Filter, error: null };
    } catch (err) {
      console.error('Error in importPublicFilter:', err);
      return { data: null, error: 'Error importing filter' };
    }
  },

  /**
   * Toggle filter public/private status
   */
  async toggleFilterPublic(
    filterId: string,
    isPublic: boolean
  ): Promise<{ data: Filter | null; error: string | null }> {
    try {
      const response = await fetch('/api/filters/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterId,
          updates: { is_public: isPublic }
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('Error updating filter visibility:', result.error);
        return { data: null, error: 'Error updating filter' };
      }

      return { data: result.data as Filter, error: null };
    } catch (err) {
      console.error('Error in toggleFilterPublic:', err);
      return { data: null, error: 'Error updating filter' };
    }
  },

  /**
   * Increment filter trigger count
   * Called when a match triggers a filter
   */
  async incrementFilterTriggerCount(filterId: string): Promise<{ error: string | null }> {
    try {
      const { data: filter, error: fetchError } = await supabase
        .from('filters')
        .select('trigger_count')
        .eq('id', filterId)
        .single();

      if (fetchError) {
        console.error('Error fetching filter for increment:', fetchError);
        return { error: 'Error fetching filter' };
      }

      const newCount = (filter?.trigger_count || 0) + 1;

      const { error: updateError } = await supabase
        .from('filters')
        .update({
          trigger_count: newCount,
          last_triggered: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', filterId);

      if (updateError) {
        console.error('Error incrementing filter trigger count:', updateError);
        return { error: 'Error updating filter' };
      }

      console.log(`✅ Filter ${filterId} trigger_count incremented to ${newCount}`);
      return { error: null };
    } catch (err) {
      console.error('Error in incrementFilterTriggerCount:', err);
      return { error: 'Error updating filter' };
    }
  },

  // ============================================
  // MATCH HISTORY
  // ============================================

  /**
   * Salvează un meci în istoric
   */
  async saveMatchHistory(match: Partial<MatchHistory>): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('matches_history')
        .insert([match]);

      if (error) {
        console.error('Error saving match history:', error);
        return { error: 'Error saving history' };
      }

      return { error: null };
    } catch (err) {
      console.error('Error in saveMatchHistory:', err);
      return { error: 'Error saving history' };
    }
  },

  /**
   * Obține istoricul meciurilor unui user
   */
  async getMatchHistory(userId: string, limit: number = 50): Promise<MatchHistory[]> {
    try {
      const { data, error } = await supabase
        .from('matches_history')
        .select('*')
        .eq('user_id', userId)
        .order('picked_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching match history:', error);
        return [];
      }

      return (data as MatchHistory[]) || [];
    } catch (err) {
      console.error('Error in getMatchHistory:', err);
      return [];
    }
  },

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Obține statistici pentru un user
   */
  async getUserStats(userId: string): Promise<any> {
    try {
      // Placeholder pentru statistici
      // În viitor vom implementa queries complexe
      return {
        totalPicks: 0,
        winRate: 0,
        activeFilters: 0,
        todayPicks: 0,
      };
    } catch (err) {
      console.error('Error in getUserStats:', err);
      return null;
    }
  },

  // ============================================
  // NOTIFICATIONS LOG
  // ============================================

  /**
   * Log notificare trimisă
   */
  async logNotification(notification: Partial<NotificationLog>): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('notifications_log')
        .insert([{
          ...notification,
          sent_at: new Date().toISOString(),
        }]);

      if (error) {
        console.error('Error logging notification:', error);
        return { error: 'Error saving notification' };
      }

      return { error: null };
    } catch (err) {
      console.error('Error in logNotification:', err);
      return { error: 'Error saving notification' };
    }
  },

  /**
   * Obține log-ul de notificări
   */
  async getNotificationsLog(userId: string, limit: number = 50): Promise<NotificationLog[]> {
    try {
      const { data, error } = await supabase
        .from('notifications_log')
        .select('*')
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching notifications log:', error);
        return [];
      }

      return (data as NotificationLog[]) || [];
    } catch (err) {
      console.error('Error in getNotificationsLog:', err);
      return [];
    }
  },

  /**
   * Log a triggered match (when filter matches a live match)
   */
  async logTriggeredMatch(triggeredMatch: Partial<TriggeredMatch>): Promise<{ error: string | null; id?: string }> {
    try {
      const { data, error } = await supabase
        .from('triggered_matches')
        .insert([{
          ...triggeredMatch,
          created_at: new Date().toISOString(),
        }])
        .select('id');

      if (error) {
        console.error('Error logging triggered match:', error);
        return { error: 'Error saving triggered match' };
      }

      return { 
        error: null,
        id: data?.[0]?.id
      };
    } catch (err) {
      console.error('Error in logTriggeredMatch:', err);
      return { error: 'Error saving triggered match' };
    }
  },

  /**
   * Get triggered matches for user (last 15-20 minutes + historical data)
   */
  async getTriggeredMatches(userId: string, minutesBack: number = 20, limit: number = 50): Promise<TriggeredMatch[]> {
    try {
      const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('triggered_matches')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', cutoffTime)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching triggered matches:', error);
        return [];
      }

      return (data as TriggeredMatch[]) || [];
    } catch (err) {
      console.error('Error in getTriggeredMatches:', err);
      return [];
    }
  },

  /**
   * Get triggered matches history (full history, paginated)
   */
  async getTriggeredMatchesHistory(userId: string, limit: number = 100, offset: number = 0): Promise<TriggeredMatch[]> {
    try {
      const { data, error } = await supabase
        .from('triggered_matches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching triggered matches history:', error);
        return [];
      }

      return (data as TriggeredMatch[]) || [];
    } catch (err) {
      console.error('Error in getTriggeredMatchesHistory:', err);
      return [];
    }
  },

  /**
   * Get triggered matches for a specific match (all filters that triggered it)
   */
  async getMatchTriggeredBy(matchId: string, userId: string): Promise<TriggeredMatch[]> {
    try {
      const { data, error } = await supabase
        .from('triggered_matches')
        .select('*')
        .eq('match_id', matchId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching triggered matches for match:', error);
        return [];
      }

      return (data as TriggeredMatch[]) || [];
    } catch (err) {
      console.error('Error in getMatchTriggeredBy:', err);
      return [];
    }
  },

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  /**
   * Get user profile with all settings
   */
  async getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId);
      
      if (error) {
        console.error('Error getting user profile:', error);
        return null;
      }
      
      // Return first record if exists, otherwise null
      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error('Error in getUserProfile:', err);
      return null;
    }
  },

  /**
   * Update user profile (including Telegram settings)
   */
  async updateUserProfile(userId: string, updates: {
    full_name?: string;
    username?: string;
    telegram_chat_id?: string | null;
    telegram_username?: string | null;
    telegram_enabled?: boolean;
    telegram_verified_at?: string | null;
  }) {
    try {
      // First, check if profile exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId);
      
      if (checkError) {
        console.error('Error checking profile:', checkError);
        return { data: null, error: checkError.message };
      }
      
      let result;
      
      if (!existingProfile || existingProfile.length === 0) {
        // Create new profile if it doesn't exist
        console.log('Creating new profile for user:', userId);
        result = await supabase
          .from('profiles')
          .insert([{
            id: userId,
            ...updates,
          }])
          .select()
          .single();
      } else {
        // Update existing profile
        result = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)
          .select();
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error('Error updating profile:', error);
        return { data: null, error: error.message };
      }
      
      // Return the first record if it's an array
      const profileData = Array.isArray(data) ? data[0] : data;
      return { data: profileData, error: null };
    } catch (err) {
      console.error('Error in updateUserProfile:', err);
      return { data: null, error: 'Failed to update profile' };
    }
  },

  // ============================================
  // ADMIN FUNCTIONS
  // ============================================

  /**
   * Obține toți utilizatorii (doar pentru admin)
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, email, is_admin, is_active, created_at, last_login')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        return [];
      }

      return (data as User[]) || [];
    } catch (err) {
      console.error('Error in getAllUsers:', err);
      return [];
    }
  },

  /**
   * Creează un user nou (doar pentru admin)
   */
  async createUser(userData: {
    username: string;
    password: string;
    full_name: string;
    email?: string;
    is_admin?: boolean;
  }): Promise<{ error: string | null }> {
    try {
      // Hash password
      const passwordHash = bcrypt.hashSync(userData.password, 10);

      const { error } = await supabase
        .from('users')
        .insert([{
          username: userData.username,
          password_hash: passwordHash,
          full_name: userData.full_name,
          email: userData.email || null,
          is_admin: userData.is_admin || false,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (error) {
        console.error('Error creating user:', error);
        return { error: 'Error creating user' };
      }

      return { error: null };
    } catch (err) {
      console.error('Error in createUser:', err);
      return { error: 'Error creating user' };
    }
  },

  /**
   * Șterge un user (doar pentru admin)
   */
  async deleteUser(userId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('Error deleting user:', error);
        return { error: 'Error deleting user' };
      }

      return { error: null };
    } catch (err) {
      console.error('Error in deleteUser:', err);
      return { error: 'Error deleting user' };
    }
  },

  /**
   * Toggle user active/inactive (doar pentru admin)
   */
  async toggleUserStatus(userId: string, currentStatus: boolean): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_active: !currentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.error('Error toggling user status:', error);
        return { error: 'Error changing status' };
      }

      return { error: null };
    } catch (err) {
      console.error('Error in toggleUserStatus:', err);
      return { error: 'Error changing status' };
    }
  },
};

// ============================================
// EXPORT EVERYTHING
// ============================================

const supabaseLib = {
  supabase,
  authHelpers,
  dbHelpers,
};

export default supabaseLib;
