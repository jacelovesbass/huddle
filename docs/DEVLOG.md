# Dev log

What happened and why, in plain English. Not a changelog: `git log` already
lists what changed. This is for the reasoning, the wrong turns, and the things
that would otherwise have to be rediscovered.

**Newest first.** Add an entry when a session ends, not when a commit lands.

---

## 2026-11-07 — Tidying up

Nothing new for a user. A day of making the next change cheaper than the last.

**What the mess actually was.** The repo root held 45 loose scripts, 20 of them
one-off debug files written to answer a single question and never deleted.
`App.jsx` had grown to 707 lines holding nine components. Schema changes were
applied by editing a setup script by hand, so nothing recorded what had
actually been run against the database. The tests created rooms and abandoned
them, which is how a live database ended up with **127 rooms, 125 of them junk**.

**What changed.** Components split into one file each, with shared logic in
`src/lib`. Migrations ordered in files and recorded in a `schema_migrations`
table. Scripts and tests moved out of the root. ESLint added with the React
hooks rules, which found six real problems including a `setState` inside an
effect and a sparse array used as a default.

**Two things worth remembering from it.**

A test group was called **"Pure"** — the same name as the real group. Nothing
went wrong, but the cleanup routine deletes by name, so that was one typo away
from destroying a real conversation. Test fixtures should never be named
something a real thing might be called.

The refactor touched almost every file and was safe only because 37 browser
tests existed to say so. They ran green before and after. That is the entire
argument for having written them.

---

## 2026-11-06 — Emoji packs, GIFs, and working out what the product is

The day the project stopped being "a chat app" and became something with an
argument behind it.

**The argument, which is the MD's and took a while to surface.** Messenger's
toolbar already exists and is full of things nobody wants: bad games, worse GIF
search, embarrassing avatars. The gap is not features, it is that **the
catalogue belongs to somebody else**. A group reuses about twenty GIFs, and
searching a library of millions to find one of them is a tax you pay for not
owning it. Twenty needs no search at all.

So the product is: your own emoji, your own GIFs, eventually your own tools.
The incumbents cannot copy it, because their business model is keeping you
inside their catalogue.

**The pack format came out of that and is the piece most likely to outlive the
app.** A pack is an ordinary zip with a manifest, and an entry carries either a
bundled file *or* a URL. That one either/or is why a GIF pack exports at about
500 bytes carrying no pictures, and why bring-your-own-storage needs no new
code. Nobody else has a pack *file* — Telegram, Signal and WhatsApp all lock
the concept inside the app; Discord and Slack make you re-upload emoji one at
a time.

**A useful question that picked the architecture.** "How would this cost almost
nothing if everyone on earth used it?" Only a few designs survive it:
content-addressed URLs, dedupe, zero-egress storage, re-encode in the browser,
never let the origin touch the bytes. The MD then pushed past it to actual
zero, which produced the better answer: the pictures live in the user's own
cloud and the app holds a URL.

**Three defects, all found by a person, none by a test.**

1. Picking one emoji sent a different one. Both packs contained `:shocked:` and
   the lookup kept whichever loaded last. A member reported it inside the chat.
2. The GIF picker was empty after a day of sending GIFs, because it only showed
   things someone had explicitly saved.
3. No way back out of a chat. The only exit was "Leave group", which sounded
   destructive and only ever cleared which group you were in.

**This is now a pattern rather than a coincidence.** Across two days, every
defect of consequence was found by someone opening the app. The suites were
green throughout. A test written from the inside knows which box to fill in, so
it cannot notice that a person would not.

**Tests still earned their place, in the other direction.** Two real bugs
surfaced only because a test failed for a reason I did not expect and I looked
instead of retrying: messages lost between loading history and the socket going
live, and a realtime event that never fires for a row added to an existing
parent.

**Ruling GIPHY out properly took longer than building the alternative.** Their
signup kept failing on mobile; oEmbed returns 406 for everyone; the site
refuses non-browser requests whatever user agent you send. So there is no
key-free way to turn a GIF link into search terms, even server-side.

**Drawing takes iterations and the loop is short.** The capybaras took three
attempts to stop looking like teddy bears — the fix was a loaf-shaped head,
tiny flat ears and a broad snout. The unicorn horn took four to read as gold
rather than a dark smudge; the problem was that a thick outline on a narrow
cone swallows the fill. Each cycle was render, look, adjust, about ninety
seconds.

---

## 2026-11-05 — Built and deployed in one evening

Opened as a question and shipped the same night, for nothing.

**The plan written that morning was wrong, and the way it was wrong is the
lesson.** It specified a 30-day pilot on off-the-shelf software *before*
writing any code, reasoning that the build was the expensive half. The build
took one session and cost A$0: Vite, React, Supabase, GitHub Pages, all free
tiers. **When a build is genuinely free, building it is the cheap test**, and a
staged de-risking plan can cost more than the risk it manages.

**Giving the session eyes changed how it worked.** Playwright plus a screenshot
helper, so the running app could be looked at and its console errors read,
rather than relayed. Two of that day's three defects were found by looking.

**Hard-won specifics.** GitHub Pages will not serve a private repo on a free
plan. An installed iOS web app draws under the status bar, so the header needs
the safe-area inset or the clock lands on top of it. On a desktop, chat bubbles
pinned to opposite edges of a 1440px window read as unrelated messages; the fix
is a narrow centred column.

**And the one that was nobody's bug but mine:** the app folder started inside
the OneDrive-synced vault, which would have had OneDrive syncing `node_modules`
forever. Moved out before the first install finished.
