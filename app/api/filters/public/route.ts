import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

    // Fetch all public filters with user info
    const { data: filters, error } = await supabaseAdmin
      .from('filters')
      .select('*')
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
    return NextResponse.json({ data: filters || [], error: null });
  } catch (err) {
    console.error('❌ Error in /filters/public:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
