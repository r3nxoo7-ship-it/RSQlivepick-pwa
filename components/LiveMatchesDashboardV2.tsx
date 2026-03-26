'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle, BarChart3, Search, X, ChevronDown, Check, Clock } from 'lucide-react';
import { LiveMatch } from '@/lib/unified-api';
import { Filter } from '@/lib/supabase';
import { getMatchingFiltersForMatch, FilterMatchDetails } from '@/lib/live-filter-matcher';
import AdvancedMatchDetail from './AdvancedMatchDetail';

interface LiveMatchesDashboardProps {
  matches?: LiveMatch[];
  liveMatches?: LiveMatch[];
  upcomingMatches?: LiveMatch[];
  scheduledMatches?: LiveMatch[];
  teamForm?: Record<string, any>;
  userFilters?: Filter[];
  loading?: boolean;
  matchOdds?: Record<string, any>; // normKey(home|away) → ParsedBookmakerOdds entry
}

interface MatchWithPredictions extends LiveMatch {
  matchingFilters?: FilterMatchDetails[];
  matchingCount?: number;
}

interface DayTab {
  key: string; // YYYY-MM-DD
  label: string; // "Today", "Tomorrow", "Wed 12.2"
  shortLabel: string; // "Today", "Tom", "We"
  date: Date;
  isToday: boolean;
}

function getDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildDayTabs(): DayTab[] {
  const tabs: DayTab[] = [];
  const now = new Date();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);

    let label: string;
    let shortLabel: string;
    if (i === 0) {
      label = 'Today';
      shortLabel = 'Today';
    } else if (i === 1) {
      label = 'Tomorrow';
      shortLabel = 'Tom';
    } else {
      const dayName = dayNames[d.getDay()];
      const dateStr = `${d.getDate()}.${d.getMonth() + 1}`;
      label = `${dayName} - ${dateStr}`;
      shortLabel = `${dayName.substring(0, 2)} ${dateStr}`;
    }

    tabs.push({
      key: getDateKey(d),
      label,
      shortLabel,
      date: d,
      isToday: i === 0,
    });
  }
  return tabs;
}

