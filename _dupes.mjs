import fs from 'node:fs';
import pg from 'pg';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.trim()&&!l.startsWith('#')&&l.includes('='))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]));
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const c = new pg.Client({ connectionString:
  `postgresql://postgres.${ref}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
  ssl:{rejectUnauthorized:false} });
await c.connect();
const { rows } = await c.query(`
  select e.name, count(*) n, string_agg(p.name, ' + ' order by p.created_at) packs
  from emoji e join packs p on p.id = e.pack_id
  where p.room_id = (select id from rooms where join_code='J3TXB')
  group by e.name having count(*) > 1`);
console.log(rows.length ? 'DUPLICATE NAMES in Pure Empathy:' : 'no duplicate names');
rows.forEach(r => console.log(`  :${r.name}: appears ${r.n}x  (${r.packs})`));
const { rows: all } = await c.query(`
  select p.name pack, string_agg(e.name, ', ' order by e.name) names
  from packs p join emoji e on e.pack_id = p.id
  where p.room_id = (select id from rooms where join_code='J3TXB') group by p.name, p.created_at order by p.created_at`);
all.forEach(r => console.log(`\n${r.pack}: ${r.names}`));
await c.end();
