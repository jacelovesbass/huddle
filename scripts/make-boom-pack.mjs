// Wrap Tic Tak Toe BOOM! as a puregame/1 pack, so it arrives with its proper
// name and a credit instead of being named after the file it came from.
import JSZip from 'jszip';
import fs from 'node:fs';

const html = fs.readFileSync('public/tic-tak-toe-boom.html', 'utf8');

const zip = new JSZip();
zip.file('game.json', JSON.stringify({
  format: 'puregame/1',
  name: 'Tic Tak Toe BOOM!',
  author: 'Jason',
  description: 'Four in a row on one phone. Three bombs each, and the rubble still counts.',
  file: 'index.html',
}, null, 2));
zip.file('index.html', html);

const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync('public/tic-tak-toe-boom.zip', out);

console.log(`tic-tak-toe-boom.zip  ${(out.length / 1024).toFixed(1)} KB`);
console.log(`index.html inside     ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB of the 512 KB limit`);
