-- Tags make a library searchable once it outgrows a single screen.
alter table emoji add column if not exists tags text not null default '';
create index if not exists emoji_tags_idx on emoji using gin (to_tsvector('simple', tags));
