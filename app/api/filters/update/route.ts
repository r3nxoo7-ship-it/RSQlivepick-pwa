import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { filterId, updates } = body;

    if (!filterId) {
      return NextResponse.json({ error: 'Missing filterId' }, { status: 400 });
    }

    console.log('✏️ API /filters/update: Updating filter:', filterId);

    // ============================================
    // CHECK IF FILTER IS EDITABLE
    // ============================================
    const { data: filter, error: fetchError } = await supabaseAdmin
      .from('filters')
      .select('*')
      .eq('id', filterId)
      .single();

    if (fetchError || !filter) {
      console.error('❌ Filter not found:', fetchError);
      return NextResponse.json(
        { error: 'Filter not found' },
        { status: 404 }
      );
    }

    // Check if filter is editable (forked filters can't edit original)
    if (filter.is_editable === false) {
      console.error('❌ This filter cannot be edited - it is a base filter');
      return NextResponse.json(
        {
          error: 'This filter cannot be edited',
          message: 'This is a read-only base filter. Import it to create your own editable version.',
        },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('filters')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', filterId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating filter:', error);
      return NextResponse.json(
        { error: error.message || 'Error updating filter' },
        { status: 400 }
      );
    }

    console.log('✅ Filter updated successfully');
    return NextResponse.json({ data, error: null });
  } catch (err) {
    console.error('❌ Error in /filters/update:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
