// ============================================
// R$Q - API DIAGNOSTIC SCRIPT
// ============================================
// Run this to check why matches aren't showing

// OPEN IN BROWSER:
// http://localhost:3000/api/diagnostic

import { NextResponse } from 'next/server';

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    checks: {},
  };
  
  // ==========================================
  // CHECK 1: Environment Variables
  // ==========================================
  
  results.checks.environment = {
    footballData: {
      configured: !!process.env.NEXT_PUBLIC_FOOTBALL_DATA_KEY,
      keyLength: process.env.NEXT_PUBLIC_FOOTBALL_DATA_KEY?.length || 0,
    },
    apiFootball: {
      configured: !!process.env.NEXT_PUBLIC_API_FOOTBALL_KEY,
      keyLength: process.env.NEXT_PUBLIC_API_FOOTBALL_KEY?.length || 0,
    },
  };
  
  // ==========================================
  // CHECK 2: Football-Data.org API
  // ==========================================
  
  try {
    const fdResponse = await fetch('https://api.football-data.org/v4/matches', {
      headers: {
        'X-Auth-Token': process.env.NEXT_PUBLIC_FOOTBALL_DATA_KEY || '',
      },
    });
    
    results.checks.footballDataAPI = {
      status: fdResponse.status,
      ok: fdResponse.ok,
      headers: {
        remaining: fdResponse.headers.get('X-Requests-Available-Month'),
        limit: fdResponse.headers.get('X-RequestCounter-Reset'),
      },
    };
    
    if (fdResponse.ok) {
      const data = await fdResponse.json();
      results.checks.footballDataAPI.matchesCount = data.matches?.length || 0;
      results.checks.footballDataAPI.sample = data.matches?.slice(0, 2) || [];
    } else {
      results.checks.footballDataAPI.error = await fdResponse.text();
    }
  } catch (error) {
    results.checks.footballDataAPI = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  // ==========================================
  // CHECK 3: API-Football
  // ==========================================
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const afResponse = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${today}&status=1H-2H-HT`,
      {
        headers: {
          'x-rapidapi-key': process.env.NEXT_PUBLIC_API_FOOTBALL_KEY || '',
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
      }
    );
    
    results.checks.apiFootball = {
      status: afResponse.status,
      ok: afResponse.ok,
    };
    
    if (afResponse.ok) {
      const data = await afResponse.json();
      results.checks.apiFootball.matchesCount = data.response?.length || 0;
      results.checks.apiFootball.requestsRemaining = data.requests?.remaining || 0;
      results.checks.apiFootball.sample = data.response?.slice(0, 2) || [];
    } else {
      results.checks.apiFootball.error = await afResponse.text();
    }
  } catch (error) {
    results.checks.apiFootball = {
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
  
  // ==========================================
  // CHECK 4: SofaScore direct tests from Vercel
  // ==========================================

  const today = new Date().toISOString().split('T')[0];
  const sfHeaders = {
    Accept: '*/*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Referer: 'https://www.sofascore.com/',
  };

  const ssTests = [
    { label: 'sofascore.ro/scheduled', url: `https://www.sofascore.ro/api/v1/sport/football/scheduled-events/${today}` },
    { label: 'sofascore.ro/live', url: 'https://www.sofascore.ro/api/v1/sport/football/events/live' },
    { label: 'sofascore.com/scheduled', url: `https://www.sofascore.com/api/v1/sport/football/scheduled-events/${today}` },
    { label: 'sofascore.com/live', url: 'https://www.sofascore.com/api/v1/sport/football/events/live' },
    { label: 'api.sofascore.com/live', url: 'https://api.sofascore.com/api/v1/sport/football/events/live' },
  ];

  results.checks.sofascore = {};
  await Promise.allSettled(
    ssTests.map(async ({ label, url }) => {
      try {
        const res = await fetch(url, { headers: sfHeaders, cache: 'no-store' });
        const body = res.ok ? await res.json() : null;
        results.checks.sofascore[label] = {
          status: res.status,
          ok: res.ok,
          count: body?.events?.length ?? 0,
        };
      } catch (e) {
        results.checks.sofascore[label] = {
          status: 0,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    })
  );

  // ==========================================
  // CHECK 5: Current Time & Expected Matches
  // ==========================================
  
  const now = new Date();
  results.checks.timing = {
    currentTime: now.toISOString(),
    dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
    hour: now.getHours(),
    expectedMatches: now.getHours() >= 12 && now.getHours() <= 23 ? 'YES' : 'MAYBE',
    note: 'Most matches are between 12:00-23:00 UTC',
  };
  
  // ==========================================
  // RECOMMENDATIONS
  // ==========================================
  
  results.recommendations = [];
  
  if (!results.checks.footballDataAPI.ok && !results.checks.apiFootball.ok) {
    results.recommendations.push('⚠️ BOTH APIs failing! Check API keys in .env.local');
  }
  
  if (results.checks.footballDataAPI.matchesCount === 0 && results.checks.apiFootball.matchesCount === 0) {
    results.recommendations.push('⚠️ No live matches found on either API. Check time/date.');
  }
  
  if (results.checks.apiFootball.requestsRemaining === 0) {
    results.recommendations.push('⚠️ API-Football daily limit reached (100 requests)');
  }
  
  if (results.checks.footballDataAPI.ok && results.checks.footballDataAPI.matchesCount > 0) {
    results.recommendations.push('✅ Football-Data.org working! Use this as primary.');
  }
  
  if (results.checks.apiFootball.ok && results.checks.apiFootball.matchesCount > 0) {
    results.recommendations.push('✅ API-Football working! Can use as fallback.');
  }
  
  return NextResponse.json(results, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
