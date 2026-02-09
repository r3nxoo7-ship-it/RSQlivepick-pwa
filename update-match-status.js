// Quick script to update a match status for testing
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Strip quotes if they exist
supabaseUrl = supabaseUrl?.replace(/^["']|["']$/g, '');
supabaseServiceKey = supabaseServiceKey?.replace(/^["']|["']$/g, '');

console.log('📝 Env vars loaded:');
console.log(`  URL: ${supabaseUrl?.substring(0, 30)}...`);
console.log(`  Key: ${supabaseServiceKey?.substring(0, 30)}...`);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase env vars');
  console.log('Available env keys:', Object.keys(process.env).filter(k => k.includes('SUPA') || k.includes('supabase')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function updateMatchToLive() {
  try {
    console.log('🔍 Fetching upcoming scheduled matches...');
    
    // Get a match scheduled for the next few hours
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Looking for matches between ${twoHoursLater.toISOString()} and ${fourHoursLater.toISOString()}`);

    const { data, error } = await supabase
      .from('espn_matches')
      .select('*')
      .eq('sport', 'soccer')
      .eq('status', 'scheduled')
      .gte('date', twoHoursLater.toISOString())
      .lte('date', fourHoursLater.toISOString())
      .limit(1);

    if (error) {
      console.error('❌ Query error:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No scheduled matches in 2-4 hour window, looking for any upcoming scheduled match...');
      
      const { data: anyMatch, error: anyError } = await supabase
        .from('espn_matches')
        .select('*')
        .eq('sport', 'soccer')
        .eq('status', 'scheduled')
        .gte('date', now.toISOString())
        .order('date', { ascending: true })
        .limit(1);

      if (anyError) {
        console.error('❌ Query error:', anyError);
        process.exit(1);
      }

      if (!anyMatch || anyMatch.length === 0) {
        console.log('⚠️ No scheduled matches found!');
        process.exit(1);
      }

      const match = anyMatch[0];
      console.log(`\n📍 Found match: ${match.home_team_name} vs ${match.away_team_name}`);
      console.log(`   Scheduled for: ${match.date}`);
      console.log(`   Current status: ${match.status}`);

      // Update status to in_progress
      const { error: updateError } = await supabase
        .from('espn_matches')
        .update({ status: 'in_progress' })
        .eq('id', match.id);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        process.exit(1);
      }

      console.log('✅ Status updated to "in_progress"!');
      console.log('🔄 The match will now appear as LIVE on the dashboard!');
    } else {
      const match = data[0];
      console.log(`\n📍 Found match: ${match.home_team_name} vs ${match.away_team_name}`);
      console.log(`   Scheduled for: ${match.date}`);
      console.log(`   Current status: ${match.status}`);

      // Update status to in_progress
      const { error: updateError } = await supabase
        .from('espn_matches')
        .update({ status: 'in_progress' })
        .eq('id', match.id);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        process.exit(1);
      }

      console.log('✅ Status updated to "in_progress"!');
      console.log('🔄 The match will now appear as LIVE on the dashboard!');
    }
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

updateMatchToLive();
