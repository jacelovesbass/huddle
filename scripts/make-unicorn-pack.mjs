// Capybara unicorns. Same sticker conventions as the capybara pack: thick dark
// outline, blush hatching, Y-shaped nose and mouth. Adds a gold spiral horn and
// a pastel mane, and lifts the fur to a lilac tint so it reads as a unicorn at
// 24px rather than only at full size.
import { chromium } from 'playwright';
import JSZip from 'jszip';
import fs from 'node:fs';

const FUR = '#d8cbe8';
const MUZZLE = '#c3b2da';
const LINE = '#332b40';
const BLUSH = '#e88aa6';
const GOLD = '#f3c44f';
const GOLD_DK = '#d79f22';
const W = 4.2;

const horn = `
  <path d="M47.2 7 q2.8 -6.5 5.6 0 l10.2 31 q-13 5.5 -26 0 z" fill="${GOLD}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
  <g stroke="${GOLD_DK}" stroke-width="1.7" stroke-linecap="round" fill="none">
    <path d="M42 30 q8 3.4 16 -1"/><path d="M44.5 21 q5.5 2.8 11 -1"/><path d="M46.8 13 q3.2 2 6.4 -0.8"/>
  </g>`;

const ears = `
  <g fill="${FUR}" stroke="${LINE}" stroke-width="${W}" stroke-linejoin="round">
    <path d="M27 32 q-9 -19 4 -22 q13 -3 17 15 z"/>
    <path d="M73 32 q9 -19 -4 -22 q-13 -3 -17 15 z"/>
  </g>`;

const skull = `
  <path d="M50 16 q-24 0 -32 20 q-7 17 -6 32 q1 18 38 18 q37 0 38 -18 q1 -15 -6 -32 q-8 -20 -32 -20 z"
        fill="${FUR}" stroke="${LINE}" stroke-width="${W}" stroke-linejoin="round"/>
  <ellipse cx="50" cy="60" rx="19" ry="15" fill="${MUZZLE}"/>`;

// Mane sits over the top of the head and hides the base of the horn.
const mane = `
  <g stroke="${LINE}" stroke-width="3" stroke-linejoin="round">
    <path d="M35 28 q-4 -10 5 -11 q7 -1 8 8 z" fill="#8ed6c8"/>
    <path d="M65 28 q4 -10 -5 -11 q-7 -1 -8 8 z" fill="#8fb8ef"/>
    <path d="M43 26 q0 -7 7 -7 q7 0 7 7 q-7 4 -14 0 z" fill="#f4a0c0"/>
  </g>`;

const nose = `
  <path d="M43 52 q7 -3 14 0 q2 7 -7 8 q-9 -1 -7 -8 z" fill="${LINE}"/>
  <path d="M50 60 v7" stroke="${LINE}" stroke-width="3.2" stroke-linecap="round" fill="none"/>`;

const blush = `
  <g stroke="${BLUSH}" stroke-width="2.6" stroke-linecap="round" opacity=".85">
    <path d="M25 56 l4 5 M31 55 l4 5 M37 55 l3 5"/>
    <path d="M75 56 l-4 5 M69 55 l-4 5 M63 55 l-3 5"/>
  </g>`;

const line = (d, w = 3.2, colour = LINE) =>
  `<path d="${d}" stroke="${colour}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

const eyesDots = (r = 4.4) =>
  `<ellipse cx="33" cy="42" rx="${r}" ry="${r + 0.6}" fill="${LINE}"/>
   <ellipse cx="67" cy="42" rx="${r}" ry="${r + 0.6}" fill="${LINE}"/>`;
const eyesArcs = line('M27 44 q6 -8 12 0 M61 44 q6 -8 12 0', 3.4);
const eyesFlat = line('M28 43 h11 M61 43 h11', 3.4);

const smile = line('M41 67 q9 9 18 0', 3.2);
const openSmile = `<path d="M40 66 q10 14 20 0 z" fill="${LINE}"/>
                   <path d="M46 72 q4 6 8 0 z" fill="#e8798f"/>`;
const flat = line('M43 69 h14', 3.2);
const frown = line('M41 72 q9 -8 18 0', 3.2);

const sparkle = (x, y, s) =>
  `<path d="M${x} ${y - s} q${s * 0.3} ${s * 0.7} ${s} ${s} q-${s * 0.7} ${s * 0.3} -${s} ${s}
            q-${s * 0.3} -${s * 0.7} -${s} -${s} q${s * 0.7} -${s * 0.3} ${s} -${s} z"
        fill="#ffe27a" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round"/>`;

