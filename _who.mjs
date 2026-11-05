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
const r = (await c.query("select id,name,join_code from rooms where join_code='6MNPQ'")).rows[0];
console.log('room:', r.name, r.join_code);
console.log('\nmembers table:');
for (const m of (await c.query('select name, joined_at, last_seen from members where room_id=$1 order by joined_at',[r.id])).rows)
  console.log('  ', m.name, '| joined', new Date(m.joined_at).toLocaleString());
console.log('\nauthors who have posted:');
for (const m of (await c.query('select author, count(*) n, max(created_at) last from messages where room_id=$1 group by author order by last',[r.id])).rows)
  console.log('  ', m.author, '|', m.n, 'msgs | last', new Date(m.last).toLocaleString());
await c.end();
