import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase.js';
import { store, rooms } from './lib/storage.js';
import { UpdateBanner } from './components/UpdateBanner.jsx';
import { NameGate } from './components/NameGate.jsx';
import { RoomGate } from './components/RoomGate.jsx';
import { Chat } from './components/Chat.jsx';

/** Which of the three screens you are on, and nothing else. */
export default function App() {
  const [name, setName] = useState(store.get('name'));
  const [room, setRoom] = useState(null);
  // Start settled when there is nothing to fetch, so the effect never has to
  // immediately set state to say "actually, done".
  const [booting, setBooting] = useState(
    () => Boolean(location.hash.replace('#', '').trim() || store.get('roomId')));

  // An invite link (#CODE) wins over the last room you were in.
  useEffect(() => {
    const invite = location.hash.replace('#', '').trim().toUpperCase();
    const id = store.get('roomId');

    const done = r => {
      if (r) { store.set('roomId', r.id); rooms.add(r); setRoom(r); }
      setBooting(false);
    };

    if (invite) {
      history.replaceState(null, '', location.pathname);
      supabase.from('rooms').select('*').eq('join_code', invite).maybeSingle()
        .then(({ data }) => done(data));
    } else if (id) {
      supabase.from('rooms').select('*').eq('id', id).maybeSingle()
        .then(({ data }) => done(data));
    }
  }, []);

  if (booting) return <div className="center muted">Loading…</div>;

  const screen = !name
    ? <NameGate onDone={n => { store.set('name', n); setName(n); }} />
    : !room
      ? <RoomGate onDone={r => { store.set('roomId', r.id); rooms.add(r); setRoom(r); }} />
      : <Chat
          name={name}
          room={room}
          onBack={() => { store.set('roomId', ''); setRoom(null); }}
          onForget={() => { rooms.drop(room.id); store.set('roomId', ''); setRoom(null); }}
        />;

  return <><UpdateBanner />{screen}</>;
}
