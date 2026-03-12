#!/usr/bin/env node

/**
 * Setup Admin User
 * Creates admin user if it doesn't exist
 * Usage: node scripts/setup-admin.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const readline = require('readline');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🔧 Admin User Setup\n');
  console.log('='.repeat(50));

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nAdd them to .env.local and try again.\n');
    process.exit(1);
  }

  console.log('✓ Environment variables found\n');

  // Get admin credentials
  const username = await question('Admin username [admin]: ');
  const password = await question('Admin password: ');
  const fullName = await question('Full name [Administrator]: ');
  const email = await question('Email [admin@example.com]: ');

  if (!password) {
    console.error('❌ Password is required!');
    rl.close();
    process.exit(1);
  }

  // Generate admin ID and hash password
  const adminId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  const adminUsername = username || 'admin';
  const adminFullName = fullName || 'Administrator';
  const adminEmail = email || 'admin@example.com';

  console.log('\n📝 Admin user data:');
  console.log(`  Username: ${adminUsername}`);
  console.log(`  Full name: ${adminFullName}`);
  console.log(`  Email: ${adminEmail}`);
  console.log(`  Is admin: true`);

  try {
    console.log('\n⏳ Creating admin user...\n');

    // Use Supabase REST API with fetch
    const apiUrl = `${supabaseUrl}/rest/v1/users`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        id: adminId,
        username: adminUsername,
        password_hash: passwordHash,
        full_name: adminFullName,
        email: adminEmail,
        is_admin: true,
        is_active: true,
        created_at: new Date().toISOString(),
      }),
    });

    console.log('='.repeat(50));

    const responseData = await response.json();

    if (response.ok) {
      console.log('✅ Admin user created successfully!\n');
      console.log('You can now login with:');
      console.log(`  Username: ${adminUsername}`);
      console.log(`  Password: ${password}\n`);
    } else {
      if (responseData.code === '23505' || responseData.message?.includes('duplicate')) {
        console.log('⚠️  Admin user already exists!');
        console.log(`   Username: ${adminUsername}\n`);
      } else {
        console.error('❌ Error creating admin:');
        console.error('   Message:', responseData.message);
        console.error('   Code:', responseData.code);
        if (responseData.details) {
          console.error('   Details:', responseData.details);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nMake sure:');
    console.error('  1. Your .env.local has correct Supabase credentials');
    console.error('  2. You have internet connection');
    console.error('  3. Supabase is reachable at:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  }

  rl.close();
}

main().catch(console.error);
