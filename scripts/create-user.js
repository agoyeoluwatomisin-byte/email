#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

loadEnvFile(path.join(process.cwd(), '.env.local'));

const [email, password, displayName] = process.argv.slice(2);
if (!email || !password || !displayName) {
  console.error('Usage: node scripts/create-user.js <email> <password> <display name>');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local');
  process.exit(1);
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.from('users').upsert(
    {
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      display_name: displayName.trim(),
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email' },
  );

  if (error) {
    console.error('Failed to create user:', error.message);
    process.exit(1);
  }

  console.log(`Created or updated user ${email.trim().toLowerCase()}.`);
}

function loadEnvFile(filename) {
  if (!fs.existsSync(filename)) return;
  for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

main().catch((error) => {
  console.error('Failed to create user:', error.message);
  process.exit(1);
});
