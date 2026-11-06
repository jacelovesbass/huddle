// Delete rooms created by test runs. Everything hangs off rooms with
// ON DELETE CASCADE, so one delete takes its messages, members, packs and
// emoji with it.
//
// An explicit keep-list, not a guess at which names look like tests: getting
// this wrong destroys a real conversation.
import fs from 'node:fs';
import pg from 'pg';

const KEEP = new Set(['J3TXB', '6MNPQ']);   // Pure Empathy, Pure
const apply = process.argv.includes('--apply');

const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.trim()&&!l.startsWith('#')&&l.includes('='))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const c = new pg.Client({ connectionString:
  `postgresql://postgres.${ref}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
  ssl:{rejectUnauthorized:false} });
await c.connect();

const before = await c.query(`
  select (select count(*) from rooms) rooms, (select count(*) from messages) msgs,
         (select count(*) from members) members, (select count(*) from packs) packs,
         (select count(*) from emoji) emoji`);
console.log('before:', before.rows[0]);

const keep = [...KEEP];
const { rows: doomed } = await c.query(
  'select join_code, name from rooms where join_code <> all($1)', [keep]);
console.log(`\nkeeping ${keep.length}: ${keep.join(', ')}`);
console.log(`deleting ${doomed.length} rooms`);

if (!apply) {
  console.log('\nDRY RUN. Re-run with --apply to delete.');
  await c.end();
  process.exit(0);
}

await c.query('delete from rooms where join_code <> all($1)', [keep]);
const after = await c.query(`
  select (select count(*) from rooms) rooms, (select count(*) from messages) msgs,
         (select count(*) from members) members, (select count(*) from packs) packs,
         (select count(*) from emoji) emoji`);
console.log('\nafter: ', after.rows[0]);
for (const r of (await c.query('select join_code, name, (select count(*) from messages m where m.room_id=rooms.id) msgs from rooms')).rows)
  console.log(`  ${r.join_code}  ${r.name}  ${r.msgs} messages`);
await c.end();
