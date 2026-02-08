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

    // First, verify the filter exists
    const { data: existingFilter, error: fetchError } = await supabaseAdmin
      .from('filters')
      .select('id, name, user_id')
      .eq('id', filterId)
      .single();

    if (fetchError) {
      console.error('❌ Filter not found or error fetching:', fetchError);
      return NextResponse.json(
        { error: 'Filter not found' },
        { status: 404 }
      );
    }

    console.log('📋 Found filter to delete:', existingFilter);

    // Perform the delete
    const { data: deletedData, error: deleteError, status, statusText } = await supabaseAdmin
      .from('filters')
      .delete()
      .eq('id', filterId)
      .select();

    console.log('📊 Delete response:', {
      deletedData,
      deleteError,
      status,
      statusText,
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
      console.error('⚠️ Delete returned success but no rows affected');
      return NextResponse.json(
        { error: 'Delete failed - no rows affected' },
        { status: 500 }
      );
    }

    console.log('✅ Filter deleted successfully:', deletedData[0]);
    return NextResponse.json({ error: null, deleted: deletedData[0] });
  } catch (err) {
    console.error('❌ Error in /filters/delete:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
