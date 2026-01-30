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
  notification_enabled: boolean;
  telegram_enabled: boolean;
  last_triggered: string | null;
  trigger_count: number;
  success_rate: number | null;
  created_at: string;
  updated_at: string;
  // Filter styling
  color?: 'cyan' | 'green' | 'amber' | 'purple' | 'blue' | 'red' | 'gray'; // Color theme for card display
  template_id?: string; // Reference to template this was created from
  // Filter groups - combine multiple filters with OR logic for better accuracy
  combined_filter_ids?: string[]; // IDs of filters to combine with OR
  combination_logic?: 'AND' | 'OR'; // AND = all must match, OR = any can match
}

export interface FilterConditions {
  corners?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  shots_on_target?: {
    min?: number;
    max?: number;
  };
  shots_off_target?: {
    min?: number;
    max?: number;
  };
  total_shots?: {
    min?: number;
    max?: number;
  };
  dangerous_attacks?: {
    min?: number;
    max?: number;
  };
  yellow_cards?: {
    min?: number;
    max?: number;
  };
  red_cards?: {
    min?: number;
    max?: number;
  };
  possession?: {
    min?: number;
    max?: number;
  };
  match_time?: {
    min?: number;
    max?: number;
  };
  odds?: {
    min?: number;
    max?: number;
  };
  goals?: {
    min?: number;
    max?: number;
    team?: 'home' | 'away' | 'total';
  };
  score?: {
    home?: number;
    away?: number;
    type?: 'exact' | 'range';
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
      const url = `/api/filters/get?user_id=${encodeURIComponent(userId)}`;
      console.log('📡 Fetching from:', url);
      
      const response = await fetch(url);
      console.log('📡 Response status:', response.status);
      
      const result = await response.json();
      console.log('📡 Response data:', result);

      if (!response.ok || result.error) {
        console.error('❌ Error fetching filters:', result.error, 'Status:', response.status);
        return [];
      }

      console.log('✅ Filters fetched successfully:', result.data?.length || 0);
      return (result.data as Filter[]) || [];
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
          combined_filter_ids: (filter as any).combined_filter_ids || undefined,
          combination_logic: (filter as any).combination_logic || undefined,
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

      if (!response.ok || result.error) {
        console.error('Error deleting filter via API:', result.error);
        return { error: 'Error deleting filter' };
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
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error getting user profile:', error);
        throw error;
      }
      
      return data;
    } catch (err) {
      console.error('Error in getUserProfile:', err);
      throw err;
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
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating profile:', error);
        return { data: null, error: error.message };
      }
      
      return { data, error: null };
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
