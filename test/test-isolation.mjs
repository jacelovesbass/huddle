// A change in one room must not wake clients in another.
// Regression for an unfiltered emoji subscription that made every client
// everywhere reload its packs on any emoji change.
import { launch, open } from './helpers.mjs';
import path from 'node:path';

const browser = await launch();


// Two unrelated groups, two unrelated people.
const a = await open(browser, 'Jason');
await a.getByPlaceholder('Group name').fill('Pack Test');
await a.getByRole('button', { name: 'Create group' }).click();
await a.waitForSelector('.chat header');

const b = await open(browser, 'Sam');
await b.getByPlaceholder('Group name').fill('Collision');
await b.getByRole('button', { name: 'Create group' }).click();
await b.waitForSelector('.chat header');

// Count how often the bystander refetches packs.
await b.evaluate(() => {
  window.__packFetches = 0;
  const real = window.fetch;
  window.fetch = (...args) => {
    if (String(args[0]).includes('/emoji?') || String(args[0]).includes('/packs?')) window.__packFetches++;
    return real(...args);
  };
});
await b.waitForTimeout(500);
const before = await b.evaluate(() => window.__packFetches);

// Jason installs a 6-emoji pack in his own group.
await a.locator('.tool.tool-emoji').click();
await a.waitForSelector('.sheet-card');
await a.locator('input[type=file][accept=".zip"]').setInputFiles(path.resolve('public/starter-faces.zip'));
try {
  await a.waitForSelector('.cell', { timeout: 25000 });
} catch {
  console.log('sheet says:', JSON.stringify(await a.locator('.sheet-card').innerText()));
  await browser.close();
  process.exit(1);
}
await a.waitForTimeout(3000);

const after = await b.evaluate(() => window.__packFetches);
console.log(`   bystander pack fetches: ${before} before, ${after} after`);
console.log(after === before
  ? 'PASS: a change in one room does not wake another room'
  : `FAIL: bystander refetched ${after - before} times for someone else's emoji`);

// And the person who did it still sees their own packs.
console.log(await a.locator('.cell').count() === 6
  ? 'PASS: the installing client still updates'
  : 'FAIL: installer did not see its own pack');

// The counter proves isolation only if it moves when it should. Install into
// Sam's OWN room and check he does refetch, otherwise "0 before, 0 after"
// would also pass with the subscription switched off entirely.
await b.locator('.tool.tool-emoji').click();
await b.waitForSelector('.sheet-card');
await b.locator('input[type=file][accept=".zip"]').setInputFiles(path.resolve('public/starter-faces.zip'));
await b.waitForSelector('.cell', { timeout: 25000 });
await b.waitForTimeout(2500);
const own = await b.evaluate(() => window.__packFetches);
console.log(`   bystander fetches after a change in his own room: ${own}`);
console.log(own > after
  ? 'PASS: a change in your own room still reaches you'
  : 'FAIL: the subscription is not firing at all');

await browser.close();
