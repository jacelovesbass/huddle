-- Emoji packs. See PACK_FORMAT.md.
-- An emoji row holds a URL, which may be https: or data:. v1 imports produce
-- data: URLs so no storage service is needed; bring-your-own-storage packs
-- produce https: ones. The renderer cannot tell the difference.

create table if not exists packs (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  name       text not null,
  author     text,
  added_by   text,
  created_at timestamptz not null default now()
);

create table if not exists emoji (
  id      uuid primary key default gen_random_uuid(),
  pack_id uuid not null references packs(id) on delete cascade,
  name    text not null,
  url     text not null,
  unique (pack_id, name)
);

create index if not exists packs_room_idx on packs (room_id, created_at);
create index if not exists emoji_pack_idx on emoji (pack_id);

alter table packs enable row level security;
alter table emoji enable row level security;

drop policy if exists packs_all on packs;
create policy packs_all on packs for all to anon using (true) with check (true);

drop policy if exists emoji_all on emoji;
create policy emoji_all on emoji for all to anon using (true) with check (true);

-- Idempotent: adding a table to a publication twice is an error, and a
-- migration must be safe to re-run.
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'packs') then
    alter publication supabase_realtime add table packs;
  end if;
end $$;
-- Idempotent: adding a table to a publication twice is an error, and a
-- migration must be safe to re-run.
do $$ begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and tablename = 'emoji') then
    alter publication supabase_realtime add table emoji;
  end if;
end $$;
