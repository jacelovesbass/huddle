// Applies the schema to Supabase over a direct Postgres connection.
// usage: node setup-db.mjs
import fs from 'node:fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const pw = encodeURIComponent(env.SUPABASE_DB_PASSWORD);

const candidates = [
  `postgresql://postgres.${ref}:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres.${ref}:${pw}@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres`,
  `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`,
];

const sql = fs.readFileSync('schema.sql', 'utf8');

for (const cs of candidates) {
  const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('connected:', cs.replace(pw, '***').split('@')[1]);
    await client.query(sql);
    console.log('schema applied');
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log('failed:', cs.split('@')[1]?.split('/')[0], '-', e.message);
    try { await client.end(); } catch {}
  }
}
console.log('no connection worked');
process.exit(1);
