import { chromium } from 'playwright';
const URL = 'https://jacelovesbass.github.io/purechat/';
const b = await chromium.launch();
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
await a.waitForSelector('.code');
const code = (await a.locator('.code').first().innerText()).trim();
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
