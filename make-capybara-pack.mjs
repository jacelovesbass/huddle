// Builds a capybara emoji pack. Drawn as SVG rather than generated, so every
// face shares one head and the set actually looks like a set.
import { chromium } from 'playwright';
import JSZip from 'jszip';
import fs from 'node:fs';

const FUR = '#a8763f';
const FUR_DARK = '#8a5c30';
const MUZZLE = '#c49561';
const INK = '#2a1d12';

// Third attempt. The first two read as a teddy bear because the head was a
// dome with big round ears. A capybara front-on is a loaf: narrow across the
// top, flaring out to a very broad squared-off snout, with tiny ears pinned
// flat at the top corners and a big dark nose pad doing most of the work.
const head = `
  <ellipse cx="30" cy="24" rx="5.5" ry="4.5" fill="${FUR_DARK}"/>
  <ellipse cx="70" cy="24" rx="5.5" ry="4.5" fill="${FUR_DARK}"/>
  <path d="M31 24
           q19 -5 38 0
           q9 2 11 20
           q3 24 1 36
           q-2 12 -31 12
           q-29 0 -31 -12
           q-2 -12 1 -36
           q2 -18 11 -20 z" fill="${FUR}"/>
  <path d="M26 66 q24 -6 48 0 q2 16 -4 22 q-6 6 -20 6 q-14 0 -20 -6 q-6 -6 -4 -22 z" fill="${MUZZLE}"/>
  <rect x="38" y="62" width="24" height="12" rx="6" fill="${INK}"/>
  <ellipse cx="44.5" cy="68" rx="2" ry="2.8" fill="#6b563f"/>
  <ellipse cx="55.5" cy="68" rx="2" ry="2.8" fill="#6b563f"/>`;

const eyesOpen = (r = 4) => `
  <ellipse cx="36" cy="41" rx="${r}" ry="${r + 0.4}" fill="${INK}"/>
  <ellipse cx="64" cy="41" rx="${r}" ry="${r + 0.4}" fill="${INK}"/>`;

const eyesClosed = `
  <g stroke="${INK}" stroke-width="3.2" stroke-linecap="round" fill="none">
    <path d="M31 42 q5 -6 10 0"/><path d="M59 42 q5 -6 10 0"/>
  </g>`;

const mouth = d => `<path d="${d}" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;

const FACES = {
  capy:      eyesOpen() + mouth('M50 74 v4 M44 81 q6 4 12 0'),
  happy:     eyesClosed + mouth('M50 74 v4 M43 79 q7 6 14 0'),
  sleepy:    `<g stroke="${INK}" stroke-width="3.2" stroke-linecap="round"><path d="M31 42 h10"/><path d="M59 42 h10"/></g>`
             + mouth('M50 74 v4 M46 80 q4 3 8 0')
             + `<text x="78" y="26" font-family="system-ui" font-size="16" font-weight="700" fill="${INK}">z</text>`,
  shocked:   `<ellipse cx="36" cy="41" rx="6" ry="7" fill="#fff"/><ellipse cx="64" cy="41" rx="6" ry="7" fill="#fff"/>
              <ellipse cx="36" cy="42" rx="3.2" ry="3.8" fill="${INK}"/><ellipse cx="64" cy="42" rx="3.2" ry="3.8" fill="${INK}"/>
              <ellipse cx="50" cy="82" rx="4.5" ry="5" fill="${INK}"/>`,
  sideeye:   `<ellipse cx="40" cy="41" rx="4" ry="4.4" fill="${INK}"/><ellipse cx="68" cy="41" rx="4" ry="4.4" fill="${INK}"/>`
             + mouth('M50 74 v4 M44 80 h12'),
  crying:    eyesClosed
             + `<path d="M36 46 q-3 7 0 10 q3 -3 0 -10" fill="#6fb7f0"/><path d="M64 46 q-3 7 0 10 q3 -3 0 -10" fill="#6fb7f0"/>`
             + mouth('M50 74 v4 M44 82 q6 -5 12 0'),
  cool:      `<rect x="27" y="35" width="46" height="12" rx="5" fill="${INK}"/>
              <rect x="23" y="38" width="5" height="4" rx="2" fill="${INK}"/><rect x="72" y="38" width="5" height="4" rx="2" fill="${INK}"/>`
             + mouth('M50 74 v4 M44 81 q6 4 12 0'),
  love:      `<g fill="#ff5d7a"><path d="M36 35 a4.2 4.2 0 0 1 6.6 4.2 l-6.6 6.6 l-6.6 -6.6 a4.2 4.2 0 0 1 6.6 -4.2z"/>
              <path d="M64 35 a4.2 4.2 0 0 1 6.6 4.2 l-6.6 6.6 l-6.6 -6.6 a4.2 4.2 0 0 1 6.6 -4.2z"/></g>`
             + mouth('M50 74 v4 M43 79 q7 6 14 0'),
};

const svg = face => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="128" height="128">
  ${head}${face}
</svg>`;

const browser = await chromium.launch();
const zip = new JSZip();
const manifest = { format: 'purepack/1', name: 'Capybaras', author: 'Pure Chat', emoji: [] };
fs.mkdirSync('capybara-pack', { recursive: true });

for (const [name, face] of Object.entries(FACES)) {
  const page = await (await browser.newContext({ viewport: { width: 128, height: 128 } })).newPage();
  await page.setContent(`<body style="margin:0">${svg(face)}</body>`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(100);
  const buf = await page.screenshot({ omitBackground: true, type: 'png' });
  fs.writeFileSync(`capybara-pack/${name}.png`, buf);
  zip.file(`${name}.png`, buf);
  manifest.emoji.push({ name, file: `${name}.png` });
}

zip.file('pack.json', JSON.stringify(manifest, null, 2));
fs.writeFileSync('capybara-pack/pack.json', JSON.stringify(manifest, null, 2));
fs.writeFileSync('public/capybaras.zip', await zip.generateAsync({ type: 'nodebuffer' }));

// A contact sheet so the set can be eyeballed as a set.
const page = await (await browser.newContext({ viewport: { width: 560, height: 160 } })).newPage();
await page.setContent(`<body style="margin:0;background:#171a21;display:flex;align-items:center;gap:6px;padding:12px">
  ${Object.keys(FACES).map(n => `<div style="text-align:center;color:#8b93a3;font:11px system-ui">
    <img src="data:image/png;base64,${fs.readFileSync(`capybara-pack/${n}.png`).toString('base64')}" width="58"><div>${n}</div></div>`).join('')}
</body>`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(300);
await page.screenshot({ path: 'capybara-sheet.png' });

await browser.close();
console.log('capybaras.zip:', (fs.statSync('public/capybaras.zip').size / 1024).toFixed(1), 'KB,', Object.keys(FACES).length, 'emoji');
