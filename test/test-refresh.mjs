// The header refresh must actually bust the cache, not just reload.
import { chromium } from 'playwright';
const URL = process.env.TEST_URL || 'http://localhost:5173';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:390,height:760} })).newPage();
p.on('pageerror', e => console.log('ERROR', String(e)));
await p.goto(URL);
await p.waitForSelector('.gate, .chat');
if (await p.getByPlaceholder('Your name').isVisible().catch(()=>false)) {
  await p.getByPlaceholder('Your name').fill('Jason');
  await p.getByRole('button',{name:'Continue'}).click();
}
await p.getByPlaceholder('Group name').fill('Refresh');
await p.getByRole('button',{name:'Create group'}).click();
await p.waitForSelector('.chat header');
const before = (await p.locator('header strong').innerText()).trim();

await p.locator('.refresh').click();
await p.waitForSelector('.chat header', { timeout: 15000 });
console.log(/\?v=\d+/.test(p.url()) ? 'PASS: refresh navigates to a cache-busting URL'
                                    : `FAIL: url is ${p.url()}`);
const after = (await p.locator('header strong').innerText()).trim();
console.log(after === before ? `PASS: still in the same group (${after})`
                             : `FAIL: landed in "${after}", was "${before}"`);
await p.screenshot({ path:'refresh.png' });
await b.close();
