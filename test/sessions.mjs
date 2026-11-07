// A small pool of anonymous identities, shared by every suite.
//
// Each browser context is a fresh browser, so it used to sign in anonymously
// from scratch: roughly fifty sign-ins per full run, against a default limit
// of thirty an hour. The suite was failing on a production rate limit rather
// than on anything about the app.
//
// So identities are created once, cached on disk, and seeded straight into
// localStorage. A given NAME always maps to the same identity, which keeps
// "two different people" genuinely two different people.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const CACHE = path.join(ROOT, '.test-sessions.json');

const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));

function load() {
  try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return {}; }
}

/**
 * A session object ready to drop into localStorage, one per NAME.
 *
 * Keyed by the name itself, deliberately. An earlier version hashed names into
 * eight slots, so two different people in a test could quietly collide onto one
 * identity: "the other person" became the same person, two-client tests failed
 * for no visible reason, and the lockdown suite's member-of-nothing stranger
 * turned out to be a member of five rooms. A pool that silently conflates two
 * identities is worse than no pool.
 */
export async function sessionFor(name) {
  let cache = load();
  if (cache[name] && !expired(cache[name])) return cache[name];

  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });

  let session = null;

  // An access token lasts an hour, a refresh token much longer. REFRESHING an
  // expired identity costs nothing against the anonymous sign-in rate limit;
  // minting a new one does. Re-minting hourly is what kept failing the suite.
  if (cache[name]?.refresh_token) {
    const { data } = await sb.auth.refreshSession({ refresh_token: cache[name].refresh_token });
    session = data?.session ?? null;
  }

  if (!session) {
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw new Error(`could not mint a test identity for ${name}: ${error.message}`);
    session = data.session;
  }

  cache = load();                      // re-read: suites run as separate processes
  cache[name] = session;
  fs.writeFileSync(CACHE, JSON.stringify(cache));
  return session;
}

function expired(s) {
  return !s?.access_token || (s.expires_at ?? 0) * 1000 < Date.now() + 60_000;
}

export const SESSION_KEY = 'purechat-auth';
