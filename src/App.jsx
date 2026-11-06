import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { readZip, readLooseImages, encodeShortcodes, splitBody, dedupeNames, toMediaUrl, normalise, GIF_MAX_BYTES } from './packs.js';

// The halo. Inline so it scales and needs no path juggling under a base path.
function Halo({ size = 64, className = '' }) {
  const id = 'halo' + size;
  return (
    <svg className={'halo ' + className} width={size} height={size * 0.42} viewBox="0 0 320 134" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="45%" stopColor="#f6c452" />
          <stop offset="100%" stopColor="#d79a1f" />
        </linearGradient>
      </defs>
      <ellipse cx="160" cy="70" rx="138" ry="48" fill="none" stroke={`url(#${id})`} strokeWidth="22" />
      <ellipse cx="160" cy="63" rx="138" ry="48" fill="none" stroke="#fff6dc" strokeWidth="4" opacity=".6" />
    </svg>
  );
}

const code = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const store = {
  get: k => localStorage.getItem('huddle.' + k) || '',
  set: (k, v) => localStorage.setItem('huddle.' + k, v),
};

// Every group you have ever been in, so leaving one never loses its code.
const history_ = {
  all: () => { try { return JSON.parse(store.get('rooms') || '[]'); } catch { return []; } },
  add: r => {
    const kept = history_.all().filter(x => x.id !== r.id);
    store.set('rooms', JSON.stringify([{ id: r.id, name: r.name, join_code: r.join_code }, ...kept].slice(0, 20)));
  },
  drop: id => store.set('rooms', JSON.stringify(history_.all().filter(x => x.id !== id))),
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
      if (r) { store.set('roomId', r.id); history_.add(r); setRoom(r); }
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
  if (!room) return <RoomGate onDone={r => { store.set('roomId', r.id); history_.add(r); setRoom(r); }} />;

  return <Chat name={name} room={room} onLeave={() => { store.set('roomId', ''); setRoom(null); }} />;
}

