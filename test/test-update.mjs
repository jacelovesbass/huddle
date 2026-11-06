// A stale copy must notice and offer to update.
import { launch } from './helpers.mjs';

// Deliberately the deployed site: this is about a stale cached copy, which
// only means anything against the real thing.
const URL = 'https://jacelovesbass.github.io/purechat/';
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });

// Pretend the server has moved on to a build this copy has never seen.
await ctx.route('**/version.json*', r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: '{"build":"a-newer-build"}' }));

const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERROR', String(e)));
await page.goto(URL);
await page.waitForSelector('.gate, .chat');

try {
  await page.waitForSelector('.update', { timeout: 15000 });
  console.log('PASS: stale copy is told, "' + (await page.locator('.update').innerText()).trim() + '"');
} catch {
  console.log('FAIL: no update banner');
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: 'update-banner.png' });
await page.locator('.update').click();
await page.waitForTimeout(2500);
console.log(/\?v=\d+/.test(page.url()) ? 'PASS: update navigates to a fresh URL'
                                       : `FAIL: url is ${page.url()}`);

// And a current copy must not nag.
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 760 } });
const p2 = await ctx2.newPage();
await p2.goto(URL);
await p2.waitForSelector('.gate, .chat');
await p2.waitForTimeout(6000);
console.log(await p2.locator('.update').count() === 0
  ? 'PASS: an up-to-date copy shows nothing' : 'FAIL: banner shown when current');

await browser.close();
