import { createClient } from '@supabase/supabase-js';

export const SESSION_KEY = 'purechat-auth';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  // An explicit storage key, so the test suite can seed a session into a
  // browser rather than burning a fresh anonymous sign-in for every context.
  // The default key is derived from the project ref and is not worth guessing.
  { auth: { storageKey: SESSION_KEY } }
);
