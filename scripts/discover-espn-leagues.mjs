#!/usr/bin/env node
// ============================================
// ESPN Soccer League Discovery Script
// ============================================
// Run with: node scripts/discover-espn-leagues.mjs
// Tests all known/suspected ESPN soccer league codes against the scoreboard endpoint
// and reports which ones return valid data.

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

// Comprehensive list of candidate league codes to test
const CANDIDATE_LEAGUES = [
  // ====== ENGLAND ======
  { code: 'eng.1', name: 'Premier League' },
  { code: 'eng.2', name: 'EFL Championship' },
  { code: 'eng.3', name: 'EFL League One' },
  { code: 'eng.4', name: 'EFL League Two' },
  { code: 'eng.5', name: 'National League' },
  { code: 'eng.league_cup', name: 'EFL Cup (Carabao Cup)' },
  { code: 'eng.fa', name: 'FA Cup' },
  { code: 'eng.trophy', name: 'EFL Trophy' },
  { code: 'eng.community_shield', name: 'Community Shield' },

  // ====== SPAIN ======
  { code: 'esp.1', name: 'La Liga' },
  { code: 'esp.2', name: 'La Liga 2' },
  { code: 'esp.copa_del_rey', name: 'Copa del Rey' },
  { code: 'esp.super_cup', name: 'Spanish Super Cup' },

  // ====== ITALY ======
  { code: 'ita.1', name: 'Serie A' },
  { code: 'ita.2', name: 'Serie B' },
  { code: 'ita.coppa_italia', name: 'Coppa Italia' },
  { code: 'ita.super_cup', name: 'Italian Super Cup' },

  // ====== GERMANY ======
  { code: 'ger.1', name: 'Bundesliga' },
  { code: 'ger.2', name: '2. Bundesliga' },
  { code: 'ger.3', name: '3. Liga' },
  { code: 'ger.dfb_pokal', name: 'DFB Pokal' },
  { code: 'ger.super_cup', name: 'DFL Supercup' },

  // ====== FRANCE ======
  { code: 'fra.1', name: 'Ligue 1' },
  { code: 'fra.2', name: 'Ligue 2' },
  { code: 'fra.coupe_de_france', name: 'Coupe de France' },
  { code: 'fra.coupe_de_la_ligue', name: 'Coupe de la Ligue' },

  // ====== NETHERLANDS ======
  { code: 'ned.1', name: 'Eredivisie' },
  { code: 'ned.2', name: 'Eerste Divisie' },
  { code: 'ned.cup', name: 'KNVB Cup' },

  // ====== PORTUGAL ======
  { code: 'por.1', name: 'Primeira Liga' },
  { code: 'por.2', name: 'Liga Portugal 2' },
  { code: 'por.cup', name: 'Taca de Portugal' },

  // ====== BELGIUM ======
  { code: 'bel.1', name: 'Belgian Pro League' },
  { code: 'bel.2', name: 'Belgian First Division B' },

  // ====== SCOTLAND ======
  { code: 'sco.1', name: 'Scottish Premiership' },
  { code: 'sco.2', name: 'Scottish Championship' },
  { code: 'sco.league_cup', name: 'Scottish League Cup' },
  { code: 'sco.fa', name: 'Scottish Cup' },

  // ====== TURKEY ======
  { code: 'tur.1', name: 'Super Lig' },
  { code: 'tur.2', name: 'TFF 1. Lig' },
  { code: 'tur.cup', name: 'Turkish Cup' },

  // ====== RUSSIA ======
  { code: 'rus.1', name: 'Russian Premier League' },
  { code: 'rus.2', name: 'Russian First League' },

  // ====== GREECE ======
  { code: 'gre.1', name: 'Greek Super League' },
  { code: 'gre.2', name: 'Greek Super League 2' },

  // ====== SWITZERLAND ======
  { code: 'sui.1', name: 'Swiss Super League' },

  // ====== AUSTRIA ======
  { code: 'aut.1', name: 'Austrian Bundesliga' },

  // ====== POLAND ======
  { code: 'pol.1', name: 'Ekstraklasa' },

  // ====== CZECH REPUBLIC ======
  { code: 'cze.1', name: 'Czech First League' },

  // ====== DENMARK ======
  { code: 'den.1', name: 'Danish Superliga' },

  // ====== SWEDEN ======
  { code: 'swe.1', name: 'Allsvenskan' },

  // ====== NORWAY ======
  { code: 'nor.1', name: 'Eliteserien' },

  // ====== FINLAND ======
  { code: 'fin.1', name: 'Veikkausliiga' },

  // ====== UKRAINE ======
  { code: 'ukr.1', name: 'Ukrainian Premier League' },

  // ====== ROMANIA ======
  { code: 'rou.1', name: 'Romanian Liga I' },

  // ====== CROATIA ======
  { code: 'cro.1', name: 'Croatian First Football League' },

  // ====== SERBIA ======
  { code: 'srb.1', name: 'Serbian SuperLiga' },

  // ====== HUNGARY ======
  { code: 'hun.1', name: 'NB I' },

  // ====== BULGARIA ======
  { code: 'bul.1', name: 'Bulgarian First League' },

  // ====== ISRAEL ======
  { code: 'isr.1', name: 'Israeli Premier League' },

  // ====== CYPRUS ======
  { code: 'cyp.1', name: 'Cypriot First Division' },

  // ====== IRELAND ======
  { code: 'irl.1', name: 'League of Ireland Premier' },

  // ====== NORTHERN IRELAND ======
  { code: 'nir.1', name: 'NIFL Premiership' },

  // ====== WALES ======
  { code: 'wal.1', name: 'Welsh Premier League' },

  // ====== ICELAND ======
  { code: 'isl.1', name: 'Besta deild karla' },

  // ====== SLOVAKIA ======
  { code: 'svk.1', name: 'Slovak Super Liga' },

  // ====== SLOVENIA ======
  { code: 'svn.1', name: 'Slovenian PrvaLiga' },

  // ====== BOSNIA ======
  { code: 'bih.1', name: 'Bosnian Premier League' },

  // ====== NORTH MACEDONIA ======
  { code: 'mkd.1', name: 'Macedonian First League' },

  // ====== ALBANIA ======
  { code: 'alb.1', name: 'Albanian Superliga' },

  // ====== MONTENEGRO ======
  { code: 'mne.1', name: 'Montenegrin First League' },

  // ====== KOSOVO ======
  { code: 'kos.1', name: 'Football Superleague of Kosovo' },

  // ====== GEORGIA ======
  { code: 'geo.1', name: 'Erovnuli Liga' },

  // ====== AZERBAIJAN ======
  { code: 'aze.1', name: 'Azerbaijan Premier League' },

  // ====== KAZAKHSTAN ======
  { code: 'kaz.1', name: 'Kazakhstan Premier League' },

  // ====== BELARUS ======
  { code: 'blr.1', name: 'Belarusian Premier League' },

  // ====== LITHUANIA ======
  { code: 'ltu.1', name: 'A Lyga' },

  // ====== LATVIA ======
  { code: 'lva.1', name: 'Latvian Higher League' },

  // ====== ESTONIA ======
  { code: 'est.1', name: 'Meistriliiga' },

  // ====== SOUTH AMERICA ======
  { code: 'bra.1', name: 'Brasileirao Serie A' },
  { code: 'bra.2', name: 'Brasileirao Serie B' },
  { code: 'bra.3', name: 'Brasileirao Serie C' },
  { code: 'bra.cup', name: 'Copa do Brasil' },
  { code: 'arg.1', name: 'Argentine Primera Division' },
  { code: 'arg.2', name: 'Argentine Primera Nacional' },
  { code: 'arg.cup', name: 'Copa Argentina' },
  { code: 'col.1', name: 'Colombian Primera A' },
  { code: 'col.2', name: 'Colombian Primera B' },
  { code: 'chi.1', name: 'Chilean Primera Division' },
  { code: 'uru.1', name: 'Uruguayan Primera Division' },
  { code: 'per.1', name: 'Peruvian Primera Division' },
  { code: 'ecu.1', name: 'Ecuadorian Serie A' },
  { code: 'ven.1', name: 'Venezuelan Primera Division' },
  { code: 'bol.1', name: 'Bolivian Primera Division' },
  { code: 'par.1', name: 'Paraguayan Primera Division' },

  // ====== NORTH/CENTRAL AMERICA & CARIBBEAN ======
  { code: 'usa.1', name: 'MLS' },
  { code: 'usa.2', name: 'USL Championship' },
  { code: 'usa.nwsl', name: 'NWSL (Womens)' },
  { code: 'usa.open', name: 'US Open Cup' },
  { code: 'mex.1', name: 'Liga MX' },
  { code: 'mex.2', name: 'Liga MX Expansion' },
  { code: 'mex.cup', name: 'Copa MX' },
  { code: 'can.1', name: 'Canadian Premier League' },
  { code: 'crc.1', name: 'Costa Rican Primera Division' },
  { code: 'hon.1', name: 'Honduran Primera Division' },
  { code: 'slv.1', name: 'Salvadoran Primera Division' },
  { code: 'gua.1', name: 'Guatemalan Liga Nacional' },
  { code: 'jam.1', name: 'Jamaican Premier League' },

  // ====== ASIA ======
  { code: 'jpn.1', name: 'J1 League' },
  { code: 'jpn.2', name: 'J2 League' },
  { code: 'kor.1', name: 'K League 1' },
  { code: 'chn.1', name: 'Chinese Super League' },
  { code: 'aus.1', name: 'A-League' },
  { code: 'ind.1', name: 'Indian Super League' },
  { code: 'sgp.1', name: 'Singapore Premier League' },
  { code: 'tha.1', name: 'Thai League 1' },
  { code: 'mys.1', name: 'Malaysian Super League' },
  { code: 'idn.1', name: 'Indonesian Liga 1' },
  { code: 'sau.1', name: 'Saudi Pro League' },
  { code: 'uae.1', name: 'UAE Pro League' },
  { code: 'qat.1', name: 'Qatar Stars League' },

  // ====== AFRICA ======
  { code: 'rsa.1', name: 'South African Premier Division' },
  { code: 'egy.1', name: 'Egyptian Premier League' },
  { code: 'mar.1', name: 'Moroccan Botola Pro' },
  { code: 'tun.1', name: 'Tunisian Ligue 1' },
  { code: 'nga.1', name: 'Nigerian Professional League' },
  { code: 'gha.1', name: 'Ghana Premier League' },
  { code: 'ken.1', name: 'Kenyan Premier League' },

  // ====== UEFA COMPETITIONS ======
  { code: 'uefa.champions', name: 'UEFA Champions League' },
  { code: 'uefa.europa', name: 'UEFA Europa League' },
  { code: 'uefa.europa.conf', name: 'UEFA Conference League' },
  { code: 'uefa.super_cup', name: 'UEFA Super Cup' },
  { code: 'uefa.youth', name: 'UEFA Youth League' },
  { code: 'uefa.europaconf', name: 'UEFA Conference League (alt)' },

  // ====== CONMEBOL COMPETITIONS ======
  { code: 'conmebol.libertadores', name: 'Copa Libertadores' },
  { code: 'conmebol.sudamericana', name: 'Copa Sudamericana' },
  { code: 'conmebol.recopa', name: 'Recopa Sudamericana' },

  // ====== CONCACAF COMPETITIONS ======
  { code: 'concacaf.champions', name: 'CONCACAF Champions Cup' },
  { code: 'concacaf.champions_cup', name: 'CONCACAF Champions Cup (alt)' },
  { code: 'concacaf.leagues_cup', name: 'Leagues Cup' },
  { code: 'concacaf.gold', name: 'CONCACAF Gold Cup' },
  { code: 'concacaf.nations.league', name: 'CONCACAF Nations League' },
  { code: 'concacaf.league', name: 'CONCACAF League' },

  // ====== AFC COMPETITIONS ======
  { code: 'afc.champions', name: 'AFC Champions League' },
  { code: 'afc.champions.2', name: 'AFC Champions League 2' },
  { code: 'afc.cup', name: 'AFC Cup' },

  // ====== CAF COMPETITIONS ======
  { code: 'caf.champions', name: 'CAF Champions League' },
  { code: 'caf.confed', name: 'CAF Confederation Cup' },
  { code: 'caf.nations', name: 'Africa Cup of Nations' },

  // ====== FIFA / INTERNATIONAL ======
  { code: 'fifa.world', name: 'FIFA World Cup' },
  { code: 'fifa.worldq.uefa', name: 'FIFA World Cup Qualifying - UEFA' },
  { code: 'fifa.worldq.conmebol', name: 'FIFA World Cup Qualifying - CONMEBOL' },
  { code: 'fifa.worldq.concacaf', name: 'FIFA World Cup Qualifying - CONCACAF' },
  { code: 'fifa.worldq.afc', name: 'FIFA World Cup Qualifying - AFC' },
  { code: 'fifa.worldq.caf', name: 'FIFA World Cup Qualifying - CAF' },
  { code: 'fifa.worldq.ofc', name: 'FIFA World Cup Qualifying - OFC' },
  { code: 'fifa.friendly', name: 'International Friendly' },
  { code: 'fifa.cwc', name: 'FIFA Club World Cup' },
  { code: 'fifa.confederations', name: 'FIFA Confederations Cup' },
  { code: 'fifa.olympics', name: 'Olympic Football Tournament' },
  { code: 'fifa.world.u20', name: 'FIFA U-20 World Cup' },
  { code: 'fifa.world.u17', name: 'FIFA U-17 World Cup' },

  // ====== UEFA INTERNATIONAL ======
  { code: 'uefa.euro', name: 'UEFA European Championship' },
  { code: 'uefa.euroq', name: 'UEFA Euro Qualifying' },
  { code: 'uefa.nations', name: 'UEFA Nations League' },
  { code: 'uefa.euro.u21', name: 'UEFA U-21 Championship' },
  { code: 'uefa.euro.u19', name: 'UEFA U-19 Championship' },

  // ====== CONMEBOL INTERNATIONAL ======
  { code: 'conmebol.america', name: 'Copa America' },

  // ====== ADDITIONAL FORMATS TO TEST ======
  // Some ESPN codes use different formats
  { code: 'global.friendly', name: 'Club Friendly' },
  { code: 'club.friendly', name: 'Club Friendly (alt)' },
  { code: 'eng.charity', name: 'Community Shield (alt)' },
  { code: 'usa.usl.1', name: 'USL Championship (alt)' },
  { code: 'usa.usl.l1', name: 'USL League One' },
  { code: 'usa.usl.2', name: 'USL League Two' },
  { code: 'usa.nisa', name: 'NISA' },
  { code: 'usa.mls_cup', name: 'MLS Cup' },
  { code: 'eng.super_league', name: 'WSL' },
  { code: 'aus.w.1', name: 'A-League Women' },
  { code: 'ind.2', name: 'I-League' },
  { code: 'sco.3', name: 'Scottish League One' },
  { code: 'sco.4', name: 'Scottish League Two' },
  { code: 'mex.liga_expansion', name: 'Liga Expansion MX' },

  // ====== INTERNATIONAL FRIENDLIES VARIANTS ======
  { code: 'fifa.friendly.m', name: 'Mens International Friendly' },
  { code: 'global.world_cup_qualifying', name: 'WCQ Generic' },

  // ====== ADDITIONAL CONTINENTAL ======
  { code: 'ofc.champions', name: 'OFC Champions League' },
  { code: 'afc.asian_cup', name: 'AFC Asian Cup' },
  { code: 'caf.nations_q', name: 'AFCON Qualifying' },

  // ====== PRE-SEASON / SPECIAL ======
  { code: 'global.icc', name: 'International Champions Cup' },
  { code: 'eng.efl_cup', name: 'EFL Cup (alt code)' },
  { code: 'eng.fa_cup', name: 'FA Cup (alt code)' },
];

