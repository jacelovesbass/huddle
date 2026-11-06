# Dev log

What happened and why, in plain English. Not a changelog: `git log` already
lists what changed. This is for the reasoning, the wrong turns, and the things
that would otherwise have to be rediscovered.

**Newest first.** Add an entry when a session ends, not when a commit lands.

---

## 2026-11-07 — Tic Tak Toe BOOM! (later the same day)

The first game written for this app rather than imported into it. Four in a
row on a seven by six board with gravity, two players sharing one phone, and
three bombs each.

**The bomb is the whole game.** Tap BOOM, tap any token, and that token plus
all eight around it are destroyed, your own included. It costs your whole turn,
and everything above the hole falls into it.

**The rule that took the thought, and the MD set it.** A four made by the
collapse counts, whoever it belongs to. So a bomb can hand your opponent the
game. If the dust settles and both players hold four, the **longer line wins**,
and an equal longest is a dead heat. That is why `longest()` returns a length
rather than a boolean: a win test would have been enough for a plain drop, and
useless for arbitrating a double.

**The test is the part worth keeping.** `test/test-boom.mjs` builds a real
board by dropping twenty tokens, has **player two** bomb it, and asserts the
collapse gives **player one a five in a row** and wipes player two off the
board entirely. Driving the real entry points move by move is what makes it
evidence. A forced end state would have proved only that the overlay renders.
It also checks gravity still holds afterwards, because a board with a token
floating above a hole is lying about itself.

**Found by reading the host, not by guessing.** `games.jsx` closes the player
the instant a score is posted. So the result cannot post itself: the win screen
comes first, offering Rematch or Post, and the test asserts nothing reaches the
chat until somebody asks. The board also lifts and shrinks when the game ends
so the winning line stays visible behind the sheet, which only came up because
the first screenshot had the overlay sitting squarely on top of the five in a
row that had just been made.

**Four defects the screenshots caught and the suite did not**, which is the
project's usual pattern: a player name truncated to "Jas...", a bomb pip that
did not burn down until the turn handed over, the end sheet covering the
winning line, and a heavy dim exactly where a four usually sits. All four were
visible in a picture and invisible to an assertion.

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


## 2026-11-07 — Tidy up, a tool contract, and games

Three things, in that order, because the second depended on the first and the
third proved the second.

**Cleared 125 junk rooms** from a live database, left by tests that never tidied
up. The rooms were the symptom; the missing teardown was the defect, and
`scripts/test-all.mjs` now removes what each run creates. Narrowly: name must
match, room must be under two hours old, keep list respected. A test group was
called **"Pure"**, the same as the real group, which was one typo from deleting
a real conversation.

**Then the tidy-up.** 45 loose scripts in the root, 20 of them one-off debug
files; schema applied by hand-editing a script with no record of what had run;
`App.jsx` at 707 lines holding nine components; no linting. Now: ordered
migrations in a `schema_migrations` table, `scripts/` and `test/`, components
one per file, ESLint with the hooks rules enforced in CI. Six real lint
findings, all fixed rather than silenced.

**My own ESLint install broke the deploy**, and this is the bit worth
remembering. `--legacy-peer-deps` locally hid a genuine conflict that CI's
strict `npm ci` would not tolerate, so two deploys failed and the live site sat
on the pre-refactor build. Nobody noticed because the local run was green.
**A green terminal says nothing about production.** Lint now runs in CI and the
habit now is to check the URL.

**The tool contract.** The stated product is a bar where people bring their own
tools, and a tool was hardcoded into `Chat.jsx`. Those cannot both be true. A
tool is now `{id, label, icon, Sheet, render?}` in `src/tools/`, the bar maps
over the registry, and `Chat` knows tools exist and nothing else. Emoji and GIF
were moved onto the same contract a third party would use, because a private
path for the built-ins rots the public one.

**A dice tool proved the contract and was then deleted**, which was the right
life for it. The MD was blunt about it not being the point, and he was right:
it was scaffolding, not a game.

**Games.** One HTML file, run in an iframe with `sandbox="allow-scripts"` and
never `allow-same-origin`, so the game sits in an opaque origin with no
cookies, no storage, no DOM access and no route to the database. The host API
is three messages wide on purpose: everything added is something a hostile game
can try. Written entirely through the tool contract, which is the contract
paying for itself the first time it was used in anger.

**Kelp Diver is the evidence.** A 1200-line canvas game written in another
session, 45 KB, installed unmodified and ran with zero console errors. A second
member of the group saw it in their list without installing anything. That is
much stronger than a fixture I wrote to pass my own test. The only change was
nine lines posting the dive total to the chat, guarded so it is inert outside
Pure Chat, and flagged rather than slipped in.

**Also found and fixed: an unfiltered realtime subscription I introduced**
earlier in the week. Every client in every room reloaded its packs on any emoji
change anywhere. Invisible at four people, an outage at a thousand rooms.
`emoji` rows now carry `room_id`, kept true by a trigger. The test checks both
that another room does not wake you *and* that your own still does, so the
assertion cannot pass by the subscription being broken entirely.

**State:** 61 tests, 10 migrations, 14 suites, 560 KB bundle, A$0 spent.

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
