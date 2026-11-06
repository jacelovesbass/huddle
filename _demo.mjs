import { chromium } from 'playwright';
const URL = 'https://jacelovesbass.github.io/purechat/';
const b = await chromium.launch();
const joinCode = async page => {
  await page.locator('.tool.emoji-tool').first().waitFor({ state: 'attached' });
  await page.getByRole('button', { name: /^People/ }).click();
  await page.waitForSelector('.sheet-card .code');
  const c = (await page.locator('.sheet-card .code').innerText()).trim();
  await page.locator('.sheet').click({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(250);
  return c;
};
const open = async (name, url = URL) => {
  const p = await (await b.newContext({ viewport:{width:1280,height:760} })).newPage();
  await p.goto(url); await p.waitForSelector('.gate, .chat');
  if (await p.getByPlaceholder('Your name').isVisible().catch(()=>false)) {
    await p.getByPlaceholder('Your name').fill(name);
    await p.getByRole('button',{name:'Continue'}).click();
  }
  return p;
};
const a = await open('Jason');
await a.getByPlaceholder('Group name').fill('Demo');
await a.getByRole('button',{name:'Create group'}).click();
const code = await joinCode(a);
const s = await open('Foxy', `${URL}#${code}`);
await s.waitForSelector('.chat header');

const say = async (p, t) => {
  await p.getByPlaceholder('Message').fill(t);
  await p.getByRole('button',{name:'Send'}).click();
  await p.waitForTimeout(700);
};
await say(a, 'anyone about this weekend?');
await say(s, 'yeah free saturday');
await say(s, 'sunday is a write off though');
await say(a, 'saturday works');
await say(a, 'the usual place?');
await say(s, 'perfect, see you then');
await a.waitForTimeout(1200);
await a.screenshot({ path:'demo-jason.png' });
await s.screenshot({ path:'demo-foxy.png' });
await b.close();
console.log('done, code', code);