const FACES = {
  capycorn: eyesDots() + blush + nose + flat,
  happy:    eyesArcs + blush + nose + openSmile,
  magic:    eyesArcs + blush + nose + smile + sparkle(16, 30, 6) + sparkle(84, 26, 7) + sparkle(88, 50, 4.5),
  love:     `<g fill="#f2566f" stroke="${LINE}" stroke-width="2.6" stroke-linejoin="round">
               <path d="M33 34 a5.5 5.5 0 0 1 8.5 5.5 l-8.5 8.5 l-8.5 -8.5 a5.5 5.5 0 0 1 8.5 -5.5z"/>
               <path d="M67 34 a5.5 5.5 0 0 1 8.5 5.5 l-8.5 8.5 l-8.5 -8.5 a5.5 5.5 0 0 1 8.5 -5.5z"/>
             </g>` + blush + nose + openSmile,
  wink:     `<ellipse cx="33" cy="42" rx="4.4" ry="5" fill="${LINE}"/>` +
            line('M61 44 q6 -8 12 0', 3.4) + blush + nose + smile + sparkle(86, 32, 5.5),
  cool:     `<g stroke="${LINE}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round">
               <path d="M22 37 h56" fill="none"/>
               <path d="M23 38 h22 q2 8 -4 13 q-9 6 -15 -1 q-4 -5 -3 -12 z" fill="#3d3550"/>
               <path d="M77 38 h-22 q-2 8 4 13 q9 6 15 -1 q4 -5 3 -12 z" fill="#3d3550"/>
               <path d="M45 40 q5 -2 10 0" fill="none"/>
               <path d="M22 37 l-5 2" fill="none"/><path d="M78 37 l5 2" fill="none"/>
             </g>
             <g fill="#ffffff" opacity=".35">
               <path d="M27 41 l7 0 l-7 8 z"/><path d="M59 41 l7 0 l-7 8 z"/>
             </g>` + blush + nose + smile,
  sleepy:   eyesFlat + blush + nose + flat +
            line('M31 40 q5 -6 10 -1 M59 39 q5 -5 10 1', 2.4) +
            `<text x="80" y="42" font-family="system-ui" font-weight="700" font-size="14" fill="${LINE}">z</text>`,
  shocked:  `<ellipse cx="33" cy="42" rx="6.5" ry="7.5" fill="#fff" stroke="${LINE}" stroke-width="2.6"/>
             <ellipse cx="67" cy="42" rx="6.5" ry="7.5" fill="#fff" stroke="${LINE}" stroke-width="2.6"/>
             <ellipse cx="33" cy="43" rx="3" ry="3.6" fill="${LINE}"/>
             <ellipse cx="67" cy="43" rx="3" ry="3.6" fill="${LINE}"/>` +
            nose + `<ellipse cx="50" cy="72" rx="5" ry="6" fill="${LINE}"/>`,
  sad:      eyesFlat + blush + nose + frown +
            `<path d="M30 47 q-4 10 0 14 q4 -4 0 -14z" fill="#7cc2f2" stroke="${LINE}" stroke-width="2.2"/>`,
};

// The head is scaled down and dropped so the horn has somewhere to be. Without
// this the horn is a 14px sliver above the skull and reads as a smudge.
const svg = face => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="128" height="128">
  ${horn}
  <g transform="translate(9 19) scale(0.82)">${ears}${skull}${mane}${face}</g>
</svg>`;

const browser = await chromium.launch();
const zip = new JSZip();
const manifest = { format: 'purepack/1', name: 'Capybara unicorns', author: 'Pure Chat', emoji: [] };
fs.mkdirSync('unicorn-pack', { recursive: true });

for (const [name, face] of Object.entries(FACES)) {
  const page = await (await browser.newContext({ viewport: { width: 128, height: 128 } })).newPage();
  await page.setContent(`<body style="margin:0">${svg(face)}</body>`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(110);
  const buf = await page.screenshot({ omitBackground: true, type: 'png' });
  fs.writeFileSync(`packs/unicorn/${name}.png`, buf);
  zip.file(`${name}.png`, buf);
  manifest.emoji.push({ name, file: `${name}.png` });
}

zip.file('pack.json', JSON.stringify(manifest, null, 2));
fs.writeFileSync('packs/unicorn/pack.json', JSON.stringify(manifest, null, 2));
fs.writeFileSync('public/capybara-unicorns.zip', await zip.generateAsync({ type: 'nodebuffer' }));

const names = Object.keys(FACES);
const tile = (n, fg, w) => `<div style="text-align:center;color:${fg};font:11px system-ui">
  <img src="data:image/png;base64,${fs.readFileSync(`packs/unicorn/${n}.png`).toString('base64')}" width="${w}"><div>${n}</div></div>`;
const page = await (await browser.newContext({ viewport: { width: 700, height: 350 } })).newPage();
await page.setContent(`<body style="margin:0;font:11px system-ui">
  <div style="background:#171a21;display:flex;gap:4px;padding:10px">${names.map(n => tile(n, '#8b93a3', 64)).join('')}</div>
  <div style="background:#f2f2f2;display:flex;gap:4px;padding:10px">${names.map(n => tile(n, '#666', 64)).join('')}</div>
  <div style="background:#171a21;display:flex;gap:14px;padding:14px">${['capycorn','cool','love'].map(n => tile(n, '#8b93a3', 150)).join('')}</div>
</body>`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(400);
await page.screenshot({ path: 'unicorn-sheet.png' });

await browser.close();
console.log('capybara-unicorns.zip:', (fs.statSync('public/capybara-unicorns.zip').size / 1024).toFixed(1), 'KB,', names.length, 'emoji');
