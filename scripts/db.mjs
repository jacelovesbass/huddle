// One place that knows how to reach the database, and the migration runner.
//
// Migrations are applied in filename order and recorded, so a machine that has
// never seen this project can bring a database up to date in one command and
// re-running is harmless. Before this, schema changes were applied by editing
// a script by hand, with no record of what had actually been run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function env() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) throw new Error('.env.local is missing; see README');
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split('\n')
      .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
      .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
  );
}

export async function connect() {
  const e = env();
  const ref = new URL(e.VITE_SUPABASE_URL).hostname.split('.')[0];
  const pw = encodeURIComponent(e.SUPABASE_DB_PASSWORD);
  const hosts = [
    `postgresql://postgres.${ref}:${pw}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres.${ref}:${pw}@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${pw}@db.${ref}.supabase.co:5432/postgres`,
  ];
  let last;
  for (const connectionString of hosts) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try { await client.connect(); return client; }
    catch (err) { last = err; try { await client.end(); } catch {} }
  }
  throw new Error(`could not connect: ${last?.message}`);
}

/**
 * Apply pending migrations.
 *
 * **Gated migrations are skipped unless asked for by name.** A file ending
 * `.gated.sql` is one that must not run until something OUTSIDE the database
 * is true: a deploy has landed, a setting has been switched on, a person has
 * said go. `npm run migrate` ran one of these by accident on 2026-11-07 and
 * locked the live group out of their own chat, because "apply everything
 * pending" is the right default right up until it is catastrophically wrong.
 *
 *   npm run migrate                      every ordinary migration
 *   npm run migrate -- --gate 012        that one gated migration as well
 */
export async function migrate({ gate = [] } = {}) {
  const client = await connect();
  await client.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);

  const done = new Set((await client.query('select name from schema_migrations')).rows.map(r => r.name));
  const dir = path.join(ROOT, 'migrations');
  const all = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  const files = all.filter(f => {
    if (!f.endsWith('.gated.sql')) return true;
    return gate.some(g => f.startsWith(g));
  });

  const held = all.filter(f => !files.includes(f) && !done.has(f));
  if (held.length) {
    console.log(`  held back (gated): ${held.join(', ')}`);
    console.log('  run with --gate <prefix> when the precondition is actually met');
  }

  let ran = 0;
  for (const name of files) {
    if (done.has(name)) continue;
    process.stdout.write(`  ${name} ... `);
    await client.query(fs.readFileSync(path.join(dir, name), 'utf8'));
    await client.query('insert into schema_migrations (name) values ($1)', [name]);
    console.log('applied');
    ran++;
  }
  console.log(ran ? `${ran} applied` : `up to date (${files.length} migrations)`);
  await client.end();
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const gate = [];
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--gate' && process.argv[i + 1]) gate.push(process.argv[++i]);
  }
  await migrate({ gate });
}
