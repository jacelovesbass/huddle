// Paste a picture link: it renders as a picture for everyone, and can be kept
// in the group's library as a pack entry that points at the original.
import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'http://localhost:5173';
// A real https image. Must be https even when testing against localhost: the
// app refuses http on purpose, because an https page cannot load it anyway.
const GIF = 'https://jacelovesbass.github.io/purechat/icon-192.png';

const browser = await chromium.launch();
const open = async (who, url = URL) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 820 } })).newPage();
  page.on('pageerror', e => console.log(`[${who}] ERROR ${e}`));
  await page.goto(url);
  await page.waitForSelector('.gate, .chat');
  if (await page.getByPlaceholder('Your name').isVisible().catch(() => false)) {
    await page.getByPlaceholder('Your name').fill(who);
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  return page;
};

const a = await open('Jason');
await a.getByPlaceholder('Group name').fill('Gif Test');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.code');
const code = (await a.locator('.code').first().innerText()).trim();
const b = await open('Foxy', `${URL}#${code}`);
await b.waitForSelector('.chat header');

// Reject a link that is not a picture.
await a.locator('.tool.gif').click();
await a.waitForSelector('.sheet-card');
await a.getByPlaceholder('https://...').fill('https://example.com/not-a-picture');
await a.waitForTimeout(300);
console.log(await a.locator('.err').count() ? 'PASS: non-picture link refused'
                                            : 'FAIL: bad link accepted');

// Accept a real one and send it.
await a.getByPlaceholder('https://...').fill(GIF);
await a.waitForSelector('.preview img', { timeout: 8000 });
console.log('PASS: preview shown');
await a.getByRole('button', { name: 'Send', exact: true }).first().click();
await a.getByRole('button', { name: 'Send' }).last().click();

try {
  await b.waitForSelector('.bubble img.media', { timeout: 10000 });
  console.log('PASS: Foxy sees it as a picture, not a link');
} catch {
  console.log('FAIL: Foxy sees', JSON.stringify(await b.locator('.bubble').allInnerTexts()));
  await b.screenshot({ path: 'gif-fail.png' });
  await browser.close();
  process.exit(1);
}

// Keep it in the library.
await a.locator('.tool.gif').click();
await a.waitForSelector('.sheet-card');
await a.getByPlaceholder('https://...').fill(GIF);
await a.waitForSelector('.preview img');
await a.getByPlaceholder('Keep it as :name:').fill('halo');
await a.getByRole('button', { name: 'Keep in pack' }).click();
await a.waitForTimeout(2500);

await a.locator('.tool.emoji-tool').click();
await a.waitForSelector('.sheet-card');
const kept = await a.locator('.cell[title=":halo:"]').count();
console.log(kept === 1 ? 'PASS: kept into the group library' : 'FAIL: not in the library');
await a.screenshot({ path: 'gif-library.png' });

await browser.close();
