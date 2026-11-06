# Pure Chat

A small private group messaging web app. Invite-only, no feed, no algorithm,
no ads, and **the material in it belongs to the group**: your own emoji, your
own GIFs, your own packs that you can take away with you.

**Live:** https://jacelovesbass.github.io/purechat/
**Docs:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[docs/DEVLOG.md](docs/DEVLOG.md) · [docs/DECISIONS.md](docs/DECISIONS.md) ·
[PACK_FORMAT.md](PACK_FORMAT.md)

## Getting it running

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase details
npm run migrate                # bring the database up to date
npm run dev                    # http://localhost:5173
```

`.env.local` is never committed. It needs:

| Key | What it is |
|---|---|
| `VITE_SUPABASE_URL` | Project URL from Supabase, Settings → API |
| `VITE_SUPABASE_ANON_KEY` | The publishable key. Public by design; it ships in the browser bundle |
| `SUPABASE_DB_PASSWORD` | Postgres password. **A real secret**, used only by scripts, never by the app |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint, including the React hooks rules |
| `npm run check` | Lint then build. Run this before pushing |
| `npm test` | Every browser test, then removes the rooms they created |
| `npm run migrate` | Applies any unapplied migration |
| `npm run shot -- <url> out.png` | Screenshot a running page |

## How it is laid out

```
src/
  App.jsx            which of the three screens you are on, and nothing else
  components/        one component per file
  lib/
    packs.js         pack reading, image normalising, shortcode encoding
    storage.js       what this browser remembers
    supabase.js      the client
migrations/          ordered SQL, applied once, recorded in schema_migrations
scripts/             tooling: db, screenshots, pack generators, test runner
test/                browser tests, one file per area
packs/               generated sample packs
docs/                architecture, dev log, decisions
```

## Testing

The tests drive real browsers against a real database. There are no mocks,
because the bugs worth catching here are about several clients seeing the same
thing at the same time.

```bash
npm test                                            # against localhost
TEST_URL=https://jacelovesbass.github.io/purechat/ npm test   # against production
```

**A test that does not clean up is not finished.** `scripts/test-all.mjs`
removes the rooms each run created. Its delete is narrow on purpose: the name
must be one the suites use, the room must be less than two hours old, and it
must not be on the keep list.

**What the tests cannot do**, and this is the important part: every defect of
consequence so far has been found by a person opening the app, not by a suite.
A test written from the inside knows which box to fill in, so it cannot notice
that a person would not. Use the tests to stop regressions; use a human to find
out whether the thing makes sense.

## Deploying

Push to `main`. GitHub Actions builds and publishes to Pages, and stamps
`version.json` with the commit, which is how a running copy notices it is out
of date and offers to update.

## What this does not do

No accounts, no end-to-end encryption, and **the database is currently readable
by anyone holding the publishable key**, which is published in the bundle. See
[docs/DECISIONS.md](docs/DECISIONS.md). Do not put anything private in it.
