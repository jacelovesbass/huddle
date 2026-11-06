-- Messages need to carry more than a sentence. A game move, a poll or a
-- scoreboard has structure that does not survive being encoded into text.
--
-- Existing rows are text and stay text, so nothing migrates and no renderer
-- changes. A new kind brings its own renderer, registered like a tool.
alter table messages add column if not exists kind text not null default 'text';
alter table messages add column if not exists payload jsonb;

create index if not exists messages_kind_idx on messages (room_id, kind);
