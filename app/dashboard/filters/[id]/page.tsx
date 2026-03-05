'use client';

// ============================================
// R$Q - FILTER EDIT PAGE (COMPLETE)
// ============================================
// Edit existing filters with Telegram support

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Save,
  Trash2,
  Bell,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  GitMerge,
  ExternalLink,
  Activity,
  Target,
  Users,
  Shield,
  TrendingUp,
  Clock,
} from 'lucide-react';
import AuthWrapper from '@/components/AuthWrapper';
import { authHelpers, dbHelpers } from '@/lib/supabase';
import type { Filter, FilterConditions } from '@/lib/supabase';
import type { ExtendedFilterConditions } from '@/lib/extended-filters';

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

function OddsMarketRow({
  marketKey,
  label,
  markets,
  setMarkets,
}: {
  marketKey: string;
  label: string;
  markets: Record<string, { min?: number; max?: number }>;
  setMarkets: (val: Record<string, { min?: number; max?: number }>) => void;
}) {
  const isEnabled = marketKey in markets;
  const current = markets[marketKey] || {};

  const toggleMarket = (checked: boolean) => {
    if (checked) {
      setMarkets({ ...markets, [marketKey]: {} });
    } else {
      const updated = { ...markets };
      delete updated[marketKey];
      setMarkets(updated);
    }
  };

  const updateRange = (field: 'min' | 'max', value: string) => {
    setMarkets({
      ...markets,
      [marketKey]: {
        ...current,
        [field]: value ? parseFloat(value) : undefined,
      },
    });
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={isEnabled}
        onChange={(e) => toggleMarket(e.target.checked)}
        className="w-4 h-4 rounded shrink-0"
        title={`Toggle ${label}`}
      />
      <span className={`text-xs w-[140px] shrink-0 ${isEnabled ? 'text-white' : 'text-text-muted'}`}>
        {label}
      </span>
      {isEnabled && (
        <>
          <input
            type="number"
            step="0.01"
            min={1}
            placeholder="Min"
            value={current.min ?? ''}
            onChange={(e) => updateRange('min', e.target.value)}
            className="input-field text-xs py-1 px-2 w-20"
            title="Minimum odds"
          />
          <input
            type="number"
            step="0.01"
            min={1}
            placeholder="Max"
            value={current.max ?? ''}
            onChange={(e) => updateRange('max', e.target.value)}
            className="input-field text-xs py-1 px-2 w-20"
            title="Maximum odds"
          />
        </>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function FilterEditPage() {
  const router = useRouter();
  const params = useParams();
  const filterId = params.id as string;
  
  // ============================================
  // STATE
  // ============================================
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [filter, setFilter] = useState<Filter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sourceFilters, setSourceFilters] = useState<{ id: string; name: string }[]>([]);

  // Basic info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);

  // Time conditions
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [timeMode, setTimeMode] = useState<'after' | 'before' | 'between'>('between');
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
  const [yellowCardsTimeEnabled, setYellowCardsTimeEnabled] = useState(false);
  const [yellowCardsTimeWindow, setYellowCardsTimeWindow] = useState<{ from?: number; to?: number }>({});

  // Red cards
  const [redCardsEnabled, setRedCardsEnabled] = useState(false);
  const [redCards, setRedCards] = useState<TeamCondition>({});
  const [redCardsTimeEnabled, setRedCardsTimeEnabled] = useState(false);
  const [redCardsTimeWindow, setRedCardsTimeWindow] = useState<{ from?: number; to?: number }>({});

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

  // Goals
  const [goalsEnabled, setGoalsEnabled] = useState(false);
  const [goals, setGoals] = useState<TeamCondition>({});

  // Substitutions
  const [substitutionsEnabled, setSubstitutionsEnabled] = useState(false);
  const [substitutions, setSubstitutions] = useState<TeamCondition>({});
  const [substitutionsTimeEnabled, setSubstitutionsTimeEnabled] = useState(false);
  const [substitutionsTimeWindow, setSubstitutionsTimeWindow] = useState<{ from?: number; to?: number }>({});

  // SofaScore live stats
  const [xgEnabled, setXgEnabled] = useState(false);
  const [xg, setXg] = useState<TeamCondition>({});
  const [bigChancesEnabled, setBigChancesEnabled] = useState(false);
  const [bigChances, setBigChances] = useState<TeamCondition>({});
  const [shotsInBoxEnabled, setShotsInBoxEnabled] = useState(false);
  const [shotsInBox, setShotsInBox] = useState<TeamCondition>({});
  const [passAccuracyEnabled, setPassAccuracyEnabled] = useState(false);
  const [passAccuracy, setPassAccuracy] = useState<TeamCondition>({});
  const [interceptionsEnabled, setInterceptionsEnabled] = useState(false);
  const [interceptions, setInterceptions] = useState<TeamCondition>({});
  const [clearancesEnabled, setClearancesEnabled] = useState(false);
  const [clearances, setClearances] = useState<TeamCondition>({});

  // Pre-match odds
  const [preMatchOddsEnabled, setPreMatchOddsEnabled] = useState(false);
  const [preMatchMarkets, setPreMatchMarkets] = useState<Record<string, { min?: number; max?: number }>>({});

  // UI accordion
  const [openSection, setOpenSection] = useState<string | null>(null);
  
  // ============================================
  // LOAD FILTER
  // ============================================

  const loadFilter = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const user = authHelpers.getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const filterData = await dbHelpers.getFilterById(filterId);

      if (!filterData) {
        setError('Filter not found');
        return;
      }

      if (filterData.user_id !== user.id) {
        setError('You do not have permission to edit this filter');
        return;
      }

      setFilter(filterData);

      // Basic info
      setName(filterData.name);
      setDescription(filterData.description || '');
      setIsActive(filterData.is_active);
      setNotificationEnabled(filterData.notification_enabled);
      setTelegramEnabled(filterData.telegram_enabled || false);

      // Load source filter names if this is a combined filter
      const ids: string[] = (filterData as any).combined_filter_ids || [];
      if (ids.length > 0) {
        Promise.all(
          ids.map(id =>
            fetch(`/api/filters/get-by-id?filterId=${encodeURIComponent(id)}`)
              .then(r => r.ok ? r.json() : null)
              .then(res => res?.data ? { id, name: res.data.name as string } : { id, name: '(deleted filter)' })
              .catch(() => ({ id, name: '(deleted filter)' }))
          )
        ).then(setSourceFilters);
      }

      // ── Extract all conditions from saved data ──
      const c = filterData.conditions as any;
      if (!c) return;

      // Helper: extract TeamCondition from nested {home:{min,max},away:{min,max},total:{min,max}} OR flat {min,max}
      const extractTeam = (cond: any): { enabled: boolean; tc: TeamCondition } => {
        if (!cond) return { enabled: false, tc: {} };
        const tc: TeamCondition = {};
        let hasAny = false;
        if (cond.home && typeof cond.home === 'object') {
          if (cond.home.min !== undefined) { tc.home_min = cond.home.min; hasAny = true; }
          if (cond.home.max !== undefined) { tc.home_max = cond.home.max; hasAny = true; }
        }
        if (cond.away && typeof cond.away === 'object') {
          if (cond.away.min !== undefined) { tc.away_min = cond.away.min; hasAny = true; }
          if (cond.away.max !== undefined) { tc.away_max = cond.away.max; hasAny = true; }
        }
        if (cond.total && typeof cond.total === 'object') {
          if (cond.total.min !== undefined) { tc.total_min = cond.total.min; hasAny = true; }
          if (cond.total.max !== undefined) { tc.total_max = cond.total.max; hasAny = true; }
        }
        // Flat format: { min, max } → total
        if (!hasAny && (cond.min !== undefined || cond.max !== undefined)) {
          if (cond.min !== undefined) { tc.total_min = cond.min; hasAny = true; }
          if (cond.max !== undefined) { tc.total_max = cond.max; hasAny = true; }
        }
        return { enabled: hasAny, tc };
      };

      // Corners
      const cornersData = extractTeam(c.corners);
      if (cornersData.enabled) { setCornersEnabled(true); setCorners(cornersData.tc); }

      // Shots (total_shots)
      const shotsData = extractTeam(c.shots || c.total_shots);
      if (shotsData.enabled) { setShotsEnabled(true); setShots(shotsData.tc); }

      // Shots on target
      const sotData = extractTeam(c.shots_on_target);
      if (sotData.enabled) { setShotsOnTargetEnabled(true); setShotsOnTarget(sotData.tc); }

      // Yellow cards
      const ycData = extractTeam(c.yellow_cards);
      if (ycData.enabled) { setYellowCardsEnabled(true); setYellowCards(ycData.tc); }
      if (c.yellow_cards?.time_window) {
        setYellowCardsTimeEnabled(true);
        setYellowCardsTimeWindow(c.yellow_cards.time_window);
      }

      // Red cards
      const rcData = extractTeam(c.red_cards);
      if (rcData.enabled) { setRedCardsEnabled(true); setRedCards(rcData.tc); }
      if (c.red_cards?.time_window) {
        setRedCardsTimeEnabled(true);
        setRedCardsTimeWindow(c.red_cards.time_window);
      }

      // Dangerous attacks
      const atkData = extractTeam(c.dangerous_attacks || c.attacks);
      if (atkData.enabled) { setAttacksEnabled(true); setAttacks(atkData.tc); }

      // Goals
      const goalsData = extractTeam(c.goals);
      if (goalsData.enabled) { setGoalsEnabled(true); setGoals(goalsData.tc); }

      // Substitutions
      const subData = extractTeam(c.substitutions);
      if (subData.enabled) { setSubstitutionsEnabled(true); setSubstitutions(subData.tc); }
      if (c.substitutions?.time_window) {
        setSubstitutionsTimeEnabled(true);
        setSubstitutionsTimeWindow(c.substitutions.time_window);
      }

      // Possession
      if (c.possession) {
        const p = c.possession;
        let hasPoss = false;
        const poss = { home_min: undefined as number | undefined, home_max: undefined as number | undefined, away_min: undefined as number | undefined, away_max: undefined as number | undefined };
        if (p.home && typeof p.home === 'object') {
          if (p.home.min !== undefined) { poss.home_min = p.home.min; hasPoss = true; }
          if (p.home.max !== undefined) { poss.home_max = p.home.max; hasPoss = true; }
        }
        if (p.away && typeof p.away === 'object') {
          if (p.away.min !== undefined) { poss.away_min = p.away.min; hasPoss = true; }
          if (p.away.max !== undefined) { poss.away_max = p.away.max; hasPoss = true; }
        }
        // Flat format
        if (!hasPoss && (p.min !== undefined || p.max !== undefined)) {
          if (p.min !== undefined) { poss.home_min = p.min; hasPoss = true; }
          if (p.max !== undefined) { poss.home_max = p.max; hasPoss = true; }
        }
        if (hasPoss) { setPossessionEnabled(true); setPossession(poss); }
      }

      // Match time
      if (c.match_time) {
        setTimeEnabled(true);
        const mt = c.match_time;
        if (mt.after !== undefined) {
          setTimeMode('after');
          setTimeValue({ min: mt.after, max: 90 });
        } else if (mt.before !== undefined) {
          setTimeMode('before');
          setTimeValue({ min: 1, max: mt.before });
        } else if (mt.between) {
          setTimeMode('between');
          setTimeValue({ min: mt.between[0], max: mt.between[1] });
        } else if (mt.min !== undefined || mt.max !== undefined) {
          // Legacy flat min/max
          setTimeMode('between');
          setTimeValue({ min: mt.min ?? 1, max: mt.max ?? 90 });
        }
      }

      // Score
      if (c.score) {
        setScoreEnabled(true);
        const s = c.score;
        if (s.exact) {
          setScoreMode('exact');
          setExactScore({ home: s.exact.home ?? 0, away: s.exact.away ?? 0 });
        } else if (s.home !== undefined && s.away !== undefined && typeof s.home === 'number' && typeof s.away === 'number') {
          // Legacy flat exact score
          setScoreMode('exact');
          setExactScore({ home: s.home, away: s.away });
        } else {
          setScoreMode('range');
          const sr = { home_min: undefined as number | undefined, home_max: undefined as number | undefined, away_min: undefined as number | undefined, away_max: undefined as number | undefined, total_min: undefined as number | undefined, total_max: undefined as number | undefined };
          if (s.home && typeof s.home === 'object') { sr.home_min = s.home.min; sr.home_max = s.home.max; }
          if (s.away && typeof s.away === 'object') { sr.away_min = s.away.min; sr.away_max = s.away.max; }
          if (s.total_goals) { sr.total_min = s.total_goals.min; sr.total_max = s.total_goals.max; }
          if (s.difference) { sr.total_min = s.difference.min; sr.total_max = s.difference.max; }
          setScoreRange(sr);
        }
      }

      // SofaScore live stats
      const xgData = extractTeam(c.xg);
      if (xgData.enabled) { setXgEnabled(true); setXg(xgData.tc); }
      const bcData = extractTeam(c.big_chances);
      if (bcData.enabled) { setBigChancesEnabled(true); setBigChances(bcData.tc); }
      const sibData = extractTeam(c.shots_in_box);
      if (sibData.enabled) { setShotsInBoxEnabled(true); setShotsInBox(sibData.tc); }
      const paData = extractTeam(c.pass_accuracy);
      if (paData.enabled) { setPassAccuracyEnabled(true); setPassAccuracy(paData.tc); }
      const intData = extractTeam(c.interceptions);
      if (intData.enabled) { setInterceptionsEnabled(true); setInterceptions(intData.tc); }
      const clrData = extractTeam(c.clearances);
      if (clrData.enabled) { setClearancesEnabled(true); setClearances(clrData.tc); }

      // Pre-match odds
      if (c.pre_match_odds && typeof c.pre_match_odds === 'object') {
        const markets: Record<string, { min?: number; max?: number }> = {};
        for (const [key, val] of Object.entries(c.pre_match_odds)) {
          if (val && typeof val === 'object') {
            markets[key] = { min: (val as any).min, max: (val as any).max };
          }
        }
        if (Object.keys(markets).length > 0) {
          setPreMatchOddsEnabled(true);
          setPreMatchMarkets(markets);
        }
      }

    } catch (err) {
      console.error('Error loading filter:', err);
      setError('Error loading filter');
    } finally {
      setLoading(false);
    }
  }, [filterId, router]);

  useEffect(() => {
    loadFilter();
  }, [loadFilter]);
  
  // ============================================
  // HANDLERS
  // ============================================

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a name for the filter');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const user = authHelpers.getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Build conditions object from state
      const conditions: any = {};

      // Helper: check if a value is set (including zero)
      const hasValue = (v: number | undefined) => v !== undefined;
      const buildTeamCond = (tc: TeamCondition) => ({
        home: hasValue(tc.home_min) || hasValue(tc.home_max) ? { min: tc.home_min, max: tc.home_max } : undefined,
        away: hasValue(tc.away_min) || hasValue(tc.away_max) ? { min: tc.away_min, max: tc.away_max } : undefined,
        total: hasValue(tc.total_min) || hasValue(tc.total_max) ? { min: tc.total_min, max: tc.total_max } : undefined,
      });

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
          conditions.score = { exact: { home: exactScore.home, away: exactScore.away } };
        } else {
          conditions.score = {};
          if (scoreRange.home_min !== undefined || scoreRange.home_max !== undefined) {
            conditions.score.home = { min: scoreRange.home_min, max: scoreRange.home_max };
          }
          if (scoreRange.away_min !== undefined || scoreRange.away_max !== undefined) {
            conditions.score.away = { min: scoreRange.away_min, max: scoreRange.away_max };
          }
          if (scoreRange.total_min !== undefined || scoreRange.total_max !== undefined) {
            conditions.score.total_goals = { min: scoreRange.total_min, max: scoreRange.total_max };
          }
        }
      }

      // Corners
      if (cornersEnabled) conditions.corners = buildTeamCond(corners);

      // Shots
      if (shotsEnabled) conditions.shots = buildTeamCond(shots);

      // Shots on target
      if (shotsOnTargetEnabled) conditions.shots_on_target = buildTeamCond(shotsOnTarget);

      // Yellow cards
      if (yellowCardsEnabled) {
        const yc = buildTeamCond(yellowCards) as any;
        if (yellowCardsTimeEnabled && yellowCardsTimeWindow.from != null && yellowCardsTimeWindow.to != null) {
          yc.time_window = { from: yellowCardsTimeWindow.from, to: yellowCardsTimeWindow.to };
        }
        conditions.yellow_cards = yc;
      }

      // Red cards
      if (redCardsEnabled) {
        const rc = buildTeamCond(redCards) as any;
        if (redCardsTimeEnabled && redCardsTimeWindow.from != null && redCardsTimeWindow.to != null) {
          rc.time_window = { from: redCardsTimeWindow.from, to: redCardsTimeWindow.to };
        }
        conditions.red_cards = rc;
      }

      // Dangerous attacks
      if (attacksEnabled) conditions.dangerous_attacks = buildTeamCond(attacks);

      // Goals
      if (goalsEnabled) conditions.goals = buildTeamCond(goals);

      // Possession
      if (possessionEnabled) {
        conditions.possession = {
          home: hasValue(possession.home_min) || hasValue(possession.home_max) ? { min: possession.home_min, max: possession.home_max } : undefined,
          away: hasValue(possession.away_min) || hasValue(possession.away_max) ? { min: possession.away_min, max: possession.away_max } : undefined,
        };
      }

      // Substitutions
      if (substitutionsEnabled) {
        const sc = buildTeamCond(substitutions) as any;
        if (substitutionsTimeEnabled && substitutionsTimeWindow.from != null && substitutionsTimeWindow.to != null) {
          sc.time_window = { from: substitutionsTimeWindow.from, to: substitutionsTimeWindow.to };
        }
        conditions.substitutions = sc;
      }

      // SofaScore live stats
      if (xgEnabled) conditions.xg = buildTeamCond(xg);
      if (bigChancesEnabled) conditions.big_chances = buildTeamCond(bigChances);
      if (shotsInBoxEnabled) conditions.shots_in_box = buildTeamCond(shotsInBox);
      if (passAccuracyEnabled) {
        const pc = buildTeamCond(passAccuracy);
        conditions.pass_accuracy = { home: pc.home, away: pc.away };
      }
      if (interceptionsEnabled) conditions.interceptions = buildTeamCond(interceptions);
      if (clearancesEnabled) conditions.clearances = buildTeamCond(clearances);

      // Pre-match odds
      if (preMatchOddsEnabled && Object.keys(preMatchMarkets).length > 0) {
        const preMatchOdds: Record<string, { min?: number; max?: number }> = {};
        for (const [market, range] of Object.entries(preMatchMarkets)) {
          if (range.min !== undefined || range.max !== undefined) {
            preMatchOdds[market] = { min: range.min, max: range.max };
          }
        }
        if (Object.keys(preMatchOdds).length > 0) {
          conditions.pre_match_odds = preMatchOdds;
        }
      }

      const { data, error } = await dbHelpers.updateFilter(filterId, {
        name,
        description: description || null,
        conditions,
        is_active: isActive,
        notification_enabled: notificationEnabled,
        telegram_enabled: telegramEnabled,
      });

      if (error) {
        setError(`Error: ${error}`);
        setSaving(false);
        return;
      }

      setSuccess('✅ Filter saved successfully!');

      setTimeout(() => {
        router.push('/dashboard/filters');
      }, 1500);

    } catch (err: any) {
      console.error('Error saving filter:', err);
      setError(err?.message || 'Error saving filter');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this filter?')) {
      return;
    }

    setDeleting(true);

    try {
      const { error } = await dbHelpers.deleteFilter(filterId);

      if (error) {
        setError(`Error: ${error}`);
        setDeleting(false);
        return;
      }

      router.push('/dashboard/filters');
    } catch (err: any) {
      console.error('Error deleting filter:', err);
      setError(err?.message || 'Error deleting filter');
      setDeleting(false);
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
    icon: React.ReactNode,
    opts?: {
      useFloat?: boolean;
      noTotal?: boolean;
      hint?: string;
      timeWindow?: {
        enabled: boolean;
        setEnabled: (val: boolean) => void;
        values: { from?: number; to?: number };
        setValues: (val: { from?: number; to?: number }) => void;
      };
    }
  ) => {
    const useFloat = opts?.useFloat ?? false;
    const noTotal = opts?.noTotal ?? false;
    const hint = opts?.hint;
    const parseNum = (v: string) => v !== '' ? (useFloat ? parseFloat(v) : parseInt(v)) : undefined;
    const key = title.toLowerCase().replace(/\s+/g, '_');
    const isOpen = openSection === key;

    const toggleEnabled = (checked: boolean) => {
      setEnabled(checked);
      if (checked) setOpenSection(key);
      else if (openSection === key) setOpenSection(null);
    };

    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setOpenSection(isOpen ? null : key)}>
            {icon}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => toggleEnabled(e.target.checked)} className="w-5 h-5 rounded" />
            <span className="text-sm">Enable</span>
          </label>
        </div>
        {enabled && isOpen && (
          <div className="space-y-4">
            {hint && <p className="text-xs text-text-muted bg-glass-light/30 rounded px-3 py-2">{hint}</p>}
            <div>
              <label className="block text-sm font-semibold mb-2 text-accent-green">Home</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step={useFloat ? '0.1' : '1'} placeholder="Min" value={values.home_min !== undefined ? values.home_min : ''} onChange={(e) => setValues({ ...values, home_min: parseNum(e.target.value) })} min={0} className="input-field" />
                <input type="number" step={useFloat ? '0.1' : '1'} placeholder="Max" value={values.home_max !== undefined ? values.home_max : ''} onChange={(e) => setValues({ ...values, home_max: parseNum(e.target.value) })} min={0} className="input-field" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2 text-accent-cyan">Away</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step={useFloat ? '0.1' : '1'} placeholder="Min" value={values.away_min !== undefined ? values.away_min : ''} onChange={(e) => setValues({ ...values, away_min: parseNum(e.target.value) })} min={0} className="input-field" />
                <input type="number" step={useFloat ? '0.1' : '1'} placeholder="Max" value={values.away_max !== undefined ? values.away_max : ''} onChange={(e) => setValues({ ...values, away_max: parseNum(e.target.value) })} min={0} className="input-field" />
              </div>
            </div>
            {!noTotal && (
              <div>
                <label className="block text-sm font-semibold mb-2 text-accent-purple">Match Total</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step={useFloat ? '0.1' : '1'} placeholder="Min" value={values.total_min !== undefined ? values.total_min : ''} onChange={(e) => setValues({ ...values, total_min: parseNum(e.target.value) })} min={0} className="input-field" />
                  <input type="number" step={useFloat ? '0.1' : '1'} placeholder="Max" value={values.total_max !== undefined ? values.total_max : ''} onChange={(e) => setValues({ ...values, total_max: parseNum(e.target.value) })} min={0} className="input-field" />
                </div>
              </div>
            )}
            {opts?.timeWindow && (
              <div className="border-t border-glass-light/20 pt-4 mt-4">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input type="checkbox" checked={opts.timeWindow.enabled} onChange={(e) => opts.timeWindow!.setEnabled(e.target.checked)} className="w-4 h-4 rounded" />
                  <span className="text-sm font-semibold text-accent-amber">⏱ Time Window (minutes)</span>
                </label>
                {opts.timeWindow.enabled && (
                  <div>
                    <p className="text-xs text-text-muted mb-2">Only count events that happen between these minutes</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" placeholder="From min" value={opts.timeWindow.values.from !== undefined ? opts.timeWindow.values.from : ''} onChange={(e) => opts.timeWindow!.setValues({ ...opts.timeWindow!.values, from: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} max={120} className="input-field" />
                      <input type="number" placeholder="To min" value={opts.timeWindow.values.to !== undefined ? opts.timeWindow.values.to : ''} onChange={(e) => opts.timeWindow!.setValues({ ...opts.timeWindow!.values, to: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} max={120} className="input-field" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <AuthWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-accent-cyan mx-auto mb-4" />
            <p className="text-text-secondary">Loading filter...</p>
          </div>
        </div>
      </AuthWrapper>
    );
  }
  
  if (error && !filter) {
    return (
      <AuthWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-accent-red mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error}</h2>
            <button
              onClick={() => router.push('/dashboard/filters')}
              className="btn-secondary mt-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to filters
            </button>
          </div>
        </div>
      </AuthWrapper>
    );
  }
  
  return (
    <AuthWrapper>
      <div className="min-h-screen p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* ========== HEADER ========== */}
          <div className="flex items-center justify-between">
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
                  Edit Filter
                </h1>
                <p className="text-text-secondary text-sm mt-1">
                  Edit filter settings
                </p>
              </div>
            </div>
            
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-secondary text-accent-red hover:bg-accent-red/10 flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </>
              )}
            </button>
          </div>
          
          {/* ========== MESSAGES ========== */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-accent-red/10 border border-accent-red/20 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0" />
              <p className="text-sm text-accent-red">{error}</p>
            </motion.div>
          )}
          
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center gap-3"
            >
              <CheckCircle className="w-5 h-5 text-accent-green flex-shrink-0" />
              <p className="text-sm text-accent-green">{success}</p>
            </motion.div>
          )}
          
          {/* ========== MERGED FROM (only for combined filters) ========== */}
          {sourceFilters.length > 0 && (
            <div className="glass-card p-6 border-l-4 border-accent-purple">
              <h2 className="text-xl font-display font-semibold mb-1 flex items-center gap-2">
                <GitMerge className="w-5 h-5 text-accent-purple" />
                Merged from {sourceFilters.length} filter{sourceFilters.length !== 1 ? 's' : ''}
              </h2>
              <p className="text-xs text-text-muted mb-4">
                This filter was created by combining the conditions of the filters below.
              </p>
              <div className="space-y-2">
                {sourceFilters.map((sf, i) => (
                  <div
                    key={sf.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-glass-light border border-accent-purple/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-accent-purple/60 w-5 text-center shrink-0">{i + 1}</span>
                      <span className="text-sm font-medium text-white truncate">{sf.name}</span>
                    </div>
                    {sf.name !== '(deleted filter)' && (
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/filters/${sf.id}`)}
                        className="shrink-0 p-1.5 rounded-md hover:bg-accent-purple/10 text-accent-purple/60 hover:text-accent-purple transition"
                        title="Open this filter"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========== BASIC INFO ========== */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-display font-semibold mb-4">
              General Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Filter Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Over 9.5 Corners"
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this filter..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 rounded border-glass-medium checked:bg-accent-cyan"
                  />
                  <div>
                    <p className="font-semibold">Active Filter</p>
                    <p className="text-sm text-text-muted">
                      Scanner will check this filter
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
          
          {/* ========== PRE-MATCH ODDS ========== */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-accent-amber" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/></svg>
                <h3 className="text-lg font-semibold">Pre-Match Odds Filter</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={preMatchOddsEnabled} onChange={(e) => setPreMatchOddsEnabled(e.target.checked)} className="w-5 h-5 rounded" />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            {preMatchOddsEnabled && (
              <div className="space-y-4">
                <div className="text-xs text-text-muted mb-2">Select markets and set odds ranges. The filter will match when pre-match odds for selected markets fall within your specified range.</div>
                <div>
                  <div className="text-sm font-semibold text-accent-cyan mb-2">Result (1X2)</div>
                  <div className="space-y-2">
                    {[{ key: 'home_win', label: 'Home Win' }, { key: 'draw', label: 'Draw' }, { key: 'away_win', label: 'Away Win' }].map(m => (
                      <OddsMarketRow key={m.key} marketKey={m.key} label={m.label} markets={preMatchMarkets} setMarkets={setPreMatchMarkets} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-accent-green mb-2">Goals Over/Under</div>
                  <div className="space-y-2">
                    {[{ key: 'goals_over_0_5', label: 'Over 0.5 Goals' }, { key: 'goals_under_0_5', label: 'Under 0.5 Goals' }, { key: 'goals_over_1_5', label: 'Over 1.5 Goals' }, { key: 'goals_under_1_5', label: 'Under 1.5 Goals' }, { key: 'goals_over_2_5', label: 'Over 2.5 Goals' }, { key: 'goals_under_2_5', label: 'Under 2.5 Goals' }, { key: 'goals_over_3_5', label: 'Over 3.5 Goals' }, { key: 'goals_under_3_5', label: 'Under 3.5 Goals' }, { key: 'goals_over_4_5', label: 'Over 4.5 Goals' }, { key: 'goals_under_4_5', label: 'Under 4.5 Goals' }].map(m => (
                      <OddsMarketRow key={m.key} marketKey={m.key} label={m.label} markets={preMatchMarkets} setMarkets={setPreMatchMarkets} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-accent-purple mb-2">First Half Goals</div>
                  <div className="space-y-2">
                    {[{ key: 'first_half_over_0_5', label: 'FH Over 0.5 Goals' }, { key: 'first_half_under_0_5', label: 'FH Under 0.5 Goals' }, { key: 'first_half_over_1_5', label: 'FH Over 1.5 Goals' }, { key: 'first_half_under_1_5', label: 'FH Under 1.5 Goals' }, { key: 'first_half_over_2_5', label: 'FH Over 2.5 Goals' }, { key: 'first_half_under_2_5', label: 'FH Under 2.5 Goals' }].map(m => (
                      <OddsMarketRow key={m.key} marketKey={m.key} label={m.label} markets={preMatchMarkets} setMarkets={setPreMatchMarkets} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-accent-amber mb-2">Corners Over/Under</div>
                  <div className="space-y-2">
                    {[{ key: 'corners_over_7_5', label: 'Over 7.5 Corners' }, { key: 'corners_under_7_5', label: 'Under 7.5 Corners' }, { key: 'corners_over_8_5', label: 'Over 8.5 Corners' }, { key: 'corners_under_8_5', label: 'Under 8.5 Corners' }, { key: 'corners_over_9_5', label: 'Over 9.5 Corners' }, { key: 'corners_under_9_5', label: 'Under 9.5 Corners' }, { key: 'corners_over_10_5', label: 'Over 10.5 Corners' }, { key: 'corners_under_10_5', label: 'Under 10.5 Corners' }, { key: 'corners_over_11_5', label: 'Over 11.5 Corners' }, { key: 'corners_under_11_5', label: 'Under 11.5 Corners' }].map(m => (
                      <OddsMarketRow key={m.key} marketKey={m.key} label={m.label} markets={preMatchMarkets} setMarkets={setPreMatchMarkets} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-yellow-400 mb-2">Cards Over/Under</div>
                  <div className="space-y-2">
                    {[{ key: 'cards_over_2_5', label: 'Over 2.5 Cards' }, { key: 'cards_under_2_5', label: 'Under 2.5 Cards' }, { key: 'cards_over_3_5', label: 'Over 3.5 Cards' }, { key: 'cards_under_3_5', label: 'Under 3.5 Cards' }, { key: 'cards_over_4_5', label: 'Over 4.5 Cards' }, { key: 'cards_under_4_5', label: 'Under 4.5 Cards' }, { key: 'cards_over_5_5', label: 'Over 5.5 Cards' }, { key: 'cards_under_5_5', label: 'Under 5.5 Cards' }].map(m => (
                      <OddsMarketRow key={m.key} marketKey={m.key} label={m.label} markets={preMatchMarkets} setMarkets={setPreMatchMarkets} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-accent-blue mb-2">Both Teams To Score</div>
                  <div className="space-y-2">
                    {[{ key: 'btts_yes', label: 'BTTS Yes' }, { key: 'btts_no', label: 'BTTS No' }].map(m => (
                      <OddsMarketRow key={m.key} marketKey={m.key} label={m.label} markets={preMatchMarkets} setMarkets={setPreMatchMarkets} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-secondary mb-2">Double Chance</div>
                  <div className="space-y-2">
                    {[{ key: 'double_chance_1x', label: 'Home or Draw (1X)' }, { key: 'double_chance_x2', label: 'Draw or Away (X2)' }, { key: 'double_chance_12', label: 'Home or Away (12)' }].map(m => (
                      <OddsMarketRow key={m.key} marketKey={m.key} label={m.label} markets={preMatchMarkets} setMarkets={setPreMatchMarkets} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========== TIME CONDITIONS ========== */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-accent-amber" />
                <h3 className="text-lg font-semibold">Match Time (minutes)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={timeEnabled} onChange={(e) => setTimeEnabled(e.target.checked)} className="w-5 h-5 rounded" />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            {timeEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Time Mode</label>
                  <select value={timeMode} onChange={(e) => setTimeMode(e.target.value as any)} className="input-field" title="Select time mode">
                    <option value="after">After minute... (from minute X to end)</option>
                    <option value="before">Before minute... (from kickoff to minute X)</option>
                    <option value="between">Between minutes...</option>
                  </select>
                  <p className="text-xs text-text-muted mt-1">
                    {timeMode === 'after' && 'Filter triggers only after this minute until full time (e.g. after 60 = minutes 60-90)'}
                    {timeMode === 'before' && 'Filter triggers from kickoff up to this minute (e.g. before 45 = first half only)'}
                    {timeMode === 'between' && 'Filter triggers only between these two minutes'}
                  </p>
                </div>
                {timeMode === 'between' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="From min" value={timeValue.min} onChange={(e) => setTimeValue({ ...timeValue, min: parseInt(e.target.value) || 1 })} min={1} max={90} className="input-field" />
                    <input type="number" placeholder="To min" value={timeValue.max} onChange={(e) => setTimeValue({ ...timeValue, max: parseInt(e.target.value) || 90 })} min={1} max={90} className="input-field" />
                  </div>
                ) : (
                  <input type="number" placeholder={timeMode === 'after' ? 'After minute...' : 'Before minute...'} value={timeMode === 'after' ? timeValue.min : timeValue.max} onChange={(e) => { const val = parseInt(e.target.value) || 1; setTimeValue(timeMode === 'after' ? { ...timeValue, min: val } : { ...timeValue, max: val }); }} min={1} max={90} className="input-field" />
                )}
              </div>
            )}
          </div>

          {/* ========== SCORE CONDITIONS ========== */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-accent-green" />
                <h3 className="text-lg font-semibold">Score</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={scoreEnabled} onChange={(e) => setScoreEnabled(e.target.checked)} className="w-5 h-5 rounded" />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            {scoreEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Score Mode</label>
                  <select value={scoreMode} onChange={(e) => setScoreMode(e.target.value as any)} className="input-field" title="Select score mode">
                    <option value="exact">Exact Score (ex: 0-0, 1-0)</option>
                    <option value="range">Range (min/max goals)</option>
                  </select>
                </div>
                {scoreMode === 'exact' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-2">Home Goals</label>
                      <input type="number" value={exactScore.home} onChange={(e) => setExactScore({ ...exactScore, home: parseInt(e.target.value) || 0 })} min={0} className="input-field" title="Home team goals" />
                    </div>
                    <div>
                      <label className="block text-sm mb-2">Away Goals</label>
                      <input type="number" value={exactScore.away} onChange={(e) => setExactScore({ ...exactScore, away: parseInt(e.target.value) || 0 })} min={0} className="input-field" title="Away team goals" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-accent-green">Home Goals</label>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" placeholder="Min" value={scoreRange.home_min !== undefined ? scoreRange.home_min : ''} onChange={(e) => setScoreRange({ ...scoreRange, home_min: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} className="input-field" />
                        <input type="number" placeholder="Max" value={scoreRange.home_max !== undefined ? scoreRange.home_max : ''} onChange={(e) => setScoreRange({ ...scoreRange, home_max: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} className="input-field" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-accent-cyan">Away Goals</label>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" placeholder="Min" value={scoreRange.away_min !== undefined ? scoreRange.away_min : ''} onChange={(e) => setScoreRange({ ...scoreRange, away_min: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} className="input-field" />
                        <input type="number" placeholder="Max" value={scoreRange.away_max !== undefined ? scoreRange.away_max : ''} onChange={(e) => setScoreRange({ ...scoreRange, away_max: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} className="input-field" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-accent-purple">Match Total Goals</label>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" placeholder="Min (ex: 3 for Over 2.5)" value={scoreRange.total_min !== undefined ? scoreRange.total_min : ''} onChange={(e) => setScoreRange({ ...scoreRange, total_min: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} className="input-field" />
                        <input type="number" placeholder="Max" value={scoreRange.total_max !== undefined ? scoreRange.total_max : ''} onChange={(e) => setScoreRange({ ...scoreRange, total_max: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} className="input-field" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========== STATISTICS CONDITIONS ========== */}
          <div className="space-y-6">
            {renderTeamCondition('Corners', cornersEnabled, setCornersEnabled, corners, setCorners, <Activity className="w-5 h-5 text-accent-cyan" />)}
            {renderTeamCondition('Shots', shotsEnabled, setShotsEnabled, shots, setShots, <Target className="w-5 h-5 text-accent-green" />)}
            {renderTeamCondition('Shots on Target', shotsOnTargetEnabled, setShotsOnTargetEnabled, shotsOnTarget, setShotsOnTarget, <Target className="w-5 h-5 text-accent-purple" />)}
            {renderTeamCondition('Goals', goalsEnabled, setGoalsEnabled, goals, setGoals, <Target className="w-5 h-5 text-accent-green" />)}
            {renderTeamCondition('Yellow Cards', yellowCardsEnabled, setYellowCardsEnabled, yellowCards, setYellowCards, <div className="w-5 h-5 bg-yellow-500 rounded" />, { timeWindow: { enabled: yellowCardsTimeEnabled, setEnabled: setYellowCardsTimeEnabled, values: yellowCardsTimeWindow, setValues: setYellowCardsTimeWindow } })}
            {renderTeamCondition('Red Cards', redCardsEnabled, setRedCardsEnabled, redCards, setRedCards, <div className="w-5 h-5 bg-red-500 rounded" />, { timeWindow: { enabled: redCardsTimeEnabled, setEnabled: setRedCardsTimeEnabled, values: redCardsTimeWindow, setValues: setRedCardsTimeWindow } })}
            {renderTeamCondition('Dangerous Attacks', attacksEnabled, setAttacksEnabled, attacks, setAttacks, <TrendingUp className="w-5 h-5 text-accent-amber" />)}
            {renderTeamCondition('Substitutions', substitutionsEnabled, setSubstitutionsEnabled, substitutions, setSubstitutions, <Users className="w-5 h-5 text-accent-cyan" />, { timeWindow: { enabled: substitutionsTimeEnabled, setEnabled: setSubstitutionsTimeEnabled, values: substitutionsTimeWindow, setValues: setSubstitutionsTimeWindow } })}
          </div>

          {/* ========== POSSESSION ========== */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-accent-purple" />
                <h3 className="text-lg font-semibold">Possession (%)</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={possessionEnabled} onChange={(e) => setPossessionEnabled(e.target.checked)} className="w-5 h-5 rounded" />
                <span className="text-sm">Enable</span>
              </label>
            </div>
            {possessionEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-accent-green">Home Possession (%)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="Min %" value={possession.home_min !== undefined ? possession.home_min : ''} onChange={(e) => setPossession({ ...possession, home_min: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} max={100} className="input-field" />
                    <input type="number" placeholder="Max %" value={possession.home_max !== undefined ? possession.home_max : ''} onChange={(e) => setPossession({ ...possession, home_max: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} max={100} className="input-field" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 text-accent-cyan">Away Possession (%)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="Min %" value={possession.away_min !== undefined ? possession.away_min : ''} onChange={(e) => setPossession({ ...possession, away_min: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} max={100} className="input-field" />
                    <input type="number" placeholder="Max %" value={possession.away_max !== undefined ? possession.away_max : ''} onChange={(e) => setPossession({ ...possession, away_max: e.target.value !== '' ? parseInt(e.target.value) : undefined })} min={0} max={100} className="input-field" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========== SOFASCORE LIVE STATS ========== */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-accent-purple" />
              <h3 className="text-lg font-semibold">SofaScore Live Stats</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple font-semibold">LIVE ONLY</span>
            </div>
            <p className="text-xs text-text-muted mb-4">Enriched in real-time from SofaScore during live matches. Skipped (not failed) for pre-match or non-enriched matches.</p>
            <div className="space-y-6">
              {renderTeamCondition('xG (Expected Goals)', xgEnabled, setXgEnabled, xg, setXg, <Target className="w-5 h-5 text-accent-cyan" />, { useFloat: true, hint: 'Expected Goals per team. Typical range: 0.0 – 3.0. Example: Home xG ≥ 1.0' })}
              {renderTeamCondition('Big Chances', bigChancesEnabled, setBigChancesEnabled, bigChances, setBigChances, <Target className="w-5 h-5 text-accent-green" />, { hint: 'Clear scoring opportunities created. Example: Total ≥ 3' })}
              {renderTeamCondition('Shots in Box', shotsInBoxEnabled, setShotsInBoxEnabled, shotsInBox, setShotsInBox, <Target className="w-5 h-5 text-accent-amber" />, { hint: 'Shots from inside the penalty area.' })}
              {renderTeamCondition('Pass Accuracy (%)', passAccuracyEnabled, setPassAccuracyEnabled, passAccuracy, setPassAccuracy, <Activity className="w-5 h-5 text-accent-blue" />, { noTotal: true, hint: 'Pass accuracy percentage (0–100). Example: Home ≥ 80%' })}
              {renderTeamCondition('Interceptions', interceptionsEnabled, setInterceptionsEnabled, interceptions, setInterceptions, <Shield className="w-5 h-5 text-accent-cyan" />, { hint: 'Defensive interceptions per team.' })}
              {renderTeamCondition('Clearances', clearancesEnabled, setClearancesEnabled, clearances, setClearances, <Shield className="w-5 h-5 text-accent-purple" />, { hint: 'Defensive clearances. Example: Away ≥ 8 suggests sustained home pressure.' })}
            </div>
          </div>

          {/* ========== NOTIFICATIONS ========== */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-display font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-accent-purple" />
              Notifications
            </h2>
            
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 rounded-lg bg-glass-light hover:bg-glass-medium transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationEnabled}
                  onChange={(e) => setNotificationEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-glass-medium checked:bg-accent-cyan"
                />
                <div className="flex-1">
                  <p className="font-semibold flex items-center gap-2">
                    <Bell className="w-4 h-4 text-accent-cyan" />
                    Push Notifications (browser)
                  </p>
                  <p className="text-sm text-text-muted">
                    Receive a browser notification when this filter matches
                  </p>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-4 rounded-lg bg-glass-light hover:bg-glass-medium transition-all cursor-pointer">
                <input
                  type="checkbox"
                  checked={telegramEnabled}
                  onChange={(e) => setTelegramEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-glass-medium checked:bg-accent-purple"
                />
                <div className="flex-1">
                  <p className="font-semibold flex items-center gap-2">
                    <Send className="w-4 h-4 text-accent-purple" />
                    Telegram Notifications
                  </p>
                  <p className="text-sm text-text-muted">
                    Receive an instant alert on Telegram (configure in Settings)
                  </p>
                </div>
              </label>
            </div>
          </div>
          
          {/* ========== ACTIONS ========== */}
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/dashboard/filters')}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
          
        </div>
      </div>
    </AuthWrapper>
  );
}
