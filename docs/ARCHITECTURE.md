# How Pure Chat works

Written for someone who has never seen it, including a future version of
whoever wrote it.

## The shape of it

A React app in the browser talking straight to Supabase. **There is no server
of our own**, no API layer, and nothing to deploy beyond static files.

```
browser  ──────────────▶  Supabase Postgres        rows: rooms, members,
   │                         + Realtime              messages, packs, emoji
   │
   └─ static files from GitHub Pages
```

That is the whole system. It is a deliberate consequence of the product idea:
if the app stores nothing and runs nothing, it costs nothing, and the material
can belong to the people using it.

## The five tables

| Table | Holds | Notes |
|---|---|---|
| `rooms` | A group: name, five-character `join_code` | The code is the only access control there is |
| `members` | Who has been in a room, and when last seen | Written by a trigger when you post, so a stale client cannot get it wrong |
| `messages` | `room_id`, `author`, `body` | `body` carries `[[e:id]]` tokens, never shortcodes |
| `packs` | An emoji pack belonging to a room | "Saved GIFs" is an ordinary pack with a special name |
| `emoji` | `name`, `url`, `tags` | **`url` may be `https:` or `data:`.** Everything downstream is indifferent |

## Three ideas worth understanding

### 1. A message carries the picture, not the word

Typing `:kev:` is a convenience on the sender's keyboard. What is stored is
`[[e:<uuid>]]`, and every client in the room resolves that against the room's
packs. **So somebody who never installed the pack still sees the picture**
rather than a word in colons.

The picker also records the exact id it offered, because two packs may both
contain `:shocked:`. Relying on the name alone once sent the wrong emoji.

### 2. An emoji is a URL, and that is the whole trick

`emoji.url` holds `https://...` for a linked GIF, or `data:image/webp;base64,...`
for an imported image. The renderer cannot tell the difference and does not
care. This is why:

- a pack can bundle its pictures or point at them, with no special cases
- a GIF pack exports as about 500 bytes carrying no images
- bring-your-own-storage needs no new code, only a different URL

### 3. Subscribe before reading history

Realtime and the initial fetch race each other. If history is read first, a
message arriving in the gap is lost until a reload. So the client subscribes,
waits for `SUBSCRIBED`, *then* reads history and merges by id.

The same applies to packs: a row added to an existing pack fires no event on
the `packs` table, so the client watches `emoji` as well.

## Where state lives

| State | Where | Why |
|---|---|---|
| Your name, current room, groups you have seen | `localStorage` | There are no accounts |
| Messages, members, packs, emoji | Postgres | Shared, so it has to be |
| Who is online now | Supabase Realtime presence | Ephemeral by nature; nothing to persist |
| Which build you are running | `version.json` + a build-time constant | An installed web app caches hard |

## Access control, honestly

There is effectively none. Row level security is enabled on every table and
every policy allows the `anon` role to do anything. The join code keeps groups
apart in the interface, not in the database.

**Anyone holding the publishable key can read every message in every group**,
and that key ships in the browser bundle. This is a known, recorded, undecided
problem: see [DECISIONS.md](DECISIONS.md).

## Deployment

Push to `main` → GitHub Actions builds with `BASE_PATH=/purechat/` and a
`VITE_BUILD` stamp → publishes to Pages, alongside a `version.json` holding the
same commit. A running client polls that file and offers to update when the two
differ.
