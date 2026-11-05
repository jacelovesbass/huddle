// A third person opens an invite link and lands straight in the room.
import { chromium } from 'playwright';

const URL = 'https://jacelovesbass.github.io/huddle';
const browser = await chromium.launch();

const open = async (name, url = URL) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 760 } })).newPage();
  page.on('pageerror', e => console.log(`[${name}] ERROR ${e}`));
  await page.goto(url);
  // Wait for boot to finish before deciding which screen we are on.
  await page.waitForSelector('.gate, .chat', { timeout: 10000 });
  if (await page.getByPlaceholder('Your name').isVisible().catch(() => false)) {
    await page.getByPlaceholder('Your name').fill(name);
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  return page;
};

const a = await open('Jason');
await a.getByPlaceholder('New group name').fill('Friday Crew');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.code');
const code = (await a.locator('.code').innerText()).trim();

const link = `${URL}/#${code}`;
console.log('invite link:', link);

// Alex has never used the app and clicks the link cold.
const c = await open('Alex', link);

try {
  await c.waitForSelector('.chat header', { timeout: 8000 });
  console.log('PASS: Alex landed in', (await c.locator('header strong').innerText()).trim());
} catch {
  console.log('FAIL: Alex did not auto-join');
  await c.screenshot({ path: 'invite-fail.png' });
  await browser.close();
  process.exit(1);
}

// And the link should not still be in the address bar.
console.log('url after join:', c.url());

await a.getByPlaceholder('Message').fill('alex made it');
await a.getByRole('button', { name: 'Send' }).click();
await c.waitForSelector('text=alex made it', { timeout: 8000 });
console.log('PASS: Alex receives live messages');

await c.waitForTimeout(500);
await c.screenshot({ path: 'invite-alex.png' });
console.log('shot: invite-alex.png');
await browser.close();
