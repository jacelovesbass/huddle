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
const r = (await c.query("select id,name from rooms where join_code='6MNPQ'")).rows[0];
const { rows: tot } = await c.query('select count(*) n, min(created_at) first, max(created_at) last from messages where room_id=$1',[r.id]);
console.log(`${r.name}: ${tot[0].n} messages`);
console.log(`  first ${new Date(tot[0].first).toLocaleString()}`);
console.log(`  last  ${new Date(tot[0].last).toLocaleString()}`);
console.log('\nby author:');
for (const m of (await c.query('select author, count(*) n, max(created_at) last from messages where room_id=$1 group by author order by n desc',[r.id])).rows)
  console.log(`  ${m.author.padEnd(8)} ${String(m.n).padStart(3)}  last ${new Date(m.last).toLocaleString()}`);
console.log('\nsince the session ended (after 2026-11-05 23:30):');
const { rows: since } = await c.query("select author, count(*) n from messages where room_id=$1 and created_at > '2026-11-05 12:30:00+00' group by author",[r.id]);
console.log(since.length ? since.map(x=>`  ${x.author}: ${x.n}`).join('\n') : '  nothing');
console.log('\nmembers:', (await c.query('select name from members where room_id=$1',[r.id])).rows.map(x=>x.name).join(', '));
await c.end();
