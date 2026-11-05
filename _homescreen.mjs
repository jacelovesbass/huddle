import { chromium } from 'playwright';
import fs from 'node:fs';
const b64 = fs.readFileSync('public/icon-180.png').toString('base64');
const src = `data:image/png;base64,${b64}`;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport:{width:420,height:200}, deviceScaleFactor:2 })).newPage();
const tile = s => `<div style="text-align:center">
  <img src="${src}" style="width:${s}px;height:${s}px;border-radius:${Math.round(s*0.225)}px;display:block;box-shadow:0 6px 18px rgba(0,0,0,.45)">
  <div style="margin-top:7px;font-size:${s>80?13:11}px">Pure Chat</div></div>`;
await p.setContent(`<body style="margin:0;background:#1c2230;display:flex;gap:40px;align-items:center;justify-content:center;height:200px;font:13px system-ui;color:#fff">${tile(120)}${tile(60)}</body>`,
  { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(800);
await p.screenshot({ path:'homescreen.png' });
await b.close();
console.log('ok');
