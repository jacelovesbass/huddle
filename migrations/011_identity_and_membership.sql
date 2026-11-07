-- Close the database, part one: give every device an identity.
--
-- Until now every table said `for all to anon using (true)`, which means the
-- publishable key that ships in the browser bundle could read and write
-- everything: every group, every join code, every message. Demonstrated twice,
-- with one command and no login, against the real database.
--
-- This half adds the identity and the doors. **It deliberately leaves the old
-- permissive policies in place**, so a client that has not reloaded yet keeps
-- working. Migration 012 is the one that shuts the door, and it is only safe
-- to run once the new client is deployed. Doing both at once would break the
-- app for everyone in the gap between the migration and the deploy.

-- ---------------------------------------------------------------- identity

alter table members add column if not exists user_id uuid;
create index if not exists members_user_idx on members (room_id, user_id);

-- Rows that predate this migration have no owner. The first device to claim a
-- name takes it, which is how the four people already in Pure Empathy keep
-- their membership without doing anything.

-- ------------------------------------------------------------- the gate

-- Security definer so the members policy can call it without recursing into
-- itself. Stable so the planner calls it once per statement, not per row.
create or replace function public.is_member(p_room uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members
    where room_id = p_room and user_id = auth.uid()
  );
$$;

revoke all on function public.is_member(uuid) from public;
grant execute on function public.is_member(uuid) to authenticated;

-- --------------------------------------------------------------- finding

-- The only way to learn a room exists. You must already hold its code, which
-- is exactly the property the old `select * from rooms` destroyed.
create or replace function public.find_room(p_code text)
returns rooms
language sql stable security definer set search_path = public as $$
  select * from rooms where join_code = upper(trim(p_code));
$$;

revoke all on function public.find_room(text) from public;
grant execute on function public.find_room(text) to authenticated;

-- --------------------------------------------------------------- joining

-- Idempotent: safe to call on every chat open, which is what the client does.
create or replace function public.join_room(p_code text, p_name text)
returns rooms
language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  v_name text := nullif(btrim(p_name), '');
  v_try int := 1;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if v_name is null then
    raise exception 'a name is required';
  end if;

  select * into r from rooms where join_code = upper(btrim(p_code));
  if not found then
    return null;
  end if;

  -- Already a member: this is a rename and a heartbeat.
  if exists (select 1 from members where room_id = r.id and user_id = auth.uid()) then
    update members set name = v_name, last_seen = now()
    where room_id = r.id and user_id = auth.uid();
    return r;
  end if;

  -- Claim an unowned row with my name. This is the upgrade path for everyone
  -- who was already in a group before identities existed.
  update members set user_id = auth.uid(), last_seen = now()
  where room_id = r.id and name = v_name and user_id is null;
  if found then
    return r;
  end if;

  -- Otherwise take a seat, disambiguating if the name is already somebody's.
  loop
    begin
      insert into members (room_id, name, user_id) values (r.id, v_name, auth.uid());
      return r;
    exception when unique_violation then
      v_try := v_try + 1;
      v_name := btrim(p_name) || ' (' || v_try || ')';
      if v_try > 20 then raise exception 'could not find a free name'; end if;
    end;
  end loop;
end; $$;

revoke all on function public.join_room(text, text) from public;
grant execute on function public.join_room(text, text) to authenticated;

-- -------------------------------------------------------------- creating

create or replace function public.create_room(p_name text, p_code text, p_member text)
returns rooms
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if nullif(btrim(p_name), '') is null or nullif(btrim(p_member), '') is null then
    raise exception 'a group name and a member name are required';
  end if;

  insert into rooms (name, join_code)
  values (btrim(p_name), upper(btrim(p_code)))
  returning * into r;

  insert into members (room_id, name, user_id)
  values (r.id, btrim(p_member), auth.uid());

  return r;
end; $$;

revoke all on function public.create_room(text, text, text) from public;
grant execute on function public.create_room(text, text, text) to authenticated;

