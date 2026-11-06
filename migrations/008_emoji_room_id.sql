-- An emoji row carried only pack_id, so a client could not filter a realtime
-- subscription on it by room. The result was every client in every room
-- reloading its packs whenever any emoji changed anywhere.
--
-- Denormalise room_id onto emoji and keep it true with a trigger, so no client
-- has to remember to set it and an old client cannot get it wrong.

alter table emoji add column if not exists room_id uuid references rooms(id) on delete cascade;

update emoji e set room_id = p.room_id
from packs p where p.id = e.pack_id and e.room_id is distinct from p.room_id;

create or replace function emoji_set_room() returns trigger as $$
begin
  select room_id into new.room_id from packs where id = new.pack_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists emoji_room_id on emoji;
create trigger emoji_room_id
  before insert or update of pack_id on emoji
  for each row execute function emoji_set_room();

create index if not exists emoji_room_idx on emoji (room_id);
