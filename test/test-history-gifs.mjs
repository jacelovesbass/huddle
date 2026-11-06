// A GIF sent in the chat must appear in the picker without anyone pressing
// Keep. The picker was empty for Jason after a day of sending GIFs.
import { launch, open, joinCode, BASE as URL } from './helpers.mjs';

const G1 = 'https://jacelovesbass.github.io/purechat/icon-192.png';
const G2 = 'https://jacelovesbass.github.io/purechat/icon-512.png';

const browser = await launch();

const a = await open(browser, 'Jason');
await a.getByPlaceholder('Group name').fill('History');
await a.getByRole('button', { name: 'Create group' }).click();
const code = await joinCode(a);

// Send two GIFs the plain way: paste the link, send. No Keep.
for (const g of [G1, G2]) {
  await a.getByPlaceholder('Message').fill(g);
  await a.getByRole('button', { name: 'Send' }).click();
  await a.waitForTimeout(900);
}

await a.locator('.tool.tool-gif').click();
await a.waitForSelector('.sheet-card');
await a.waitForTimeout(600);
const tiles = await a.locator('.gif-cell').count();
console.log(tiles === 2 ? 'PASS: both appear without anyone pressing Keep'
                        : `FAIL: picker shows ${tiles}`);

// Someone else joining sees the group's GIF history too.
const b = await open(browser, 'Foxy', `${URL}#${code}`);
await b.waitForSelector('.chat header');
await b.waitForTimeout(1200);
await b.locator('.tool.tool-gif').click();
await b.waitForSelector('.sheet-card');
await b.waitForTimeout(600);
const theirs = await b.locator('.gif-cell').count();
console.log(theirs === 2 ? 'PASS: a new member sees the same history'
                         : `FAIL: Foxy sees ${theirs}`);

// Re-sending from the picker works.
await a.locator('.gif-cell').first().click();
await a.waitForTimeout(400);
const draft = await a.getByPlaceholder('Message').inputValue();
console.log(draft.startsWith('http') ? 'PASS: picking re-sends the link'
                                     : `FAIL: draft "${draft}"`);

await a.screenshot({ path: 'history-gifs.png' });
await browser.close();
