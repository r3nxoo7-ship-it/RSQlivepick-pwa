/**
 * GET /api/odds/upcoming
 *
 * Fetches today's pre-match (NS) odds from API-Football.
 * Returns a map keyed by normalized team pair so the client can match
 * against ESPN upcoming matches by team names.
 *
 * Response shape:
 *   {
 *     success: boolean,
 *     oddsMap: Record<string, ParsedBookmakerOdds & { homeTeam: string; awayTeam: string; fixtureId: number }>,
 *     date: string
 *   }
 *
 * Key format: normalizeKey(homeTeam, awayTeam)
 *   e.g. "racing genk|dinamo zagreb"
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// Cache for 5 minutes — odds don't change that often before KO
export const revalidate = 300;

const API_KEY  = process.env.NEXT_PUBLIC_API_FOOTBALL_KEY;
const API_HOST = process.env.NEXT_PUBLIC_API_FOOTBALL_HOST || 'v3.football.api-sports.io';

interface ParsedEntry {
  homeTeam: string;
  awayTeam: string;
  fixtureId: number;
  home_win?: number;
  draw?: number;
  away_win?: number;
  goals_over_2_5?: number;
  goals_under_2_5?: number;
  asian_handicap_home_odd?: number;
  asian_handicap_away_odd?: number;
  asian_handicap_line?: number;
}

function normKey(home: string, away: string) {
  const clean = (s: string) =>
    s.trim()
      .toLowerCase()
      .replace(/[-_.']/g, ' ')   // hyphens, dots, apostrophes → space
      .replace(/\s+/g, ' ')       // collapse multiple spaces
      .trim();
  return `${clean(home)}|${clean(away)}`;
}

/** Extra variant: strips trailing 's' from each word to catch "Sports" vs "Sport" differences */
function normKeyLoose(home: string, away: string) {
  const clean = (s: string) =>
    s.trim()
      .toLowerCase()
      .replace(/[-_.']/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b(\w+)s\b/g, '$1') // strip trailing s from each word
      .trim();
  return `${clean(home)}|${clean(away)}`;
}

function parseBookmakerBets(bets: any[]): Partial<ParsedEntry> {
  const out: Partial<ParsedEntry> = {};
  for (const bet of bets) {
    const name: string = bet.name || '';
    const values: Array<{ value: string; odd: string | number }> = bet.values || [];

    if (name === 'Match Winner') {
      for (const v of values) {
        const odd = typeof v.odd === 'string' ? parseFloat(v.odd) : v.odd;
        if (v.value === 'Home') out.home_win = odd;
        if (v.value === 'Draw') out.draw = odd;
        if (v.value === 'Away') out.away_win = odd;
      }
    }

    if (name.includes('Goals Over/Under') || name === 'Over/Under' || name.includes('Total Goals')) {
      for (const v of values) {
        const m = String(v.value).match(/^(Over|Under)\s+([\d.]+)$/);
        if (m && parseFloat(m[2]) === 2.5) {
          const odd = typeof v.odd === 'string' ? parseFloat(v.odd) : v.odd;
          if (m[1] === 'Over')  out.goals_over_2_5  = odd;
          if (m[1] === 'Under') out.goals_under_2_5 = odd;
        }
      }
    }

    if (name === 'Asian Handicap' || name.includes('Asian Handicap')) {
      for (const v of values) {
        const homeM = String(v.value).match(/^Home\s+([+-]?\d+\.?\d*)$/);
        const awayM = String(v.value).match(/^Away\s+([+-]?\d+\.?\d*)$/);
        const odd = typeof v.odd === 'string' ? parseFloat(v.odd) : v.odd;
        if (homeM) { out.asian_handicap_home_odd = odd; out.asian_handicap_line = parseFloat(homeM[1]); }
        if (awayM) { out.asian_handicap_away_odd = odd; }
      }
    }
  }
  return out;
}

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ success: false, error: 'API key not configured', oddsMap: {} });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const url = `https://${API_HOST}/odds?date=${today}&timezone=Europe/London`;
    const res = await fetch(url, {
      headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': API_HOST },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `API error ${res.status}`, oddsMap: {} });
    }

    const data = await res.json();
    const responses: any[] = data.response || [];

    const oddsMap: Record<string, ParsedEntry> = {};

    for (const item of responses) {
      const fix = item.fixture;
      const homeTeam: string = item.teams?.home?.name || '';
      const awayTeam: string = item.teams?.away?.name || '';
      if (!homeTeam || !awayTeam) continue;

      // Use first bookmaker's bets
      const bookmakers: any[] = item.bookmakers || [];
      if (bookmakers.length === 0) continue;
      const bets: any[] = bookmakers[0].bets || [];

      const parsed = parseBookmakerBets(bets);

      const entry: ParsedEntry = {
        homeTeam,
        awayTeam,
        fixtureId: fix?.id || 0,
        ...parsed,
      };

      oddsMap[normKey(homeTeam, awayTeam)] = entry;
      // Also store a loose variant so ESPN name mismatches still match
      const looseKey = normKeyLoose(homeTeam, awayTeam);
      if (looseKey !== normKey(homeTeam, awayTeam)) {
        oddsMap[looseKey] = entry;
      }
    }

    return NextResponse.json(
      { success: true, oddsMap, date: today, count: Object.keys(oddsMap).length },
      { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=60' } }
    );
  } catch (err: any) {
    console.error('[/api/odds/upcoming] Error:', err);
    return NextResponse.json({ success: false, error: err.message, oddsMap: {} });
  }
}