export default function LiveMatchesDashboardV2({
  matches = [],
  liveMatches = [],
  upcomingMatches = [],
  scheduledMatches = [],
  teamForm = {},
  userFilters = [],
  loading = false,
  matchOdds = {},
}: LiveMatchesDashboardProps) {
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(new Set());
  const [leagueDropdownOpen, setLeagueDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<MatchWithPredictions | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const leagueDropdownRef = useRef<HTMLDivElement>(null);

  const dayTabs = useMemo(() => buildDayTabs(), []);

  // Close league dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (leagueDropdownRef.current && !leagueDropdownRef.current.contains(e.target as Node)) {
        setLeagueDropdownOpen(false);
      }
    }
    if (leagueDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [leagueDropdownOpen]);

  // Set default day to today on mount
  useEffect(() => {
    if (!selectedDay && dayTabs.length > 0) {
      setSelectedDay(dayTabs[0].key);
    }
  }, [dayTabs, selectedDay]);

  // All matches combined for league extraction
  const allMatches = useMemo(() => {
    return [...liveMatches, ...upcomingMatches, ...scheduledMatches, ...matches];
  }, [liveMatches, upcomingMatches, scheduledMatches, matches]);

  // Classify a match into a category based on league name/code
  const getMatchCategory = useCallback((m: LiveMatch): string => {
    const leagueName = (m.league?.name || '').toLowerCase();
    const leagueId = String(m.league?.id || '').toLowerCase();

    // Friendly
    if (leagueName.includes('friendly') || leagueId.includes('friendly')) return 'friendly';

    // National team / International
    if (
      leagueName.includes('world cup') || leagueName.includes('wcq') ||
      leagueName.includes('euro qualifying') || leagueName.includes('euro championship') ||
      leagueName.includes('nations league') || leagueName.includes('copa america') ||
      leagueName.includes('gold cup') || leagueName.includes('africa cup') ||
      leagueName.includes('olympic') || leagueName.includes('qualifying') ||
      leagueId.includes('fifa.world') || leagueId.includes('fifa.olympics') ||
      leagueId.includes('uefa.euro') || leagueId.includes('uefa.nations') ||
      leagueId.includes('concacaf.gold') || leagueId.includes('concacaf.nations') ||
      leagueId.includes('conmebol.america') || leagueId.includes('caf.nations')
    ) return 'national';

    // Cup competitions
    if (
      leagueName.includes('cup') || leagueName.includes('copa') ||
      leagueName.includes('coupe') || leagueName.includes('coppa') ||
      leagueName.includes('pokal') || leagueName.includes('beker') ||
      leagueName.includes('taça') || leagueName.includes('trophy') ||
      leagueName.includes('shield') || leagueName.includes('super cup') ||
      leagueName.includes('champions league') || leagueName.includes('europa league') ||
      leagueName.includes('conference league') || leagueName.includes('libertadores') ||
      leagueName.includes('sudamericana') || leagueName.includes('club world')
    ) return 'cup';

    // Default: league (club domestic)
    return 'league';
  }, []);

  // Category counts for badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, national: 0, friendly: 0, cup: 0, league: 0 };
    allMatches.forEach(m => {
      counts.all++;
      const cat = getMatchCategory(m);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [allMatches, getMatchCategory]);

  // Extract unique leagues (filtered by category)
  const leagues = useMemo(() => {
    const leagueSet = new Set<string>();
    allMatches.forEach(m => {
      if (selectedCategory !== 'all' && getMatchCategory(m) !== selectedCategory) return;
      const name = m.league?.name;
      if (name && name !== 'Soccer') leagueSet.add(name);
    });
    return ['All', ...Array.from(leagueSet).sort()];
  }, [allMatches, selectedCategory, getMatchCategory]);

  // Enhance matches with filter matching info
  const enhanceMatch = useCallback((match: LiveMatch): MatchWithPredictions => {
    if (userFilters.length === 0) return { ...match, matchingCount: 0 };
    const matching = getMatchingFiltersForMatch(match, userFilters);
    return {
      ...match,
      matchingFilters: matching,
      matchingCount: matching.filter(m => m.isMatching).length,
    };
  }, [userFilters]);

  // Get matches for the selected day
  const dayMatches = useMemo((): MatchWithPredictions[] => {
    const todayKey = dayTabs[0]?.key;
    const isToday = selectedDay === todayKey;

    let raw: LiveMatch[] = [];

    if (isToday) {
      // Today: live first, then upcoming
      const currentLive = liveMatches.length > 0 ? liveMatches : [];
      const currentUpcoming = upcomingMatches.length > 0 ? upcomingMatches : [];

      // Fallback to old combined matches format
      if (currentLive.length === 0 && currentUpcoming.length === 0 && matches.length > 0) {
        raw = matches;
      } else {
        // Live matches first (sorted by elapsed desc), then upcoming (sorted by kickoff asc)
        const sortedLive = [...currentLive].sort((a, b) =>
          (b.fixture?.status?.elapsed || 0) - (a.fixture?.status?.elapsed || 0)
        );
        const sortedUpcoming = [...currentUpcoming].sort((a, b) =>
          new Date(a.fixture?.date || 0).getTime() - new Date(b.fixture?.date || 0).getTime()
        );
        raw = [...sortedLive, ...sortedUpcoming];
      }
    } else {
      // Future day: filter scheduledMatches by date
      raw = scheduledMatches.filter(m => {
        if (!m.fixture?.date) return false;
        const matchDate = new Date(m.fixture.date);
        return getDateKey(matchDate) === selectedDay;
      }).sort((a, b) =>
        new Date(a.fixture?.date || 0).getTime() - new Date(b.fixture?.date || 0).getTime()
      );
    }

    // Enhance with filter matching
    let enhanced = raw.map(enhanceMatch);

    // Apply category filter
    if (selectedCategory !== 'all') {
      enhanced = enhanced.filter(m => getMatchCategory(m) === selectedCategory);
    }

    // Apply league filter (multi-select: empty set = all leagues)
    if (selectedLeagues.size > 0) {
      enhanced = enhanced.filter(m => m.league?.name && selectedLeagues.has(m.league.name));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      enhanced = enhanced.filter(m =>
        (m.teams?.home?.name || '').toLowerCase().includes(q) ||
        (m.teams?.away?.name || '').toLowerCase().includes(q)
      );
    }

    return enhanced;
  }, [selectedDay, dayTabs, liveMatches, upcomingMatches, scheduledMatches, matches, selectedLeagues, selectedCategory, searchQuery, enhanceMatch, getMatchCategory]);

  // Count matches per day (for tab badges)
  const dayMatchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const todayKey = dayTabs[0]?.key;
    counts[todayKey] = liveMatches.length + upcomingMatches.length + (liveMatches.length === 0 && upcomingMatches.length === 0 ? matches.length : 0);

    scheduledMatches.forEach(m => {
      if (!m.fixture?.date) return;
      const key = getDateKey(new Date(m.fixture.date));
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [dayTabs, liveMatches, upcomingMatches, scheduledMatches, matches]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-cyan" />
      </div>
    );
  }

  const todayKey = dayTabs[0]?.key;
  const liveCount = liveMatches.length;

  return (
    <div className="space-y-4">
      {/* Day Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {dayTabs.map(tab => {
          const count = dayMatchCounts[tab.key] || 0;
          const isActive = selectedDay === tab.key;
          const hasLive = tab.isToday && liveCount > 0;

          return (
            <button
              key={tab.key}
              onClick={() => setSelectedDay(tab.key)}
              className={`relative shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                isActive
                  ? 'bg-accent-cyan text-black'
                  : 'bg-glass-light/50 text-text-secondary hover:bg-glass-light hover:text-white'
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {count > 0 && (
                <span className={`ml-1.5 text-[10px] font-bold ${isActive ? 'text-black/60' : 'text-text-muted'}`}>
                  {count}
                </span>
              )}
              {hasLive && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent-red animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Filter Bar: Category chips + League dropdown + Search */}
      <div className="space-y-2">
        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {([
            { key: 'all', label: 'All' },
            { key: 'league', label: 'League' },
            { key: 'cup', label: 'Cup' },
            { key: 'national', label: 'National' },
            { key: 'friendly', label: 'Friendly' },
          ] as const).map(cat => {
            const count = categoryCounts[cat.key] || 0;
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => { setSelectedCategory(cat.key); setSelectedLeagues(new Set()); }}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition border ${
                  isActive
                    ? 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40'
                    : 'bg-glass-light/20 text-text-muted border-glass-light/30 hover:bg-glass-light/40 hover:text-white'
                }`}
              >
                {cat.label}
                {count > 0 && (
                  <span className={`ml-1 text-[10px] ${isActive ? 'text-accent-cyan/70' : 'text-text-muted/60'}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* League dropdown + Search */}
        <div className="flex gap-2 items-center">
        {/* League multi-select dropdown */}
        <div ref={leagueDropdownRef} className="relative shrink-0">
          <button
            onClick={() => setLeagueDropdownOpen(!leagueDropdownOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition border ${
              selectedLeagues.size > 0
                ? 'bg-accent-blue/20 text-accent-blue border-accent-blue/40'
                : 'bg-glass-light/30 text-text-muted border-glass-light hover:text-white hover:bg-glass-light/50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {selectedLeagues.size === 0
              ? 'All Leagues'
              : selectedLeagues.size === 1
                ? Array.from(selectedLeagues)[0]
                : `${selectedLeagues.size} Leagues`}
            <ChevronDown className={`w-3 h-3 transition ${leagueDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {leagueDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 w-56 max-h-72 overflow-y-auto rounded-lg border border-glass-light bg-background/95 backdrop-blur-md shadow-xl">
              {/* Select All / Clear */}
              <div className="sticky top-0 bg-background/95 backdrop-blur-md border-b border-glass-light px-3 py-2 flex justify-between">
                <button
                  onClick={() => setSelectedLeagues(new Set())}
                  className={`text-[10px] font-semibold transition ${selectedLeagues.size === 0 ? 'text-accent-cyan' : 'text-text-muted hover:text-white'}`}
                >
                  All
                </button>
                {selectedLeagues.size > 0 && (
                  <button
                    onClick={() => setSelectedLeagues(new Set())}
                    className="text-[10px] text-text-muted hover:text-accent-red transition"
                  >
                    Clear
                  </button>
                )}
              </div>
              {leagues.filter(l => l !== 'All').map(league => {
                const isSelected = selectedLeagues.has(league);
                return (
                  <button
                    key={league}
                    onClick={() => {
                      setSelectedLeagues(prev => {
                        const next = new Set(prev);
                        if (isSelected) next.delete(league);
                        else next.add(league);
                        return next;
                      });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-glass-light/50 transition text-left"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                      isSelected ? 'bg-accent-blue border-accent-blue' : 'border-glass-light'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={isSelected ? 'text-white font-semibold' : 'text-text-secondary'}>{league}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search team..."
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-glass-light/30 border border-glass-light text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent-cyan/50 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-glass-light transition"
              title="Clear search"
            >
              <X className="w-3 h-3 text-text-muted" />
            </button>
          )}
        </div>
      </div>
      </div>

      {/* Match count summary */}
      <div className="text-xs text-text-muted">
        {dayMatches.length} match{dayMatches.length !== 1 ? 'es' : ''}
        {selectedDay === todayKey && liveCount > 0 && (
          <span className="text-accent-red ml-1">({liveCount} live)</span>
        )}
        {selectedCategory !== 'all' && <span className="capitalize"> • {selectedCategory}</span>}
        {selectedLeagues.size > 0 && <span> in {selectedLeagues.size === 1 ? Array.from(selectedLeagues)[0] : `${selectedLeagues.size} leagues`}</span>}
        {searchQuery && <span> matching &quot;{searchQuery}&quot;</span>}
      </div>

      {/* Match List */}
      {dayMatches.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {dayMatches.map((match, idx) => {
            const isLive = match.fixture?.status?.short === 'LIVE';
            // Compute match odds from normKey with same normalization as server
            const cleanName = (s: string) =>
              s.trim().toLowerCase().replace(/[-_.']/g, ' ').replace(/\s+/g, ' ').trim();
            const hName = cleanName(match.teams?.home?.name || '');
            const aName = cleanName(match.teams?.away?.name || '');
            // Priority: API-Football odds → ESPN match.odds fallback
            const oddsEntry =
              matchOdds?.[`${hName}|${aName}`] ??
              espnOddsToEntry((match as any).odds) ??
              null;
            return (
              <MatchCard
                key={match.fixture?.id || idx}
                match={match}
                idx={idx}
                onSelect={setSelectedMatch}
                isSelected={selectedMatch?.fixture?.id === match.fixture?.id}
                teamForm={teamForm}
                isLive={isLive}
                showTime={selectedDay !== todayKey}
                oddsEntry={oddsEntry}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <AlertCircle className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted">No matches found</p>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-accent-cyan text-sm mt-2 hover:underline">
              Clear search
            </button>
          )}
          {selectedLeagues.size > 0 && (
            <button onClick={() => setSelectedLeagues(new Set())} className="text-accent-cyan text-sm mt-2 hover:underline block mx-auto">
              Show all leagues
            </button>
          )}
        </div>
      )}

      {/* Advanced Detail View Modal */}
      {selectedMatch && (
        <AdvancedMatchDetail match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </div>
  );
}

/** Convert ESPN American-moneyline odds object → card entry (decimal) */
function espnOddsToEntry(o: any): any | null {
  if (!o) return null;
  const ml2dec = (ml: any): number | undefined => {
    const n = parseFloat(String(ml));
    if (!n || isNaN(n)) return undefined;
    return n > 0
      ? parseFloat(((n / 100) + 1).toFixed(2))
      : parseFloat(((100 / Math.abs(n)) + 1).toFixed(2));
  };
  const entry: any = {
    home_win:  ml2dec(o.homeWin),
    draw:      ml2dec(o.draw),
    away_win:  ml2dec(o.awayWin),
  };
  // Over/Under 2.5 only
  if (o.overUnderLine === 2.5 || o.overUnder === 2.5) {
    entry.goals_over_2_5  = ml2dec(o.overOdds);
    entry.goals_under_2_5 = ml2dec(o.underOdds);
  }
  // Spread / Asian Handicap
  if (o.homeSpreadLine != null) {
    entry.asian_handicap_line      = o.homeSpreadLine;
    entry.asian_handicap_home_odd  = ml2dec(o.homeSpreadOdds);
    entry.asian_handicap_away_odd  = ml2dec(o.awaySpreadOdds);
  }
  // Only return if we have at least one value
  if (entry.home_win || entry.draw || entry.away_win) return entry;
  return null;
}

interface MatchCardProps {
  match: MatchWithPredictions;
  idx: number;
  onSelect: (m: MatchWithPredictions) => void;
  isSelected: boolean;
  teamForm: Record<string, any>;
  isLive: boolean;
  showTime?: boolean;
  oddsEntry?: any | null;
}

function MatchCard({
  match,
  idx,
  onSelect,
  isSelected,
  teamForm,
  isLive,
  showTime = false,
  oddsEntry = null,
}: MatchCardProps) {
  const homeTeamId = match.teams?.home?.id?.toString();
  const awayTeamId = match.teams?.away?.id?.toString();
  const homeForm = teamForm?.[homeTeamId] || null;
  const awayForm = teamForm?.[awayTeamId] || null;

  const statusShort = match.fixture?.status?.short || 'NS';
  const isFinished = statusShort === 'FT' || statusShort === 'AET' || statusShort === 'PEN';
  const isUpcoming = !isLive && !isFinished;

  const getStatValue = (stats: any[] | undefined, statType: string): string => {
    if (!stats || stats.length === 0) return '—';
    const homeStats = stats[0];
    if (homeStats?.statistics) {
      const found = homeStats.statistics.find((s: any) =>
        s.type?.toLowerCase().includes(statType.toLowerCase())
      );
      if (found?.value !== null && found?.value !== undefined) {
        return String(found.value);
      }
    }
    return '—';
  };

  const matchTime = match.fixture?.date ? new Date(match.fixture.date) : null;
  const timeStr = matchTime
    ? matchTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '';

  const hasOdds = oddsEntry && (oddsEntry.home_win || oddsEntry.draw || oddsEntry.away_win);
  const hasOU25 = oddsEntry && (oddsEntry.goals_over_2_5 || oddsEntry.goals_under_2_5);
  const hasAH = oddsEntry && (oddsEntry.asian_handicap_home_odd || oddsEntry.asian_handicap_away_odd);

  const homeName = match.teams?.home?.name || 'Home';
  const awayName = match.teams?.away?.name || 'Away';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
      onClick={() => onSelect(match)}
    >
      <div
        className={`glass-card p-4 rounded-xl border transition cursor-pointer group hover:shadow-lg ${
          isSelected
            ? 'border-accent-cyan bg-accent-cyan/10'
            : isLive
              ? 'border-accent-red/30 hover:border-accent-red/60'
              : 'border-glass-light hover:border-accent-cyan'
        }`}
      >
        {/* Top row: League + Time/Status + Details link */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold truncate">
              {match.league?.name || 'Soccer'}
            </p>
            {isLive ? (
              <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-accent-red">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
                LIVE {match.fixture?.status?.elapsed && `${match.fixture.status.elapsed}'`}
              </span>
            ) : isFinished ? (
              <span className="shrink-0 text-[10px] text-text-muted font-bold">FT</span>
            ) : (
              <span className="shrink-0 flex items-center gap-1 text-[10px] text-accent-cyan/80 font-semibold">
                <Clock className="w-3 h-3" />
                {timeStr}
              </span>
            )}
          </div>
          <span className="text-[10px] text-text-muted group-hover:text-accent-cyan transition shrink-0 ml-2">
            Details →
          </span>
        </div>

        {isUpcoming ? (
          /* ===== UPCOMING LAYOUT: side-by-side + form + odds ===== */
          <>
            <div className="flex items-start gap-2 mb-3">
              {/* Home */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm truncate">{homeName}</p>
                {homeForm && homeForm.played > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {homeForm.wins > 0 && <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-[9px] font-bold text-green-400">{homeForm.wins}W</span>}
                    {homeForm.draws > 0 && <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-[9px] font-bold text-yellow-400">{homeForm.draws}D</span>}
                    {homeForm.losses > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-[9px] font-bold text-red-400">{homeForm.losses}L</span>}
                  </div>
                )}
              </div>
              {/* VS */}
              <span className="text-xs font-bold text-text-muted/60 shrink-0 px-1 pt-0.5">vs</span>
              {/* Away */}
              <div className="flex-1 min-w-0 text-right">
                <p className="font-semibold text-white text-sm truncate">{awayName}</p>
                {awayForm && awayForm.played > 0 && (
                  <div className="flex items-center gap-1 mt-1 justify-end flex-wrap">
                    {awayForm.wins > 0 && <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-[9px] font-bold text-green-400">{awayForm.wins}W</span>}
                    {awayForm.draws > 0 && <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-[9px] font-bold text-yellow-400">{awayForm.draws}D</span>}
                    {awayForm.losses > 0 && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-[9px] font-bold text-red-400">{awayForm.losses}L</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Odds Section */}
            {hasOdds ? (
              <div className="border-t border-white/8 pt-3 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-accent-amber">
                  <TrendingUp className="w-3 h-3" />
                  <span>Decimal Odds</span>
                </div>
                {/* 1X2 */}
                <div>
                  <div className="text-[9px] text-text-muted mb-1 uppercase tracking-wide">Match Result (1X2)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <OddsCell label={`1 ${homeName.split(' ')[0]}`} value={oddsEntry.home_win} color="cyan" />
                    <OddsCell label="X Draw" value={oddsEntry.draw} color="yellow" />
                    <OddsCell label={`2 ${awayName.split(' ')[0]}`} value={oddsEntry.away_win} color="blue" />
                  </div>
                </div>
                {/* O/U 2.5 */}
                {hasOU25 && (
                  <div>
                    <div className="text-[9px] text-text-muted mb-1 uppercase tracking-wide">Goals Over/Under 2.5</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <OddsCell label="Over 2.5" value={oddsEntry.goals_over_2_5} color="green" />
                      <OddsCell label="Under 2.5" value={oddsEntry.goals_under_2_5} color="red" />
                    </div>
                  </div>
                )}
                {/* Asian Handicap */}
                {hasAH && (
                  <div>
                    <div className="text-[9px] text-text-muted mb-1 uppercase tracking-wide">Asian Handicap</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <OddsCell
                        label={`${homeName.split(' ')[0]} (${oddsEntry.asian_handicap_line !== undefined ? (oddsEntry.asian_handicap_line >= 0 ? '+' : '') + oddsEntry.asian_handicap_line : '-0.5'})`}
                        value={oddsEntry.asian_handicap_home_odd}
                        color="cyan"
                      />
                      <OddsCell
                        label={`${awayName.split(' ')[0]} (${oddsEntry.asian_handicap_line !== undefined ? ((-oddsEntry.asian_handicap_line) >= 0 ? '+' : '') + (-oddsEntry.asian_handicap_line) : '+0.5'})`}
                        value={oddsEntry.asian_handicap_away_odd}
                        color="blue"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-t border-white/8 pt-2">
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted/60">
                  <TrendingUp className="w-3 h-3" />
                  <span>Odds unavailable</span>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ===== LIVE / FINISHED LAYOUT: stacked with score ===== */
          <>
            <div className="space-y-1.5 mb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{homeName}</p>
                  {homeForm && <TeamFormBadge form={homeForm} />}
                </div>
                <div className={`text-2xl font-bold min-w-[2rem] text-right ${isLive ? 'text-white' : 'text-accent-cyan'}`}>
                  {match.goals?.home ?? 0}
                </div>
              </div>
              <div className="h-px bg-glass-light/30" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">{awayName}</p>
                  {awayForm && <TeamFormBadge form={awayForm} />}
                </div>
                <div className={`text-2xl font-bold min-w-[2rem] text-right ${isLive ? 'text-white' : 'text-accent-blue'}`}>
                  {match.goals?.away ?? 0}
                </div>
              </div>
            </div>

            {/* Quick Stats (live only) */}
            {isLive && match.statistics && match.statistics.length > 0 && (
              <div className="flex gap-3 text-[10px] text-text-muted mt-2 pt-2 border-t border-glass-light/30">
                <span>Poss: {getStatValue(match.statistics, 'possession')}</span>
                <span>Shots: {getStatValue(match.statistics, 'shots')}</span>
                <span>Corners: {getStatValue(match.statistics, 'corner')}</span>
              </div>
            )}
          </>
        )}


      </div>
    </motion.div>
  );
}

function OddsCell({ label, value, color }: { label: string; value: number | undefined; color: 'cyan' | 'blue' | 'yellow' | 'green' | 'red' }) {
  const colorMap = { cyan: 'text-accent-cyan', blue: 'text-accent-blue', yellow: 'text-yellow-400', green: 'text-green-400', red: 'text-red-400' };
  return (
    <div className="text-center px-2 py-2 rounded-lg bg-white/5 border border-white/10">
      <div className={`font-bold text-[13px] tabular-nums ${colorMap[color]}`}>
        {value ? value.toFixed(2) : '-'}
      </div>
      <div className="text-[9px] text-text-muted mt-0.5 truncate leading-tight" title={label}>{label}</div>
    </div>
  );
}

interface TeamFormBadgeProps {
  form: {
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    winRate: number;
  };
}

function TeamFormBadge({ form }: TeamFormBadgeProps) {
  if (!form || form.played === 0) return null;
  const formColor = form.winRate >= 60 ? 'text-accent-green' : form.winRate >= 40 ? 'text-accent-yellow' : 'text-accent-red';
  return (
    <div className={`text-[10px] font-semibold mt-0.5 ${formColor}`}>
      <BarChart3 className="w-2.5 h-2.5 inline mr-0.5" />
      {form.wins}W {form.draws}D {form.losses}L
    </div>
  );
}
