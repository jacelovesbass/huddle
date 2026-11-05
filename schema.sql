-- HOB_2026_001 schema. Closed-group messaging, v1.
-- Deliberately permissive: this is a feature test with a friend group, not a
-- product. Access control is a join code, not real auth. See README.

create table if not exists rooms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  join_code  text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references rooms(id) on delete cascade,
  author     text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_room_created_idx
  on messages (room_id, created_at);

alter table rooms    enable row level security;
alter table messages enable row level security;

-- v1 policies: anyone with the publishable key can read and post.
-- The join code is what keeps groups apart, not the database.
drop policy if exists rooms_all on rooms;
create policy rooms_all on rooms
  for all to anon using (true) with check (true);

drop policy if exists messages_all on messages;
create policy messages_all on messages
  for all to anon using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table messages;
