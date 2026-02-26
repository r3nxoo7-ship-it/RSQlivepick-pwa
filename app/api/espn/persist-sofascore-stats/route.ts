/**
 * POST /api/espn/persist-sofascore-stats
 *
 * Persists SofaScore match-stats to the espn_matches.sofascore_stats column so
 * the data survives scanner restarts and cold Vercel deploys.
 *
 * Called fire-and-forget from lib/sofascore-live-enricher after each enrichment.
 *
 * Body: { fixtureId: number, sofascore_stats: object }
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  let body: { fixtureId?: string | number; sofascore_stats?: object };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { fixtureId, sofascore_stats } = body;
  if (!fixtureId || !sofascore_stats) {
    return NextResponse.json({ error: 'fixtureId and sofascore_stats required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('espn_matches')
    .update({ sofascore_stats })
    .eq('id', String(fixtureId));

  if (error) {
    // Non-fatal — just return the error message for debugging
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
