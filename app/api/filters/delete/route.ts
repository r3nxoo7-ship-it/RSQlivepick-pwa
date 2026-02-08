import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this route uses request parameters
export const dynamic = 'force-dynamic';

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

    // Use count to verify deletion actually happened
    const { error, count } = await supabaseAdmin
      .from('filters')
      .delete({ count: 'exact' })
      .eq('id', filterId);

    console.log('📊 Delete result - Error:', error, 'Count:', count);

    if (error) {
      console.error('❌ Error deleting filter:', error);
      return NextResponse.json(
        { error: error.message || 'Error deleting filter' },
        { status: 400 }
      );
    }

    // Check if any rows were actually deleted
    if (count === 0) {
      console.error('⚠️ DELETE succeeded but 0 rows affected - RLS policy or filter not found');
      return NextResponse.json(
        { error: 'Filter not found or permission denied' },
        { status: 404 }
      );
    }

    console.log('✅ Filter deleted successfully - Rows affected:', count);
    return NextResponse.json({ error: null, count });
  } catch (err) {
    console.error('❌ Error in /filters/delete:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
