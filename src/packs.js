// Emoji pack reading and image normalisation. Format spec in PACK_FORMAT.md.
import JSZip from 'jszip';

export const NAME_RE = /^[a-z0-9-]{1,32}$/;
const MAX_BYTES = 256 * 1024;
const MAX_PX = 128;

/** Filename to a legal emoji name: "Shocked Kev.PNG" -> "shocked-kev". */
export function nameFromFilename(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

/**
 * Shrink to at most 128px and re-encode as WebP, in the browser, so no server
 * ever processes an image. Animated GIFs pass through untouched: a canvas only
 * sees their first frame, and losing the animation is worse than the bytes.
 */
export const GIF_MAX_BYTES = 1024 * 1024;

export async function normalise(blob, maxBytes = MAX_BYTES) {
  if (blob.type === 'image/gif') {
    // An animated GIF cannot be shrunk in a canvas without losing the
    // animation, so the only lever is refusing one that is too big.
    if (blob.size > maxBytes) {
      throw new Error(`that GIF is ${Math.round(blob.size / 1024)} KB, the limit is ${Math.round(maxBytes / 1024)} KB`);
    }
    return toDataUrl(blob);
  }

  const bitmap = await createImageBitmap(blob);
  const limitPx = maxBytes > MAX_BYTES ? 320 : MAX_PX;
  const scale = Math.min(1, limitPx / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const out = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.9));
  if (!out) throw new Error('could not re-encode image');
  if (out.size > maxBytes) throw new Error('image is too large after shrinking');
  return toDataUrl(out);
}

function toDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error('could not read file'));
    fr.readAsDataURL(blob);
  });
}

/** A .zip carrying pack.json. Returns { name, author, emoji:[{name,url}] }. */
export async function readZip(file) {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('pack.json');
  if (!manifestFile) throw new Error('no pack.json in that zip');

  let manifest;
  try {
    manifest = JSON.parse(await manifestFile.async('string'));
  } catch {
    throw new Error('pack.json is not valid JSON');
  }

  if (manifest.format !== 'purepack/1') {
    throw new Error(`unknown pack format "${manifest.format ?? '(missing)'}"`);
  }
  if (!Array.isArray(manifest.emoji) || manifest.emoji.length === 0) {
    throw new Error('pack.json lists no emoji');
  }

  const emoji = [];
  for (const entry of manifest.emoji) {
    const name = String(entry.name ?? '').toLowerCase();
    if (!NAME_RE.test(name)) throw new Error(`"${entry.name}" is not a usable emoji name`);

    // A pack may carry its images or point at them. Both are just a URL here.
    if (entry.url) {
      emoji.push({ name, url: String(entry.url), tags: String(entry.tags || '') });
      continue;
    }
    const f = zip.file(entry.file);
    if (!f) throw new Error(`pack.json lists ${entry.file}, which is not in the zip`);
    emoji.push({ name, url: await normalise(await f.async('blob')), tags: String(entry.tags || '') });
  }

  return { name: manifest.name || 'Untitled pack', author: manifest.author || null, emoji };
}

/** Loose image files dropped in without a manifest. */
export async function readLooseImages(files, packName) {
  const emoji = [];
  const seen = new Set();

  for (const file of files) {
    let name = nameFromFilename(file.name);
    if (!NAME_RE.test(name)) continue;
    while (seen.has(name)) name = name.slice(0, 29) + '-' + (seen.size + 1);
    seen.add(name);
    emoji.push({ name, url: await normalise(file) });
  }

  if (!emoji.length) throw new Error('none of those files were usable images');
  return { name: packName || 'My pack', author: null, emoji };
}

/** Replace :shortcodes: with [[e:id]] so the message carries the picture. */
export function encodeShortcodes(text, byName) {
  return text.replace(/:([a-z0-9-]{1,32}):/g, (whole, name) =>
    byName.has(name) ? `[[e:${byName.get(name).id}]]` : whole);
}

/**
 * A link to a picture, resolved to something an <img> can actually load.
 * Handles direct image URLs and GIPHY page links, which are what people
 * actually paste. Returns null for anything else, which stays a plain link.
 */
