import { chromium } from 'playwright';
import fs from 'node:fs';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:660,height:240} })).newPage();
const big = n => `<img src="data:image/png;base64,${fs.readFileSync(`capybara-pack/${n}.png`).toString('base64')}" width="200">`;
await p.setContent(`<body style="margin:0;background:#171a21;display:flex;gap:10px;padding:14px">
  ${big('capy')}${big('happy')}${big('love')}</body>`, { waitUntil:'domcontentloaded' });
await p.waitForTimeout(300);
await p.screenshot({ path:'capy-zoom.png' });
await b.close();
