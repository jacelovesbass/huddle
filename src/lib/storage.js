// What this browser remembers: your name, the group you were last in, and
// every group you have ever opened. Deliberately localStorage and nothing
// else, because there are no accounts and nothing here is worth syncing.

const KEY = 'huddle.';   // Named before the app was renamed. Changing it would
                         // forget everyone's groups for no benefit.

export const code = () => Math.random().toString(36).slice(2, 7).toUpperCase();

export const store = {
  get: k => localStorage.getItem(KEY + k) || '',
  set: (k, v) => localStorage.setItem(KEY + k, v),
};

/**
 * Every group you have been in, newest first, capped at 20.
 *
 * This exists because leaving a group used to lose its join code: the code was
 * only ever shown inside the chat, so stepping out was a one-way door.
 */
export const rooms = {
  all() {
    try { return JSON.parse(store.get('rooms') || '[]'); } catch { return []; }
  },
  add(r) {
    const kept = rooms.all().filter(x => x.id !== r.id);
    store.set('rooms', JSON.stringify(
      [{ id: r.id, name: r.name, join_code: r.join_code }, ...kept].slice(0, 20)));
  },
  drop(id) {
    store.set('rooms', JSON.stringify(rooms.all().filter(x => x.id !== id)));
  },
};
