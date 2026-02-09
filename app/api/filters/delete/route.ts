import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this route uses request parameters
export const dynamic = 'force-dynamic';

// Singleton client (REVERT to original approach)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterId = searchParams.get('filterId');

    if (!filterId) {
      return NextResponse.json({ error: 'Missing filterId' }, { status: 400 });
    }

    console.log('🗑️ API /filters/delete: Deleting filter:', filterId);

    // First verify the filter exists before deleting
    const { data: existingFilter, error: checkError } = await supabaseAdmin
      .from('filters')
      .select('id')
      .eq('id', filterId)
      .limit(1);

    if (checkError || !existingFilter || existingFilter.length === 0) {
      console.warn('⚠️ Filter not found (already deleted):', filterId);
      return NextResponse.json(
        { error: 'Filter not found' },
        { status: 404 }
      );
    }

    // Delete the filter
    const { error } = await supabaseAdmin
      .from('filters')
      .delete()
      .eq('id', filterId);

    if (error) {
      console.error('❌ Error deleting filter:', error);
      return NextResponse.json(
        { error: error.message || 'Error deleting filter' },
        { status: 400 }
      );
    }

    console.log('✅ Filter deleted successfully:', filterId);
    return NextResponse.json({ error: null });
  } catch (err) {
    console.error('❌ Error in /filters/delete:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
