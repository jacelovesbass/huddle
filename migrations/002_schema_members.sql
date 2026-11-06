-- HOB_2026_001: membership roster.
-- Until now nothing recorded that someone joined, only that they posted, so a
-- member who had not spoken was invisible.

create table if not exists members (
  room_id   uuid not null references rooms(id) on delete cascade,
  name      text not null,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (room_id, name)
);

create index if not exists members_room_idx on members (room_id, last_seen desc);

alter table members enable row level security;

drop policy if exists members_all on members;
create policy members_all on members
  for all to anon using (true) with check (true);

-- Idempotent: adding a table to a publication twice is an error, and a
-- migration must be safe to re-run.
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'members') then
    alter publication supabase_realtime add table members;
  end if;
end $$;
