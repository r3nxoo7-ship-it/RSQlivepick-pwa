import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache public filters for 5 minutes (they change infrequently)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * Get all public filters that can be imported by users
 * Returns: filter data + creator username (for display)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📝 API /filters/public: Fetching all public filters');

    // Fetch only needed columns to reduce bandwidth
    // Note: Optional columns (color, template_id, version) will be added via migration
    const { data: filters, error } = await supabaseAdmin
      .from('filters')
      .select('id, user_id, name, description, conditions, is_active, is_public, notification_enabled, trigger_count, success_rate, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching public filters:', error);
      return NextResponse.json(
        { error: 'Error fetching public filters' },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${filters?.length || 0} public filters`);
    return NextResponse.json({ data: filters || [], error: null }, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=300',
      }
    });
  } catch (err) {
    console.error('❌ Error in /filters/public:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
