// Screenshot a page at a few widths, so a layout can be judged rather than hoped at.
import { chromium } from 'playwright';
const [url, out = 'page.png', width = '1200', height = '900'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: +width, height: +height } })).newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(500);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log('shot:', out, errs.length ? '\nerrors:\n' + errs.join('\n') : '');
