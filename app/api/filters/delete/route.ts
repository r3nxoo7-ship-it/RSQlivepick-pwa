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

    // Perform the delete directly - let Supabase handle existence check
    const { data: deletedData, error: deleteError, count } = await supabaseAdmin
      .from('filters')
      .delete()
      .eq('id', filterId)
      .select();

    console.log('📊 Delete response:', {
      deletedData,
      deleteError,
      count,
      deletedCount: deletedData?.length || 0
    });

    if (deleteError) {
      console.error('❌ Error deleting filter:', deleteError);
      return NextResponse.json(
        { error: deleteError.message || 'Error deleting filter' },
        { status: 400 }
      );
    }

    if (!deletedData || deletedData.length === 0) {
      console.error('⚠️ Delete query succeeded but no rows were deleted - filter may not exist');
      console.error('⚠️ Filter ID attempted:', filterId);
      return NextResponse.json(
        { error: 'Filter not found or already deleted' },
        { status: 404 }
      );
    }

    console.log('✅ Filter deleted successfully:', deletedData[0]);
    console.log('🗑️ Deleted filter ID:', deletedData[0].id, 'Name:', deletedData[0].name);
    return NextResponse.json({ error: null, deleted: deletedData[0] });
  } catch (err) {
    console.error('❌ Error in /filters/delete:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
