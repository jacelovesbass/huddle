// Screenshot a URL so Claude can see the running app.
// usage: node shot.mjs <url> [out.png] [width] [height]
import { chromium } from 'playwright';

const [url = 'http://localhost:5173', out = 'shot.png', w = '390', h = '844'] = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });

const errors = [];
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', e => errors.push(String(e)));

await page.goto(url, { waitUntil: 'networkidle' }).catch(e => errors.push(String(e)));
await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log(`shot: ${out}`);
if (errors.length) console.log('page errors:\n' + errors.join('\n'));
