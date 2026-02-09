import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering - this route uses request parameters
export const dynamic = 'force-dynamic';

// Disable all caching for this route (Vercel-compatible)
export const revalidate = 0;

// Singleton client with connection pooling (REVERT to original approach)
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

    // Use wildcard select instead of explicit fields to avoid query-level caching
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

    // Return with extremely aggressive cache control to prevent Vercel edge caching
    // This response must never be cached - data changes frequently
    return NextResponse.json(
      { data: data || [], error: null },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'CDN-Cache-Control': 'no-cache',
          'Vary': '*',
          'X-Content-Type-Options': 'nosniff',
          'X-timestamp': new Date().toISOString(),
          // Tell Vercel to not cache this at all
          'X-Vercel-Cache': 'BYPASS',
        }
      }
    );
  } catch (err) {
    console.error('❌ Error in /filters/get:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
