# Proposal: getting ready for games and whatever comes after

**2026-11-07.** Written before building games, because the shape of the next
feature decides whether the one after it is cheap or expensive.

## The one decision that matters

**Today a "tool" is hardcoded.** The emoji button and the GIF button are both
written directly into `Chat.jsx`, each with its own sheet, its own state, and
its own wiring. Adding games the same way means a third set, and `Chat.jsx`
grows past 300 lines doing five unrelated jobs.

That matters more here than in most apps, because the MD's stated product is
**a customisable bar where people bring their own tools**. If every tool
requires editing the chat component, the bar can never become that. The bar is
the product; it should have a contract.

### Proposed: a tool is a registration

```js
// src/tools/index.js
export const TOOLS = [emojiTool, gifTool /*, gameTool, ... */];

// src/tools/emoji.js
export const emojiTool = {
  id: 'emoji',
  label: 'Emoji',
  icon: '☺',
  Sheet: EmojiSheet,          // opened when the button is tapped
  render: undefined,          // optional: how to draw its messages
};
```

The bar maps over `TOOLS`. `Chat.jsx` knows that tools exist and nothing about
what any of them do.

**Build the built-ins through the same interface.** If emoji and GIF use a
private path and games use the public one, the public one rots before anyone
outside ever touches it. Two real tools going through the contract is what
proves the contract.

**What this buys immediately:** games is a new file, not a change to the chat.
Per-user bar configuration becomes "which ids are in your list". A third-party
tool later is the same object with its `Sheet` living in a sandboxed iframe
talking over `postMessage`, which is the only safe way to run someone else's
code in a chat.

**Cost:** about half a day, and the 37 tests make it safe.

## Messages need to carry more than text

A game is not a sentence. Today `messages.body` is text, with `[[e:id]]` tokens
and bare URLs picked out by the renderer. A game move, a poll, a scoreboard,
all need structure.

**Proposed:** add `kind text default 'text'` and `payload jsonb` to `messages`.
A renderer is registered per kind, the same way a tool is. Text messages are
unchanged, so nothing migrates and nothing breaks.

```
kind='text'   body='nice one [[e:...]]'
kind='game'   payload={ game:'wordle', state:{...} }
```

**Why now rather than later:** it is a two-line migration today and a rewrite of
every message once games exist in the body as encoded text.

## Scale: four measured problems, worst first

Numbers measured today, not estimated.

### 1. A broadcast storm waiting to happen, and it is my bug
Every client subscribes to **`emoji` changes with no filter**, because an emoji
row carries a pack, not a room. So one person keeping a GIF in one group makes
**every client in every group** reload its packs. At four people it is
invisible; at a thousand rooms it is a self-inflicted denial of service.

**Fix:** denormalise `room_id` onto `emoji` and filter the subscription, or
broadcast a small room-scoped event instead of watching the table. Half an hour.
**This is worth doing regardless of scale, because it is simply wrong.**

### 2. Emoji images live in database rows
24 emoji, averaging **10.5 KB each as `data:` URLs**, and the `emoji` table is
already **952 KB**. Every client downloads every emoji in the room on load,
inside the row payload: no CDN, no browser cache, no conditional request.

**Fix, in order of appetite:** prefer links wherever possible (already the
default for GIFs); then, if stored images stay, move them to Supabase Storage or
an R2 bucket with content-addressed names and `immutable` caching, leaving a URL
in the row. The code does not care — `emoji.url` is already either kind.

### 3. Message history has no paging
`limit(200)` and no way to go further back. A group that actually sticks hits
this in weeks, and then silently loses its own history from view.

**Fix:** keyset pagination on `created_at`, load older on scroll. A few hours.

### 4. One 554 KB bundle
**554 KB raw, 160 KB gzipped, in a single chunk.** JSZip is in it, loaded by
everyone on first visit even though it is only needed when importing or
exporting a pack.

**Fix:** dynamic `import()` for the pack code and per-tool code splitting, which
falls out naturally from the tool registry. Expect to roughly halve first load.

## Tidy-up still outstanding

Mechanical, from today's audit. Listed so it does not evaporate.

| Item | Why | Size |
|---|---|---|
| Migrate the ten suites onto `test/helpers.mjs` | I wrote the helper today and no suite uses it. Each still carries its own boilerplate | 1 hr |
| Delete `setup-db.mjs`, `baseline.mjs`, `cleanup_test_rooms.mjs` | Superseded or spent, referenced by nothing | 10 min |
| Split `styles.css` (389 lines) | One file, no sectioning. Split per component area | 30 min |
| Split `Chat.jsx` (230 lines) | Messages, presence, packs, invite and sending in one place. Falls out of the tool registry anyway | with the registry |
| Split `packs.js` (224 lines) | Four concerns: zip, image processing, URL parsing, shortcode encoding | 1 hr |

## What I would deliberately not do yet

Worth stating, because "thinking about scaling" is how a four-person app
acquires the architecture of a thousand-person one and stops moving.

- **No state management library.** Props and local state are fine at this size.
- **No server of our own.** The moment there is one, the cost stops being zero
  and the deployment stops being a static push.
- **No TypeScript.** Defensible later; today it is a large change for a codebase
  whose bugs have all been behavioural, not type errors.
- **No caching layer, no queue, no CDN of our own.** Not the bottleneck and may
  never be.
- **No premature multi-tenancy.** Rooms are already the tenant boundary.

## Suggested order

**Before games:**
1. Fix the unfiltered `emoji` subscription (half an hour, it is a defect)
2. The tool registry, with emoji and GIF moved onto it (half a day)
3. `kind` and `payload` on messages (ten minutes, unblocks everything structured)
4. The tidy-up list above (two to three hours)

**Then games**, as the first tool built entirely through the public contract.

**After, when something actually hurts:** message paging, moving stored images
out of rows, code splitting.

## The thing none of this addresses

**The database is still readable by anyone holding the published key.** Games
will add more of other people's data to it. This proposal does not fix that and
should not be read as if it does. It is still costed at about half a day for
anonymous sign-in plus membership rules, and still undecided.
