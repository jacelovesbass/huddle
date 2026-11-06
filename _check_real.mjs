import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:390,height:860} })).newPage();
p.on('pageerror', e => console.log('ERROR', String(e)));
p.on('console', m => m.type()==='error' && console.log('console', m.text()));
await p.goto('https://jacelovesbass.github.io/purechat/#J3TXB');
await p.waitForSelector('.gate, .chat');
if (await p.getByPlaceholder('Your name').isVisible().catch(()=>false)) {
  await p.getByPlaceholder('Your name').fill('Claude');
  await p.getByRole('button',{name:'Continue'}).click();
}
await p.waitForSelector('.chat header', { timeout: 15000 });
await p.waitForTimeout(3000);
console.log('room:', (await p.locator('header strong').innerText()).trim());
console.log('messages rendered:', await p.locator('.bubble').count());
console.log('media imgs in chat:', await p.locator('.bubble img.media').count());
await p.locator('.tool.gif').click();
await p.waitForSelector('.sheet-card');
await p.waitForTimeout(1500);
console.log('gif tiles in picker:', await p.locator('.gif-cell').count());
await p.screenshot({ path:'real-picker.png' });
await b.close();
