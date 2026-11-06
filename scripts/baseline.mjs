// The database was built by hand before migrations existed. Record the
// existing files as applied so the runner starts from the real state rather
// than trying to recreate what is already there.
import fs from 'node:fs';
import { connect } from './db.mjs';

const client = await connect();
await client.query(`create table if not exists schema_migrations (
  name text primary key, applied_at timestamptz not null default now())`);
for (const name of fs.readdirSync('migrations').filter(f => f.endsWith('.sql')).sort()) {
  await client.query(
    'insert into schema_migrations (name) values ($1) on conflict do nothing', [name]);
  console.log('baselined', name);
}
await client.end();
