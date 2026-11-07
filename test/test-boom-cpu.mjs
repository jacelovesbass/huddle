// The computer opponent in Tic Tak Toe BOOM!
//
// Two kinds of check here, and they are worth different things.
//
// The cheap ones ask what the computer WOULD play in a position built move by
// move, without playing it. The expensive one plays a whole game against it.
//
// The test that matters is the trap: there is a bomb in that position which
// collapses the board into four for the HUMAN. It first proves the bomb really
// is that bad, then proves the computer did not take it. Asserting only the
// second would pass just as happily if the position were harmless.
import { launch, open, joinCode, until, closeSheet } from './helpers.mjs';
import path from 'node:path';

const browser = await launch();
const a = await open(browser, 'Jason');
await a.getByPlaceholder('Group name').fill('BOOM-TEST-ROOM');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.chat header');
await joinCode(a);

await a.locator('.tool.tool-games').click();
await a.waitForSelector('.sheet-card');
await a.locator('input[type=file]').setInputFiles(path.resolve('public/tic-tak-toe-boom.html'));
await a.waitForSelector('.game-row', { timeout: 20000 });
await a.locator('.game-play').click();
await a.waitForSelector('iframe.game-frame');

const g = a.frameLocator('iframe.game-frame');
await g.locator('#go').waitFor({ timeout: 10000 });

const state = () => g.locator('body').evaluate(() => window.__state());
const call = (fn, ...args) => g.locator('body').evaluate(
  (_el, [f, as]) => window[f](...as), [fn, args]);

async function drop(c) {
  const before = (await state()).moves;
  await call('__drop', c);
  const ok = await until(async () => {
    const s = await state();
    return s.moves > before && (!s.locked || s.over);
  }, { timeout: 5000, every: 60 });
  if (!ok) throw new Error(`drop in column ${c} never settled`);
}

/** Fresh board, in a named mode, without reloading the game.
    An earlier version of this only reset when the game had ENDED, so the
    scenarios after the first one stacked on a dirty board and three checks
    failed for a reason that had nothing to do with the computer. */
async function newGame(mode) {
  await call('__reset');
  await call('__mode', mode);
  await g.locator('#board').waitFor();
  const s = await state();
  const left = s.grid.flat().filter(v => v !== -1).length;
  if (left !== 0) throw new Error(`board not clean: ${left} tokens left`);
}

/* ---- The start screen offers the choice ---- */

await call('__mode', 'cpu');
const cpuShown = await g.locator('#cpuName').isVisible();
const n2Shown = await g.locator('#n2').isVisible();
console.log(cpuShown && !n2Shown
  ? 'PASS: choosing the computer replaces the second name box'
  : `FAIL: cpuName visible=${cpuShown} n2 visible=${n2Shown}`);

await call('__mode', 'friend');
console.log(await g.locator('#n2').isVisible()
  ? 'PASS: choosing a friend brings the name box back'
  : 'FAIL: the second name box did not come back');

/* ---- What it would play, in positions built by hand ---- */

await g.locator('#n1').fill('Jason');
await g.locator('#n2').fill('Foxy');
await g.locator('#go').click();
await g.locator('#board').waitFor();

// Take the win. Both players sit on three; the computer is amber and must
// finish rather than block, because finishing ends it.
for (const c of [0, 1, 0, 1, 0, 1]) await drop(c);
let move = await call('__choose');
console.log(move.kind === 'drop' && move.c === 1
  ? 'PASS: it takes an immediate win rather than blocking'
  : `FAIL: it chose ${JSON.stringify(move)}`);

// Block. The human holds three in a column and the computer holds nothing.
await newGame('friend');
for (const c of [0, 6, 0, 6, 0]) await drop(c);
move = await call('__choose');
console.log(move.kind === 'drop' && move.c === 0
  ? 'PASS: it blocks a three in a column'
  : `FAIL: it chose ${JSON.stringify(move)}`);

/* ---- The trap ---- */

await newGame('friend');
for (const c of [3, 3, 3, 2, 3, 2, 3, 1, 6, 1, 6]) await drop(c);

const worth = await call('__bombWorth', 2, 1);
console.log(worth === -1
  ? 'PASS: the bomb at column 2 really does collapse into a win for the human'
  : `FAIL: that bomb is worth ${worth}, so this position proves nothing`);

move = await call('__choose');
const tookIt = move.kind === 'bomb' && move.c === 2 && move.r === 1;
console.log(!tookIt
  ? `PASS: the computer did not take the losing bomb (it chose ${JSON.stringify(move)})`
  : 'FAIL: it bombed itself into a loss');
console.log(move.kind === 'drop' && move.c === 3
  ? 'PASS: it blocked the human\'s winning column instead'
  : `FAIL: expected a drop in column 3, got ${JSON.stringify(move)}`);

