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
const { rows } = await c.query("select id, name, join_code from rooms where name ilike 'pure' order by created_at desc limit 1");
if (!rows.length) { console.log('no room called Pure'); process.exit(1); }
const room = rows[0];
console.log('found:', room.name, room.join_code);
await c.query('insert into messages (room_id, author, body) values ($1,$2,$3)',
  [room.id, 'Claude', 'hello Pure. thanks for the invite']);
console.log('sent');
await c.end();
