import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getEvaluationType, getEffectiveSuccess } from '@/lib/analytics';
import { RAW_TEMPLATES } from '@/lib/filter-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Build template lookup
const templateMap = new Map(RAW_TEMPLATES.map(t => [t.id, t]));

interface TemplateRanking {
  templateId: string;
  templateName: string;
  evaluationType: string;
  totalTriggers: number;
  autoSuccessRate: number | null;
  avgGoalsAdded: number | null;
  bestMinuteRange: string | null;
  bestLeague: { name: string; successRate: number; count: number } | null;
  worstLeague: { name: string; successRate: number; count: number } | null;
}

interface LeagueInsight {
  league: string;
  totalTriggers: number;
  avgGoalsAdded: number | null;
  autoSuccessRate: number | null;
  bestTemplates: { name: string; successRate: number; count: number }[];
  worstTemplates: { name: string; successRate: number; count: number }[];
}

interface MinuteHeatmap {
  range: string;
  count: number;
  avgGoalsAdded: number | null;
  autoSuccessRate: number | null;
  topTemplates: { name: string; successRate: number; count: number }[];
}

interface GoldenCombo {
  template: string;
  templateId: string;
  league: string;
  minuteRange: string;
  successRate: number;
  sampleSize: number;
  avgGoalsAdded: number;
}

