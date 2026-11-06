// Tic Tak Toe BOOM!: drive a real game move by move and check the rules the
// MD actually set, rather than forcing an end state and asserting it arrived.
//
// The valuable test here is the second game. It builds a board by dropping
// eleven tokens, then has PLAYER TWO bomb it, and the collapse hands PLAYER
// ONE a four in a row. That is the whole point of the bomb: it can lose you
// the game. A test that only checked a plain vertical four would have proved
// nothing about the rule that was hard to get right.
import { launch, open, joinCode, until, closeSheet, BASE as URL } from './helpers.mjs';
import path from 'node:path';

const browser = await launch();
const a = await open(browser, 'Jason');
await a.getByPlaceholder('Group name').fill('BOOM-TEST-ROOM');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.chat header');
const code = await joinCode(a);

const b = await open(browser, 'Foxy', `${URL}#${code}`);
await b.waitForSelector('.chat header');

// Install it the way a person would, from a file.
await a.locator('.tool.tool-games').click();
await a.waitForSelector('.sheet-card');
await a.locator('input[type=file]').setInputFiles(path.resolve('public/tic-tak-toe-boom.html'));
await a.waitForSelector('.game-row', { timeout: 20000 });
await a.locator('.game-play').click();
await a.waitForSelector('iframe.game-frame');

const g = a.frameLocator('iframe.game-frame');
await g.locator('#go').waitFor({ timeout: 10000 });
console.log('PASS: the game loaded and rendered inside the frame');

// The sandbox is the only thing between an AI-written file and the chat.
const sandbox = await a.locator('iframe.game-frame').getAttribute('sandbox');
console.log(sandbox === 'allow-scripts'
  ? 'PASS: sandbox is allow-scripts only, no allow-same-origin'
  : `FAIL: sandbox is "${sandbox}"`);

const reachable = await a.evaluate(() => {
  try { return !!document.querySelector('iframe.game-frame').contentDocument; }
  catch { return false; }
});
console.log(reachable === false
  ? 'PASS: the host cannot reach into the frame, so the frame cannot reach out'
  : 'FAIL: the frame is same-origin and the sandbox is not doing its job');

// The handshake prefills whoever's chat this is.
const prefill = await g.locator('#n1').inputValue();
console.log(prefill === 'Jason'
  ? 'PASS: the host handshake prefilled player one as Jason'
  : `FAIL: player one prefilled as "${prefill}"`);

await g.locator('#n2').fill('Foxy');
await g.locator('#go').click();
await g.locator('#board').waitFor();

const state = () => g.locator('body').evaluate(() => window.__state());
// locator.evaluate hands the callback (element, arg), so the payload is second.
const call = (fn, ...args) => g.locator('body').evaluate(
  (_el, [f, as]) => window[f](...as), [fn, args]);

/** Drop, then wait for the turn to actually hand over before the next one. */
async function drop(c) {
  const before = (await state()).moves;
  await call('__drop', c);
  const ok = await until(async () => {
    const s = await state();
    return s.moves > before && (!s.locked || s.over);
  }, { timeout: 5000, every: 60 });
  if (!ok) throw new Error(`drop in column ${c} never settled`);
}

/* ---- Game one: a plain vertical four ---- */

for (const c of [0, 1, 0, 1, 0, 1, 0]) {
  const s = await state();
  if (s.over) break;
  await drop(c);
}

await a.waitForTimeout(1000); // the overlay is held back so the win can be seen
let s = await state();
console.log(s.over && s.longest[0] === 4
  ? 'PASS: four in a column wins, and the game ends on it'
  : `FAIL: over=${s.over} longest=${JSON.stringify(s.longest)}`);

const big = await g.locator('#overBig').innerText();
console.log(big === 'Jason wins' ? 'PASS: the winner is named' : `FAIL: overlay says "${big}"`);

// Nothing may reach the chat until somebody asks for it, because posting a
// score is what closes the game.
const early = await b.locator('.score-card').count();
console.log(early === 0
  ? 'PASS: nothing posted to the chat on its own'
  : `FAIL: ${early} score cards arrived without anyone posting`);

/* ---- Game two: player two bombs, and the collapse hands player one a four ----

   Column 3 reads, from the bottom: P1, P2, P1, P1, P1. Take the single P2 out
   of it and the three above drop onto the one below, making four.

   The blast is a plus, so a bomb aimed AT that P2 would take the P1 above and
   below it as well. Aiming one column to the left instead reaches it with a
   single arm and leaves the rest of column 3 alone. That is the shape of the
   new blast being load bearing, which is exactly why this is the test. */

await g.locator('#again').click();
await g.locator('#board').waitFor();

const SETUP = [3, 3, 3, 2, 3, 2, 3, 1, 6, 1, 6];
for (const c of SETUP) await drop(c);

s = await state();
const bottom = s.grid[0].join(',');
console.log(s.longest[0] === 3 && s.longest[1] === 3 && !s.over
  ? 'PASS: the board is set up with nobody yet on four'
  : `FAIL: longest=${JSON.stringify(s.longest)} over=${s.over} bottom=[${bottom}]`);
