// Keep GIFs with tags, find them again by tag, and export the pack so it can
// travel to another group.
import { chromium } from 'playwright';
import fs from 'node:fs';
import JSZip from 'jszip';

const URL = process.env.TEST_URL || 'http://localhost:5173';
const A = 'https://jacelovesbass.github.io/purechat/icon-192.png';
// A GIPHY page link, whose slug carries the words that become tags.
const B = 'https://giphy.com/gifs/homer-simpson-backs-into-bushes-jUwpNzg9IcyrK';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERROR', String(e)));

await page.goto(URL);
await page.waitForSelector('.gate, .chat');
await page.getByPlaceholder('Your name').fill('Jason');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByPlaceholder('Group name').fill('Library');
await page.getByRole('button', { name: 'Create group' }).click();
await page.waitForSelector('.chat header');

// Some actions close the sheet themselves, some do not. Close only if open.
const closeSheet = async () => {
  if (await page.locator('.sheet').count()) {
    await page.locator('.sheet').click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(300);
  }
};

async function keep(url, name, tags) {
  await page.locator('.tool.gif').click();
  await page.waitForSelector('.sheet-card');
  await page.getByPlaceholder('https://...').fill(url);
  await page.waitForSelector('.preview img', { timeout: 10000 });
  await page.getByPlaceholder('Keep it as :name:').fill(name);
  if (tags) await page.locator('.tagbox').fill(tags);
  await page.getByRole('button', { name: 'Keep', exact: true }).click();
  await page.waitForTimeout(2200);
}

await keep(A, 'halo', 'logo brand');
await keep(B, 'homer', '');

await page.locator('.tool.gif').click();
await page.waitForSelector('.sheet-card');
const tiles = await page.locator('.gif-cell').count();
console.log(tiles === 2 ? 'PASS: both GIFs in the library' : `FAIL: ${tiles} in the library`);

// A GIPHY page link should have tagged itself from its slug.
const homerTitle = await page.locator('.gif-cell[title^=":homer:"]').getAttribute('title');
console.log(/simpson/.test(homerTitle) ? `PASS: auto-tagged from the link (${homerTitle})`
                                       : `FAIL: no auto tags (${homerTitle})`);

// Search by a tag that is not in the name.
await page.locator('.search').fill('brand');
await page.waitForTimeout(400);
const found = await page.locator('.gif-cell').count();
console.log(found === 1 ? 'PASS: search by tag finds it' : `FAIL: ${found} results for "brand"`);
await page.locator('.search').fill('');

// Send one straight from the library. Clear the box first: Keep also queues
// the GIF into the draft, so it is not empty at this point.
await closeSheet();
await page.getByPlaceholder('Message').fill('');
await page.locator('.tool.gif').click();
await page.waitForSelector('.sheet-card');
// The GIFs are still loading and reflow the sheet as they arrive, which moves
// the tile out from under the click. Wait for them to settle.
await page.waitForFunction(() =>
  [...document.querySelectorAll('.gif-cell img')].every(i => i.complete), null, { timeout: 20000 });
await page.waitForTimeout(300);
await page.locator('.gif-cell').first().click();
await page.waitForTimeout(400);
const draft = await page.getByPlaceholder('Message').inputValue();
console.log(/^:[a-z0-9-]+:$/.test(draft.trim()) ? `PASS: library pick inserted ${draft.trim()}`
                                                : `FAIL: draft "${draft}"`);

// Export the pack and read it back.
await closeSheet();
await page.locator('.tool.emoji-tool').click();
await page.waitForSelector('.sheet-card');
const [dl] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('.pack', { hasText: 'Saved GIFs' }).getByRole('button', { name: 'Export' }).click(),
]);
const out = 'exported-pack.zip';
await dl.saveAs(out);
const zip = await JSZip.loadAsync(fs.readFileSync(out));
const manifest = JSON.parse(await zip.file('pack.json').async('string'));
const linksOnly = manifest.emoji.every(e => e.url && !e.file);
console.log(manifest.format === 'purepack/1' && manifest.emoji.length === 2 && linksOnly
  ? `PASS: exported ${manifest.emoji.length} entries as links, ${fs.statSync(out).size} bytes`
  : `FAIL: ${JSON.stringify(manifest).slice(0, 200)}`);
console.log('   tags survived:', JSON.stringify(manifest.emoji.map(e => e.tags || '')));

await browser.close();
