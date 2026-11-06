// Look at the game. Screenshots of the four screens that matter, at phone size.
import { chromium } from 'playwright';

const URL = (process.env.TEST_URL || 'http://localhost:5173').replace(/\/$/, '');
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 760 } })).newPage();
page.on('pageerror', e => console.log('ERROR', e.message));
page.on('console', m => m.type() === 'error' && console.log('console', m.text()));

await page.goto(`${URL}/tic-tak-toe-boom.html`);
await page.locator('#go').waitFor();
await page.screenshot({ path: 'shot-boom-1-start.png' });

await page.locator('details.rules summary').click();
await page.waitForTimeout(200);
await page.screenshot({ path: 'shot-boom-2-rules.png' });
await page.locator('details.rules summary').click();

await page.locator('#n1').fill('Jason');
await page.locator('#n2').fill('Foxy');
await page.locator('#go').click();
await page.locator('#board').waitFor();

const drop = async c => {
  await page.evaluate(n => window.__drop(n), c);
  await page.waitForFunction(() => !window.__state().locked || window.__state().over, null, { timeout: 5000 });
};

// A believable mid-game board rather than a tidy one.
for (const c of [3, 3, 2, 4, 2, 2, 4, 1, 3, 5, 4]) await drop(c);
await page.waitForTimeout(400);
await page.screenshot({ path: 'shot-boom-3-midgame.png' });

// Armed, with every token ringed as a target.
await page.locator('#boom2').click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'shot-boom-4-armed.png' });

// Mid blast, caught while the flash is still on screen.
await page.evaluate(() => window.__bomb(3, 1));
await page.waitForTimeout(150);
await page.screenshot({ path: 'shot-boom-5-blast.png' });

// And the win screen, from the suite's bomb scenario.
await page.goto(`${URL}/tic-tak-toe-boom.html`);
await page.locator('#n1').fill('Jason');
await page.locator('#n2').fill('Foxy');
await page.locator('#go').click();
await page.locator('#board').waitFor();
for (const c of [3, 3, 3, 2, 3, 2, 3, 1, 6, 1, 6]) await drop(c);
await page.evaluate(() => window.__bomb(2, 1));
await page.waitForFunction(() => window.__state().over, null, { timeout: 8000 });
await page.waitForTimeout(500);
await page.screenshot({ path: 'shot-boom-6-win.png' });

console.log('state:', JSON.stringify(await page.evaluate(() => window.__state().result)));
await browser.close();
