// Getting out of a chat without losing it, and starting another one.
import { launch, BASE as URL } from './helpers.mjs';

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 820 } })).newPage();
page.on('pageerror', e => console.log('ERROR', String(e)));

await page.goto(URL);
await page.waitForSelector('.gate, .chat');
await page.getByPlaceholder('Your name').fill('Jason');
await page.getByRole('button', { name: 'Continue' }).click();

await page.getByPlaceholder('Group name').fill('First');
await page.getByRole('button', { name: 'Create group' }).click();
await page.waitForSelector('.chat header');

// Back to the list, group retained.
await page.locator('.back').click();
await page.waitForSelector('.gate');
console.log(await page.locator('.recent-row', { hasText: 'First' }).count()
  ? 'PASS: back returns to the list with the group kept'
  : 'FAIL: group lost on back');

// Start a second group from there.
await page.getByPlaceholder('Group name').fill('Second');
await page.getByRole('button', { name: 'Create group' }).click();
await page.waitForSelector('.chat header');
console.log((await page.locator('header strong').innerText()).trim() === 'Second'
  ? 'PASS: a new group can be started without losing the first'
  : 'FAIL: did not land in Second');

// Both are on the shelf.
await page.locator('.back').click();
await page.waitForSelector('.gate');
const rows = await page.locator('.recent-row').count();
console.log(rows === 2 ? 'PASS: both groups listed' : `FAIL: ${rows} rows`);

// Switch back to the first by tapping it.
await page.locator('.recent-row', { hasText: 'First' }).click();
await page.waitForSelector('.chat header');
console.log((await page.locator('header strong').innerText()).trim() === 'First'
  ? 'PASS: switching between groups works' : 'FAIL: wrong group');

// Forget really does remove it from the list.
await page.getByRole('button', { name: /^People/ }).click();
await page.getByRole('button', { name: 'Forget this group' }).click();
await page.waitForSelector('.gate');
const left = await page.locator('.recent-row').count();
console.log(left === 1 ? 'PASS: Forget drops it from the list' : `FAIL: ${left} rows left`);

await page.screenshot({ path: 'navigation.png' });
await browser.close();
