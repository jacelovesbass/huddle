// Two packs sharing an emoji name must not make a shortcode ambiguous.
// Regression for the defect Foxy hit: picked one capybara, sent a different one.
import { chromium } from 'playwright';
import path from 'node:path';

const URL = process.env.TEST_URL || 'http://localhost:5173';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 820 } })).newPage();
page.on('pageerror', e => console.log('ERROR', String(e)));

await page.goto(URL);
await page.waitForSelector('.gate, .chat');
await page.getByPlaceholder('Your name').fill('Jason');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByPlaceholder('Group name').fill('Collision');
await page.getByRole('button', { name: 'Create group' }).click();
await page.waitForSelector('.code');

// Both sample packs contain :shocked:.
for (const zip of ['starter-faces.zip', 'capybaras.zip']) {
  await page.locator('.tool').click();
  await page.waitForSelector('.sheet-card');
  await page.locator('input[type=file][accept=".zip"]').setInputFiles(path.resolve('public', zip));
  await page.waitForFunction(
    n => document.querySelectorAll('.pack').length === n,
    zip === 'starter-faces.zip' ? 1 : 2, { timeout: 25000 });
  await page.waitForTimeout(800);
  await page.locator('.sheet').click({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(300);
}

await page.locator('.tool').click();
await page.waitForSelector('.sheet-card');

const titles = await page.locator('.cell').evaluateAll(els => els.map(e => e.getAttribute('title')));
const shockedLike = titles.filter(t => t.startsWith(':shocked'));
console.log('shocked names:', shockedLike.join(' '));
console.log(shockedLike.length === 2 && new Set(shockedLike).size === 2
  ? 'PASS: the clashing name was renamed, both are reachable'
  : `FAIL: ${JSON.stringify(shockedLike)}`);

// Pick each one and confirm the picture sent matches the picture clicked.
async function pickAndSend(title) {
  const cell = page.locator(`.cell[title="${title}"]`);
  const want = await cell.locator('img').getAttribute('src');
  await cell.click();
  await page.getByRole('button', { name: 'Send' }).click();
  await page.waitForTimeout(1200);
  const got = await page.locator('.bubble img.emoji').last().getAttribute('src');
  console.log(want === got ? `PASS: ${title} sent the picture that was clicked`
                           : `FAIL: ${title} sent a different picture`);
  await page.locator('.tool').click();
  await page.waitForSelector('.sheet-card');
}

for (const t of shockedLike) await pickAndSend(t);

await page.locator('.sheet').click({ position: { x: 8, y: 8 } });
await page.waitForTimeout(400);
await page.screenshot({ path: 'collision.png' });
await browser.close();
