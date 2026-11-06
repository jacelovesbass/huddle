// The tool contract: a tool nobody wired into Chat.jsx must appear on the bar,
// open its own sheet, send its own kind of message, and draw it for everyone.
import { launch, open, BASE as URL } from './helpers.mjs';

const browser = await launch();


const a = await open(browser, 'Jason');
await a.getByPlaceholder('Group name').fill('Pack Test');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.chat header');

// Every registered tool gets a button, with its label as the accessible name.
const labels = await a.locator('.tools .tool').evaluateAll(
  els => els.map(e => e.getAttribute('aria-label')));
console.log(`   bar shows: ${labels.join(', ')}`);
console.log(labels.length === 3 && labels.includes('Roll a die')
  ? 'PASS: the registry drives the bar, including a tool Chat.jsx never heard of'
  : `FAIL: ${JSON.stringify(labels)}`);

await a.getByRole('button', { name: /^People/ }).click();
await a.waitForSelector('.sheet-card .code');
const code = (await a.locator('.sheet-card .code').innerText()).trim();
await a.locator('.sheet').click({ position: { x: 8, y: 8 } });
await a.waitForTimeout(250);

const b = await open(browser, 'Sam', `${URL}#${code}`);
await b.waitForSelector('.chat header');

// Roll, which sends a structured message rather than text.
await a.locator('.tool.tool-dice').click();
await a.waitForSelector('.dice-picker');
await a.getByRole('button', { name: 'd20' }).click();
await a.getByRole('button', { name: /^Roll d20/ }).click();

try {
  await b.waitForSelector('.dice-result', { timeout: 10000 });
  const shown = (await b.locator('.dice-result').innerText()).replace(/\s+/g, ' ').trim();
  const n = parseInt(shown, 10);
  console.log(n >= 1 && n <= 20
    ? `PASS: the other client drew it with the tool's own renderer (${shown})`
    : `FAIL: rendered "${shown}"`);
} catch {
  console.log('FAIL: dice message never arrived or was not rendered');
  console.log('  Sam sees:', JSON.stringify(await b.locator('.bubble').allInnerTexts()));
  await browser.close();
  process.exit(1);
}

// Text messages must be untouched by any of this.
await a.getByPlaceholder('Message').fill('still just words');
await a.getByRole('button', { name: 'Send' }).click();
await b.waitForSelector('text=still just words', { timeout: 8000 });
console.log('PASS: ordinary text still renders normally');

await a.screenshot({ path: 'tools-bar.png' });
await browser.close();
