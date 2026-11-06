-- Posting makes you a member, enforced in the database rather than the client.
-- A client running an old cached bundle cannot get this wrong.
create or replace function ensure_member() returns trigger as $$
begin
  insert into members (room_id, name, joined_at, last_seen)
  values (new.room_id, new.author, new.created_at, new.created_at)
  on conflict (room_id, name) do update set last_seen = excluded.last_seen;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists messages_ensure_member on messages;
create trigger messages_ensure_member
  after insert on messages
  for each row execute function ensure_member();
