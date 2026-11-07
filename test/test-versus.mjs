// Versus: a game played live in the conversation.
//
// Two halves, and the first is the one that will matter in six months.
//
// BOOM's rules now exist TWICE: sealed inside public/tic-tak-toe-boom.html,
// which cannot import anything by definition, and in src/lib/boom.js, which
// the chat board uses. Two copies drift. So the first half runs the same move
// sequences through both and fails the moment they disagree about anything.
//
// The second half is two people actually playing through the chat.
import { launch, open, joinCode, until, closeSheet, BASE as URL } from './helpers.mjs';
import { replay, longest } from '../src/lib/boom.js';

const browser = await launch();

/* ==================== Half one: the two engines agree ==================== */

const solo = await (await browser.newContext({ viewport: { width: 390, height: 820 } })).newPage();
await solo.goto(`${URL}tic-tak-toe-boom.html`);
await solo.locator('#go').waitFor({ timeout: 15000 });
await solo.locator('#n1').fill('A');
await solo.locator('#n2').fill('B');
await solo.locator('#go').click();
await solo.locator('#board').waitFor();

// Each case is a move list in the shared format: {d: col} or {b: [col, row]}.
const CASES = [
  { why: 'a plain vertical four', moves: [0, 1, 0, 1, 0, 1, 0].map(d => ({ d })) },
  { why: 'a wandering midgame', moves: [3, 3, 2, 4, 2, 2, 4, 1, 3, 5, 4].map(d => ({ d })) },
  {
    why: 'the bomb that collapses into a four for the other player',
    moves: [...[3, 3, 3, 2, 3, 2, 3, 1, 6, 1, 6].map(d => ({ d })), { b: [2, 1] }],
  },
  {
    why: 'a bomb on an almost empty board',
    moves: [...[3, 3, 2].map(d => ({ d })), { b: [3, 0] }, { d: 4 }],
  },
];

for (const c of CASES) {
  await solo.evaluate(() => window.__reset());
  for (const m of c.moves) {
    if (m.d !== undefined) await solo.evaluate(n => window.__drop(n), m.d);
    else await solo.evaluate(b => window.__bomb(b[0], b[1]), m.b);
    await solo.waitForFunction(() => !window.__state().locked || window.__state().over,
      null, { timeout: 5000 }).catch(() => {});
  }
  await solo.waitForTimeout(250);
  const sealed = await solo.evaluate(() => {
    const s = window.__state();
    return { grid: s.grid, longest: s.longest, over: s.over, bombs: s.bombs };
  });
  const shared = replay(c.moves);

  const gridSame = JSON.stringify(sealed.grid) === JSON.stringify(shared.board);
  const longSame = sealed.longest[0] === longest(shared.board, 0)
                && sealed.longest[1] === longest(shared.board, 1);
  const overSame = sealed.over === shared.done;
  const bombSame = JSON.stringify(sealed.bombs) === JSON.stringify(shared.bombs);

  console.log(gridSame && longSame && overSame && bombSame
    ? `PASS: both engines agree on ${c.why}`
    : `FAIL: engines differ on ${c.why}\n  sealed ${JSON.stringify(sealed)}\n  shared ${JSON.stringify({ board: shared.board, bombs: shared.bombs, done: shared.done })}`);
}

await solo.close();

/* ==================== Half two: two people, one board ==================== */

const a = await open(browser, 'Jason');
await a.getByPlaceholder('Group name').fill('BOOM-TEST-ROOM');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.chat header');
const code = await joinCode(a);

const b = await open(browser, 'Foxy', `${URL}#${code}`);
await b.waitForSelector('.chat header');

// Versus is its own button, not the Games one.
console.log(await a.locator('.tool.tool-versus').count() === 1
    && await a.locator('.tool.tool-games').count() === 1
  ? 'PASS: Versus is a separate button beside Games'
  : 'FAIL: the two tools are not both on the bar');

