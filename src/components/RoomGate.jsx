import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Halo } from './Halo.jsx';
import { code, rooms } from '../lib/storage.js';
import { oneRoom as one } from '../lib/rooms.js';

export function RoomGate({ name, onDone }) {
  const [join, setJoin] = useState('');
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');

  // Rooms are created and found through security definer functions now. There
  // is no insert policy on `rooms` and no way to select one you are not in, so
  // these are the only doors.

  async function create(e) {
    e.preventDefault();
    const { data, error } = await supabase.rpc('create_room', {
      p_name: newName.trim(), p_code: code(), p_member: name,
    });
    error ? setErr(error.message) : onDone(one(data));
  }

  async function enter(e) {
    e.preventDefault();
    const { data, error } = await supabase.rpc('join_room', {
      p_code: join.trim().toUpperCase(), p_name: name,
    });
    if (error) return setErr(error.message);
    const r = one(data);
    r ? onDone(r) : setErr('No group with that code.');
  }

  const mine = rooms.all();

  // Reopening re-joins, because this device may be meeting the database with
  // a new identity: a cleared browser, another phone, or the first load after
  // identities existed at all. join_room is idempotent.
  async function reopen(r) {
    const { data } = await supabase.rpc('join_room', { p_code: r.join_code, p_name: name });
    const found = one(data);
    if (found) return onDone(found);
    rooms.drop(r.id);
    setErr(`"${r.name}" no longer exists.`);
  }

  return (
    <div className="center gate">
      <Halo size={92} />
      <h1>Pure Chat</h1>
      <p className="muted">Start a group, then invite your friends.</p>

      {mine.length > 0 && (
        <div className="recent">
          <div className="label">Your groups</div>
          {mine.map(r => (
            <button key={r.id} type="button" className="recent-row" onClick={() => reopen(r)}>
              <span>{r.name}</span>
              <span className="code">{r.join_code}</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={create}>
        <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Group name" maxLength={32} />
        <button disabled={!newName.trim()}>Create group</button>
      </form>
      <div className="or">or join one you were sent</div>
      <form onSubmit={enter}>
        <input value={join} onChange={e => setJoin(e.target.value)} placeholder="Join code" maxLength={5} />
        <button className="ghost" disabled={!join.trim()}>Join group</button>
      </form>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