async function testLeague(code) {
  try {
    const url = `${BASE_URL}/${code}/scoreboard`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LivePick-PWA/1.0' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { code, status: response.status, valid: false };
    }

    const data = await response.json();

    // Check if the response has a valid league structure
    const leagueName = data?.leagues?.[0]?.name || data?.leagues?.[0]?.shortName || null;
    const leagueSlug = data?.leagues?.[0]?.slug || null;
    const leagueAbbr = data?.leagues?.[0]?.abbreviation || null;
    const eventCount = data?.events?.length || 0;

    if (data?.leagues?.length > 0) {
      return {
        code,
        valid: true,
        name: leagueName,
        slug: leagueSlug,
        abbreviation: leagueAbbr,
        currentEvents: eventCount,
      };
    }

    return { code, valid: false, reason: 'No leagues in response' };
  } catch (error) {
    return { code, valid: false, reason: error.message };
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('ESPN Soccer League Discovery');
  console.log(`Testing ${CANDIDATE_LEAGUES.length} league codes...`);
  console.log('='.repeat(80));
  console.log('');

  // Test in batches of 10 to avoid overwhelming the API
  const BATCH_SIZE = 10;
  const results = [];

  for (let i = 0; i < CANDIDATE_LEAGUES.length; i += BATCH_SIZE) {
    const batch = CANDIDATE_LEAGUES.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(l => testLeague(l.code)));
    results.push(...batchResults);

    // Progress indicator
    const progress = Math.min(i + BATCH_SIZE, CANDIDATE_LEAGUES.length);
    process.stdout.write(`\rTested ${progress}/${CANDIDATE_LEAGUES.length} codes...`);

    // Small delay between batches
    if (i + BATCH_SIZE < CANDIDATE_LEAGUES.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n');

  // Separate valid and invalid
  const valid = results.filter(r => r.valid);
  const invalid = results.filter(r => !r.valid);

  // Print valid leagues
  console.log('='.repeat(80));
  console.log(`VALID LEAGUES (${valid.length} found)`);
  console.log('='.repeat(80));
  console.log('');

  // Group by category
  const categories = {
    'Top 5 European Leagues': r => ['eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1'].includes(r.code),
    'Other European Leagues': r => /^(eng|esp|ita|ger|fra|ned|por|bel|sco|tur|rus|gre|sui|aut|pol|cze|den|swe|nor|fin|ukr|rou|cro|srb|hun|bul|isr|cyp|irl|nir|wal|isl|svk|svn|bih|mkd|alb|mne|kos|geo|aze|kaz|blr|ltu|lva|est)\.\d+$/.test(r.code) && !['eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1'].includes(r.code),
    'European Domestic Cups': r => /^(eng|esp|ita|ger|fra|ned|por|sco|tur)\.(fa|cup|league_cup|copa|coppa|dfb_pokal|coupe|trophy|charity|community|efl|super_cup|fa_cup|efl_cup)/.test(r.code),
    'South America': r => /^(bra|arg|col|chi|uru|per|ecu|ven|bol|par)\./.test(r.code),
    'North/Central America': r => /^(usa|mex|can|crc|hon|slv|gua|jam)\./.test(r.code),
    'Asia & Oceania': r => /^(jpn|kor|chn|aus|ind|sgp|tha|mys|idn|sau|uae|qat)\./.test(r.code),
    'Africa': r => /^(rsa|egy|mar|tun|nga|gha|ken)\./.test(r.code),
    'UEFA Competitions': r => /^uefa\./.test(r.code),
    'CONMEBOL Competitions': r => /^conmebol\./.test(r.code),
    'CONCACAF Competitions': r => /^concacaf\./.test(r.code),
    'AFC Competitions': r => /^afc\./.test(r.code),
    'CAF Competitions': r => /^caf\./.test(r.code),
    'FIFA / International': r => /^(fifa|global|club|ofc)\./.test(r.code),
  };

  const categorized = new Set();

  for (const [catName, filter] of Object.entries(categories)) {
    const catLeagues = valid.filter(filter);
    if (catLeagues.length > 0) {
      console.log(`--- ${catName} ---`);
      for (const l of catLeagues) {
        console.log(`  ${l.code.padEnd(30)} ${(l.name || 'Unknown').padEnd(45)} Events today: ${l.currentEvents}`);
        categorized.add(l.code);
      }
      console.log('');
    }
  }

  // Uncategorized
  const uncategorized = valid.filter(r => !categorized.has(r.code));
  if (uncategorized.length > 0) {
    console.log('--- Uncategorized ---');
    for (const l of uncategorized) {
      console.log(`  ${l.code.padEnd(30)} ${(l.name || 'Unknown').padEnd(45)} Events today: ${l.currentEvents}`);
    }
    console.log('');
  }

  // Print summary for code use
  console.log('='.repeat(80));
  console.log('CODE-READY FORMAT (copy-paste into LEAGUE_NAME_TO_CODE)');
  console.log('='.repeat(80));
  console.log('');
  console.log('export const LEAGUE_NAME_TO_CODE: Record<string, string> = {');
  for (const l of valid) {
    const safeName = (l.name || l.code).replace(/'/g, "\\'");
    console.log(`  '${safeName}': '${l.code}',`);
  }
  console.log('};');

  console.log('');
  console.log('='.repeat(80));
  console.log(`INVALID/NOT FOUND (${invalid.length} codes)`);
  console.log('='.repeat(80));
  for (const l of invalid) {
    console.log(`  ${l.code.padEnd(30)} Status: ${l.status || l.reason}`);
  }
}

main().catch(console.error);
