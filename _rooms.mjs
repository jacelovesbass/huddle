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
  select r.name, r.join_code, count(m.id) as msgs, max(m.created_at) as last
  from rooms r left join messages m on m.room_id = r.id
  group by r.id order by r.created_at desc`);
for (const r of rows) console.log(`${r.join_code}  ${r.name.padEnd(16)} ${r.msgs} msgs  ${r.last ? new Date(r.last).toLocaleString() : '-'}`);
await c.end();
