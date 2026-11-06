// Leaving a group must not lose it. The regression Jason hit on 2026-11-05.
import { launch, joinCode, BASE as URL } from './helpers.mjs';

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 760 } })).newPage();
page.on('pageerror', e => console.log('ERROR', String(e)));

await page.goto(URL);
await page.waitForSelector('.gate, .chat');
await page.getByPlaceholder('Your name').fill('Jason');
await page.getByRole('button', { name: 'Continue' }).click();

await page.getByPlaceholder('Group name').fill('Rejoin Test');
await page.getByRole('button', { name: 'Create group' }).click();
const code = await joinCode(page);
console.log('created Rejoin Test:', code);

await page.locator('.back').click();
await page.waitForSelector('.gate');

const row = page.locator('.recent-row', { hasText: 'Rejoin Test' });
if (!(await row.count())) {
  console.log('FAIL: group gone from the gate after leaving');
  await page.screenshot({ path: 'rejoin-fail.png' });
  await browser.close();
  process.exit(1);
}
console.log('PASS: group still listed, code shown:', (await row.locator('.code').innerText()).trim());

await row.click();
await page.waitForSelector('.chat header', { timeout: 8000 });
console.log('PASS: one tap back in');

// And it survives a cold reload, not just this page's memory.
await page.locator('.back').click();
await page.waitForSelector('.gate');
await page.reload();
await page.waitForSelector('.gate');
if (await page.locator('.recent-row', { hasText: 'Rejoin Test' }).count()) {
  console.log('PASS: survives reload');
} else {
  console.log('FAIL: lost after reload');
  process.exit(1);
}

await page.screenshot({ path: 'rejoin.png' });
await browser.close();