// Wait for Foxy to actually be on Jason's roster before challenging her.
await until(async () => /People\s*2/.test(await a.locator('header .actions').innerText()),
  { timeout: 15000, every: 250 });

await a.locator('.tool.tool-versus').click();
await a.waitForSelector('.sheet-card');
await a.getByRole('button', { name: /Challenge Foxy/ }).click();

await a.waitForSelector('.versus', { timeout: 15000 });
const arrived = await b.waitForSelector('.versus', { timeout: 15000 }).then(() => true).catch(() => false);
console.log(arrived
  ? 'PASS: the board appeared in both conversations'
  : 'FAIL: the challenged player never saw the board');

const cell = (page, col) => page.locator('.vrow').last().locator('.vcell').nth(col);
const filled = page => page.locator('.vcell.vp1, .vcell.vp2').count();

// Foxy must not be able to move on Jason's turn.
const foxyBlocked = await cell(b, 2).isDisabled();
console.log(foxyBlocked
  ? 'PASS: the player not on turn cannot move'
  : 'FAIL: Foxy could play on Jason\'s turn');

/** Play one move and wait for the other phone to show it. */
async function move(page, other, col) {
  const before = await filled(other);
  await cell(page, col).click();
  const ok = await until(async () => (await filled(other)) > before, { timeout: 15000, every: 250 });
  if (!ok) throw new Error(`move in column ${col} never reached the other client`);
}

await move(a, b, 0);
console.log(await cell(a, 1).isDisabled()
  ? 'PASS: after moving, it is not your turn any more'
  : 'FAIL: Jason could move twice');

await move(b, a, 1);
await move(a, b, 0);
await move(b, a, 1);
await move(a, b, 0);
await move(b, a, 1);

// The fourth token in column 0 finishes it.
await cell(a, 0).click();
const ended = await until(async () =>
  (await b.locator('.versus-foot strong').count()) > 0, { timeout: 15000, every: 250 });
console.log(ended
  ? `PASS: the other player saw the result (${await b.locator('.versus-foot strong').innerText()})`
  : 'FAIL: the game never resolved on the other client');

const text = await b.locator('.versus-foot strong').innerText();
console.log(/Jason wins, 4 in a row/.test(text)
  ? 'PASS: the winner and the run are right'
  : `FAIL: it says "${text}"`);

// A finished board must be dead on both phones.
console.log(await cell(a, 5).isDisabled() && await cell(b, 5).isDisabled()
  ? 'PASS: a finished game takes no more moves'
  : 'FAIL: the board is still live after a win');

// One message, edited, not a conversation full of moves.
const rows = await a.locator('.row').count();
console.log(rows === 1
  ? 'PASS: the whole game is one message, not one per move'
  : `FAIL: the chat holds ${rows} messages`);

/* ---- Rematch, which is how a second game ever happens ---- */

await b.getByRole('button', { name: 'Rematch' }).click();
const second = await until(async () => (await a.locator('.versus').count()) === 2,
  { timeout: 15000, every: 250 });
console.log(second
  ? 'PASS: a rematch starts a second board, visible to both'
  : 'FAIL: the rematch never reached the other client');

// The loser goes first, so Foxy can move and Jason cannot.
const board2 = page => page.locator('.versus').last().locator('.vrow').last().locator('.vcell');
console.log(!(await board2(b).nth(3).isDisabled()) && await board2(a).nth(3).isDisabled()
  ? 'PASS: the loser starts the rematch'
  : 'FAIL: the wrong player is on turn in the rematch');

// Somebody who is not playing can watch but not touch.
const c = await open(browser, 'Poop', `${URL}#${code}`);
await c.waitForSelector('.versus', { timeout: 15000 });
const watcherLocked = await cell(c, 3).isDisabled();
console.log(watcherLocked
  ? 'PASS: a third person sees the board and cannot play it'
  : 'FAIL: a bystander could move');

await a.screenshot({ path: 'shot-versus-1-chat.png' });
await closeSheet(a);
await browser.close();
