// Two real browsers, one room. Proves messages move between clients live.
// usage: node test-chat.mjs
import { chromium } from 'playwright';

const URL = 'http://localhost:5173';
const browser = await chromium.launch();

const open = async name => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 760 } })).newPage();
  page.on('pageerror', e => console.log(`[${name}] ERROR ${e}`));
  page.on('console', m => m.type() === 'error' && console.log(`[${name}] console ${m.text()}`));
  await page.goto(URL);
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  return page;
};

const a = await open('Jason');
const b = await open('Sam');

// Jason creates the group.
await a.getByPlaceholder('New group name').fill('Friday Crew');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.code');
const code = (await a.locator('.code').innerText()).trim();
console.log('join code:', code);

// Sam joins with it.
await b.getByPlaceholder('Join code').fill(code);
await b.getByRole('button', { name: 'Join group' }).click();
await b.waitForSelector('.code');

// Talk.
const say = async (page, text) => {
  await page.getByPlaceholder('Message').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
};

await say(a, 'anyone free friday?');
await b.waitForSelector('text=anyone free friday?', { timeout: 8000 });
console.log('PASS: Sam received Jason without reloading');

await say(b, "yep, I'm in");
await b.waitForTimeout(1200);
await say(b, 'what time?');

try {
  await a.waitForSelector('text=what time?', { timeout: 8000 });
  console.log('PASS: Jason received Sam without reloading');
} catch {
  console.log('FAIL: Jason did not receive Sam');
  console.log('  Jason sees:', await a.locator('.bubble').allInnerTexts());
  console.log('  Sam sees  :', await b.locator('.bubble').allInnerTexts());
  await a.reload();
  await a.waitForTimeout(1500);
  console.log('  Jason after reload:', await a.locator('.bubble').allInnerTexts());
}

await say(a, '7pm at mine');
await b.waitForSelector('text=7pm at mine', { timeout: 8000 }).catch(() => console.log('FAIL: Sam missed the reply too'));

await a.waitForTimeout(600);
await a.screenshot({ path: 'chat-jason.png' });
await b.screenshot({ path: 'chat-sam.png' });
console.log('shots: chat-jason.png chat-sam.png');

await browser.close();
