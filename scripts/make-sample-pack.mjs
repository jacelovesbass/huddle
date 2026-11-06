// Builds a sample purepack/1 zip, to prove the format end to end.
import { chromium } from 'playwright';
import JSZip from 'jszip';
import fs from 'node:fs';

const FACES = [
  ['yep',     '#35c759', 'M30 58 q20 18 40 0',           'open'],
  ['nope',    '#ff6b6b', 'M30 68 q20 -18 40 0',          'open'],
  ['shocked', '#f6c452', 'M50 62 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0', 'fill'],
  ['smug',    '#a78bfa', 'M34 60 q16 10 32 -2',          'open'],
  ['dead',    '#8b93a3', 'M32 58 q18 16 36 0',           'open'],
  ['party',   '#2f6df6', 'M30 56 q20 22 40 0',           'open'],
];

const svg = (colour, mouth, mode, dead) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="128" height="128">
  <circle cx="50" cy="50" r="44" fill="${colour}"/>
  ${dead
    ? '<g stroke="#15181f" stroke-width="7" stroke-linecap="round"><path d="M26 32 L42 46 M42 32 L26 46"/><path d="M58 32 L74 46 M74 32 L58 46"/></g>'
    : '<circle cx="34" cy="40" r="7" fill="#15181f"/><circle cx="66" cy="40" r="7" fill="#15181f"/>'}
  <path d="${mouth}" fill="${mode === 'fill' ? '#15181f' : 'none'}"
        stroke="#15181f" stroke-width="7" stroke-linecap="round"/>
</svg>`;

const browser = await chromium.launch();
const zip = new JSZip();
const manifest = { format: 'purepack/1', name: 'Starter faces', author: 'Pure Chat', emoji: [] };

fs.mkdirSync('sample-pack', { recursive: true });

for (const [name, colour, mouth, mode] of FACES) {
  const page = await (await browser.newContext({ viewport: { width: 128, height: 128 } })).newPage();
  await page.setContent(
    `<body style="margin:0">${svg(colour, mouth, mode, name === 'dead')}</body>`,
    { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(120);
  const buf = await page.screenshot({ omitBackground: true, type: 'png' });
  // Keep it simple: store the PNG bytes under a .webp-free name the importer re-encodes anyway.
  fs.writeFileSync(`packs/sample/${name}.png`, buf);
  zip.file(`${name}.png`, buf);
  manifest.emoji.push({ name, file: `${name}.png` });
}

zip.file('pack.json', JSON.stringify(manifest, null, 2));
fs.writeFileSync('packs/sample/pack.json', JSON.stringify(manifest, null, 2));
fs.writeFileSync('starter-faces.zip', await zip.generateAsync({ type: 'nodebuffer' }));
await browser.close();
console.log('starter-faces.zip:', (fs.statSync('starter-faces.zip').size / 1024).toFixed(1), 'KB,', FACES.length, 'emoji');