/**
 * GET /api/analytics/cross-analysis?user_id=xxx
 *
 * Produces a comprehensive cross-analysis of all triggered matches:
 * - Template rankings by auto-success rate
 * - League insights (best/worst templates per league)
 * - Minute heatmap (which time ranges produce value)
 * - Golden combos (template + league + minute with high success)
 * - Low-value combos (template + league with low success)
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  }

  // Fetch all finished triggered matches with scores
  const { data: rows, error } = await supabase
    .from('triggered_matches')
    .select('filter_id, filter_name, league_name, match_time, score_home, score_away, final_score_home, final_score_away, user_feedback, auto_success')
    .eq('user_id', userId)
    .eq('match_status', 'finished')
    .not('final_score_home', 'is', null)
    .not('final_score_away', 'is', null)
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const matches = rows || [];
  if (matches.length === 0) {
    return NextResponse.json({
      templateRankings: [],
      leagueInsights: [],
      minuteHeatmap: [],
      goldenCombos: [],
      lowValueCombos: [],
      totalAnalyzed: 0,
    });
  }

  // Look up template IDs for filters
  const filterIds = [...new Set(matches.map(m => m.filter_id))];
  const { data: filters } = await supabase
    .from('filters')
    .select('id, template_id, name')
    .in('id', filterIds);

  const filterTemplateMap = new Map<string, string>();
  for (const f of filters || []) {
    if (f.template_id) filterTemplateMap.set(f.id, f.template_id);
  }

  // ── Helpers ────────────────────────────────────────────────
  function getMinuteRange(min: number | null): string {
    if (min == null) return 'unknown';
    if (min <= 30) return '1-30';
    if (min <= 45) return '31-45';
    if (min <= 55) return '46-55';
    if (min <= 65) return '56-65';
    if (min <= 75) return '66-75';
    return '76+';
  }

  function goalsAdded(m: any): number {
    return ((m.final_score_home ?? 0) + (m.final_score_away ?? 0)) - ((m.score_home ?? 0) + (m.score_away ?? 0));
  }

  function calcRate(items: any[]): number | null {
    const rated = items.filter(i => i.success !== null);
    if (rated.length < 3) return null;
    const positive = rated.filter(i => i.success === true).length;
    return Math.round((positive / rated.length) * 100);
  }

  function calcAvg(nums: number[]): number | null {
    if (nums.length === 0) return null;
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
  }

  // ── Process all matches ────────────────────────────────────
  type ProcessedMatch = {
    templateId: string;
    templateName: string;
    league: string;
    minuteRange: string;
    matchTime: number | null;
    goalsAdded: number;
    success: boolean | null;
  };

  const processed: ProcessedMatch[] = [];

  for (const m of matches) {
    const templateId = filterTemplateMap.get(m.filter_id) || '';
    const template = templateMap.get(templateId);
    const templateName = template?.name || m.filter_name || 'Custom Filter';
    const success = getEffectiveSuccess(m.user_feedback, m.auto_success);

    processed.push({
      templateId,
      templateName,
      league: m.league_name || 'Unknown',
      minuteRange: getMinuteRange(m.match_time),
      matchTime: m.match_time,
      goalsAdded: goalsAdded(m),
      success,
    });
  }

  // ── 1. TEMPLATE RANKINGS ───────────────────────────────────
  const byTemplate = new Map<string, ProcessedMatch[]>();
  for (const p of processed) {
    const key = p.templateId || p.templateName;
    if (!byTemplate.has(key)) byTemplate.set(key, []);
    byTemplate.get(key)!.push(p);
  }

  const templateRankings: TemplateRanking[] = [];
  for (const [key, items] of byTemplate) {
    const template = templateMap.get(key);
    const evalType = template?.evaluationType || getEvaluationType(key, items[0]?.templateName);

    // League sub-analysis
    const byLeague = new Map<string, ProcessedMatch[]>();
    for (const i of items) {
      if (!byLeague.has(i.league)) byLeague.set(i.league, []);
      byLeague.get(i.league)!.push(i);
    }

    let bestLeague: TemplateRanking['bestLeague'] = null;
    let worstLeague: TemplateRanking['worstLeague'] = null;

    const leagueRates = Array.from(byLeague.entries())
      .map(([name, lItems]) => ({ name, rate: calcRate(lItems), count: lItems.length }))
      .filter(l => l.rate !== null && l.count >= 3);

    if (leagueRates.length > 0) {
      leagueRates.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
      bestLeague = { name: leagueRates[0].name, successRate: leagueRates[0].rate!, count: leagueRates[0].count };
      if (leagueRates.length > 1) {
        const worst = leagueRates[leagueRates.length - 1];
        worstLeague = { name: worst.name, successRate: worst.rate!, count: worst.count };
      }
    }

    // Minute sub-analysis
    const byMinute = new Map<string, ProcessedMatch[]>();
    for (const i of items) {
      if (!byMinute.has(i.minuteRange)) byMinute.set(i.minuteRange, []);
      byMinute.get(i.minuteRange)!.push(i);
    }

    const minuteRates = Array.from(byMinute.entries())
      .map(([range, mItems]) => ({ range, rate: calcRate(mItems), count: mItems.length }))
      .filter(mr => mr.rate !== null && mr.count >= 3);

    minuteRates.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
    const bestMinuteRange = minuteRates.length > 0 ? minuteRates[0].range : null;

    templateRankings.push({
      templateId: key,
      templateName: items[0].templateName,
      evaluationType: evalType,
      totalTriggers: items.length,
      autoSuccessRate: calcRate(items),
      avgGoalsAdded: calcAvg(items.map(i => i.goalsAdded)),
      bestMinuteRange,
      bestLeague,
      worstLeague,
    });
  }

  templateRankings.sort((a, b) => (b.autoSuccessRate ?? 0) - (a.autoSuccessRate ?? 0));

  // ── 2. LEAGUE INSIGHTS ─────────────────────────────────────
  const byLeagueAll = new Map<string, ProcessedMatch[]>();
  for (const p of processed) {
    if (!byLeagueAll.has(p.league)) byLeagueAll.set(p.league, []);
    byLeagueAll.get(p.league)!.push(p);
  }

  const leagueInsights: LeagueInsight[] = [];
  for (const [league, items] of byLeagueAll) {
    if (items.length < 5) continue; // Need minimum data

    // Best/worst templates in this league
    const templatePerf = new Map<string, ProcessedMatch[]>();
    for (const i of items) {
      const key = i.templateId || i.templateName;
      if (!templatePerf.has(key)) templatePerf.set(key, []);
      templatePerf.get(key)!.push(i);
    }

    const templateRates = Array.from(templatePerf.entries())
      .map(([, tItems]) => ({
        name: tItems[0].templateName,
        successRate: calcRate(tItems) ?? 0,
        count: tItems.length,
      }))
      .filter(t => t.count >= 3);

    templateRates.sort((a, b) => b.successRate - a.successRate);

    leagueInsights.push({
      league,
      totalTriggers: items.length,
      avgGoalsAdded: calcAvg(items.map(i => i.goalsAdded)),
      autoSuccessRate: calcRate(items),
      bestTemplates: templateRates.slice(0, 3),
      worstTemplates: templateRates.slice(-3).reverse(),
    });
  }

  leagueInsights.sort((a, b) => b.totalTriggers - a.totalTriggers);

  // ── 3. MINUTE HEATMAP ──────────────────────────────────────
  const minuteRanges = ['1-30', '31-45', '46-55', '56-65', '66-75', '76+'];
  const byMinuteAll = new Map<string, ProcessedMatch[]>();
  for (const r of minuteRanges) byMinuteAll.set(r, []);
  for (const p of processed) {
    if (byMinuteAll.has(p.minuteRange)) {
      byMinuteAll.get(p.minuteRange)!.push(p);
    }
  }

  const minuteHeatmap: MinuteHeatmap[] = [];
  for (const range of minuteRanges) {
    const items = byMinuteAll.get(range) || [];
    if (items.length === 0) continue;

    // Top templates in this minute range
    const templatePerf = new Map<string, ProcessedMatch[]>();
    for (const i of items) {
      const key = i.templateId || i.templateName;
      if (!templatePerf.has(key)) templatePerf.set(key, []);
      templatePerf.get(key)!.push(i);
    }

    const topTemplates = Array.from(templatePerf.entries())
      .map(([, tItems]) => ({
        name: tItems[0].templateName,
        successRate: calcRate(tItems) ?? 0,
        count: tItems.length,
      }))
      .filter(t => t.count >= 3)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    minuteHeatmap.push({
      range,
      count: items.length,
      avgGoalsAdded: calcAvg(items.map(i => i.goalsAdded)),
      autoSuccessRate: calcRate(items),
      topTemplates,
    });
  }

  // ── 4. GOLDEN COMBOS ───────────────────────────────────────
  // Template + league + minute combos with >= 60% success and >= 5 samples
  const goldenCombos: GoldenCombo[] = [];
  const lowValueCombos: GoldenCombo[] = [];

  for (const p of processed) {
    // key = template + league + minuteRange
    p; // used in the loop below
  }

  const comboMap = new Map<string, ProcessedMatch[]>();
  for (const p of processed) {
    const key = `${p.templateId || p.templateName}|${p.league}|${p.minuteRange}`;
    if (!comboMap.has(key)) comboMap.set(key, []);
    comboMap.get(key)!.push(p);
  }

  for (const [key, items] of comboMap) {
    if (items.length < 4) continue;
    const rate = calcRate(items);
    if (rate === null) continue;

    const [templateKey, league, minuteRange] = key.split('|');
    const combo: GoldenCombo = {
      template: items[0].templateName,
      templateId: templateKey,
      league,
      minuteRange,
      successRate: rate,
      sampleSize: items.length,
      avgGoalsAdded: calcAvg(items.map(i => i.goalsAdded)) ?? 0,
    };

    if (rate >= 60) {
      goldenCombos.push(combo);
    } else if (rate <= 35) {
      lowValueCombos.push(combo);
    }
  }

  goldenCombos.sort((a, b) => b.successRate - a.successRate || b.sampleSize - a.sampleSize);
  lowValueCombos.sort((a, b) => a.successRate - b.successRate);

  // Also compute template+league combos (without minute constraint) for broader insights
  const templateLeagueMap = new Map<string, ProcessedMatch[]>();
  for (const p of processed) {
    const key = `${p.templateId || p.templateName}|${p.league}`;
    if (!templateLeagueMap.has(key)) templateLeagueMap.set(key, []);
    templateLeagueMap.get(key)!.push(p);
  }

  const leagueCombos: { template: string; templateId: string; league: string; successRate: number; sampleSize: number; avgGoalsAdded: number }[] = [];
  const lowLeagueCombos: typeof leagueCombos = [];

  for (const [key, items] of templateLeagueMap) {
    if (items.length < 5) continue;
    const rate = calcRate(items);
    if (rate === null) continue;

    const [templateKey, league] = key.split('|');
    const entry = {
      template: items[0].templateName,
      templateId: templateKey,
      league,
      successRate: rate,
      sampleSize: items.length,
      avgGoalsAdded: calcAvg(items.map(i => i.goalsAdded)) ?? 0,
    };

    if (rate >= 55) leagueCombos.push(entry);
    else if (rate <= 30) lowLeagueCombos.push(entry);
  }

  leagueCombos.sort((a, b) => b.successRate - a.successRate);
  lowLeagueCombos.sort((a, b) => a.successRate - b.successRate);

  return NextResponse.json({
    totalAnalyzed: processed.length,
    templateRankings: templateRankings.slice(0, 50),
    leagueInsights: leagueInsights.slice(0, 30),
    minuteHeatmap,
    goldenCombos: goldenCombos.slice(0, 30),
    lowValueCombos: lowValueCombos.slice(0, 20),
    leagueBestCombos: leagueCombos.slice(0, 30),
    leagueWorstCombos: lowLeagueCombos.slice(0, 20),
  });
}
