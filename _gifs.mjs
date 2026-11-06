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
const room = (await c.query("select id from rooms where join_code='J3TXB'")).rows[0];
console.log('packs in Pure Empathy:');
for (const p of (await c.query('select name, (select count(*) from emoji e where e.pack_id=p.id) n from packs p where room_id=$1',[room.id])).rows)
  console.log(`   ${p.name} (${p.n})`);
const { rows } = await c.query(
  "select author, body from messages where room_id=$1 and body like '%http%' order by created_at",[room.id]);
console.log(`\nmessages containing links: ${rows.length}`);
rows.forEach(r => console.log(`   ${r.author}: ${r.body.slice(0,90)}`));
await c.end();
