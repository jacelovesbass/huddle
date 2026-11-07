-- Close the database, part two: shut the door.
--
-- Migration 011 added identities and the join functions while leaving the old
-- `to anon using (true)` policies in place, so that both the old and the new
-- client worked. This one removes them.
--
-- **Gated.** `npm run migrate` will not run this file. It needs:
--   1. anonymous sign-in enabled on the Supabase project, and
--   2. the new client deployed and confirmed live.
-- Then: `npm run migrate -- --gate 012`
--
-- It is gated because it was once applied by an ordinary `npm run migrate`
-- while neither precondition held, and the live group lost access to their own
-- chat until it was rolled back.
--
-- **Run this only after the new client is deployed.** A browser still running
-- the previous build will stop being able to read anything until it reloads,
-- which the in-app update banner tells people to do.
--
-- After this, the publishable key on its own grants nothing at all.

-- ------------------------------------------------------------- the lockup
--
-- Every `to anon` policy is replaced by one `to authenticated` policy gated on
-- membership. Nothing is readable by the key alone any more.

drop policy if exists rooms_all    on rooms;
drop policy if exists messages_all on messages;
drop policy if exists members_all  on members;
drop policy if exists packs_all    on packs;
drop policy if exists emoji_all    on emoji;
drop policy if exists games_all    on games;

-- Rooms: read only, and only ones you are in. Creating goes through
-- create_room, so there is deliberately no insert policy.
create policy rooms_read on rooms
  for select to authenticated using (is_member(id));

-- Messages: read, post and edit within your own groups. Edit is needed
-- because a Versus board is one message rewritten on every turn.
create policy messages_read on messages
  for select to authenticated using (is_member(room_id));
create policy messages_write on messages
  for insert to authenticated with check (is_member(room_id));
create policy messages_edit on messages
  for update to authenticated using (is_member(room_id)) with check (is_member(room_id));

-- Members: see who else is in, and keep your own row current. Joining goes
-- through join_room, so there is no insert policy.
create policy members_read on members
  for select to authenticated using (is_member(room_id));
create policy members_touch on members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_leave on members
  for delete to authenticated using (user_id = auth.uid());

create policy packs_rw on packs
  for all to authenticated using (is_member(room_id)) with check (is_member(room_id));

-- Emoji carry room_id, kept true by the trigger from migration 008, which is
-- the only reason this can be a one line policy.
create policy emoji_rw on emoji
  for all to authenticated using (is_member(room_id)) with check (is_member(room_id));

create policy games_rw on games
  for all to authenticated using (is_member(room_id)) with check (is_member(room_id));

-- Belt and braces: even with a policy mistake, the anonymous role should hold
-- no table privileges at all.
revoke all on table rooms, messages, members, packs, emoji, games from anon;
