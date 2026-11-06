# Working on Pure Chat

The short version of how to keep this from rotting.

## Before you push

```bash
npm run check    # lint + build
npm test         # every browser test, then cleans up after itself
```

Both must pass. `npm test` needs the dev server running, or `TEST_URL` pointed
at a deployed copy.

## Conventions

**One component per file**, in `src/components`. Shared logic goes in
`src/lib`. `App.jsx` decides which screen you are on and nothing else. When a
component passes roughly 200 lines, that is the signal to split it, not a rule
to argue with.

**Comments explain why, never what.** `// increments the counter` is noise.
`// Subscribe before reading history, because a message arriving in the gap is
lost until a reload` is the comment that stops someone undoing a fix. If a line
exists because something went wrong once, say what went wrong.

**Schema changes are new migration files.** Never edit one that has been
applied. Number them in sequence and make them safe to run twice: `if not
exists`, `on conflict do nothing`, and a guard around `alter publication`.

**Secrets live in `.env.local` only.** The publishable key is public by
design and may appear anywhere. The Postgres password is a real secret, is used
only by `scripts/`, and must never reach the browser bundle.

## Tests

They drive real browsers against a real database. No mocks, because the bugs
worth catching are about several clients seeing the same thing at once.

- **Wait for a condition, never a fixed delay.** `waitForTimeout` as an
  assertion is how a suite becomes flaky. Poll for the state you expect.
- **A failing UI test is more often the test than the app** — usually it acted
  before the page finished loading. "More often" is not "always": look before
  you assume.
- **Clean up.** `scripts/test-all.mjs` removes rooms by name, age and a keep
  list. If you add a suite, add its room name there.
- **Never name a fixture something real might be called.** A test group called
  "Pure" was one typo from deleting the real group of that name.

## What tests will not do for you

Every defect of consequence in this project so far was found by a person
opening the app, never by a suite: a first screen that offered "Join code" to
someone with no code, a header under the iOS clock, a picker that sent a
different emoji from the one tapped, an empty GIF library, no way back out of a
chat. All suites were green throughout.

The reason is structural. A test is written by someone who knows which box to
fill in, so it cannot notice that a person would not know. **Use tests to stop
regressions. Use a human to find out whether the thing makes sense.** Take
"that's not what I selected" as a defect report, not confusion.

## Writing things down

| Where | What goes in it |
|---|---|
| `docs/DEVLOG.md` | What happened in a session and why, in plain English. Wrong turns included |
| `docs/DECISIONS.md` | A choice and the reason behind it, so a later change argues with the reason |
| `docs/ARCHITECTURE.md` | How it fits together. Update when the shape changes |
| `PACK_FORMAT.md` | The pack format. It is a contract with other people's files: version it, do not quietly change it |
| Commit messages | What changed and why. If it fixes something a person reported, say so |

Add a DEVLOG entry at the end of a session, not per commit. A decision goes in
DECISIONS the moment it is made, because the reason is what evaporates.