export function toMediaUrl(text) {
  let u;
  try { u = new URL(text.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;

  if (/\.(gif|png|jpe?g|webp)$/i.test(u.pathname)) return u.href;

  // https://giphy.com/gifs/some-slug-3o7TKMt1VVNkHV2PaE -> the media file
  if (/(^|\.)giphy\.com$/i.test(u.hostname)) {
    const m = u.pathname.match(/\/gifs\/(?:.*-)?([A-Za-z0-9]{6,})\/?$/);
    if (m) return `https://i.giphy.com/${m[1]}.gif`;
  }
  return null;
}

const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Split a message body into text, emoji and pasted-picture parts. */
export function splitBody(body) {
  const out = [];
  for (const chunk of body.split(/(\[\[e:[0-9a-f-]{36}\]\])/i).filter(Boolean)) {
    const m = chunk.match(/^\[\[e:([0-9a-f-]{36})\]\]$/i);
    if (m) { out.push({ emojiId: m[1] }); continue; }
    for (const bit of chunk.split(URL_RE).filter(Boolean)) {
      const media = URL_RE.test(bit) ? toMediaUrl(bit) : null;
      URL_RE.lastIndex = 0;
      out.push(media ? { media } : { text: bit });
    }
  }
  return out;
}

/**
 * Two packs may legitimately both contain :shocked:. Rename the later one
 * rather than letting a shortcode be ambiguous: the picker showed one picture
 * and the message carried the other, which is exactly what Foxy hit.
 */
export function dedupeNames(emoji, takenNames) {
  const taken = new Set(takenNames);
  return emoji.map(e => {
    if (!taken.has(e.name)) { taken.add(e.name); return e; }
    let n = 2;
    while (taken.has(`${e.name}-${n}`)) n++;
    const name = `${e.name}-${n}`;
    taken.add(name);
    return { ...e, name };
  });
}

/**
 * Words buried in a GIPHY page link, which are effectively its tags:
 * giphy.com/gifs/homer-simpson-bushes-l0HlNaQ6 -> "homer simpson bushes".
 * A media link (media0.giphy.com/...) carries only analytics ids, so this
 * returns nothing for those and the person types their own.
 */
export function tagsFromUrl(text) {
  let u;
  try { u = new URL(text.trim()); } catch { return ''; }
  if (!/(^|\.)giphy\.com$/i.test(u.hostname)) return '';
  const m = u.pathname.match(/\/gifs\/(.+?)-([A-Za-z0-9]{6,})\/?$/);
  if (!m) return '';
  return m[1].split('-').filter(w => w.length > 1).join(' ').slice(0, 120);
}

/**
 * Export a pack as a zip anyone can import anywhere. Entries that already
 * point at a URL stay links, so a GIF pack exports as a few hundred bytes of
 * JSON and carries no pictures at all.
 */
export async function exportPack(pack, entries) {
  const zip = new JSZip();
  const manifest = {
    format: 'purepack/1',
    name: pack.name,
    author: pack.author || null,
    exported: new Date().toISOString().slice(0, 10),
    emoji: [],
  };

  let n = 0;
  for (const e of entries) {
    if (e.url.startsWith('data:')) {
      // A stored picture has to travel as a file.
      const ext = (e.url.match(/^data:image\/([a-z]+)/) || [, 'png'])[1];
      const bytes = Uint8Array.from(atob(e.url.split(',')[1]), c => c.charCodeAt(0));
      const file = `${e.name}.${ext === 'jpeg' ? 'jpg' : ext}`;
      zip.file(file, bytes);
      manifest.emoji.push({ name: e.name, file, ...(e.tags ? { tags: e.tags } : {}) });
      n++;
    } else {
      manifest.emoji.push({ name: e.name, url: e.url, ...(e.tags ? { tags: e.tags } : {}) });
    }
  }

  zip.file('pack.json', JSON.stringify(manifest, null, 2));
  return { blob: await zip.generateAsync({ type: 'blob' }), files: n };
}
