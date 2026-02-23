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

    // If combining filters, merge their conditions into one
    let finalConditions = conditions || {};
    if (isCombiningFilters) {
      const { data: sourceFilters, error: srcErr } = await supabaseAdmin
        .from('filters')
        .select('id, name, conditions')
        .in('id', combined_filter_ids)
        .eq('user_id', user_id);

      if (srcErr || !sourceFilters || sourceFilters.length === 0) {
        return NextResponse.json(
          { error: 'Could not load source filters to combine' },
          { status: 400 }
        );
      }

      // Merge: for each condition key, use the strictest values (highest min, lowest max)
      const merged: Record<string, any> = {};
      for (const sf of sourceFilters) {
        const conds = sf.conditions || {};
        for (const [key, value] of Object.entries(conds)) {
          if (!value || typeof value !== 'object') continue;
          if (!merged[key]) {
            merged[key] = JSON.parse(JSON.stringify(value));
          } else {
            mergeCondition(merged, key, value);
          }
        }
      }

      finalConditions = merged;
      console.log('✅ Merged conditions from', sourceFilters.length, 'filters:', Object.keys(finalConditions));
    }

    // Insert filter using admin client (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('filters')
      .insert([{
        user_id,
        name,
        description: description || `Combined from ${combined_filter_ids?.length || 0} filters`,
        conditions: finalConditions,
        is_active: is_active || false,
        is_shared: false,
        is_public: is_public || false, // Default to private (false)
        notification_enabled: notification_enabled && (isCombiningFilters || conditionsComplete),
        telegram_enabled: telegram_enabled && (isCombiningFilters || conditionsComplete),
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

/**
 * Merge a condition value into the merged object.
 * Uses AND logic: take the strictest bounds (highest min, lowest max).
 * Handles both flat { min, max } and nested { home: { min, max }, away: { min, max }, total: { min, max } }
 */
function mergeCondition(merged: Record<string, any>, key: string, incoming: any) {
  const existing = merged[key];
  if (!existing || !incoming) return;

  // Check if it's a nested structure (home/away/total) or flat (min/max)
  const nestedKeys = ['home', 'away', 'total'];
  const isNested = nestedKeys.some(k => incoming[k] !== undefined || existing[k] !== undefined);

  if (isNested) {
    for (const subKey of nestedKeys) {
      if (incoming[subKey]) {
        if (!existing[subKey]) {
          existing[subKey] = { ...incoming[subKey] };
        } else {
          mergeRange(existing[subKey], incoming[subKey]);
        }
      }
    }
  } else {
    // Flat condition: merge min/max directly
    mergeRange(existing, incoming);
  }

  // Also handle special fields like 'between', 'after', 'before', 'exact', 'dominant'
  if (incoming.between) existing.between = incoming.between;
  if (incoming.after !== undefined) {
    existing.after = Math.max(existing.after ?? 0, incoming.after);
  }
  if (incoming.before !== undefined) {
    existing.before = existing.before !== undefined
      ? Math.min(existing.before, incoming.before)
      : incoming.before;
  }
  if (incoming.exact) existing.exact = incoming.exact;
  if (incoming.dominant) existing.dominant = incoming.dominant;
}

function mergeRange(target: any, source: any) {
  if (source.min !== undefined) {
    target.min = target.min !== undefined ? Math.max(target.min, source.min) : source.min;
  }
  if (source.max !== undefined) {
    target.max = target.max !== undefined ? Math.min(target.max, source.max) : source.max;
  }
}
