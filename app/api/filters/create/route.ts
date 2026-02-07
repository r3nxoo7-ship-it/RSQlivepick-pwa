import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this route uses request parameters
export const dynamic = 'force-dynamic';
import { 
  validateFilterConditions, 
  checkDuplicate, 
  areConditionsComplete 
} from '@/lib/filter-validation';

// Create server-side Supabase client with SERVICE ROLE key (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: NextRequest) {
  try {
    // Get current user from localStorage (sent in request body)
    const body = await request.json();
    const { user_id, name, description, conditions, is_active, notification_enabled, telegram_enabled, is_public, combined_filter_ids } = body;

    // Validate user_id
    if (!user_id || user_id === 'anon' || typeof user_id !== 'string') {
      console.error('❌ API: Invalid user_id:', user_id);
      return NextResponse.json(
        { error: 'Invalid user authentication' },
        { status: 401 }
      );
    }

    console.log('📝 API /filters/create: Creating filter for user:', user_id);
    console.log('📝 Combined filter IDs:', combined_filter_ids);

    // ============================================
    // VALIDATION 1: CONDITIONS
    // ============================================
    // Skip condition validation if combining existing filters
    const isCombiningFilters = combined_filter_ids && Array.isArray(combined_filter_ids) && combined_filter_ids.length > 0;
    
    if (!isCombiningFilters) {
      const conditionValidation = validateFilterConditions(conditions);
      if (!conditionValidation.isValid) {
        console.warn('⚠️ Invalid filter conditions:', conditionValidation.errors);
        return NextResponse.json(
          { 
            error: 'Invalid filter conditions', 
            details: conditionValidation.errors,
            warnings: conditionValidation.warnings 
          },
          { status: 400 }
        );
      }
    } else {
      console.log('✅ Skipping condition validation - combining existing filters');
    }

    // ============================================
    // VALIDATION 2: COMPLETE CONDITIONS
    // ============================================
    // Skip completeness check if combining filters
    let conditionsComplete = true;
    if (!isCombiningFilters) {
      conditionsComplete = areConditionsComplete(conditions);
      if (!conditionsComplete && notification_enabled) {
        console.warn('⚠️ Cannot enable notifications with incomplete conditions');
        return NextResponse.json(
          { 
            error: 'Notifications require complete conditions',
            details: ['Define at least one value (min or max) for a condition']
          },
        { status: 400 }
        );
      }
    } else {
      console.log('✅ Skipping completeness check - combining existing filters');
    }

    // ============================================
    // VALIDATION 3: DUPLICATES
    // ============================================
    // Obtener todos los filtros del usuario
    const { data: existingFilters, error: fetchError } = await supabaseAdmin
      .from('filters')
      .select('*')
      .eq('user_id', user_id);

    if (fetchError) {
      console.error('❌ Error fetching existing filters:', fetchError);
      return NextResponse.json(
        { error: 'Error validating duplicate filters' },
        { status: 500 }
      );
    }

    const duplicateCheck = checkDuplicate(
      { name, conditions },
      existingFilters || []
    );

    if (duplicateCheck.isDuplicate) {
      console.warn('⚠️ Duplicate filter detected:', duplicateCheck.reason);
      return NextResponse.json(
        { 
          error: 'Duplicate filter',
          message: duplicateCheck.reason,
          existingFilterId: duplicateCheck.existingFilter?.id
        },
        { status: 409 } // Conflict status code
      );
    }

    console.log('✅ All validations passed');

    // Insert filter using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('filters')
      .insert([{
        user_id,
        name,
        description: description || null,
        conditions,
        is_active: is_active || false,
        is_shared: false,
        is_public: is_public || false, // Default to private (false)
        notification_enabled: notification_enabled && conditionsComplete,
        telegram_enabled: telegram_enabled && conditionsComplete,
        version: 1, // New filters start at v1.0
        is_editable: true, // User's own filters are always editable
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating filter:', error);
      return NextResponse.json(
        { error: error.message || 'Error creating filter' },
        { status: 400 }
      );
    }

    console.log('✅ Filter created successfully:', data.id);
    return NextResponse.json({ data, error: null });
  } catch (err) {
    console.error('❌ Error in /filters/create:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
