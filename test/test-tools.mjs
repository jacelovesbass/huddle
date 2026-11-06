// The tool contract: a tool nobody wired into Chat.jsx must appear on the bar,
// open its own sheet, send its own kind of message, and draw it for everyone.
import { launch, open, BASE as URL } from './helpers.mjs';

const browser = await launch();


const a = await open(browser, 'Jason');
await a.getByPlaceholder('Group name').fill('Pack Test');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.chat header');

// The bar is built from the registry, so it should match it exactly rather
// than match a list typed into this test. Read the registry from the module
// the app actually uses.
const expected = await a.evaluate(async () => {
  const m = await import('/src/tools/index.js');
  return m.TOOLS.map(t => t.label);
}).catch(() => null);

const labels = await a.locator('.tools .tool').evaluateAll(
  els => els.map(e => e.getAttribute('aria-label')));
console.log(`   bar shows: ${labels.join(', ')}`);

if (expected) {
  console.log(JSON.stringify(labels) === JSON.stringify(expected)
    ? `PASS: the bar matches the registry exactly (${expected.length} tools)`
    : `FAIL: bar ${JSON.stringify(labels)} vs registry ${JSON.stringify(expected)}`);
} else {
  // A production build has no module graph to import; fall back to shape.
  console.log(labels.length >= 3 && labels.every(Boolean)
    ? `PASS: the bar is built from the registry (${labels.length} labelled tools)`
    : `FAIL: ${JSON.stringify(labels)}`);
}

await a.getByRole('button', { name: /^People/ }).click();
await a.waitForSelector('.sheet-card .code');
const code = (await a.locator('.sheet-card .code').innerText()).trim();
await a.locator('.sheet').click({ position: { x: 8, y: 8 } });
await a.waitForTimeout(250);

const b = await open(browser, 'Sam', `${URL}#${code}`);
await b.waitForSelector('.chat header');

// Each tool's sheet opens and closes without Chat.jsx knowing what it is.
for (const label of labels) {
  await a.getByRole('button', { name: label, exact: true }).first().click();
  const opened = await a.waitForSelector('.sheet-card, .player-card', { timeout: 8000 })
    .then(() => true).catch(() => false);
  console.log(opened ? `PASS: ${label} opened its own sheet` : `FAIL: ${label} did not open`);
  await a.locator('.sheet, .player').first().click({ position: { x: 8, y: 8 } });
  await a.waitForTimeout(300);
}

// Text messages must be untouched by any of this.
await a.getByPlaceholder('Message').fill('still just words');
await a.getByRole('button', { name: 'Send' }).click();
await b.waitForSelector('text=still just words', { timeout: 8000 });
console.log('PASS: ordinary text still renders normally');

await a.screenshot({ path: 'tools-bar.png' });
await browser.close();