function NameGate({ onDone }) {
  const [v, setV] = useState('');
  return (
    <form className="center gate" onSubmit={e => { e.preventDefault(); v.trim() && onDone(v.trim()); }}>
      <Halo size={92} />
      <h1>Pure Chat</h1>
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

  const mine = history_.all();

  async function reopen(r) {
    const { data } = await supabase.from('rooms').select('*').eq('id', r.id).maybeSingle();
    if (data) return onDone(data);
    history_.drop(r.id);
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

function Chat({ name, room, onLeave }) {
  const [msgs, setMsgs] = useState([]);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [people, setPeople] = useState([]);
  const [online, setOnline] = useState([]);
  const [showPeople, setShowPeople] = useState(false);
  const [packs, setPacks] = useState([]);
  const [emoji, setEmoji] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const end = useRef(null);

  // Anyone in the room resolves an emoji id, so a person without the pack
  // still sees the picture rather than a word in colons.
  const byId = useMemo(() => new Map(emoji.map(e => [e.id, e])), [emoji]);
  const byName = useMemo(() => {
    const m = new Map();
    for (const e of emoji) if (!m.has(e.name)) m.set(e.name, e);
    return m;
  }, [emoji]);

  // Clicking a specific picture must send that picture, whatever else shares
  // its name. The picker records the exact id it offered.
  const picked = useRef(new Map());

  // Share sheet on phones, clipboard everywhere else.
  async function invite() {
    const url = `${location.origin}${location.pathname}#${room.join_code}`;
    const text = `Join ${room.name} on Pure Chat`;
    try {
      if (navigator.share) return await navigator.share({ title: text, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* user dismissed the share sheet */ }
  }

  useEffect(() => {
    let live = true;

    const loadPeople = () => supabase.from('members').select('*')
      .eq('room_id', room.id).order('joined_at')
      .then(({ data }) => live && setPeople(data || []));

    const loadPacks = async () => {
      const { data: ps } = await supabase.from('packs').select('*')
        .eq('room_id', room.id).order('created_at');
      if (!live) return;
      setPacks(ps || []);
      const ids = (ps || []).map(p => p.id);
      if (!ids.length) return setEmoji([]);
      const { data: es } = await supabase.from('emoji').select('*').in('pack_id', ids);
      if (live) setEmoji(es || []);
    };
    loadPacks();


    // Record that I am here, then read the roster.
    supabase.from('members')
      .upsert({ room_id: room.id, name, last_seen: new Date().toISOString() },
              { onConflict: 'room_id,name' })
      .then(loadPeople);

    // Merge rather than replace, because history and live inserts race.
    const merge = incoming => setMsgs(prev => {
      const seen = new Map(prev.map(m => [m.id, m]));
      for (const m of incoming) seen.set(m.id, m);
      return [...seen.values()].sort((x, y) =>
        x.created_at === y.created_at ? Number(x.id) - Number(y.id)
                                      : x.created_at < y.created_at ? -1 : 1);
    });

    const loadHistory = () => supabase.from('messages').select('*')
      .eq('room_id', room.id).order('created_at').limit(200)
      .then(({ data }) => live && merge(data || []));

    const ch = supabase.channel('room:' + room.id, { config: { presence: { key: name } } })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        ({ new: m }) => merge([m]))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `room_id=eq.${room.id}` },
        loadPeople)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'packs', filter: `room_id=eq.${room.id}` },
        loadPacks)
      // Also watch emoji rows: adding one to a pack that already exists fires
      // no packs event, so a GIF kept into Saved GIFs reached nobody else.
      // Unfiltered because emoji rows carry a pack, not a room; loadPacks
      // still only reads this room.
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'emoji' },
        loadPacks)
      .on('presence', { event: 'sync' },
        () => setOnline(Object.keys(ch.presenceState())))
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return;
        ch.track({ name, at: Date.now() });
        // Only now is it safe to read history: anything inserted from here on
        // arrives over the socket, so the two cannot miss each other.
        loadHistory();
      });

    return () => { live = false; supabase.removeChannel(ch); };
  }, [room.id, name]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs.length]);

  async function send(e) {
    e.preventDefault();
    const resolver = new Map(byName);
    for (const [n, e] of picked.current) resolver.set(n, e);
    const body = encodeShortcodes(draft.trim(), resolver);
    if (!body) return;
    setDraft('');
    const { error } = await supabase.from('messages').insert({ room_id: room.id, author: name, body });
    // Silently losing a message is the worst failure this app can have.
    if (error) { setSendErr(error.message); setDraft(draft); }
    else picked.current.clear();
  }

  return (
    <div className="chat">
      <header>
        <div className="title">
          <Halo size={30} className="mark" />
          <strong>{room.name}</strong>
          <span className="code">{room.join_code}</span>
        </div>
        <div className="actions">
          <button className="link" onClick={() => setShowPeople(true)}>
            People {people.length > 0 && <span className="pill">{people.length}</span>}
          </button>
          <button className="link" onClick={invite}>{copied ? 'Copied' : 'Invite'}</button>
        </div>
      </header>

      {showPeople && (
        <div className="sheet" onClick={() => setShowPeople(false)}>
          <div className="sheet-card" onClick={e => e.stopPropagation()}>
            <div className="sheet-head">
              <strong>In this group</strong>
              <button className="link" onClick={() => setShowPeople(false)}>Done</button>
            </div>
            {people.length === 0 && <p className="muted">Nobody yet.</p>}
            {people.map(p => (
              <div key={p.name} className="person">
                <span className={'dot ' + (online.includes(p.name) ? 'on' : '')} />
                <span>{p.name}{p.name === name && <span className="muted"> (you)</span>}</span>
                <span className="muted when">{online.includes(p.name) ? 'online' : 'offline'}</span>
              </div>
            ))}
            <button className="leave" onClick={onLeave}>Leave group</button>
          </div>
        </div>
      )}

      <main>
        {msgs.length === 0 && <p className="muted empty">No messages yet. Say something.</p>}
        {msgs.map((m, i) => {
          const mine = m.author === name;
          const runOn = i > 0 && msgs[i - 1].author === m.author;
          return (
            <div key={m.id} className={'row ' + (mine ? 'mine' : 'theirs')}>
              <div className="bubble">
                {!mine && !runOn && <div className="who">{m.author}</div>}
                <Body body={m.body} byId={byId} />
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </main>

      {showEmoji && (
        <EmojiSheet
          room={room} name={name} packs={packs} emoji={emoji}
          onPick={e => {
            picked.current.set(e.name, e);
            setDraft(d => d + `:${e.name}:`);
            setShowEmoji(false);
          }}
          onClose={() => setShowEmoji(false)}
        />
      )}

      {showMedia && (
        <MediaSheet
          room={room} name={name} packs={packs} emoji={emoji}
          onSend={url => { setDraft(d => (d ? d + ' ' : '') + url); setShowMedia(false); }}
          onSendEmoji={e => {
            picked.current.set(e.name, e);
            setDraft(d => (d ? d + ' ' : '') + `:${e.name}:`);
            setShowMedia(false);
          }}
          onClose={() => setShowMedia(false)}
        />
      )}

      <div className="composer">
        {sendErr && <p className="err send-err">Not sent: {sendErr}</p>}
        {/* The tool bar. One button today; this is where gifs, music and
            anything else people bring will hang off. */}
        <div className="tools">
          <button type="button" className="tool emoji-tool" title="Emoji"
                  onClick={() => setShowEmoji(true)}>☺</button>
          <button type="button" className="tool gif" title="Paste a GIF or picture link"
                  onClick={() => setShowMedia(true)}>GIF</button>
        </div>
        <form onSubmit={send}>
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message" />
          <button disabled={!draft.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}

/** A message body: text with [[e:id]] tokens swapped for pictures. */
function Body({ body, byId }) {
  return splitBody(body).map((part, i) => {
    if (part.text !== undefined) return <span key={i}>{part.text}</span>;
    if (part.media) return <img key={i} className="media" src={part.media} alt="" loading="lazy" />;
    const e = byId.get(part.emojiId);
    return e
      ? <img key={i} className="emoji" src={e.url} alt={':' + e.name + ':'} title={':' + e.name + ':'} />
      : <span key={i} className="muted">[emoji]</span>;
  });
}

function EmojiSheet({ room, name, packs, emoji, onPick, onClose }) {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const zipRef = useRef(null);
  const imgRef = useRef(null);

  async function install(read) {
    setErr('');
    try {
      const pack = await read();
      const renamed = dedupeNames(pack.emoji, emoji.map(e => e.name));
      const clashes = renamed.filter((e, i) => e.name !== pack.emoji[i].name).length;
      setBusy(`Adding ${renamed.length} emoji...`);
      const { data: row, error } = await supabase.from('packs')
        .insert({ room_id: room.id, name: pack.name, author: pack.author, added_by: name })
        .select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from('emoji')
        .insert(renamed.map(e => ({ pack_id: row.id, name: e.name, url: e.url })));
      if (e2) {
        await supabase.from('packs').delete().eq('id', row.id);
        throw e2;
      }
      if (clashes) setErr(`${clashes} name${clashes > 1 ? 's' : ''} already in use here, renamed so nothing is ambiguous.`);
    } catch (ex) {
      setErr(ex.message || String(ex));
    } finally {
      setBusy('');
    }
  }

  async function removePack(id) {
    await supabase.from('packs').delete().eq('id', id);
  }

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <strong>Emoji</strong>
          <button className="link" onClick={onClose}>Done</button>
        </div>

        {emoji.length === 0 && !busy && (
          <p className="muted">No packs yet. Add a .zip pack, or just pick some images.</p>
        )}

        {packs.map(p => {
          const mine = emoji.filter(e => e.pack_id === p.id);
          return (
            <div key={p.id} className="pack">
              <div className="pack-head">
                <span>{p.name} <span className="muted">{mine.length}</span></span>
                <button className="link" onClick={() => removePack(p.id)}>Remove</button>
              </div>
              <div className="grid">
                {mine.map(e => (
                  <button key={e.id} className="cell" title={':' + e.name + ':'} onClick={() => onPick(e)}>
                    <img src={e.url} alt={e.name} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {busy && <p className="muted">{busy}</p>}
        {err && <p className="err">{err}</p>}

        <div className="pack-actions">
          <button className="ghost" onClick={() => zipRef.current.click()}>Add pack (.zip)</button>
          <button className="ghost" onClick={() => imgRef.current.click()}>Add images</button>
        </div>

        <input ref={zipRef} type="file" accept=".zip" hidden
               onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) install(() => readZip(f)); }} />
        <input ref={imgRef} type="file" accept="image/*" multiple hidden
               onChange={e => { const fs = [...e.target.files]; e.target.value = '';
                                if (fs.length) install(() => readLooseImages(fs, 'My pack')); }} />
      </div>
    </div>
  );
}

/**
 * Paste a link to a GIF, see it, send it, and optionally keep it in the group's
 * library. Nothing is uploaded: a kept GIF is a pack entry whose url points at
 * wherever the picture already lives.
 */
function MediaSheet({ room, name, packs, emoji, onSend, onSendEmoji, onClose }) {
  const [raw, setRaw] = useState('');
  const fileRef = useRef(null);
  const [keepName, setKeepName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const url = toMediaUrl(raw);
  const taken = new Set(emoji.map(e => e.name));
  const clean = keepName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  async function shelfId() {
    const existing = packs.find(p => p.name === 'Saved GIFs');
    if (existing) return existing.id;
    const { data, error } = await supabase.from('packs')
      .insert({ room_id: room.id, name: 'Saved GIFs', added_by: name }).select().single();
    if (error) throw error;
    return data.id;
  }

  const freeName = base => {
    let n = base, i = 2;
    while (taken.has(n)) n = `${base}-${i++}`;
    return n;
  };

  async function keep() {
    setBusy(true);
    setErr('');
    try {
      const { error } = await supabase.from('emoji')
        .insert({ pack_id: await shelfId(), name: freeName(clean), url });
      if (error) throw error;
      onSend(url);
    } catch (ex) {
      setErr(ex.message || String(ex));
      setBusy(false);
    }
  }

  /**
   * Pick a GIF straight out of Photos. Copying a *link* on iOS is awkward, so
   * this is the path that actually works on a phone. It is stored rather than
   * linked, which breaks the store-nothing rule on purpose and is capped
   * tightly. It goes in as a library entry and the message carries a
   * reference, so sending the same GIF ten times costs one copy.
   */
  async function fromPhotos(file) {
    setBusy(true);
    setErr('');
    try {
      const dataUrl = await normalise(file, GIF_MAX_BYTES);
      const base = (file.name || 'gif').replace(/\.[^.]+$/, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'gif';
      const { data, error } = await supabase.from('emoji')
        .insert({ pack_id: await shelfId(), name: freeName(base), url: dataUrl })
        .select().single();
      if (error) throw error;
      onSendEmoji(data);
    } catch (ex) {
      setErr(ex.message || String(ex));
      setBusy(false);
    }
  }

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <strong>Send a GIF</strong>
          <button className="link" onClick={onClose}>Done</button>
        </div>

        <div className="pack-actions">
          <button onClick={() => fileRef.current.click()} disabled={busy}>
            {busy ? 'Working...' : 'Choose from Photos'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden
               onChange={e => { const f = e.target.files[0]; e.target.value = ''; if (f) fromPhotos(f); }} />

        <div className="or">or paste a link</div>
        <p className="muted hint">In the GIPHY app: tap a GIF, Share, Copy Link. On giphy.com in a browser, open the GIF on its own page and copy the address bar.</p>
        <input autoFocus value={raw} onChange={e => setRaw(e.target.value)}
               placeholder="https://..." />

        {raw && !url && <p className="err">That link is not a picture or a GIPHY page.</p>}

        {url && (
          <>
            <div className="preview"><img src={url} alt="" /></div>
            <div className="pack-actions">
              <button onClick={() => onSend(url)}>Send</button>
            </div>
            <div className="keep">
              <input value={keepName} onChange={e => setKeepName(e.target.value)}
                     placeholder="Keep it as :name:" maxLength={32} />
              <button className="ghost" disabled={!clean || busy} onClick={keep}>
                {busy ? 'Keeping...' : 'Keep in pack'}
              </button>
            </div>
            <p className="muted hint">Keeping it puts it in the group's library, one tap away next time.</p>
          </>
        )}

        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}
