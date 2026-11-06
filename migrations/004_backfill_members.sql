-- Anyone who has ever posted is a member. Backfills rooms that predate the
-- members table, and repairs anyone running an old cached bundle.
insert into members (room_id, name, joined_at, last_seen)
select m.room_id, m.author, min(m.created_at), max(m.created_at)
from messages m
group by m.room_id, m.author
on conflict (room_id, name) do nothing;
