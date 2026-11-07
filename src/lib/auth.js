// An identity, and nothing more.
//
// Every device signs in anonymously: a uuid, no email, no password, no login
// screen, nothing the person has to do or even notice. It exists so the
// database can tell one device from another, which is what membership is built
// on. Before this, the publishable key in the browser bundle could read every
// message in every group.
//
// This is NOT encryption and does not pretend to be. The server can still read
// everything; what changed is that strangers cannot.
import { supabase } from './supabase.js';

let pending = null;

/** Resolve once this browser has a session. Safe to call repeatedly. */
export function ready() {
  if (!pending) {
    pending = (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return session;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      return data.session;
    })();
    // A failed sign-in must not poison every later call.
    pending.catch(() => { pending = null; });
  }
  return pending;
}

export async function uid() {
  const session = await ready();
  return session?.user?.id ?? null;
}
