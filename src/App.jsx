import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';

const code = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const store = {
  get: k => localStorage.getItem('huddle.' + k) || '',
  set: (k, v) => localStorage.setItem('huddle.' + k, v),
};

export default function App() {
  const [name, setName] = useState(store.get('name'));
  const [room, setRoom] = useState(null);
  const [booting, setBooting] = useState(true);

  // An invite link (#CODE) wins over the last room you were in.
  useEffect(() => {
    const invite = location.hash.replace('#', '').trim().toUpperCase();
    const id = store.get('roomId');

    const done = r => {
      if (r) { store.set('roomId', r.id); setRoom(r); }
      setBooting(false);
    };

    if (invite) {
      history.replaceState(null, '', location.pathname);
      supabase.from('rooms').select('*').eq('join_code', invite).maybeSingle()
        .then(({ data }) => done(data));
    } else if (id) {
      supabase.from('rooms').select('*').eq('id', id).maybeSingle()
        .then(({ data }) => done(data));
    } else {
      setBooting(false);
    }
  }, []);

  if (booting) return <div className="center muted">Loading…</div>;
  if (!name) return <NameGate onDone={n => { store.set('name', n); setName(n); }} />;
  if (!room) return <RoomGate onDone={r => { store.set('roomId', r.id); setRoom(r); }} />;

  return <Chat name={name} room={room} onLeave={() => { store.set('roomId', ''); setRoom(null); }} />;
}

function NameGate({ onDone }) {
  const [v, setV] = useState('');
  return (
    <form className="center gate" onSubmit={e => { e.preventDefault(); v.trim() && onDone(v.trim()); }}>
      <h1>Huddle</h1>
      <p className="muted">A private place for your group.</p>
      <input autoFocus value={v} onChange={e => setV(e.target.value)} placeholder="Your name" maxLength={24} />
      <button disabled={!v.trim()}>Continue</button>
    </form>
  );
}

function RoomGate({ onDone }) {
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

  return (
    <div className="center gate">
      <h1>Huddle</h1>
      <p className="muted">Start a group, then invite your friends.</p>
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

function Chat({ name, room, onLeave }) {
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const end = useRef(null);

  // Share sheet on phones, clipboard everywhere else.
  async function invite() {
    const url = `${location.origin}${location.pathname}#${room.join_code}`;
    const text = `Join ${room.name} on Huddle`;
    try {
      if (navigator.share) return await navigator.share({ title: text, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* user dismissed the share sheet */ }
  }

  useEffect(() => {
    let live = true;
    supabase.from('messages').select('*').eq('room_id', room.id)
      .order('created_at').limit(200)
      .then(({ data }) => live && setMsgs(data || []));

    const ch = supabase.channel('room:' + room.id)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        ({ new: m }) => setMsgs(p => p.some(x => x.id === m.id) ? p : [...p, m]))
      .subscribe();

    return () => { live = false; supabase.removeChannel(ch); };
  }, [room.id]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  async function send(e) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    await supabase.from('messages').insert({ room_id: room.id, author: name, body });
  }

  return (
    <div className="chat">
      <header>
        <div>
          <strong>{room.name}</strong>
          <span className="code">{room.join_code}</span>
        </div>
        <div className="actions">
          <button className="link" onClick={invite}>{copied ? 'Copied' : 'Invite'}</button>
          <button className="link" onClick={onLeave}>Leave</button>
        </div>
      </header>

      <main>
        {msgs.length === 0 && <p className="muted empty">No messages yet. Say something.</p>}
        {msgs.map((m, i) => {
          const mine = m.author === name;
          const runOn = i > 0 && msgs[i - 1].author === m.author;
          return (
            <div key={m.id} className={'row ' + (mine ? 'mine' : 'theirs')}>
              <div className="bubble">
                {!mine && !runOn && <div className="who">{m.author}</div>}
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </main>

      <form onSubmit={send}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message" />
        <button disabled={!draft.trim()}>Send</button>
      </form>
    </div>
  );
}
