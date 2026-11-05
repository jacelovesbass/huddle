import { chromium } from 'playwright';
const URL = process.env.TEST_URL || 'http://localhost:5173';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:1440,height:800} })).newPage();
await p.goto(URL);
await p.waitForSelector('.gate, .chat');
if (await p.getByPlaceholder('Your name').isVisible().catch(()=>false)) {
  await p.getByPlaceholder('Your name').fill('Jason');
  await p.getByRole('button',{name:'Continue'}).click();
}
await p.getByPlaceholder('Group name').fill('Wide Test');
await p.getByRole('button',{name:'Create group'}).click();
await p.waitForSelector('.chat');
for (const t of ['anyone free friday?','yep','what time though','7pm at mine']) {
  await p.getByPlaceholder('Message').fill(t);
  await p.getByRole('button',{name:'Send'}).click();
  await p.waitForTimeout(250);
}
await p.waitForTimeout(600);
await p.screenshot({ path:'wide.png' });
await b.close();
