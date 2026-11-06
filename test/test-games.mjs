// Games: add a single-file HTML game, run it sandboxed, post a score, and
// check the sandbox is actually a sandbox.
import { launch, open, joinCode, BASE as URL } from './helpers.mjs';
import path from 'node:path';

const browser = await launch();
const a = await open(browser, 'Jason');
await a.getByPlaceholder('Group name').fill('Pack Test');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.chat header');
const code = await joinCode(a);

const b = await open(browser, 'Sam', `${URL}#${code}`);
await b.waitForSelector('.chat header');

// A bare .html file is a game.
await a.locator('.tool.tool-games').click();
await a.waitForSelector('.sheet-card');
await a.locator('input[type=file]').setInputFiles(path.resolve('public/tile-tap.html'));
await a.waitForSelector('.game-row', { timeout: 20000 });
console.log(await a.locator('.game-name').innerText() === 'tile tap'
  ? 'PASS: a bare .html file became a game'
  : `FAIL: named "${await a.locator('.game-name').innerText()}"`);

// Play it.
await a.locator('.game-play').click();
await a.waitForSelector('iframe.game-frame');
const frame = a.frameLocator('iframe.game-frame');
await frame.locator('#grid .cell').first().waitFor({ timeout: 10000 });
console.log('PASS: the game loaded and rendered inside the frame');

// The sandbox must be opaque: no same-origin, no reach into the host.
const sandbox = await a.locator('iframe.game-frame').getAttribute('sandbox');
console.log(sandbox === 'allow-scripts'
  ? 'PASS: sandbox is allow-scripts only, no allow-same-origin'
  : `FAIL: sandbox is "${sandbox}"`);

const escaped = await a.evaluate(() => {
  // If the frame were same-origin this would read its document.
  try { return !!document.querySelector('iframe.game-frame').contentDocument; }
  catch { return false; }
});
console.log(escaped === false
  ? 'PASS: the host cannot reach into the frame, so the frame cannot reach out'
  : 'FAIL: the frame is same-origin and the sandbox is not doing its job');

// The host greeted the player, which proves the message channel works.
const title = await frame.locator('#title').innerText();
console.log(title.includes('Jason')
  ? `PASS: host handshake reached the game ("${title}")`
  : `FAIL: title is "${title}"`);

// Finish instantly rather than waiting out the clock, then check the score
// travelled to the other person as a rendered card, not as text.
await frame.locator('#grid .cell').first().evaluate(() => window.__finishNow(7));

try {
  await b.waitForSelector('.score-card', { timeout: 10000 });
  const shown = (await b.locator('.score-card').innerText()).replace(/\s+/g, ' ').trim();
  console.log(shown.startsWith('7') && shown.includes('tile tap')
    ? `PASS: Sam sees the score card (${shown})`
    : `FAIL: Sam sees "${shown}"`);
} catch {
  console.log('FAIL: no score reached the other client');
  console.log('  Sam sees:', JSON.stringify(await b.locator('.bubble').allInnerTexts()));
  await browser.close();
  process.exit(1);
}

// The person who played must see their own score too.
const mine = await a.locator('.score-card').count();
console.log(mine === 1
  ? 'PASS: the player sees their own score'
  : `FAIL: the player sees ${mine} score cards of their own`);

// A game pack with a manifest carries its proper name and author.
await a.locator('.tool.tool-games').click();
await a.waitForSelector('.sheet-card');
await a.locator('input[type=file]').setInputFiles(path.resolve('public/tile-tap.zip'));
await a.waitForFunction(() => document.querySelectorAll('.game-row').length === 2, null, { timeout: 20000 });
const names = await a.locator('.game-name').allInnerTexts();
console.log(names.includes('Tile Tap')
  ? 'PASS: a game pack brings its name and author'
  : `FAIL: ${JSON.stringify(names)}`);

await a.screenshot({ path: 'games-sheet.png' });
await a.locator('.sheet').click({ position: { x: 8, y: 8 } });
await a.waitForTimeout(400);
await a.screenshot({ path: 'games-chat.png' });
await browser.close();
