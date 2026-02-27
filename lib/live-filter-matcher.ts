/**
 * Live Filter Matching Engine
 * Calculates which filters match current live match stats
 * Includes team history analysis for predictability scoring
 */

import { Filter, FilterConditions } from '@/lib/supabase';
import { LiveMatch } from '@/lib/unified-api';

export interface FilterMatchDetails {
  filter: Filter;
  isMatching: boolean;
  matchedConditions: string[];
  failedConditions: string[];
  confidence: number; // 0-100
  teamHistoryFactor: number; // How likely based on team history
  reasoning: string;
}

/**
 * Check which filters match a live match
 */
export function getMatchingFiltersForMatch(
  match: LiveMatch,
  filters: Filter[],
  teamHistoryData?: TeamHistoryData
): FilterMatchDetails[] {
  return filters
    .filter(f => f.is_active && f.notification_enabled)
    .map(filter => evaluateFilterForMatch(match, filter, teamHistoryData))
    .sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// HELPERS FOR DUAL-FORMAT CONDITIONS (flat FilterConditions + ExtendedFilterConditions)
// ============================================================================

/** Returns true if the condition is in extended "team-specific" format (home/away/total as objects) */
function isTeamSpecificCondition(cond: any): boolean {
  if (!cond || typeof cond !== 'object') return false;
  return (
    (cond.home !== undefined && typeof cond.home === 'object') ||
    (cond.away !== undefined && typeof cond.away === 'object') ||
    (cond.total !== undefined && typeof cond.total === 'object')
  );
}

/** Evaluates a TeamSpecificCondition (home/away/total as RangeCondition objects) */
function evaluateTeamSpecificCondition(
  homeVal: number,
  awayVal: number,
  cond: { home?: { min?: number; max?: number }; away?: { min?: number; max?: number }; total?: { min?: number; max?: number } },
  label: string,
  matchedConditions: string[],
  failedConditions: string[]
): boolean {
  const total = homeVal + awayVal;
  let ok = true;

  if (cond.home) {
    if ((cond.home.min !== undefined && homeVal < cond.home.min) ||
        (cond.home.max !== undefined && homeVal > cond.home.max)) {
      failedConditions.push(`${label} home: ${homeVal} (need ${cond.home.min ?? 0}+${cond.home.max !== undefined ? '-' + cond.home.max : ''})`);
      ok = false;
    }
  }
  if (cond.away) {
    if ((cond.away.min !== undefined && awayVal < cond.away.min) ||
        (cond.away.max !== undefined && awayVal > cond.away.max)) {
      failedConditions.push(`${label} away: ${awayVal} (need ${cond.away.min ?? 0}+${cond.away.max !== undefined ? '-' + cond.away.max : ''})`);
      ok = false;
    }
  }
  if (cond.total) {
    if ((cond.total.min !== undefined && total < cond.total.min) ||
        (cond.total.max !== undefined && total > cond.total.max)) {
      failedConditions.push(`${label} total: ${total} H${homeVal}+A${awayVal} (need ${cond.total.min ?? 0}+${cond.total.max !== undefined ? '-' + cond.total.max : ''})`);
      ok = false;
    }
  }

  if (ok) {
    matchedConditions.push(`${label} H${homeVal}/A${awayVal} (total: ${total})`);
  }
  return ok;
}

/** Returns true if the match_time is in extended TimeCondition format */
function isExtendedTimeCondition(cond: any): boolean {
  return cond && (cond.between !== undefined || cond.after !== undefined || cond.before !== undefined || cond.exact !== undefined) && cond.min === undefined;
}

/** Evaluates extended TimeCondition against elapsed minutes */
function evaluateExtendedTimeCondition(elapsed: number, cond: { between?: [number, number]; after?: number; before?: number; exact?: number }): boolean {
  if (cond.exact !== undefined) return elapsed === cond.exact;
  if (cond.after !== undefined && elapsed <= cond.after) return false;
  if (cond.before !== undefined && elapsed >= cond.before) return false;
  if (cond.between) {
    const [min, max] = cond.between;
    if (elapsed < min || elapsed > max) return false;
  }
  return true;
}

/**
 * Detailed filter evaluation for a single match
 * Supports both flat FilterConditions and extended ExtendedFilterConditions (used by LivePick templates).
 */
export function evaluateFilterForMatch(
  match: LiveMatch,
  filter: Filter,
  teamHistoryData?: TeamHistoryData
): FilterMatchDetails {
  const conditions = filter.conditions as any; // use `any` to handle both flat and extended formats
  const matchedConditions: string[] = [];
  const failedConditions: string[] = [];
  let conditionScore = 0;
  let totalConditions = 0;

  // Extract stats from match
  const stats = extractMatchStats(match);
  const elapsed = match.fixture?.status?.elapsed || 0;

  // ========== MATCH TIME ==========
  // Flat: { min, max } | Extended: { between, after, before }
  if (conditions.match_time) {
    totalConditions++;
    const mt = conditions.match_time;
    let timeOk: boolean;

    if (isExtendedTimeCondition(mt)) {
      timeOk = evaluateExtendedTimeCondition(elapsed, mt);
      if (timeOk) {
        matchedConditions.push(`Time ${elapsed}'`);
        conditionScore++;
      } else {
        const range = mt.between ? `${mt.between[0]}-${mt.between[1]}` : mt.after ? `>${mt.after}` : mt.before ? `<${mt.before}` : `=${mt.exact}`;
        failedConditions.push(`Time: ${elapsed}' not in [${range}]`);
      }
    } else {
      // Flat format: min/max
      timeOk = isInRange(elapsed, mt.min, mt.max);
      if (timeOk) {
        matchedConditions.push(`Time ${elapsed}'`);
        conditionScore++;
      } else {
        failedConditions.push(`Time: ${elapsed}' not in ${mt.min ?? 0}-${mt.max ?? 90}`);
      }
    }
  }

  // ========== GOALS ==========
  if (conditions.goals) {
    totalConditions++;
    const goalsValue = conditions.goals.team === 'away' ? stats.awayGoals : stats.homeGoals;

    if (isInRange(goalsValue, conditions.goals.min, conditions.goals.max)) {
      matchedConditions.push(`Goals (${goalsValue})`);
      conditionScore++;
    } else {
      failedConditions.push(`Goals: expected ${conditions.goals.min}-${conditions.goals.max}, got ${goalsValue}`);
    }
  }

  // ========== SCORE (extended: total_goals / home / away / difference / exact) ==========
  if (conditions.score) {
    totalConditions++;
    const homeGoals = stats.homeGoals;
    const awayGoals = stats.awayGoals;
    const totalGoals = homeGoals + awayGoals;
    const diff = Math.abs(homeGoals - awayGoals);
    let scoreOk = true;

    if (conditions.score.exact) {
      if (homeGoals !== conditions.score.exact.home || awayGoals !== conditions.score.exact.away) {
        failedConditions.push(`Score exact: ${homeGoals}-${awayGoals} ≠ ${conditions.score.exact.home}-${conditions.score.exact.away}`);
        scoreOk = false;
      }
    }
    if (conditions.score.total_goals) {
      const tg = conditions.score.total_goals;
      if ((tg.min !== undefined && totalGoals < tg.min) || (tg.max !== undefined && totalGoals > tg.max)) {
        failedConditions.push(`Total goals: ${totalGoals} (need ${tg.min ?? 0}-${tg.max ?? '∞'})`);
        scoreOk = false;
      }
    }
    if (conditions.score.home) {
      const sh = conditions.score.home;
      if ((sh.min !== undefined && homeGoals < sh.min) || (sh.max !== undefined && homeGoals > sh.max)) {
        failedConditions.push(`Home goals: ${homeGoals} (need ${sh.min ?? 0}-${sh.max ?? '∞'})`);
        scoreOk = false;
      }
    }
    if (conditions.score.away) {
      const sa = conditions.score.away;
      if ((sa.min !== undefined && awayGoals < sa.min) || (sa.max !== undefined && awayGoals > sa.max)) {
        failedConditions.push(`Away goals: ${awayGoals} (need ${sa.min ?? 0}-${sa.max ?? '∞'})`);
        scoreOk = false;
      }
    }
    if (conditions.score.difference) {
      const sd = conditions.score.difference;
      if ((sd.min !== undefined && diff < sd.min) || (sd.max !== undefined && diff > sd.max)) {
        failedConditions.push(`Goal diff: ${diff} (need ${sd.min ?? 0}-${sd.max ?? '∞'})`);
        scoreOk = false;
      }
    }

    if (scoreOk) {
      matchedConditions.push(`Score ${homeGoals}-${awayGoals}`);
      conditionScore++;
    }
  }

  // ========== CORNERS ==========
  // Extended: { home: {min}, away: {min}, total: {min} } | Flat: { min, max, team }
  if (conditions.corners) {
    totalConditions++;
    const c = conditions.corners;
    if (isTeamSpecificCondition(c)) {
      const ok = evaluateTeamSpecificCondition(stats.homeCorners, stats.awayCorners, c, 'Corners', matchedConditions, failedConditions);
      if (ok) conditionScore++;
    } else {
      // Flat format
      const cornersValue = c.team === 'away' ? stats.awayCorners : c.team === 'home' ? stats.homeCorners : (stats.homeCorners + stats.awayCorners);
      if (isInRange(cornersValue, c.min, c.max)) {
        matchedConditions.push(`Corners (${cornersValue})`);
        conditionScore++;
      } else {
        failedConditions.push(`Corners: expected ${c.min}-${c.max}, got ${cornersValue}`);
      }
    }
  }

  // ========== SHOTS ON TARGET ==========
  if (conditions.shots_on_target) {
    totalConditions++;
    const s = conditions.shots_on_target;
    if (isTeamSpecificCondition(s)) {
      const ok = evaluateTeamSpecificCondition(stats.homeShots, stats.awayShots, s, 'Shots', matchedConditions, failedConditions);
      if (ok) conditionScore++;
    } else {
      const shotsValue = s.team === 'home' ? stats.homeShots : s.team === 'away' ? stats.awayShots : (stats.homeShots + stats.awayShots);
      if (isInRange(shotsValue, s.min, s.max)) {
        matchedConditions.push(`Shots on Target (${shotsValue})`);
        conditionScore++;
      } else {
        failedConditions.push(`Shots: expected ${s.min}-${s.max}, got ${shotsValue}`);
      }
    }
  }

  // ========== YELLOW CARDS ==========
  if (conditions.yellow_cards) {
    totalConditions++;
    const yc = conditions.yellow_cards;
    if (isTeamSpecificCondition(yc)) {
      const ok = evaluateTeamSpecificCondition(stats.homeYellowCards, stats.awayYellowCards, yc, 'Yellow Cards', matchedConditions, failedConditions);
      if (ok) conditionScore++;
    } else {
      const cardsValue = yc.team === 'home' ? stats.homeYellowCards : yc.team === 'away' ? stats.awayYellowCards : (stats.homeYellowCards + stats.awayYellowCards);
      if (isInRange(cardsValue, yc.min, yc.max)) {
        matchedConditions.push(`Yellow Cards (${cardsValue})`);
        conditionScore++;
      } else {
        failedConditions.push(`Yellow Cards: expected ${yc.min}-${yc.max}, got ${cardsValue}`);
      }
    }
  }

  // ========== RED CARDS ==========
  if (conditions.red_cards) {
    totalConditions++;
    const rc = conditions.red_cards;
    if (isTeamSpecificCondition(rc)) {
      const ok = evaluateTeamSpecificCondition(stats.homeRedCards, stats.awayRedCards, rc, 'Red Cards', matchedConditions, failedConditions);
      if (ok) conditionScore++;
    } else {
      const redCardsValue = rc.team === 'home' ? stats.homeRedCards : rc.team === 'away' ? stats.awayRedCards : (stats.homeRedCards + stats.awayRedCards);
      if (isInRange(redCardsValue, rc.min, rc.max)) {
        matchedConditions.push(`Red Cards (${redCardsValue})`);
        conditionScore++;
      } else {
        failedConditions.push(`Red Cards: expected ${rc.min}-${rc.max}, got ${redCardsValue}`);
      }
    }
  }

  // ========== POSSESSION ==========
  // Extended: { home: {min,max}, away: {min,max}, dominant: 'home'|'away'|'balanced' }
  // Flat: { min, max, team }
  if (conditions.possession) {
    totalConditions++;
    const p = conditions.possession;
    const homePos = stats.homePossession;
    const awayPos = stats.awayPossession || (100 - homePos);
    let posOk = true;

    if (p.dominant !== undefined || (p.home && typeof p.home === 'object') || (p.away && typeof p.away === 'object')) {
      // Extended format
      if (p.home && typeof p.home === 'object') {
        if ((p.home.min !== undefined && homePos < p.home.min) || (p.home.max !== undefined && homePos > p.home.max)) {
          failedConditions.push(`Possession home: ${homePos}% (need ${p.home.min ?? 0}-${p.home.max ?? 100}%)`);
          posOk = false;
        }
      }
      if (p.away && typeof p.away === 'object') {
        if ((p.away.min !== undefined && awayPos < p.away.min) || (p.away.max !== undefined && awayPos > p.away.max)) {
          failedConditions.push(`Possession away: ${awayPos}% (need ${p.away.min ?? 0}-${p.away.max ?? 100}%)`);
          posOk = false;
        }
      }
      if (p.dominant) {
        const balanced = Math.abs(homePos - awayPos) < 10;
        const homeDominant = homePos > awayPos + 5;
        const awayDominant = awayPos > homePos + 5;
        if (p.dominant === 'home' && !homeDominant) { failedConditions.push(`Possession: home not dominant (${homePos}% vs ${awayPos}%)`); posOk = false; }
        if (p.dominant === 'away' && !awayDominant) { failedConditions.push(`Possession: away not dominant (${awayPos}% vs ${homePos}%)`); posOk = false; }
        if (p.dominant === 'balanced' && !balanced) { failedConditions.push(`Possession: not balanced (${homePos}% vs ${awayPos}%)`); posOk = false; }
      }
      if (posOk) {
        matchedConditions.push(`Possession H${homePos}% A${awayPos}%`);
        conditionScore++;
      }
    } else {
      // Flat format
      const posValue = p.team === 'away' ? awayPos : homePos;
      if (isInRange(posValue, p.min, p.max)) {
        matchedConditions.push(`Possession (${posValue}%)`);
        conditionScore++;
      } else {
        failedConditions.push(`Possession: expected ${p.min}-${p.max}%, got ${posValue}%`);
      }
    }
  }

  // ========== TOTAL SHOTS (flat: { min, max, team }) ==========
  if (conditions.total_shots) {
    totalConditions++;
    const ts = conditions.total_shots as any;
    const totalShotsVal = ts.team === 'home' ? stats.homeShots : ts.team === 'away' ? stats.awayShots : (stats.homeShots + stats.awayShots);
    if (isInRange(totalShotsVal, ts.min, ts.max)) {
      matchedConditions.push(`Total Shots (${totalShotsVal})`);
      conditionScore++;
    } else {
      failedConditions.push(`Total Shots: expected ${ts.min}-${ts.max}, got ${totalShotsVal}`);
    }
  }

  // ========== DANGEROUS ATTACKS ==========
  // Extended: { home: {min}, away: {min}, total: {min} } | Flat: { min, max, team }
  // Soft-skip: if ESPN data source doesn't provide DA (both = 0), skip silently instead of failing
  if (conditions.dangerous_attacks) {
    const noDaData = stats.homeDangerousAttacks === 0 && stats.awayDangerousAttacks === 0;
    if (!noDaData) {
      totalConditions++;
      const da = conditions.dangerous_attacks as any;
      if (isTeamSpecificCondition(da)) {
        const ok = evaluateTeamSpecificCondition(stats.homeDangerousAttacks, stats.awayDangerousAttacks, da, 'Dangerous Attacks', matchedConditions, failedConditions);
        if (ok) conditionScore++;
      } else {
        const daValue = da.team === 'home' ? stats.homeDangerousAttacks : da.team === 'away' ? stats.awayDangerousAttacks : (stats.homeDangerousAttacks + stats.awayDangerousAttacks);
        if (isInRange(daValue, da.min, da.max)) {
          matchedConditions.push(`Dangerous Attacks (${daValue})`);
          conditionScore++;
        } else {
          failedConditions.push(`Dangerous Attacks: expected ${da.min}-${da.max}, got ${daValue}`);
        }
      }
    }
    // else: DA data not available from this source — skip condition
  }

  // ========== TRENDS (corners_increasing, shots_increasing) ==========
  // Approximated: if total corners/shots is above period-average-based threshold
  if (conditions.trends) {
    const tr = conditions.trends as any;
    const totalCorners = stats.homeCorners + stats.awayCorners;
    const totalShots = stats.homeShots + stats.awayShots;

    // corners_increasing: use a pace-based check: if elapsed > 0, corners per minute > 0.08 (≈7 corners by 90min)
    if (tr.corners_increasing !== undefined) {
      totalConditions++;
      const cornerPace = elapsed > 0 ? totalCorners / elapsed : 0;
      const cornersIncreasing = cornerPace >= 0.08 || totalCorners >= 5;
      if (cornersIncreasing) {
        matchedConditions.push(`Corners Increasing (${totalCorners} @ ${elapsed}')`);
        conditionScore++;
      } else {
        failedConditions.push(`Corners not increasing fast enough (${totalCorners} @ ${elapsed}', pace ${cornerPace.toFixed(3)}/min)`);
      }
    }

    // shots_increasing: similar pace check
    if (tr.shots_increasing !== undefined) {
      totalConditions++;
      const shotPace = elapsed > 0 ? totalShots / elapsed : 0;
      const shotsIncreasing = shotPace >= 0.12 || totalShots >= 8;
      if (shotsIncreasing) {
        matchedConditions.push(`Shots Increasing (${totalShots} @ ${elapsed}')`);
        conditionScore++;
      } else {
        failedConditions.push(`Shots not at high pace (${totalShots} @ ${elapsed}', pace ${shotPace.toFixed(3)}/min)`);
      }
    }
  }

  // ========== GOALS FIRST HALF ==========
  if (conditions.goals_first_half) {
    totalConditions++;
    const firstHalfGoals = (match.score?.halftime?.home || 0) + (match.score?.halftime?.away || 0);
    
    if (isInRange(firstHalfGoals, conditions.goals_first_half.min, conditions.goals_first_half.max)) {
      matchedConditions.push(`First Half Goals (${firstHalfGoals})`);
      conditionScore++;
    } else {
      failedConditions.push(`First Half Goals: expected ${conditions.goals_first_half.min}-${conditions.goals_first_half.max}, got ${firstHalfGoals}`);
    }
  }

  // ========== GOALS SECOND HALF ==========
  if (conditions.goals_second_half) {
    totalConditions++;
    const fullGoals = (match.goals?.home || 0) + (match.goals?.away || 0);
    const firstHalfGoals = (match.score?.halftime?.home || 0) + (match.score?.halftime?.away || 0);
    const secondHalfGoals = Math.max(0, fullGoals - firstHalfGoals);
    
    if (isInRange(secondHalfGoals, conditions.goals_second_half.min, conditions.goals_second_half.max)) {
      matchedConditions.push(`Second Half Goals (${secondHalfGoals})`);
      conditionScore++;
    } else {
      failedConditions.push(`Second Half Goals: expected ${conditions.goals_second_half.min}-${conditions.goals_second_half.max}, got ${secondHalfGoals}`);
    }
  }

  // ========== GOALS LAST 5/10 MIN ==========
  if (conditions.goals_last_5min) {
    totalConditions++;
    matchedConditions.push(`Last 5min (data pending)`);
    conditionScore++;
  }
  if (conditions.goals_last_10min) {
    totalConditions++;
    matchedConditions.push(`Last 10min (data pending)`);
    conditionScore++;
  }

  // ========== MATCH GOALS OVER/UNDER ==========
  if (conditions.match_goals) {
    totalConditions++;
    const totalGoals = (match.goals?.home || 0) + (match.goals?.away || 0);
    const threshold = conditions.match_goals.value || 2.5;
    
    const isMatch =
      (conditions.match_goals.type === 'over' && totalGoals > threshold) ||
      (conditions.match_goals.type === 'under' && totalGoals < threshold);

    if (isMatch) {
      matchedConditions.push(`Match Goals ${conditions.match_goals.type.toUpperCase()} ${threshold} (${totalGoals})`);
      conditionScore++;
    } else {
      failedConditions.push(`Match Goals: ${conditions.match_goals.type.toUpperCase()} ${threshold}, got ${totalGoals}`);
    }
  }

  // ========== FIRST HALF GOALS OVER/UNDER ==========
  if (conditions.first_half_goals) {
    totalConditions++;
    const firstHalfGoals = (match.score?.halftime?.home || 0) + (match.score?.halftime?.away || 0);
    const threshold = conditions.first_half_goals.value || 1.5;
    
    const isMatch =
      (conditions.first_half_goals.type === 'over' && firstHalfGoals > threshold) ||
      (conditions.first_half_goals.type === 'under' && firstHalfGoals < threshold);

    if (isMatch) {
      matchedConditions.push(`First Half ${conditions.first_half_goals.type.toUpperCase()} ${threshold}`);
      conditionScore++;
    } else {
      failedConditions.push(`First Half: ${conditions.first_half_goals.type.toUpperCase()} ${threshold}, got ${firstHalfGoals}`);
    }
  }

  // ========== BOTH TEAMS SCORE (BTTS) ==========
  if (conditions.both_teams_score) {
    totalConditions++;
    const homeScoredMoreThanZero = (match.goals?.home || 0) > 0;
    const awayScoredMoreThanZero = (match.goals?.away || 0) > 0;
    
    if (homeScoredMoreThanZero && awayScoredMoreThanZero) {
      matchedConditions.push('Both Teams Score');
      conditionScore++;
    } else {
      failedConditions.push('Both Teams Score: Only one team has scored');
    }
  }

  // ========== MATCH CORNERS OVER/UNDER ==========
  if (conditions.match_corners) {
    totalConditions++;
    const totalCorners = stats.homeCorners + stats.awayCorners;
    const threshold = conditions.match_corners.value || 8.5;
    
    const isMatch =
      (conditions.match_corners.type === 'over' && totalCorners > threshold) ||
      (conditions.match_corners.type === 'under' && totalCorners < threshold);

    if (isMatch) {
      matchedConditions.push(`Corners ${conditions.match_corners.type.toUpperCase()} ${threshold}`);
      conditionScore++;
    } else {
      failedConditions.push(`Corners: ${conditions.match_corners.type.toUpperCase()} ${threshold}, got ${totalCorners}`);
    }
  }

  // ========== MOMENTUM ==========
  if (conditions.momentum_last_5min) {
    totalConditions++;
    matchedConditions.push('Momentum (approx)');
    conditionScore++;
  }

  // ========== PRE-MATCH ODDS ==========
  if (conditions.pre_match_odds) {
    const preMatchOdds = conditions.pre_match_odds;
    const matchOdds = (match as any).odds;

    for (const [market, range] of Object.entries(preMatchOdds)) {
      if (!range) continue;
      totalConditions++;
      const r = range as { min?: number; max?: number };
      const oddsValue = matchOdds?.[market];

      if (oddsValue !== undefined && oddsValue !== null && isInRange(oddsValue, r.min, r.max)) {
        matchedConditions.push(`${market} odds: ${oddsValue}`);
        conditionScore++;
      } else {
        failedConditions.push(`${market} odds: ${oddsValue ?? 'N/A'} not in ${r.min ?? '*'}-${r.max ?? '*'}`);
      }
    }
  }

  // ========== Calculate confidence ==========
  const baseConfidence = totalConditions > 0 ? (conditionScore / totalConditions) * 100 : 0;

  // Time-weighted boost: conditions met late in the match deserve higher confidence
  const conditionRatio = totalConditions > 0 ? conditionScore / totalConditions : 0;
  const timeBoost =
    elapsed >= 80 ? conditionRatio * 15 :
    elapsed >= 65 ? conditionRatio * 10 :
    elapsed >= 45 ? conditionRatio * 5 : 0;

  // Get team history factor
  const historyFactor = getTeamHistoryFactor(match, teamHistoryData);

  // Combined confidence (60% condition match, 20% time bonus, 20% team history)
  const confidence = Math.min(100, Math.round(baseConfidence * 0.6 + timeBoost + historyFactor * 0.2));

  const isMatching = conditionScore === totalConditions && totalConditions > 0;

  return {
    filter,
    isMatching,
    matchedConditions,
    failedConditions,
    confidence,
    teamHistoryFactor: historyFactor,
    reasoning: generateReasoning(filter.name, matchedConditions, failedConditions, isMatching),
  };
}

/**
 * Extract stats from live match data
 */
function extractMatchStats(match: LiveMatch) {
  const stats = match.statistics || [];
  const homeStats = stats.find(s => s.team?.id === match.teams?.home?.id);
  const awayStats = stats.find(s => s.team?.id === match.teams?.away?.id);

  const findStat = (statsObj: any, type: string): number => {
    if (!statsObj?.statistics) return 0;
    const val = statsObj.statistics.find((s: any) => s.type === type)?.value;
    if (val === null || val === undefined) return 0;
    // Possession comes as "45%" string
    if (typeof val === 'string' && val.endsWith('%')) return parseFloat(val);
    return typeof val === 'number' ? val : parseFloat(val) || 0;
  };

  return {
    homeGoals: match.goals?.home || 0,
    awayGoals: match.goals?.away || 0,
    homeCorners: findStat(homeStats, 'Corner Kicks') || findStat(homeStats, 'Corners'),
    awayCorners: findStat(awayStats, 'Corner Kicks') || findStat(awayStats, 'Corners'),
    homeShots: findStat(homeStats, 'Shots on Goal'),
    awayShots: findStat(awayStats, 'Shots on Goal'),
    homePossession: findStat(homeStats, 'Ball Possession') || findStat(homeStats, 'Possession'),
    awayPossession: findStat(awayStats, 'Ball Possession') || findStat(awayStats, 'Possession'),
    homeYellowCards: findStat(homeStats, 'Yellow Cards'),
    awayYellowCards: findStat(awayStats, 'Yellow Cards'),
    homeRedCards: findStat(homeStats, 'Red Cards'),
    awayRedCards: findStat(awayStats, 'Red Cards'),
    homeFouls: findStat(homeStats, 'Fouls Committed') || findStat(homeStats, 'Fouls'),
    awayFouls: findStat(awayStats, 'Fouls Committed') || findStat(awayStats, 'Fouls'),
    homeDangerousAttacks: findStat(homeStats, 'Dangerous Attacks'),
    awayDangerousAttacks: findStat(awayStats, 'Dangerous Attacks'),
  };
}

/**
 * Check if value is in range (handles optional min/max)
 */
function isInRange(value: number, min?: number, max?: number): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Team history data interface
 */
export interface TeamHistoryData {
  [teamId: string]: {
    avgGoals: number;
    avgCorners: number;
    avgShots: number;
    avgCards: number;
    recentForm: number; // 0-100, wins percentage
    homeAwayFactor: number; // 1.2 if home team scores more at home, etc.
  };
}

/**
 * Calculate team history factor (0-100)
 * Higher when match conditions align with team history
 */
function getTeamHistoryFactor(match: LiveMatch, data?: TeamHistoryData): number {
  if (!data) return 50; // Default neutral

  const homeHistory = data[match.teams?.home?.id!];
  const awayHistory = data[match.teams?.away?.id!];

  if (!homeHistory || !awayHistory) return 50;

  const stats = extractMatchStats(match);

  // Score based on how much actual stats match expected averages
  let score = 50; // Start neutral

  // Home team tendency check
  if (stats.homeGoals > stats.awayGoals && homeHistory.avgGoals > awayHistory.avgGoals) {
    score += 15;
  }

  // Shots check
  if ((stats.homeShots + stats.awayShots) > 15) {
    score += 10;
  }

  // Cards check
  if ((stats.homeYellowCards + stats.awayYellowCards) > 2) {
    score += 10;
  }

  // Recent form check
  score += Math.min(homeHistory.recentForm * 0.1, 10);

  return Math.min(score, 100);
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(
  filterName: string,
  matched: string[],
  failed: string[],
  isMatching: boolean
): string {
  if (isMatching) {
    return `"${filterName}" matches! All conditions met: ${matched.join(', ')}`;
  }

  if (matched.length > 0) {
    return `"${filterName}" partially matches (${matched.join(', ')}). Missing: ${failed.join(', ')}`;
  }

  return `"${filterName}" doesn't match yet. Waiting for: ${failed.join(', ')}`;
}

/**
 * Calculate predictability for entire match.
 * Time-aware: later in the match, partially-met conditions indicate higher likelihood.
 */
export function calculateMatchPredictability(
  match: LiveMatch,
  matchFilters: FilterMatchDetails[]
): number {
  if (matchFilters.length === 0) return 0;

  const elapsed = match.fixture?.status?.elapsed || 0;
  const matchingCount = matchFilters.filter(m => m.isMatching).length;
  const avgConfidence = matchFilters.reduce((sum, m) => sum + m.confidence, 0) / matchFilters.length;

  // Higher confidence if some are already matching
  const matchingBonus = (matchingCount / matchFilters.length) * 30;

  // Time factor: late in the match, conditions that aren't met yet are less likely
  // but conditions that ARE met late are very reliable
  let timeFactor = 1.0;
  if (matchingCount > 0) {
    // Already triggered — very high predictability
    if (elapsed >= 70) timeFactor = 1.3;
    else if (elapsed >= 45) timeFactor = 1.1;
  } else {
    // Not yet triggered — penalize very late matches (unlikely to trigger)
    if (elapsed >= 85) timeFactor = 0.5;
    else if (elapsed >= 75) timeFactor = 0.7;
    else if (elapsed >= 60) timeFactor = 0.85;
  }

  const raw = (avgConfidence * 0.7 + matchingBonus) * timeFactor;
  return Math.min(100, Math.round(raw));
}

/**
 * Detect contradictory filters triggering on the same match
 * Returns array of conflict warnings to alert user
 */
export function detectContradictoryFilters(
  matchingFilters: FilterMatchDetails[]
): string[] {
  if (matchingFilters.length < 2) return [];

  const conflicts: string[] = [];
  const filterNames = matchingFilters.map(f => f.filter.name.toLowerCase());

  // Helper: check if any filter name contains a keyword
  const hasKeyword = (keywords: string[]) => 
    filterNames.some(name => keywords.some(kw => name.includes(kw)));

  // Helper: check if filter has specific condition
  const hasCondition = (conditionCheck: (f: FilterMatchDetails) => boolean) => 
    matchingFilters.some(conditionCheck);

  // CONFLICT 1: BTTS vs Under 2.5/1.5 Goals
  const hasBTTS = hasKeyword(['btts', 'both teams', 'both team score']);
  const hasUnder = hasKeyword(['under 2.5', 'under 1.5', 'under 2,5', 'under 1,5', '<2.5', '<1.5']);
  if (hasBTTS && hasUnder) {
    conflicts.push('⚠️ BTTS and Under Goals filters both triggered (contradictory markets)');
  }

  // CONFLICT 2: Over 2.5 vs Under 2.5
  const hasOver25 = hasKeyword(['over 2.5', 'over 2,5', '>2.5', 'over25']);
  if (hasOver25 && hasUnder) {
    conflicts.push('⚠️ Over 2.5 and Under goals filters both triggered (opposite predictions)');
  }

  // CONFLICT 3: Home Win vs Away Win
  const hasHomeWin = hasKeyword(['home win', 'home team winning', 'home dominance']) && 
    !hasKeyword(['comeback', 'losing', 'underdog']);
  const hasAwayWin = hasKeyword(['away win', 'away team winning', 'away dominance', 'away upset']) && 
    !hasKeyword(['comeback', 'losing']);
  if (hasHomeWin && hasAwayWin) {
    conflicts.push('⚠️ Home win and Away win filters both triggered (opposite outcomes)');
  }

  // CONFLICT 4: Draw prediction vs Winner prediction
  const hasDraw = hasKeyword(['draw', 'stalemate', 'balanced']) && 
    hasCondition(f => {
      const cond = f.filter.conditions as any;
      return cond?.score?.difference !== undefined && cond.score.difference.max === 0;
    });
  if (hasDraw && (hasHomeWin || hasAwayWin)) {
    conflicts.push('⚠️ Draw and Winner filters both triggered (contradictory outcomes)');
  }

  // CONFLICT 5: Low scoring (defensive) vs High scoring (attacking)
  const isDefensive = hasKeyword(['defensive', 'conservative', 'low xg', 'tight', 'cautious']);
  const isHighScoring = hasKeyword(['high scoring', 'attacking', 'goals bonanza', 'over 3.5', '>3.5']);
  if (isDefensive && isHighScoring) {
    conflicts.push('⚠️ Defensive and High-scoring filters both triggered (conflicting game styles)');
  }

  // CONFLICT 6: Favorite dominating vs Underdog upset
  const hasFavoriteDom = hasKeyword(['favorite', 'dominant', 'possession >60']) && 
    hasCondition(f => {
      const cond = f.filter.conditions as any;
      return cond?.possession?.home !== undefined && cond.possession.home.min >= 55;
    });
  const hasUnderdogUpset = hasKeyword(['underdog', 'upset', 'counter', 'low possession']) && 
    hasCondition(f => {
      const cond = f.filter.conditions as any;
      return cond?.possession?.away !== undefined || 
             (cond?.possession?.max !== undefined && cond.possession.max <= 45);
    });
  if (hasFavoriteDom && hasUnderdogUpset) {
    conflicts.push('⚠️ Favorite dominating and Underdog upset filters both triggered (conflicting narratives)');
  }

  return conflicts;
}

/**
 * Get human-readable summary of triggered filters with conflict warnings
 */
export function getMatchFilterSummary(
  match: LiveMatch,
  matchingFilters: FilterMatchDetails[]
): {
  totalMatching: number;
  avgConfidence: number;
  predictability: number;
  conflicts: string[];
  filterNames: string[];
} {
  const conflicts = detectContradictoryFilters(matchingFilters);
  const predictability = calculateMatchPredictability(match, matchingFilters);
  const avgConfidence = matchingFilters.length > 0
    ? matchingFilters.reduce((sum, f) => sum + f.confidence, 0) / matchingFilters.length
    : 0;

  return {
    totalMatching: matchingFilters.filter(f => f.isMatching).length,
    avgConfidence: Math.round(avgConfidence),
    predictability,
    conflicts,
    filterNames: matchingFilters.map(f => f.filter.name),
  };
}
