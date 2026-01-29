import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
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
    const { user_id, name, description, conditions, is_active, notification_enabled, telegram_enabled } = body;

    // Validate user_id
    if (!user_id || user_id === 'anon' || typeof user_id !== 'string') {
      console.error('❌ API: Invalid user_id:', user_id);
      return NextResponse.json(
        { error: 'Invalid user authentication' },
        { status: 401 }
      );
    }

    console.log('📝 API /filters/create: Creating filter for user:', user_id);

    // ============================================
    // VALIDATION 1: CONDITIONS
    // ============================================
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

    // ============================================
    // VALIDATION 2: COMPLETE CONDITIONS
    // ============================================
    const conditionsComplete = areConditionsComplete(conditions);
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
        notification_enabled: notification_enabled && conditionsComplete,
        telegram_enabled: telegram_enabled && conditionsComplete,
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
