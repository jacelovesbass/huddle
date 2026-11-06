import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { Halo } from './Halo.jsx';
import { code, rooms } from '../lib/storage.js';

export function RoomGate({ onDone }) {
  const [join, setJoin] = useState('');
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');

  async function create(e) {
    e.preventDefault();
    const { data, error } = await supabase.from('rooms')
      .insert({ name: newName.trim(), join_code: code() }).select().single();
    error ? setErr(error.message) : onDone(data);
  }

  async function enter(e) {
    e.preventDefault();
    const { data, error } = await supabase.from('rooms')
      .select('*').eq('join_code', join.trim().toUpperCase()).maybeSingle();
    if (error) return setErr(error.message);
    data ? onDone(data) : setErr('No group with that code.');
  }

  const mine = rooms.all();

  async function reopen(r) {
    const { data } = await supabase.from('rooms').select('*').eq('id', r.id).maybeSingle();
    if (data) return onDone(data);
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
