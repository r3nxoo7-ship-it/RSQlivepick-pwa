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
      console.warn('⚠️ Filter not found (already deleted), treating as success:', filterId);
      // Return 200 OK even if already deleted (idempotent behavior)
      // This prevents bulk delete operations from failing
      return NextResponse.json({ error: null });
    }

    console.log('✅ Filter exists, proceeding with delete:', filterId);

    // Delete the filter
    const { error, count } = await supabaseAdmin
      .from('filters')
      .delete()
      .eq('id', filterId)
      .select();

    if (error) {
      console.error('❌ Error deleting filter:', error);
      return NextResponse.json(
        { error: error.message || 'Error deleting filter' },
        { status: 400 }
      );
    }

    console.log('✅ Filter deleted successfully:', filterId, 'Rows affected:', count);
    
    // Add a longer delay before returning to ensure the delete is fully committed
    // and propagated to any read replicas (increased from 100ms to 300ms)
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return NextResponse.json({ error: null });
  } catch (err) {
    console.error('❌ Error in /filters/delete:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
