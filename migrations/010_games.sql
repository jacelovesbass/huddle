-- Games are single-file HTML: the thing an AI can actually produce and a
-- person can actually pass around.
--
-- A game carries its html OR points at a url, the same either/or the pack
-- format uses, so a hosted game costs nothing to keep and a shared one still
-- travels. One of the two must be present.
create table if not exists games (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  name       text not null,
  author     text,
  added_by   text,
  html       text,
  url        text,
  created_at timestamptz not null default now(),
  constraint games_has_a_source check (html is not null or url is not null)
);

create index if not exists games_room_idx on games (room_id, created_at);

alter table games enable row level security;
drop policy if exists games_all on games;
create policy games_all on games for all to anon using (true) with check (true);

do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'games') then
    alter publication supabase_realtime add table games;
  end if;
end $$;
