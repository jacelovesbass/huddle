// Reading and writing game packs. Format in GAME_FORMAT.md.
import JSZip from 'jszip';

export const GAME_MAX_BYTES = 512 * 1024;

const nameFromFilename = f =>
  f.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 60) || 'Game';

/** A .zip carrying game.json, or a bare .html file. */
export async function readGame(file) {
  if (/\.html?$/i.test(file.name)) {
    const html = await file.text();
    if (html.length > GAME_MAX_BYTES) {
      throw new Error(`that file is ${Math.round(html.length / 1024)} KB, the limit is 512 KB`);
    }
    return { name: nameFromFilename(file.name), author: null, description: null, html };
  }

  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('game.json');
  if (!manifestFile) throw new Error('no game.json in that zip, and it is not an .html file');

  let manifest;
  try {
    manifest = JSON.parse(await manifestFile.async('string'));
  } catch {
    throw new Error('game.json is not valid JSON');
  }
  if (manifest.format !== 'puregame/1') {
    throw new Error(`unknown game format "${manifest.format ?? '(missing)'}"`);
  }

  const base = {
    name: String(manifest.name || 'Game').slice(0, 60),
    author: manifest.author ? String(manifest.author) : null,
    description: manifest.description ? String(manifest.description).slice(0, 200) : null,
  };

  // Hosted elsewhere: keep the link and store nothing.
  if (manifest.url) return { ...base, url: String(manifest.url) };

  const entry = zip.file(manifest.file || 'index.html');
  if (!entry) throw new Error(`game.json points at ${manifest.file}, which is not in the zip`);
  const html = await entry.async('string');
  if (html.length > GAME_MAX_BYTES) {
    throw new Error(`that game is ${Math.round(html.length / 1024)} KB, the limit is 512 KB`);
  }
  return { ...base, html };
}

/** Hand a game back as a zip, so it can go to another group or another app. */
export async function exportGame(game) {
  const zip = new JSZip();
  const manifest = {
    format: 'puregame/1',
    name: game.name,
    author: game.author || null,
    description: game.description || null,
  };

  if (game.html) {
    manifest.file = 'index.html';
    zip.file('index.html', game.html);
  } else {
    manifest.url = game.url;
  }

  zip.file('game.json', JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: 'blob' });
}
