import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/triggered-matches/feedback
 * Save user feedback (thumbs up/down) for a triggered match
 *
 * Body: { triggered_match_id: string, user_id: string, feedback: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { triggered_match_id, user_id, feedback } = body;

    if (!triggered_match_id || !user_id || typeof feedback !== 'boolean') {
      return NextResponse.json(
        { error: 'triggered_match_id, user_id, and feedback (boolean) are required' },
        { status: 400 }
      );
    }

    // Update the triggered match with feedback
    const { data, error } = await supabaseAdmin
      .from('triggered_matches')
      .update({
        user_feedback: feedback,
        feedback_at: new Date().toISOString(),
      })
      .eq('id', triggered_match_id)
      .eq('user_id', user_id)
      .select('id, filter_id, user_feedback')
      .single();

    if (error) {
      console.error('[feedback] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recalculate success_rate for this filter based on all feedback
    const filterId = data.filter_id;
    await recalculateSuccessRate(filterId, user_id);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[feedback] Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Recalculate filter success_rate from actual user feedback
 * Formula: (positive_feedback / total_feedback) * 100
 * If no feedback exists, keeps the current rate
 */
async function recalculateSuccessRate(filterId: string, userId: string) {
  const { data: triggers } = await supabaseAdmin
    .from('triggered_matches')
    .select('id, user_feedback')
    .eq('filter_id', filterId)
    .eq('user_id', userId)
    .not('user_feedback', 'is', null);

  if (!triggers || triggers.length === 0) return;

  const positive = triggers.filter(t => t.user_feedback === true).length;
  const total = triggers.length;
  const successRate = Math.round((positive / total) * 10000) / 100;

  await supabaseAdmin
    .from('filters')
    .update({
      success_rate: successRate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', filterId);
}
