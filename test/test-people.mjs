// The People button: roster of everyone who joined, live dot for who is online.
import { launch, open, joinCode, BASE as URL } from './helpers.mjs';

const browser = await launch();



const a = await open(browser, 'Jason');
await a.getByPlaceholder('Group name').fill('People Test');
await a.getByRole('button', { name: 'Create group' }).click();
const code = await joinCode(a);

// Sam joins but says nothing. The old version could not see him at all.
const b = await open(browser, 'Sam', `${URL}#${code}`);
await b.waitForSelector('.chat header');
await a.waitForTimeout(1500);

await a.getByRole('button', { name: /People/ }).click();
await a.waitForSelector('.sheet-card');
const names = await a.locator('.person').allInnerTexts();
console.log('Jason sees:', names.map(n => n.replace(/\s+/g, ' ').trim()));

if (!names.some(n => n.includes('Sam'))) { console.log('FAIL: silent member missing'); process.exit(1); }
console.log('PASS: silent member listed');

// Presence syncs over a websocket, so wait for the state rather than guessing a delay.
let onlineCount = 0;
for (let i = 0; i < 30 && onlineCount < 2; i++) {
  onlineCount = await a.locator('.dot.on').count();
  if (onlineCount < 2) await a.waitForTimeout(500);
}
console.log(onlineCount >= 2 ? 'PASS: both show online' : `FAIL: only ${onlineCount} online after 15s`);

await a.screenshot({ path: 'people.png' });

// Sam closes the tab; his dot should go out.
await b.context().close();
await a.waitForTimeout(3000);
const stillOn = await a.locator('.dot.on').count();
console.log(stillOn === 1 ? 'PASS: Sam went offline' : `FAIL: ${stillOn} still online`);

await browser.close();
