// Shared test plumbing.
//
// Keep this to things every suite genuinely uses. An earlier version carried
// a cleanup() and a launch() that no suite ever imported, which is worse than
// duplication: dead code that looks like policy.
import { chromium } from 'playwright';
import { sessionFor, SESSION_KEY } from './sessions.mjs';

export const BASE = (process.env.TEST_URL || 'http://localhost:5173').replace(/\/$/, '') + '/';

/** A browser with page errors surfaced, because a silent exception looks like a hang. */
export async function launch() {
  return chromium.launch();
}

/** Open the app as someone, optionally straight into an invite link. */
export async function open(browser, who, url = BASE) {
  const context = await browser.newContext({ viewport: { width: 390, height: 820 } });
  // Seed an identity instead of signing in again. Same name, same identity,
  // so two names are still two genuinely different people.
  const session = await sessionFor(who);
  await context.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v); } catch { /* first-run about:blank */ }
  }, [SESSION_KEY, JSON.stringify(session)]);
  const page = await context.newPage();
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

/** Wait for a condition rather than guessing a delay. Returns true if it held. */
export async function until(fn, { timeout = 15000, every = 400 } = {}) {
  const stop = Date.now() + timeout;
  while (Date.now() < stop) {
    if (await fn()) return true;
    await new Promise(r => setTimeout(r, every));
  }
  return false;
}
