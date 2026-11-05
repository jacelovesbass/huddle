import { chromium } from 'playwright';
import fs from 'node:fs';
const svg = fs.readFileSync('public/icon.svg','utf8');
const b = await chromium.launch();
for (const size of [180, 192, 512]) {
  const p = await (await b.newContext({ viewport:{width:size,height:size}, deviceScaleFactor:1 })).newPage();
  await p.setContent(`<body style="margin:0">${svg.replace(/width="512" height="512"/, `width="${size}" height="${size}"`)}</body>`);
  await p.waitForTimeout(200);
  await p.screenshot({ path:`public/icon-${size}.png` });
  console.log('icon-' + size + '.png');
}
await b.close();
