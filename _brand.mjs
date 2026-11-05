import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:390,height:500} })).newPage();
await p.goto('https://jacelovesbass.github.io/huddle/');
await p.waitForSelector('.gate');
await p.screenshot({ path:'brand.png' });
await b.close();
