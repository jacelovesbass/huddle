import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { ready } from './lib/auth.js';
import { oneRoom } from './lib/rooms.js';
import { store, rooms } from './lib/storage.js';
import { UpdateBanner } from './components/UpdateBanner.jsx';
import { NameGate } from './components/NameGate.jsx';
import { RoomGate } from './components/RoomGate.jsx';
import { Chat } from './components/Chat.jsx';

/** Which of the three screens you are on, and nothing else. */
export default function App() {
  const [name, setName] = useState(store.get('name'));
  const [room, setRoom] = useState(null);
  // Always boot, because there is always something to wait for now: the
  // database answers nothing without a session, so nothing may be rendered
  // that could call it. The first version of this only waited when there was
  // a room to fetch, and every create or join fired before sign-in landed and
  // came back "not signed in".
  const [booting, setBooting] = useState(true);
  const [authErr, setAuthErr] = useState('');

  // An invite link (#CODE) wins over the last room you were in.
  //
  // Everything here now waits on a session, because the database answers
  // nothing without one. Rooms are found by CODE rather than by id: the code
  // is the capability, and `select * from rooms` no longer works at all.
  useEffect(() => {
    const invite = location.hash.replace('#', '').trim().toUpperCase();
    const id = store.get('roomId');
    const saved = rooms.all().find(r => r.id === id);

    const done = r => {
      if (r) { store.set('roomId', r.id); rooms.add(r); setRoom(r); }
      setBooting(false);
    };

    const find = code => supabase.rpc('find_room', { p_code: code })
      .then(({ data }) => oneRoom(data));

    ready()
      .then(() => {
        if (invite) {
          history.replaceState(null, '', location.pathname);
          return find(invite);
        }
        // The stored room carries its own code, which is what makes the
        // switch to code-based lookup invisible to anyone already using it.
        if (saved?.join_code) return find(saved.join_code);
        return null;
      })
      .then(done)
      .catch(e => {
        // Without a session nothing works, so say so plainly rather than
        // dropping the person into a gate whose every button fails.
        setAuthErr(e?.status === 429
          ? 'Too many sign-ins from this network just now. Wait a minute and try again.'
          : 'Could not reach the server. Check your connection and try again.');
        setBooting(false);
      });
  }, []);

  if (booting) return <div className="center muted">Loading…</div>;

  if (authErr) {
    return (
      <div className="center gate">
        <h1>Pure Chat</h1>
        <p className="err">{authErr}</p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>
    );
  }

  const screen = !name
    ? <NameGate onDone={n => { store.set('name', n); setName(n); }} />
    : !room
      ? <RoomGate name={name} onDone={r => { store.set('roomId', r.id); rooms.add(r); setRoom(r); }} />
      : <Chat
          name={name}
          room={room}
          onBack={() => { store.set('roomId', ''); setRoom(null); }}
          onForget={() => { rooms.drop(room.id); store.set('roomId', ''); setRoom(null); }}
        />;

  return <><UpdateBanner />{screen}</>;
}
