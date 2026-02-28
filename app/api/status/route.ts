/**
 * GET /api/status
 * 
 * Returns API status check from unified API
 * Server-side only to avoid CORS issues
 */
import { NextResponse } from 'next/server';
import { checkAPIStatus } from '@/lib/unified-api';

export async function GET() {
  try {
    const status = await checkAPIStatus();
    return NextResponse.json(status, { 
      headers: { 
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' 
      } 
    });
  } catch (error) {
    console.error('[API] /api/status error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check API status',
        primary: 'unknown',
        available: []
      },
      { status: 500 }
    );
  }
}
