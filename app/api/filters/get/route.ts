import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this route uses request parameters
export const dynamic = 'force-dynamic';

// Create server-side Supabase client with SERVICE ROLE key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables on server!');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId || userId === 'anon' || typeof userId !== 'string') {
      console.error('❌ API: Invalid user_id:', userId);
      return NextResponse.json(
        { error: 'Invalid user authentication' },
        { status: 401 }
      );
    }

    console.log('📖 API /filters/get: Reading filters for user:', userId);

    const { data, error } = await supabaseAdmin
      .from('filters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error reading filters:', error);
      return NextResponse.json(
        { error: error.message || 'Error reading filters' },
        { status: 400 }
      );
    }

    console.log('✅ Filters read successfully:', data?.length || 0);
    return NextResponse.json({ data: data || [], error: null });
  } catch (err) {
    console.error('❌ Error in /filters/get:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
