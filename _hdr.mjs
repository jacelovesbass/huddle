import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:390,height:420} })).newPage();
await p.goto('http://localhost:5173');
await p.waitForSelector('.gate');
await p.getByPlaceholder('Your name').fill('Jason');
await p.getByRole('button',{name:'Continue'}).click();
await p.getByPlaceholder('Group name').fill('Pure Empathy');
await p.getByRole('button',{name:'Create group'}).click();
await p.waitForSelector('.chat');
// Simulate the iOS status bar inset, which env() reports as 0 on desktop.
await p.addStyleTag({ content: '.chat header { padding-top: 59px !important; }' });
await p.evaluate(() => {
  const bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:50px;display:flex;justify-content:space-between;align-items:center;padding:0 22px;color:#fff;font:600 15px system-ui;z-index:99;pointer-events:none';
  bar.innerHTML = '<span>11:20</span><span>▮▮▮ ᯤ 🔋</span>';
  document.body.appendChild(bar);
});
await p.waitForTimeout(400);
await p.screenshot({ path:'hdr.png' });
await b.close();
