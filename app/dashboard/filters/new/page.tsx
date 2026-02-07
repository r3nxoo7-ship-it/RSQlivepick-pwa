'use client';

// ============================================
// R$Q - COMPLETE FILTER BUILDER UI
// ============================================
// Comprehensive filter creation with all conditions

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Save,
  ArrowLeft,
  Plus,
  Minus,
  Clock,
  Target,
  Users,
  Shield,
  Activity,
  TrendingUp,
  Loader2,
  AlertCircle,
  CheckCircle,
  Combine,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import { ExtendedFilterConditions } from '@/lib/extended-filters';

// ============================================
// TYPES
// ============================================

interface TeamCondition {
  home_min?: number;
  home_max?: number;
  away_min?: number;
  away_max?: number;
  total_min?: number;
  total_max?: number;
}

// ============================================
// COMPONENTA PRINCIPALĂ
// ============================================

export default function CompleteFilterBuilder() {
  const router = useRouter();
  
  // ============================================
  // STATE
  // ============================================
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  
  // Time conditions
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [timeMode, setTimeMode] = useState<'after' | 'before' | 'between'>('after');
  const [timeValue, setTimeValue] = useState({ min: 1, max: 90 });
  
  // Score conditions
  const [scoreEnabled, setScoreEnabled] = useState(false);
  const [scoreMode, setScoreMode] = useState<'exact' | 'range'>('range');
  const [exactScore, setExactScore] = useState({ home: 0, away: 0 });
  const [scoreRange, setScoreRange] = useState({
    home_min: undefined as number | undefined,
    home_max: undefined as number | undefined,
    away_min: undefined as number | undefined,
    away_max: undefined as number | undefined,
    total_min: undefined as number | undefined,
    total_max: undefined as number | undefined,
  });
  
  // Corners
  const [cornersEnabled, setCornersEnabled] = useState(false);
  const [corners, setCorners] = useState<TeamCondition>({});
  
  // Shots
  const [shotsEnabled, setShotsEnabled] = useState(false);
  const [shots, setShots] = useState<TeamCondition>({});
  
  // Shots on target
  const [shotsOnTargetEnabled, setShotsOnTargetEnabled] = useState(false);
  const [shotsOnTarget, setShotsOnTarget] = useState<TeamCondition>({});
  
  // Yellow cards
  const [yellowCardsEnabled, setYellowCardsEnabled] = useState(false);
  const [yellowCards, setYellowCards] = useState<TeamCondition>({});
  
  // Red cards
  const [redCardsEnabled, setRedCardsEnabled] = useState(false);
  const [redCards, setRedCards] = useState<TeamCondition>({});
  
  // Dangerous attacks
  const [attacksEnabled, setAttacksEnabled] = useState(false);
  const [attacks, setAttacks] = useState<TeamCondition>({});
  
  // Possession
  const [possessionEnabled, setPossessionEnabled] = useState(false);
  const [possession, setPossession] = useState({
    home_min: undefined as number | undefined,
    home_max: undefined as number | undefined,
    away_min: undefined as number | undefined,
    away_max: undefined as number | undefined,
  });
  
  // Substitutions
  const [substitutionsEnabled, setSubstitutionsEnabled] = useState(false);
  const [substitutions, setSubstitutions] = useState<TeamCondition>({});
  
  // Filter groups - combine multiple filters
  const [combinedFilterIds, setCombinedFilterIds] = useState<string[]>([]);
  const [combinationLogic, setCombinationLogic] = useState<'AND' | 'OR'>('OR');
  const [userFilters, setUserFilters] = useState<any[]>([]);
  const [showCombineMode, setShowCombineMode] = useState(false);

  // Odds (pre-match) condition
  const [oddsEnabled, setOddsEnabled] = useState(false);
  const [oddsMin, setOddsMin] = useState<number | undefined>(undefined);
  const [oddsMax, setOddsMax] = useState<number | undefined>(undefined);
  
  // ============================================
  // LOAD DATA
  // ============================================
  
  useEffect(() => {
    loadUserFilters();
  }, []);

  // If opened with ?mode=super then show combine mode UI prominently
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const mode = sp.get('mode');
      if (mode === 'super') {
        setShowCombineMode(true);
        setCombinationLogic('AND');
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Auto-set description for super/combine mode
  useEffect(() => {
    if (showCombineMode) {
      setDescription('Combine Filters');
    }
  }, [showCombineMode]);
  
  const loadUserFilters = async () => {
    try {
      const currentUser = authHelpers.getCurrentUser();
      if (currentUser) {
        const filters = await dbHelpers.getUserFilters(currentUser.id);
        setUserFilters(filters);
      }
    } catch (err) {
      console.error('Error loading filters:', err);
    }
  };
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a name for the filter');
      return;
    }
    
    // ============================================
    // VALIDATION: allow Super (combine-only) mode
    // ============================================
    if (!showCombineMode) {
      const hasAnyCondition =
        timeEnabled || scoreEnabled || cornersEnabled || shotsEnabled ||
        shotsOnTargetEnabled || yellowCardsEnabled || redCardsEnabled ||
        attacksEnabled || possessionEnabled || substitutionsEnabled || oddsEnabled;

      if (!hasAnyCondition && combinedFilterIds.length === 0) {
        setError('Define at least one condition or select filters to combine');
        return;
      }
    } else {
      // Super Filter mode: require at least TWO combined filters
      if (combinedFilterIds.length < 2) {
        setError('Select at least two filters to combine');
        return;
      }
    }

    // ============================================
    // VALIDATION: contradictory ranges
    // ============================================
    const validationErrors: string[] = [];
    
    // Validar time range
    if (timeEnabled && timeMode === 'between' && timeValue.min > timeValue.max) {
      validationErrors.push('Time: min cannot be greater than max');
    }
    
    // Validar corners
    if (cornersEnabled) {
      if (corners.total_min !== undefined && corners.total_max !== undefined && corners.total_min > corners.total_max) {
        validationErrors.push('Corners (total): min cannot be greater than max');
      }
      if (corners.home_min !== undefined && corners.home_max !== undefined && corners.home_min > corners.home_max) {
        validationErrors.push('Corners (home): min cannot be greater than max');
      }
      if (corners.away_min !== undefined && corners.away_max !== undefined && corners.away_min > corners.away_max) {
        validationErrors.push('Corners (away): min cannot be greater than max');
      }
    }
    
    // Validar shots
    if (shotsEnabled) {
      if (shots.total_min !== undefined && shots.total_max !== undefined && shots.total_min > shots.total_max) {
        validationErrors.push('Shots (total): min cannot be greater than max');
      }
    }
    
    // Validar shots on target
    if (shotsOnTargetEnabled) {
      if (shotsOnTarget.total_min !== undefined && shotsOnTarget.total_max !== undefined && shotsOnTarget.total_min > shotsOnTarget.total_max) {
        validationErrors.push('Shots on target (total): min cannot be greater than max');
      }
    }
    
    // Validar yellow cards
    if (yellowCardsEnabled) {
      if (yellowCards.total_min !== undefined && yellowCards.total_max !== undefined && yellowCards.total_min > yellowCards.total_max) {
        validationErrors.push('Yellow cards (total): min cannot be greater than max');
      }
    }
    
    // Validar red cards
    if (redCardsEnabled) {
      if (redCards.total_min !== undefined && redCards.total_max !== undefined && redCards.total_min > redCards.total_max) {
        validationErrors.push('Red cards (total): min cannot be greater than max');
      }
    }
    
    if (validationErrors.length > 0) {
      setError(`❌ Validation errors:\n${validationErrors.join('\n')}`);
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const user = authHelpers.getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      
      // Build conditions object
      const conditions: ExtendedFilterConditions = {};
      
      // Time
      if (timeEnabled) {
        if (timeMode === 'after') {
          conditions.match_time = { after: timeValue.min };
        } else if (timeMode === 'before') {
          conditions.match_time = { before: timeValue.max };
        } else {
          conditions.match_time = { between: [timeValue.min, timeValue.max] };
        }
      }
      
      // Score
      if (scoreEnabled) {
        if (scoreMode === 'exact') {
          conditions.score = {
            exact: { home: exactScore.home, away: exactScore.away },
          };
        } else {
          conditions.score = {};
          if (scoreRange.home_min !== undefined || scoreRange.home_max !== undefined) {
            conditions.score.home = {
              min: scoreRange.home_min,
              max: scoreRange.home_max,
            };
          }
          if (scoreRange.away_min !== undefined || scoreRange.away_max !== undefined) {
            conditions.score.away = {
              min: scoreRange.away_min,
              max: scoreRange.away_max,
            };
          }
          if (scoreRange.total_min !== undefined || scoreRange.total_max !== undefined) {
            conditions.score.total_goals = {
              min: scoreRange.total_min,
              max: scoreRange.total_max,
            };
          }
        }
      }
      
      // Corners
      if (cornersEnabled) {
        conditions.corners = {
          home: corners.home_min || corners.home_max ? {
            min: corners.home_min,
            max: corners.home_max,
          } : undefined,
          away: corners.away_min || corners.away_max ? {
            min: corners.away_min,
            max: corners.away_max,
          } : undefined,
          total: corners.total_min || corners.total_max ? {
            min: corners.total_min,
            max: corners.total_max,
          } : undefined,
        };
      }
      
      // Shots
      if (shotsEnabled) {
        conditions.shots = {
          home: shots.home_min || shots.home_max ? {
            min: shots.home_min,
            max: shots.home_max,
          } : undefined,
          away: shots.away_min || shots.away_max ? {
            min: shots.away_min,
            max: shots.away_max,
          } : undefined,
          total: shots.total_min || shots.total_max ? {
            min: shots.total_min,
            max: shots.total_max,
          } : undefined,
        };
      }
      
      // Shots on target
      if (shotsOnTargetEnabled) {
        conditions.shots_on_target = {
          home: shotsOnTarget.home_min || shotsOnTarget.home_max ? {
            min: shotsOnTarget.home_min,
            max: shotsOnTarget.home_max,
          } : undefined,
          away: shotsOnTarget.away_min || shotsOnTarget.away_max ? {
            min: shotsOnTarget.away_min,
            max: shotsOnTarget.away_max,
          } : undefined,
          total: shotsOnTarget.total_min || shotsOnTarget.total_max ? {
            min: shotsOnTarget.total_min,
            max: shotsOnTarget.total_max,
          } : undefined,
        };
      }
      
      // Yellow cards
      if (yellowCardsEnabled) {
        conditions.yellow_cards = {
          home: yellowCards.home_min || yellowCards.home_max ? {
            min: yellowCards.home_min,
            max: yellowCards.home_max,
          } : undefined,
          away: yellowCards.away_min || yellowCards.away_max ? {
            min: yellowCards.away_min,
            max: yellowCards.away_max,
          } : undefined,
          total: yellowCards.total_min || yellowCards.total_max ? {
            min: yellowCards.total_min,
            max: yellowCards.total_max,
          } : undefined,
        };
      }
      
      // Red cards
      if (redCardsEnabled) {
        conditions.red_cards = {
          home: redCards.home_min || redCards.home_max ? {
            min: redCards.home_min,
            max: redCards.home_max,
          } : undefined,
          away: redCards.away_min || redCards.away_max ? {
            min: redCards.away_min,
            max: redCards.away_max,
          } : undefined,
          total: redCards.total_min || redCards.total_max ? {
            min: redCards.total_min,
            max: redCards.total_max,
          } : undefined,
        };
      }
      
      // Dangerous attacks
      if (attacksEnabled) {
        conditions.dangerous_attacks = {
          home: attacks.home_min || attacks.home_max ? {
            min: attacks.home_min,
            max: attacks.home_max,
          } : undefined,
          away: attacks.away_min || attacks.away_max ? {
            min: attacks.away_min,
            max: attacks.away_max,
          } : undefined,
          total: attacks.total_min || attacks.total_max ? {
            min: attacks.total_min,
            max: attacks.total_max,
          } : undefined,
        };
      }
      
      // Possession
      if (possessionEnabled) {
        conditions.possession = {
          home: possession.home_min || possession.home_max ? {
            min: possession.home_min,
            max: possession.home_max,
          } : undefined,
          away: possession.away_min || possession.away_max ? {
            min: possession.away_min,
            max: possession.away_max,
          } : undefined,
        };
      }
      
      // Substitutions
      if (substitutionsEnabled) {
        conditions.substitutions = {
          home: substitutions.home_min || substitutions.home_max ? {
            min: substitutions.home_min,
            max: substitutions.home_max,
          } : undefined,
          away: substitutions.away_min || substitutions.away_max ? {
            min: substitutions.away_min,
            max: substitutions.away_max,
          } : undefined,
          total: substitutions.total_min || substitutions.total_max ? {
            min: substitutions.total_min,
            max: substitutions.total_max,
          } : undefined,
        };
      }

      // Odds (pre-match)
      if (oddsEnabled) {
        conditions.odds = {
          min: oddsMin,
          max: oddsMax,
        } as any;
      }
      
      // Create filter
      console.log('Creating filter with user_id:', user?.id);
      const filterPayload: any = {
        user_id: user?.id || undefined,
        name,
        description: description || undefined,
        conditions: conditions as any,
        is_active: isActive,
        is_public: isPublic,
        notification_enabled: notificationEnabled,
        telegram_enabled: telegramEnabled,
      };
      
      // If in super/combine mode, add combined filter IDs
      if (showCombineMode && combinedFilterIds.length > 0) {
        filterPayload.combined_filter_ids = combinedFilterIds;
      }
      
      const { data, error } = await dbHelpers.createFilter(filterPayload);
      
      if (error) {
        setError(error);
        return;
      }
      
      setSuccess('✅ Filter created successfully!');
      
      setTimeout(() => {
        router.push('/dashboard/filters');
      }, 1500);
      
    } catch (err) {
      console.error('Error creating filter:', err);
      setError('Error creating filter. Check your permissions.');
    } finally {
      setSaving(false);
    }
  };
  
  // ============================================
  // RENDER HELPERS
  // ============================================
  
  const renderTeamCondition = (
    title: string,
    enabled: boolean,
    setEnabled: (val: boolean) => void,
    values: TeamCondition,
    setValues: (val: TeamCondition) => void,
    icon: React.ReactNode
  ) => (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {icon}
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
          <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-5 h-5 rounded"
          />
          <span className="text-sm">Enable</span>
        </label>
      </div>
      
      {enabled && (
        <div className="space-y-4">
          {/* Home Team */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-accent-green">
              Home
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Min"
                value={values.home_min || ''}
                onChange={(e) => setValues({
                  ...values,
                  home_min: e.target.value ? parseInt(e.target.value) : undefined,
                })}
                className="input-field"
              />
              <input
                type="number"
                placeholder="Max"
                value={values.home_max || ''}
                onChange={(e) => setValues({
                  ...values,
                  home_max: e.target.value ? parseInt(e.target.value) : undefined,
                })}
                className="input-field"
              />
            </div>
          </div>
          
          {/* Away Team */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-accent-cyan">
              Away
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Min"
                value={values.away_min || ''}
                onChange={(e) => setValues({
                  ...values,
                  away_min: e.target.value ? parseInt(e.target.value) : undefined,
                })}
                className="input-field"
              />
              <input
                type="number"
                placeholder="Max"
                value={values.away_max || ''}
                onChange={(e) => setValues({
                  ...values,
                  away_max: e.target.value ? parseInt(e.target.value) : undefined,
                })}
                className="input-field"
              />
            </div>
          </div>
          
          {/* Total */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-accent-purple">
              Match Total
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="Min"
                value={values.total_min || ''}
                onChange={(e) => setValues({
                  ...values,
                  total_min: e.target.value ? parseInt(e.target.value) : undefined,
                })}
                className="input-field"
              />
              <input
                type="number"
                placeholder="Max"
                value={values.total_max || ''}
                onChange={(e) => setValues({
                  ...values,
                  total_max: e.target.value ? parseInt(e.target.value) : undefined,
                })}
                className="input-field"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
  
  // ============================================
  // RENDER
  // ============================================
  
  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* HEADER */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/filters')}
              className="btn-secondary"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-display font-bold gradient-text">
                {showCombineMode ? 'Create Super Filter' : 'Create Complete Filter'}
              </h1>
              <p className="text-text-secondary text-sm mt-1">
                {showCombineMode ? 'Combine Filters' : 'All available conditions'}
              </p>
            </div>
          </div>
          
          {/* MESSAGES */}
          {error && (
            <div className="p-4 rounded-lg bg-accent-red/10 border border-accent-red/20 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-accent-red" />
              <p className="text-sm text-accent-red">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="p-4 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-accent-green" />
              <p className="text-sm text-accent-green">{success}</p>
            </div>
          )}
          
          {/* BASIC INFO */}
          <div className="glass-card p-6">
              <h2 className="text-xl font-semibold mb-4">General Information</h2>
            
            <div className="space-y-4">
              <div>
                  <label className="block text-sm font-semibold mb-2">
                  Filter Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Corners + Score 0-0"
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this filter..."
                  rows={2}
                  className="input-field resize-none"
                />
              </div>
              
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm">Active Filter</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationEnabled}
                    onChange={(e) => setNotificationEnabled(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm">Browser Notifications</span>
                </label>
                
                  <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={telegramEnabled}
                    onChange={(e) => setTelegramEnabled(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm">Telegram</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm">Share in Community</span>
                </label>
              </div>
            </div>
          </div>

          {!showCombineMode && (
          <>
          {/* PRE-MATCH ODDS */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-accent-amber" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/></svg>
                <h3 className="text-lg font-semibold">Pre-match Odds Filter</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={oddsEnabled}
                  onChange={(e) => setOddsEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Enable</span>
              </label>
            </div>

            {oddsEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-2">Min Odds</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={oddsMin ?? ''}
                    onChange={(e) => setOddsMin(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="e.g. 1.5"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Max Odds</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={oddsMax ?? ''}
                    onChange={(e) => setOddsMax(e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="e.g. 3.0"
                    className="input-field"
                  />
                </div>
                <div className="col-span-2 text-xs text-text-muted">
                  Example: For +3 goals strategies set Max Odds &lt;= 1.8 to only consider matches that opened below 1.8. For red-card-only signals set Min Odds &gt;= 6 to focus on long-shot events.
                </div>
              </div>
            )}
          </div>
          
          {/* TIME CONDITIONS */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-accent-amber" />
                <h3 className="text-lg font-semibold">Match Time (minutes)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeEnabled}
                  onChange={(e) => setTimeEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            
            {timeEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Time Mode</label>
                  <select
                    value={timeMode}
                    onChange={(e) => setTimeMode(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="after">After minute...</option>
                      <option value="before">Before minute...</option>
                      <option value="between">Between minutes...</option>
                  </select>
                </div>
                
                {timeMode === 'between' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="From min"
                      value={timeValue.min}
                      onChange={(e) => setTimeValue({ ...timeValue, min: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={90}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="To min"
                      value={timeValue.max}
                      onChange={(e) => setTimeValue({ ...timeValue, max: parseInt(e.target.value) || 90 })}
                      min={1}
                      max={90}
                      className="input-field"
                    />
                  </div>
                ) : (
                  <input
                    type="number"
                    placeholder={timeMode === 'after' ? "After minute..." : "Before minute..."}
                    value={timeMode === 'after' ? timeValue.min : timeValue.max}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setTimeValue(timeMode === 'after' ? { ...timeValue, min: val } : { ...timeValue, max: val });
                    }}
                    min={1}
                    max={90}
                    className="input-field"
                  />
                )}
              </div>
            )}
          </div>

          {/* SCORE CONDITIONS */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-accent-green" />
                <h3 className="text-lg font-semibold">Score</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scoreEnabled}
                  onChange={(e) => setScoreEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            
            {scoreEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Score Mode</label>
                  <select
                    value={scoreMode}
                    onChange={(e) => setScoreMode(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="exact">Exact Score (ex: 0-0, 1-0)</option>
                    <option value="range">Range (min/max goals)</option>
                  </select>
                </div>
                
                {scoreMode === 'exact' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-2">Home Goals</label>
                      <input
                        type="number"
                        value={exactScore.home}
                        onChange={(e) => setExactScore({ ...exactScore, home: parseInt(e.target.value) || 0 })}
                        min={0}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2">Away Goals</label>
                      <input
                        type="number"
                        value={exactScore.away}
                        onChange={(e) => setExactScore({ ...exactScore, away: parseInt(e.target.value) || 0 })}
                        min={0}
                        className="input-field"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-accent-green">
                        Home Goals
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="Min"
                          value={scoreRange.home_min || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            home_min: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={scoreRange.home_max || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            home_max: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-accent-cyan">
                        Away Goals
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="Min"
                          value={scoreRange.away_min || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            away_min: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={scoreRange.away_max || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            away_max: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-accent-purple">
                        Match Total Goals
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="Min (ex: 3 pentru Over 2.5)"
                          value={scoreRange.total_min || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            total_min: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={scoreRange.total_max || ''}
                          onChange={(e) => setScoreRange({
                            ...scoreRange,
                            total_max: e.target.value ? parseInt(e.target.value) : undefined,
                          })}
                          min={0}
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STATISTICS CONDITIONS */}
          <div className="space-y-6">
            {renderTeamCondition(
              'Corners',
              cornersEnabled,
              setCornersEnabled,
              corners,
              setCorners,
              <Activity className="w-5 h-5 text-accent-cyan" />
            )}
            
            {renderTeamCondition(
              'Shots',
              shotsEnabled,
              setShotsEnabled,
              shots,
              setShots,
              <Target className="w-5 h-5 text-accent-green" />
            )}
            
            {renderTeamCondition(
              'Shots on Target',
              shotsOnTargetEnabled,
              setShotsOnTargetEnabled,
              shotsOnTarget,
              setShotsOnTarget,
              <Target className="w-5 h-5 text-accent-purple" />
            )}
            
            {renderTeamCondition(
              'Yellow Cards',
              yellowCardsEnabled,
              setYellowCardsEnabled,
              yellowCards,
              setYellowCards,
              <div className="w-5 h-5 bg-yellow-500 rounded" />
            )}
            
            {renderTeamCondition(
              'Red Cards',
              redCardsEnabled,
              setRedCardsEnabled,
              redCards,
              setRedCards,
              <div className="w-5 h-5 bg-red-500 rounded" />
            )}
            
            {renderTeamCondition(
              'Dangerous Attacks',
              attacksEnabled,
              setAttacksEnabled,
              attacks,
              setAttacks,
              <TrendingUp className="w-5 h-5 text-accent-amber" />
            )}
            
            {renderTeamCondition(
              'Substitutions',
              substitutionsEnabled,
              setSubstitutionsEnabled,
              substitutions,
              setSubstitutions,
              <Users className="w-5 h-5 text-accent-cyan" />
            )}
          </div>

          {/* POSSESSION */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-accent-purple" />
                <h3 className="text-lg font-semibold">Possession (%)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={possessionEnabled}
                  onChange={(e) => setPossessionEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            
            {possessionEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-accent-green">
                    Home Possession (%)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Min %"
                      value={possession.home_min || ''}
                      onChange={(e) => setPossession({
                        ...possession,
                        home_min: e.target.value ? parseInt(e.target.value) : undefined,
                      })}
                      min={0}
                      max={100}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Max %"
                      value={possession.home_max || ''}
                      onChange={(e) => setPossession({
                        ...possession,
                        home_max: e.target.value ? parseInt(e.target.value) : undefined,
                      })}
                      min={0}
                      max={100}
                      className="input-field"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold mb-2 text-accent-cyan">
                    Away Possession (%)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Min %"
                      value={possession.away_min || ''}
                      onChange={(e) => setPossession({
                        ...possession,
                        away_min: e.target.value ? parseInt(e.target.value) : undefined,
                      })}
                      min={0}
                      max={100}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Max %"
                      value={possession.away_max || ''}
                      onChange={(e) => setPossession({
                        ...possession,
                        away_max: e.target.value ? parseInt(e.target.value) : undefined,
                      })}
                      min={0}
                      max={100}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          </>
          )}

          {showCombineMode && (
            <div className="space-y-4 pb-6">
              <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                  <Combine className="w-5 h-5" />
                  Combine Filters
                </h3>
                
                {userFilters && userFilters.length > 0 ? (
                  <>
                    {/* Combination Logic Selection */}
                    <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/30">
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        How should filters be combined?
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            name="logic"
                            value="AND"
                            checked={combinationLogic === 'AND'}
                            onChange={(e) => setCombinationLogic(e.target.value as 'AND' | 'OR')}
                            className="w-4 h-4 accent-cyan-400"
                          />
                          <span className="text-gray-300 group-hover:text-cyan-400 transition-colors">
                            <strong>AND</strong> - Match only if <u>all</u> filters match
                          </span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            name="logic"
                            value="OR"
                            checked={combinationLogic === 'OR'}
                            onChange={(e) => setCombinationLogic(e.target.value as 'AND' | 'OR')}
                            className="w-4 h-4 accent-purple-400"
                          />
                          <span className="text-gray-300 group-hover:text-purple-400 transition-colors">
                            <strong>OR</strong> - Match if <u>any</u> filter matches
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Available Filters Selection */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-300 mb-3">
                        Select filters to combine ({combinedFilterIds.length}/5)
                      </label>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {userFilters.map((filter) => (
                          <label
                            key={filter.id}
                            className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:border-cyan-500/50 transition-colors cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={combinedFilterIds.includes(filter.id)}
                              onChange={(e) => {
                                if (e.target.checked && combinedFilterIds.length < 5) {
                                  setCombinedFilterIds([...combinedFilterIds, filter.id]);
                                } else if (!e.target.checked) {
                                  setCombinedFilterIds(
                                    combinedFilterIds.filter((id) => id !== filter.id)
                                  );
                                }
                              }}
                              disabled={
                                !combinedFilterIds.includes(filter.id) &&
                                combinedFilterIds.length >= 5
                              }
                              className="w-4 h-4 accent-cyan-400 mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-100 font-medium truncate group-hover:text-cyan-400 transition-colors">
                                {filter.name}
                              </p>
                              <p className="text-xs text-gray-400 line-clamp-1">
                                {Object.keys(filter.conditions || {}).length} conditions
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Selection Summary */}
                    {combinedFilterIds.length > 0 && (
                      <div className="mt-4 p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
                        <p className="text-sm text-cyan-300">
                          ✅ Combining <strong>{combinedFilterIds.length}</strong> filter{combinedFilterIds.length !== 1 ? 's' : ''} with{' '}
                          <strong>{combinationLogic}</strong> logic. This will create a new filter that matches when{' '}
                          {combinationLogic === 'AND'
                            ? 'all selected filters match'
                            : 'any of the selected filters match'}
                          .
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center p-6 text-gray-400">
                    <p>No existing filters available for combining</p>
                    <p className="text-xs mt-2">Create some filters first, then you can combine them here</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* ACTIONS */}
          <div className="flex gap-2 sm:gap-4 sticky bottom-6 z-50 flex-col-reverse sm:flex-row">
            <button
              onClick={() => router.push('/dashboard/filters')}
              className="btn-secondary flex-1 py-2 px-3 sm:py-3 sm:px-4 text-sm sm:text-base"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2 py-2 px-3 sm:py-3 sm:px-4 text-sm sm:text-base"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                  <span className="sm:hidden">Save...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Create Filter</span>
                  <span className="sm:hidden">Create</span>
                </>
              )}
            </button>
          </div>
          
        </div>
      </div>
    </AuthWrapper>
  );
}