// No bomb it would ever choose should be a losing one.
const anyLosing = await g.locator('body').evaluate(() => {
  const s = window.__state();
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    if (s.grid[r][c] === -1) continue;
    if (window.__bombWorth(c, r) === -1) {
      const m = window.__choose();
      if (m.kind === 'bomb' && m.c === c && m.r === r) return `${c},${r}`;
    }
  }
  return null;
});
console.log(anyLosing === null
  ? 'PASS: it never picks a bomb that hands the game over'
  : `FAIL: it picked the losing bomb at ${anyLosing}`);

/* ---- A whole game against it ---- */

await newGame('cpu');
await g.locator('#board').waitFor();

const errors = [];
a.on('console', m => m.type() === 'error' && errors.push(m.text()));

// The human plays a plain, slightly greedy game: middle where possible.
//
// Waiting for "the turn is back to zero" does NOT work here. The turn only
// flips 330 ms after a drop, so that condition is still true the instant the
// call returns, and an earlier version of this loop fired forty human moves
// before the computer got one. Wait for the move COUNT to advance by two: mine
// and its reply.
let turns = 0;
while (turns < 25) {
  const s = await state();
  if (s.over) break;
  if (s.turn !== 0) { await a.waitForTimeout(200); continue; }
  const cols = [3, 2, 4, 1, 5, 0, 6];
  const col = cols.find(c => s.grid[5][c] === -1);
  if (col === undefined) break;
  const before = s.moves;
  await call('__drop', col);
  turns++;
  const replied = await until(async () => {
    const t = await state();
    return t.over || (t.moves >= before + 2 && t.turn === 0);
  }, { timeout: 10000, every: 150 });
  if (!replied) { console.log(`FAIL: the computer did not reply to move ${turns}`); break; }
}

const end = await state();
console.log(end.over
  ? `PASS: a full game against the computer finished (${await g.locator('#overBig').innerText()})`
  : `FAIL: still going after ${turns} human moves`);

console.log(end.moves >= turns * 2 - 1
  ? `PASS: the computer answered every move (${end.moves} moves total, ${turns} of them mine)`
  : `FAIL: ${end.moves} moves but the human made ${turns}`);

console.log(errors.length === 0
  ? 'PASS: no console errors during a full game'
  : `FAIL: ${errors.slice(0, 3).join(' | ')}`);

// Not asserted, because how often a bomb is worth playing depends on the game
// and a threshold here would just be flaky. Reported so it is visible when it
// drifts to always or never, either of which would mean the logic is wrong.
console.log(`  note: the computer finished that game with ${end.bombs[1]} of 3 bombs unused`);

/* ---- The human cannot play during the computer's turn ---- */

await newGame('cpu');
await call('__drop', 3);                       // my move, hands over
await until(async () => (await state()).turn === 1, { timeout: 5000, every: 50 });
const mid = await state();
await g.locator('.col[data-c="5"]').click({ force: true }).catch(() => {});
await g.locator('#boom1').click({ force: true }).catch(() => {});
await a.waitForTimeout(150);
const after = await state();
console.log(after.moves === mid.moves
  ? 'PASS: tapping the board while the computer thinks does nothing'
  : `FAIL: the human got a move in (${mid.moves} to ${after.moves})`);

// It has to answer quickly enough that a phone does not feel stuck.
await newGame('friend');
for (const c of [3, 3, 2, 4, 2, 2, 4, 1, 3, 5, 4]) await drop(c);
// Measure over enough runs to read, and check the thing actually returned a
// legal move. A timing assertion on its own would pass just as well if
// __choose did nothing at all, which is the whole point of the second half.
const timing = await g.locator('body').evaluate(() => {
  const N = 200;
  let legal = 0;
  const t = performance.now();
  for (let i = 0; i < N; i++) {
    const m = window.__choose();
    if (m && (m.kind === 'drop' ? m.c >= 0 && m.c < 7 : m.r >= 0 && m.r < 6)) legal++;
  }
  return { us: ((performance.now() - t) / N) * 1000, legal, N };
});
console.log(timing.legal === timing.N
  ? `PASS: ${timing.N} of ${timing.N} decisions were legal moves`
  : `FAIL: only ${timing.legal} of ${timing.N} were legal`);
console.log(timing.us < 150000
  ? `PASS: it decides in ${Math.round(timing.us)} microseconds, averaged over ${timing.N} runs`
  : `FAIL: ${Math.round(timing.us / 1000)} ms a move is too slow for a phone`);

await a.screenshot({ path: 'shot-boom-9-cpu.png' });
await closeSheet(a);
await browser.close();
