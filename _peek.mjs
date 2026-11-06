import { chromium } from 'playwright';
const URL = 'http://localhost:5173';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:390,height:860} })).newPage();
await p.goto(URL);
await p.waitForSelector('.gate, .chat');
if (await p.getByPlaceholder('Your name').isVisible().catch(()=>false)) {
  await p.getByPlaceholder('Your name').fill('Jason');
  await p.getByRole('button',{name:'Continue'}).click();
}
await p.getByPlaceholder('Group name').fill('Peek');
await p.getByRole('button',{name:'Create group'}).click();
await p.waitForSelector('.code');
for (const [u,n] of [['https://jacelovesbass.github.io/purechat/icon-192.png','halo'],
                     ['https://jacelovesbass.github.io/purechat/icon-512.png','halo-big']]) {
  await p.locator('.tool.gif').click();
  await p.waitForSelector('.sheet-card');
  await p.getByPlaceholder('https://...').fill(u);
  await p.waitForSelector('.preview img');
  await p.getByPlaceholder('Keep it as :name:').fill(n);
  await p.getByRole('button',{name:'Keep',exact:true}).click();
  await p.waitForTimeout(2000);
}
await p.getByPlaceholder('Message').fill('');
await p.locator('.tool.gif').click();
await p.waitForSelector('.sheet-card');
await p.waitForTimeout(600);
await p.screenshot({ path:'peek.png' });
await b.close();
