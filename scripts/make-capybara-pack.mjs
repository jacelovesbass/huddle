// Capybara pack, drawn to the sticker-art convention Jason pointed at: thick
// dark outline, soft greige fur, blush cheeks with hatch marks, and a Y-shaped
// nose and mouth. Drawn from scratch rather than traced; the reference he sent
// was a watermarked stock preview and is not ours to use.
import { chromium } from 'playwright';
import JSZip from 'jszip';
import fs from 'node:fs';

const FUR = '#bda184';
const MUZZLE = '#ab8e72';
const LINE = '#2f2a24';
const BLUSH = '#e0808f';
const W = 4.2;

// Ears sit behind the head so the outline reads as one silhouette.
const ears = `
  <g fill="${FUR}" stroke="${LINE}" stroke-width="${W}" stroke-linejoin="round">
    <path d="M27 32 q-9 -19 4 -22 q13 -3 17 15 z"/>
    <path d="M73 32 q9 -19 -4 -22 q-13 -3 -17 15 z"/>
  </g>`;

const skull = `
  <path d="M50 16 q-24 0 -32 20 q-7 17 -6 32 q1 18 38 18 q37 0 38 -18 q1 -15 -6 -32 q-8 -20 -32 -20 z"
        fill="${FUR}" stroke="${LINE}" stroke-width="${W}" stroke-linejoin="round"/>
  <ellipse cx="50" cy="60" rx="19" ry="15" fill="${MUZZLE}"/>`;

// Nose pad and the stem below it. The mouth completes the Y.
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
const frown = line('M41 72 q9 -8 18 0', 3.2);
const flat = line('M43 69 h14', 3.2);

const FACES = {
  capy:    eyesDots() + blush + nose + flat,
  happy:   eyesArcs + blush + nose + openSmile,
  content: eyesArcs + blush + nose + smile,
  wink:    `<ellipse cx="33" cy="42" rx="4.4" ry="5" fill="${LINE}"/>` +
           line('M61 44 q6 -8 12 0', 3.4) + blush + nose + smile,
  cool:    `<rect x="22" y="36" width="56" height="13" rx="6" fill="${LINE}"/>
            <rect x="17" y="39" width="6" height="4.5" rx="2" fill="${LINE}"/>
            <rect x="77" y="39" width="6" height="4.5" rx="2" fill="${LINE}"/>` +
           blush + nose + smile,
  love:    `<g fill="#f2566f" stroke="${LINE}" stroke-width="2.6" stroke-linejoin="round">
              <path d="M33 34 a5.5 5.5 0 0 1 8.5 5.5 l-8.5 8.5 l-8.5 -8.5 a5.5 5.5 0 0 1 8.5 -5.5z"/>
              <path d="M67 34 a5.5 5.5 0 0 1 8.5 5.5 l-8.5 8.5 l-8.5 -8.5 a5.5 5.5 0 0 1 8.5 -5.5z"/>
            </g>` + blush + nose + openSmile,
  crying:  eyesFlat + blush + nose + frown +
           `<path d="M30 47 q-4 10 0 14 q4 -4 0 -14z" fill="#7cc2f2" stroke="${LINE}" stroke-width="2.2"/>
            <path d="M70 47 q-4 10 0 14 q4 -4 0 -14z" fill="#7cc2f2" stroke="${LINE}" stroke-width="2.2"/>`,
  sleepy:  eyesFlat + blush + nose + flat +
           line('M31 40 q5 -6 10 -1 M59 39 q5 -5 10 1', 2.4) +
           `<text x="76" y="26" font-family="system-ui" font-weight="700" font-size="15" fill="${LINE}">z</text>`,
  shocked: `<ellipse cx="33" cy="42" rx="6.5" ry="7.5" fill="#fff" stroke="${LINE}" stroke-width="2.6"/>
            <ellipse cx="67" cy="42" rx="6.5" ry="7.5" fill="#fff" stroke="${LINE}" stroke-width="2.6"/>
            <ellipse cx="33" cy="43" rx="3" ry="3.6" fill="${LINE}"/>
            <ellipse cx="67" cy="43" rx="3" ry="3.6" fill="${LINE}"/>` +
           nose + `<ellipse cx="50" cy="72" rx="5" ry="6" fill="${LINE}"/>`,
};

const svg = face => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="128" height="128">
  ${ears}${skull}${face}
</svg>`;

const browser = await chromium.launch();
const zip = new JSZip();
const manifest = { format: 'purepack/1', name: 'Capybaras', author: 'Pure Chat', emoji: [] };
fs.mkdirSync('capybara-pack', { recursive: true });

for (const [name, face] of Object.entries(FACES)) {
  const page = await (await browser.newContext({ viewport: { width: 128, height: 128 } })).newPage();
  await page.setContent(`<body style="margin:0">${svg(face)}</body>`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(110);
  const buf = await page.screenshot({ omitBackground: true, type: 'png' });
  fs.writeFileSync(`packs/capybara/${name}.png`, buf);
  zip.file(`${name}.png`, buf);
  manifest.emoji.push({ name, file: `${name}.png` });
}

zip.file('pack.json', JSON.stringify(manifest, null, 2));
fs.writeFileSync('packs/capybara/pack.json', JSON.stringify(manifest, null, 2));
fs.writeFileSync('public/capybaras.zip', await zip.generateAsync({ type: 'nodebuffer' }));

// Contact sheet on light and dark, because stickers get used on both.
const names = Object.keys(FACES);
const tile = (n, fg) => `<div style="text-align:center;color:${fg};font:11px system-ui">
  <img src="data:image/png;base64,${fs.readFileSync(`packs/capybara/${n}.png`).toString('base64')}" width="62"><div>${n}</div></div>`;
const page = await (await browser.newContext({ viewport: { width: 680, height: 220 } })).newPage();
await page.setContent(`<body style="margin:0;font:11px system-ui">
  <div style="background:#171a21;display:flex;gap:4px;padding:10px">${names.map(n => tile(n, '#8b93a3')).join('')}</div>
  <div style="background:#f2f2f2;display:flex;gap:4px;padding:10px">${names.map(n => tile(n, '#666')).join('')}</div>
</body>`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(350);
await page.screenshot({ path: 'capybara-sheet.png' });

await browser.close();
console.log('capybaras.zip:', (fs.statSync('public/capybaras.zip').size / 1024).toFixed(1), 'KB,', names.length, 'emoji');
