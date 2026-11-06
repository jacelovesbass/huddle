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
  select r.name room, r.join_code, p.name pack, p.added_by, count(e.id) n
  from rooms r join packs p on p.room_id = r.id left join emoji e on e.pack_id = p.id
  group by r.name, r.join_code, p.name, p.added_by, p.created_at
  order by p.created_at desc`);
console.log(rows.length ? rows.map(r=>`${r.join_code} ${r.room.padEnd(12)} "${r.pack}" ${r.n} emoji, added by ${r.added_by}`).join('\n') : 'no packs installed anywhere yet');
await c.end();
