import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    console.log('🔬 DIAGNOSTIC: Checking filters for user:', userId);

    // RAW SQL query to bypass ALL caching
    const { data: rawResult, error: rawError } = await supabaseAdmin
      .rpc('exec_sql', {
        query: `SELECT COUNT(*) as count,
                       COUNT(CASE WHEN is_active THEN 1 END) as active_count,
                       COUNT(CASE WHEN NOT is_active THEN 1 END) as inactive_count
                FROM filters
                WHERE user_id = '${userId}'`
      });

    if (rawError) {
      console.error('Raw SQL failed, trying direct query');

      // Fallback: Direct query with explicit cache bypass
      const { data, error } = await supabaseAdmin
        .from('filters')
        .select('id, name, is_active, created_at')
        .eq('user_id', userId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const activeCount = data?.filter(f => f.is_active).length || 0;
      const inactiveCount = data?.filter(f => !f.is_active).length || 0;

      return NextResponse.json({
        method: 'direct_query',
        total: data?.length || 0,
        active: activeCount,
        inactive: inactiveCount,
        filters: data?.map(f => ({
          id: f.id.substring(0, 8),
          name: f.name,
          is_active: f.is_active,
          created_at: f.created_at,
        })),
      });
    }

    return NextResponse.json({
      method: 'raw_sql',
      result: rawResult,
    });

  } catch (err) {
    console.error('❌ Diagnostic error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
