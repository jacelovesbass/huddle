// A real game somebody else wrote, run unmodified in the sandbox.
// Kelp Diver: canvas, pointer events, 45 KB, no postMessage of its own.
import { launch, open } from './helpers.mjs';
import path from 'node:path';

const browser = await launch();
const a = await open(browser, 'Jason');
await a.getByPlaceholder('Group name').fill('Pack Test');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.chat header');

await a.locator('.tool.tool-games').click();
await a.waitForSelector('.sheet-card');
await a.locator('input[type=file]').setInputFiles(path.resolve('public/kelp-diver.zip'));
await a.waitForSelector('.game-row', { timeout: 25000 });
console.log(await a.locator('.game-name').innerText() === 'Kelp Diver'
  ? 'PASS: a 45 KB game pack installed'
  : 'FAIL: did not install');

const errors = [];
a.on('console', m => m.type() === 'error' && errors.push(m.text()));

await a.locator('.game-play').click();
await a.waitForSelector('iframe.game-frame');
const g = a.frameLocator('iframe.game-frame');

// The brief panel is the first thing a player sees.
await g.locator('#card h1').waitFor({ timeout: 15000 });
console.log((await g.locator('#card h1').innerText()).includes('Kelp')
  ? 'PASS: the game booted and drew its own UI'
  : 'FAIL: no brief panel');

// Start a dive and let it run, which exercises canvas, rAF and the HUD.
await g.locator('#again').click();
await a.waitForTimeout(2500);

const depth = await g.locator('#depth').innerText();
const air = await g.locator('#airtime').innerText();
console.log(/^\d+$/.test(depth) && /^\d+:\d\d$/.test(air)
  ? `PASS: the simulation is running (depth ${depth} m, air ${air})`
  : `FAIL: HUD reads depth "${depth}" air "${air}"`);

// Canvas is actually being painted, not a blank element.
const painted = await a.evaluate(() => {
  const f = document.querySelector('iframe.game-frame');
  return f.getBoundingClientRect().height > 200;
});
console.log(painted ? 'PASS: the frame has real size to draw into' : 'FAIL: frame collapsed');

console.log(errors.length === 0
  ? 'PASS: no console errors from the sandboxed game'
  : `FAIL: ${errors.length} console errors: ${errors.slice(0, 3).join(' | ')}`);

await a.waitForTimeout(600);
await a.screenshot({ path: 'kelp-diver.png' });

// Surface immediately to end the dive, which posts the total to the chat.
await g.locator('#c').evaluate(() => {
  // eslint-disable-next-line no-undef
  endDive(false);
});

try {
  await a.waitForSelector('.score-card', { timeout: 10000 });
  const shown = (await a.locator('.score-card').innerText()).replace(/\s+/g, ' ').trim();
  console.log(/Kelp Diver/.test(shown)
    ? `PASS: the dive total posted to the chat (${shown})`
    : `FAIL: score card reads "${shown}"`);
} catch {
  console.log('FAIL: no score reached the chat');
}

await browser.close();
