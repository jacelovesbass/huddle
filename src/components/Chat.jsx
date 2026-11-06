import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { encodeShortcodes } from '../lib/packs.js';
import { Halo } from './Halo.jsx';
import { Body } from './Body.jsx';
import { EmojiSheet } from './EmojiSheet.jsx';
import { MediaSheet } from './MediaSheet.jsx';

export function Chat({ name, room, onBack, onForget }) {
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
        <button className="link back" title="All groups" onClick={onBack}>‹</button>
        <div className="title">
          <Halo size={30} className="mark" />
          <strong>{room.name}</strong>
        </div>
        <div className="actions">
          <button className="link refresh" title="Get the latest version"
                  onClick={() => location.replace(`${location.pathname}?v=${Date.now()}`)}>⟳</button>
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
              <strong>{room.name} <span className="code">{room.join_code}</span></strong>
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
            <button className="leave" onClick={onForget}>Forget this group</button>
            <p className="muted hint">Forgetting removes it from your list on this device. Anyone with the code can still get in, and nothing is deleted for the others.</p>
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
          room={room} name={name} packs={packs} emoji={emoji} msgs={msgs}
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
