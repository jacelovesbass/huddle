// Shared test plumbing.
//
// The important part is cleanup(). Every suite used to create rooms and leave
// them, which put 125 junk rooms in a live database before anyone noticed. A
// test that does not clean up is not finished.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BASE = (process.env.TEST_URL || 'http://localhost:5173').replace(/\/$/, '') + '/';

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

const created = new Set();
let failures = 0;

export const check = (ok, pass, fail) => {
  console.log(ok ? `PASS: ${pass}` : `FAIL: ${fail}`);
  if (!ok) failures++;
  return ok;
};

export async function launch() {
  const browser = await chromium.launch();
  return browser;
}

/** Open the app as someone, optionally straight into an invite link. */
export async function open(browser, who, url = BASE) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 820 } })).newPage();
  page.on('pageerror', e => console.log(`[${who}] ERROR ${e}`));
  page.on('console', m => m.type() === 'error' && console.log(`[${who}] console ${m.text()}`));
  await page.goto(url);
  await page.waitForSelector('.gate, .chat');
  if (await page.getByPlaceholder('Your name').isVisible().catch(() => false)) {
    await page.getByPlaceholder('Your name').fill(who);
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  return page;
}

/** Create a group and remember it, so cleanup() can remove it afterwards. */
export async function createGroup(page, name) {
  await page.getByPlaceholder('Group name').fill(name);
  await page.getByRole('button', { name: 'Create group' }).click();
  await page.waitForSelector('.chat header');
  const code = await joinCode(page);
  created.add(code);
  return code;
}

/** The join code lives in the People sheet, not the header. */
export async function joinCode(page) {
  await page.getByRole('button', { name: /^People/ }).click();
  await page.waitForSelector('.sheet-card .code');
  const code = (await page.locator('.sheet-card .code').innerText()).trim();
  await closeSheet(page);
  return code;
}

/** Some actions close the sheet themselves; only close one that is open. */
export async function closeSheet(page) {
  if (await page.locator('.sheet').count()) {
    await page.locator('.sheet').click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(250);
  }
}

/** Delete every room this run created, then report. Call it in a finally. */
export async function cleanup(browser) {
  try { await browser?.close(); } catch {}

  const headers = {
    apikey: env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`,
  };
  let gone = 0;
  for (const code of created) {
    const r = await fetch(
      `${env.VITE_SUPABASE_URL}/rest/v1/rooms?join_code=eq.${encodeURIComponent(code)}`,
      { method: 'DELETE', headers });
    if (r.ok) gone++;
  }
  if (created.size) console.log(`cleanup: removed ${gone}/${created.size} test rooms`);
  process.exit(failures ? 1 : 0);
}
