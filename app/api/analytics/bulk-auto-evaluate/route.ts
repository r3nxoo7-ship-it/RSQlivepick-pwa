import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { computeAutoSuccess, getEvaluationType } from '@/lib/analytics';
import { RAW_TEMPLATES } from '@/lib/filter-templates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Build template evaluationType lookup
const templateEvalMap = new Map<string, ReturnType<typeof getEvaluationType>>();
for (const t of RAW_TEMPLATES) {
  templateEvalMap.set(t.id, t.evaluationType);
}

/**
 * POST /api/analytics/bulk-auto-evaluate
 *
 * Retroactively computes auto_success for all finished triggered matches.
 * Uses the user's evaluation criteria:
 *   - If triggered at min 1-55: success if goals_added >= 2
 *   - If triggered at min 56+:  success if goals_added >= 1
 *   - Excluded templates (defensive/under/draw) get separate logic
 *
 * Body: { user_id: string }
 * Returns: { evaluated, skipped, successCount, failCount }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { user_id } = body;

  if (!user_id) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  }

  // Get all finished triggered matches with final scores
  const { data: matches, error } = await supabase
    .from('triggered_matches')
    .select('id, filter_id, filter_name, match_time, score_home, score_away, final_score_home, final_score_away')
    .eq('user_id', user_id)
    .eq('match_status', 'finished')
    .not('final_score_home', 'is', null)
    .not('final_score_away', 'is', null)
    .limit(10000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ evaluated: 0, skipped: 0, successCount: 0, failCount: 0, message: 'No matches to evaluate' });
  }

  // Look up template_id for each filter
  const filterIds = [...new Set(matches.map(m => m.filter_id))];
  const { data: filters } = await supabase
    .from('filters')
    .select('id, template_id, name')
    .in('id', filterIds);

  const filterTemplateMap = new Map<string, string>();
  const filterNameMap = new Map<string, string>();
  for (const f of filters || []) {
    if (f.template_id) filterTemplateMap.set(f.id, f.template_id);
    filterNameMap.set(f.id, f.name);
  }

  let evaluated = 0;
  let skipped = 0;
  let successCount = 0;
  let failCount = 0;

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize);
    const updates: { id: string; auto_success: boolean | null }[] = [];

    for (const m of batch) {
      const templateId = filterTemplateMap.get(m.filter_id);
      const filterName = filterNameMap.get(m.filter_id) || m.filter_name;
      const evalType = templateId
        ? (templateEvalMap.get(templateId) || getEvaluationType(templateId, filterName))
        : getEvaluationType(undefined, filterName);

      const result = computeAutoSuccess(
        m.match_time,
        m.score_home,
        m.score_away,
        m.final_score_home,
        m.final_score_away,
        evalType
      );

      if (result !== null) {
        updates.push({ id: m.id, auto_success: result });
        evaluated++;
        if (result) successCount++;
        else failCount++;
      } else {
        skipped++;
      }
    }

    // Bulk update this batch
    for (const u of updates) {
      await supabase
        .from('triggered_matches')
        .update({ auto_success: u.auto_success })
        .eq('id', u.id);
    }
  }

  // Recalculate success rates for all filters using effective success
  for (const filterId of filterIds) {
    const { data: allTriggers } = await supabase
      .from('triggered_matches')
      .select('user_feedback, auto_success')
      .eq('filter_id', filterId)
      .eq('user_id', user_id);

    if (!allTriggers || allTriggers.length === 0) continue;

    // Count effective successes: user_feedback overrides auto_success
    let ratedCount = 0;
    let positiveCount = 0;
    for (const t of allTriggers) {
      const effective = t.user_feedback ?? t.auto_success;
      if (effective !== null && effective !== undefined) {
        ratedCount++;
        if (effective === true) positiveCount++;
      }
    }

    if (ratedCount >= 2) {
      const successRate = Math.round((positiveCount / ratedCount) * 10000) / 100;
      await supabase
        .from('filters')
        .update({ success_rate: successRate, updated_at: new Date().toISOString() })
        .eq('id', filterId);
    }
  }

  return NextResponse.json({
    evaluated,
    skipped,
    successCount,
    failCount,
    successRate: evaluated > 0 ? Math.round((successCount / evaluated) * 100) : null,
    message: `Auto-evaluated ${evaluated} matches. ${successCount} good, ${failCount} bad. ${skipped} skipped.`,
  });
}
