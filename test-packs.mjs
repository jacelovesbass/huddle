// Import a pack, send an emoji, and prove a second person who never installed
// the pack still sees the picture rather than ":yep:".
import { chromium } from 'playwright';
import path from 'node:path';

const URL = process.env.TEST_URL || 'http://localhost:5173';
const ZIP = path.resolve('starter-faces.zip');
const browser = await chromium.launch();

const open = async (name, url = URL) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  page.on('pageerror', e => console.log(`[${name}] ERROR ${e}`));
  page.on('console', m => m.type() === 'error' && console.log(`[${name}] console ${m.text()}`));
  await page.goto(url);
  await page.waitForSelector('.gate, .chat');
  if (await page.getByPlaceholder('Your name').isVisible().catch(() => false)) {
    await page.getByPlaceholder('Your name').fill(name);
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  return page;
};

const a = await open('Jason');
await a.getByPlaceholder('Group name').fill('Pack Test');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.code');
const code = (await a.locator('.code').first().innerText()).trim();

// Install the pack.
await a.locator('.tool.emoji-tool').click();
await a.waitForSelector('.sheet-card');
await a.locator('input[type=file][accept=".zip"]').setInputFiles(ZIP);
try {
  await a.waitForSelector('.cell', { timeout: 20000 });
} catch {
  console.log('sheet says:', JSON.stringify(await a.locator('.sheet-card').innerText()));
  await a.screenshot({ path: 'packs-fail.png' });
  await browser.close();
  process.exit(1);
}
const count = await a.locator('.cell').count();
console.log(count === 6 ? `PASS: 6 emoji imported` : `FAIL: ${count} emoji imported, expected 6`);

// Pick one, which drops :yep: into the box.
await a.locator('.cell').first().click();
const draft = await a.getByPlaceholder('Message').inputValue();
console.log(/^:[a-z-]+:$/.test(draft) ? `PASS: picker inserted ${draft}` : `FAIL: draft is "${draft}"`);

// Second person joins and never opens the pack sheet.
const b = await open('Foxy', `${URL}#${code}`);
await b.waitForSelector('.chat header');

await a.getByRole('button', { name: 'Send' }).click();

try {
  await b.waitForSelector('.bubble img.emoji', { timeout: 10000 });
  const alt = await b.locator('.bubble img.emoji').first().getAttribute('alt');
  console.log(`PASS: Foxy sees the picture (${alt}), not the shortcode`);
} catch {
  const seen = await b.locator('.bubble').allInnerTexts();
  console.log('FAIL: Foxy sees', JSON.stringify(seen));
  await b.screenshot({ path: 'packs-fail.png' });
  await browser.close();
  process.exit(1);
}

// Mixed text and emoji must render inline, not as a sticker.
await a.getByPlaceholder('Message').fill('nice one :shocked: mate');
await a.getByRole('button', { name: 'Send' }).click();
await b.waitForSelector('text=nice one', { timeout: 8000 });
const inline = await b.locator('.bubble', { hasText: 'nice one' }).locator('img.emoji').count();
console.log(inline === 1 ? 'PASS: inline emoji inside text' : `FAIL: ${inline} inline emoji`);

await a.waitForTimeout(600);
await a.locator('.tool.emoji-tool').click();
await a.waitForSelector('.sheet-card');
await a.screenshot({ path: 'packs-sheet.png' });
await a.keyboard.press('Escape');
await a.locator('.sheet').click({ position: { x: 10, y: 10 } });
await a.waitForTimeout(400);
await b.screenshot({ path: 'packs-chat.png' });
console.log('shots: packs-sheet.png packs-chat.png');

await browser.close();
