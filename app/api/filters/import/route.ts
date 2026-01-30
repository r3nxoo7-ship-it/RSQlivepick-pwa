import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create server-side Supabase client with SERVICE ROLE key (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * Import a public filter (fork/clone) - creates v2.0 of the filter
 * Only copies conditions, not trigger_count/success_rate (those reset per user)
 * Creates an independent copy that user can edit
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { source_filter_id, user_id } = body;

    // Validate inputs
    if (!source_filter_id || !user_id || user_id === 'anon') {
      console.error('❌ API: Invalid import parameters');
      return NextResponse.json(
        { error: 'Invalid import parameters' },
        { status: 400 }
      );
    }

    console.log('📝 API /filters/import: Importing filter', source_filter_id, 'for user:', user_id);

    // ============================================
    // FETCH SOURCE FILTER
    // ============================================
    const { data: sourceFilter, error: fetchError } = await supabaseAdmin
      .from('filters')
      .select('*')
      .eq('id', source_filter_id)
      .single();

    if (fetchError || !sourceFilter) {
      console.error('❌ Source filter not found:', fetchError);
      return NextResponse.json(
        { error: 'Source filter not found' },
        { status: 404 }
      );
    }

    // Verify source filter is public
    if (!sourceFilter.is_public) {
      console.error('❌ Source filter is not public');
      return NextResponse.json(
        { error: 'This filter is private and cannot be imported' },
        { status: 403 }
      );
    }

    console.log('✅ Source filter found:', sourceFilter.name);

    // ============================================
    // CHECK IF USER ALREADY HAS THIS FILTER
    // ============================================
    const { data: userFilters, error: userFilterError } = await supabaseAdmin
      .from('filters')
      .select('*')
      .eq('user_id', user_id);

    if (userFilterError) {
      console.error('❌ Error fetching user filters:', userFilterError);
      return NextResponse.json(
        { error: 'Error validating filters' },
        { status: 500 }
      );
    }

    // Check if user already imported this exact filter
    const existingImport = userFilters?.find(f => f.forked_from_id === source_filter_id);
    if (existingImport) {
      console.warn('⚠️ User already imported this filter');
      return NextResponse.json(
        {
          error: 'You already have this filter imported',
          message: `Filter "${existingImport.name}" is already in your library`,
          existingFilterId: existingImport.id,
        },
        { status: 409 }
      );
    }

    // ============================================
    // CREATE FORK (v2.0) OF THE FILTER
    // ============================================
    const sourceUsername = sourceFilter.user_id; // In production, fetch from users table
    const newFilterName = `${sourceFilter.name} (v2.0)`;

    const { data: newFilter, error: insertError } = await supabaseAdmin
      .from('filters')
      .insert([{
        user_id,
        name: newFilterName,
        description: sourceFilter.description,
        conditions: sourceFilter.conditions, // Copy conditions
        is_active: false, // Imported filters start as inactive
        is_shared: false,
        is_public: false, // Imported filters are private by default
        notification_enabled: false, // User must enable notifications
        telegram_enabled: false, // User must enable telegram
        // Versioning & Forking Info
        forked_from_id: source_filter_id, // Link to original
        forked_from_user: sourceUsername, // Record original creator
        version: 2, // Forked filters start at v2.0
        is_editable: true, // User can edit their imported version
        // Reset stats for new user
        trigger_count: 0,
        success_rate: null,
        last_triggered: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating imported filter:', insertError);
      return NextResponse.json(
        { error: insertError.message || 'Error importing filter' },
        { status: 500 }
      );
    }

    console.log('✅ Filter imported successfully:', newFilter.id);
    return NextResponse.json({ data: newFilter, error: null });
  } catch (err) {
    console.error('❌ Error in /filters/import:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
