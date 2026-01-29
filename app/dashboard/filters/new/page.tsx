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
  
  // ============================================
  // HANDLERS
  // ============================================
  
  const handleSave = async () => {
    if (!name.trim()) {
      setError('Te rog introdu un nume pentru filtru');
      return;
    }
    
    // ============================================
    // VALIDACIÓN: CONDICIONES NO VACÍAS
    // ============================================
    const hasAnyCondition = 
      timeEnabled || scoreEnabled || cornersEnabled || shotsEnabled ||
      shotsOnTargetEnabled || yellowCardsEnabled || redCardsEnabled ||
      attacksEnabled || possessionEnabled || substitutionsEnabled;
    
    if (!hasAnyCondition) {
      setError('❌ You must select at least one condition for the filter');
      return;
    }
    
    // ============================================
    // VALIDACIÓN: CONDICIONES CONTRADICTORIAS
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
      setError(`❌ Errori de validare:\n${validationErrors.join('\n')}`);
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
      
      // Create filter
      console.log('📤 About to call createFilter with user_id:', user?.id);
      const { data, error } = await dbHelpers.createFilter({
        user_id: user?.id || undefined,
        name,
        description: description || undefined,
        conditions: conditions as any,
        is_active: isActive,
        notification_enabled: notificationEnabled,
        telegram_enabled: telegramEnabled,
      });
      
      if (error) {
        setError(error);
        return;
      }
      
      setSuccess('✅ Filtru creat cu succes!');
      
      setTimeout(() => {
        router.push('/dashboard/filters');
      }, 1500);
      
    } catch (err) {
      console.error('Error creating filter:', err);
      setError('Eroare la crearea filtrului. Verifică dacă ai permisiuni.');
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
          <span className="text-sm">Activează</span>
        </label>
      </div>
      
      {enabled && (
        <div className="space-y-4">
          {/* Home Team */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-accent-green">
              🏠 Gazde
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
              🚌 Oaspeți
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
              📊 Total Meci
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
              Înapoi
            </button>
            <div>
              <h1 className="text-3xl font-display font-bold gradient-text">
                Creează Filtru Complet
              </h1>
              <p className="text-text-secondary text-sm mt-1">
                Toate condițiile disponibile
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
            <h2 className="text-xl font-semibold mb-4">Informații Generale</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Nume Filtru *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Cornere + Scor 0-0"
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Descriere
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrie acest filtru..."
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
                  <span className="text-sm">Filtru Activ</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationEnabled}
                    onChange={(e) => setNotificationEnabled(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm">Notificări Browser</span>
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
              </div>
            </div>
          </div>
          
          {/* TIME CONDITIONS */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-accent-amber" />
                <h3 className="text-lg font-semibold">Timp Meci (Minute)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={timeEnabled}
                  onChange={(e) => setTimeEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Activează</span>
              </label>
            </div>
            
            {timeEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Mod Timp</label>
                  <select
                    value={timeMode}
                    onChange={(e) => setTimeMode(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="after">După minutul...</option>
                    <option value="before">Înainte de minutul...</option>
                    <option value="between">Între minutele...</option>
                  </select>
                </div>
                
                {timeMode === 'between' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="De la min"
                      value={timeValue.min}
                      onChange={(e) => setTimeValue({ ...timeValue, min: parseInt(e.target.value) || 1 })}
                      min={1}
                      max={90}
                      className="input-field"
                    />
                    <input
                      type="number"
                      placeholder="Până la min"
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
                    placeholder={timeMode === 'after' ? "După minutul..." : "Înainte de minutul..."}
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
                <h3 className="text-lg font-semibold">Scor</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scoreEnabled}
                  onChange={(e) => setScoreEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Activează</span>
              </label>
            </div>
            
            {scoreEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Mod Scor</label>
                  <select
                    value={scoreMode}
                    onChange={(e) => setScoreMode(e.target.value as any)}
                    className="input-field"
                  >
                    <option value="exact">Scor Exact (ex: 0-0, 1-0)</option>
                    <option value="range">Interval (min/max goluri)</option>
                  </select>
                </div>
                
                {scoreMode === 'exact' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-2">Goluri Gazde</label>
                      <input
                        type="number"
                        value={exactScore.home}
                        onChange={(e) => setExactScore({ ...exactScore, home: parseInt(e.target.value) || 0 })}
                        min={0}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2">Goluri Oaspeți</label>
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
                        🏠 Goluri Gazde
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
                        🚌 Goluri Oaspeți
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
                        📊 Total Goluri Meci
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
              'Cornere',
              cornersEnabled,
              setCornersEnabled,
              corners,
              setCorners,
              <Activity className="w-5 h-5 text-accent-cyan" />
            )}
            
            {renderTeamCondition(
              'Șuturi',
              shotsEnabled,
              setShotsEnabled,
              shots,
              setShots,
              <Target className="w-5 h-5 text-accent-green" />
            )}
            
            {renderTeamCondition(
              'Șuturi pe Poartă',
              shotsOnTargetEnabled,
              setShotsOnTargetEnabled,
              shotsOnTarget,
              setShotsOnTarget,
              <Target className="w-5 h-5 text-accent-purple" />
            )}
            
            {renderTeamCondition(
              'Cartonașe Galbene',
              yellowCardsEnabled,
              setYellowCardsEnabled,
              yellowCards,
              setYellowCards,
              <div className="w-5 h-5 bg-yellow-500 rounded" />
            )}
            
            {renderTeamCondition(
              'Cartonașe Roșii 🔴',
              redCardsEnabled,
              setRedCardsEnabled,
              redCards,
              setRedCards,
              <div className="w-5 h-5 bg-red-500 rounded" />
            )}
            
            {renderTeamCondition(
              'Atacuri Periculoase',
              attacksEnabled,
              setAttacksEnabled,
              attacks,
              setAttacks,
              <TrendingUp className="w-5 h-5 text-accent-amber" />
            )}
            
            {renderTeamCondition(
              'Schimbări (Substitutions)',
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
                <h3 className="text-lg font-semibold">Posesie (%)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={possessionEnabled}
                  onChange={(e) => setPossessionEnabled(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm">Activează</span>
              </label>
            </div>
            
            {possessionEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-accent-green">
                    🏠 Posesie Gazde (%)
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
                    🚌 Posesie Oaspeți (%)
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
          
          {/* ACTIONS */}
          <div className="flex gap-4 sticky bottom-6">
            <button
              onClick={() => router.push('/dashboard/filters')}
              className="btn-secondary flex-1"
            >
              Anulează
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Se salvează...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Creează Filtru
                </>
              )}
            </button>
          </div>
          
        </div>
      </div>
    </AuthWrapper>
  );
}