console.log(s.turn === 1
  ? 'PASS: it is player two\'s turn, so the bomb is theirs to regret'
  : `FAIL: it is player ${s.turn + 1}'s turn`);

// Player two bombs column 2, whose right arm reaches into column 3.
await call('__bomb', 2, 1);
await until(async () => (await state()).over, { timeout: 8000, every: 100 });

s = await state();
console.log(s.longest[0] === 4 && s.longest[1] === 1
  ? 'PASS: the collapse made four in a row for player one, who did not bomb'
  : `FAIL: longest=${JSON.stringify(s.longest)} column 3=[${s.grid.map(r => r[3]).join(',')}]`);

// A plus takes five cells at most, and only four were occupied here. A block
// would have taken eight, which is the change being checked.
const gone = 11 - s.grid.flat().filter(v => v !== -1).length;
console.log(gone === 4
  ? 'PASS: the blast took four tokens, not the eight a block would have'
  : `FAIL: the blast took ${gone} tokens`);

console.log(s.bombs[1] === 2
  ? 'PASS: the bomb was spent, two left'
  : `FAIL: player two has ${s.bombs[1]} bombs`);

// Gravity has to hold after a collapse or the board is lying about itself.
const floating = [];
for (let c = 0; c < 7; c++) {
  let seenGap = false;
  for (let r = 0; r < 6; r++) {
    const occupied = s.grid[r][c] !== -1;
    if (!occupied) seenGap = true;
    else if (seenGap) floating.push(`c${c}r${r}`);
  }
}
console.log(floating.length === 0
  ? 'PASS: no token is left floating above a hole'
  : `FAIL: floating tokens at ${floating.join(' ')}`);

const bigger = await g.locator('#overBig').innerText();
console.log(bigger === 'Jason wins'
  ? 'PASS: the bomber lost the game they bombed'
  : `FAIL: overlay says "${bigger}"`);

/* ---- The result reaches the chat, once asked ---- */

await g.locator('#post').click();

try {
  await b.waitForSelector('.score-card', { timeout: 10000 });
  const shown = (await b.locator('.score-card').innerText()).replace(/\s+/g, ' ').trim();
  console.log(shown.startsWith('4') && /Jason beat Foxy/.test(shown)
    ? `PASS: Foxy sees the result card (${shown})`
    : `FAIL: Foxy sees "${shown}"`);
} catch {
  console.log('FAIL: no result reached the other client');
  console.log('  Foxy sees:', JSON.stringify(await b.locator('.bubble').allInnerTexts()));
  await browser.close();
  process.exit(1);
}

// Posting a score closes the player, which is why the overlay offers it as a
// choice rather than doing it automatically.
const closed = await until(async () => (await a.locator('iframe.game-frame').count()) === 0,
  { timeout: 5000, every: 150 });
console.log(closed
  ? 'PASS: posting closed the game, as the host intends'
  : 'FAIL: the game is still open after posting');

/* ---- A full column refuses a token rather than losing it ---- */

// Posting leaves the games sheet open behind the closed player.
await closeSheet(a);
await a.locator('.tool.tool-games').click();
await a.waitForSelector('.sheet-card');
await a.locator('.game-play').click();
await a.waitForSelector('iframe.game-frame');
await g.locator('#go').click();
await g.locator('#board').waitFor();

// Six alternating tokens fill a column and make nobody a four.
for (let i = 0; i < 6; i++) await drop(0);
const beforeFull = await state();
await call('__drop', 0);
await a.waitForTimeout(500);
const afterFull = await state();
console.log(afterFull.moves === beforeFull.moves && !afterFull.over
  ? 'PASS: a full column refuses the drop instead of swallowing it'
  : `FAIL: moves went ${beforeFull.moves} to ${afterFull.moves}, over=${afterFull.over}`);
console.log(afterFull.turn === beforeFull.turn
  ? 'PASS: a refused drop does not cost you your turn'
  : 'FAIL: the turn changed on a refused drop');

await a.locator('.player').click({ position: { x: 8, y: 8 } });
await a.waitForTimeout(400);
await closeSheet(a);

/* ---- The pack carries its proper name, the bare file does not ---- */

await a.locator('.tool.tool-games').click();
await a.waitForSelector('.sheet-card');
await a.locator('input[type=file]').setInputFiles(path.resolve('public/tic-tak-toe-boom.zip'));
await a.waitForFunction(() => document.querySelectorAll('.game-row').length === 2, null, { timeout: 20000 });
const named = await a.locator('.game-name').allInnerTexts();
console.log(named.includes('Tic Tak Toe BOOM!')
  ? 'PASS: the pack brings its proper name, where the bare file was "tic tak toe boom"'
  : `FAIL: ${JSON.stringify(named)}`);

await a.screenshot({ path: 'shot-boom-7-sheet.png' });
await browser.close();
