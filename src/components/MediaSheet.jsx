import { useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { toMediaUrl, splitBody, normalise, GIF_MAX_BYTES, tagsFromUrl } from '../lib/packs.js';

/**
 * Paste a link to a GIF, see it, send it, and optionally keep it in the group's
 * library. Nothing is uploaded: a kept GIF is a pack entry whose url points at
 * wherever the picture already lives.
 */
export function MediaSheet({ room, name, packs, emoji, msgs, onSend, onSendEmoji, onClose }) {
  const [raw, setRaw] = useState('');
  const [tags, setTags] = useState('');
  const [q, setQ] = useState('');
  const fileRef = useRef(null);

  const shelf = packs.find(p => p.name === 'Saved GIFs');

  /**
   * The library fills itself. Anything kept on purpose, plus every picture
   * already sent in this conversation. Requiring people to press Keep meant
   * the picker was empty for someone who had been sending GIFs all day.
   */
  const library = useMemo(() => {
    const out = [];
    const seen = new Set();

    for (const e of emoji) {
      if (shelf && e.pack_id === shelf.id && !seen.has(e.url)) {
        seen.add(e.url);
        out.push({ key: e.id, url: e.url, name: e.name, tags: e.tags || '', kept: true, emoji: e });
      }
    }

    for (let i = msgs.length - 1; i >= 0; i--) {
      for (const part of splitBody(msgs[i].body)) {
        if (!part.media || seen.has(part.media)) continue;
        seen.add(part.media);
        out.push({ key: part.media, url: part.media, name: '', tags: '', kept: false });
      }
    }
    return out;
  }, [emoji, msgs, shelf]);

  const shown = library.filter(g => {
    const needle = q.trim().toLowerCase();
    return !needle || g.name.includes(needle) || g.tags.toLowerCase().includes(needle);
  });
  const [keepName, setKeepName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const url = toMediaUrl(raw);
  const autoTags = tagsFromUrl(raw);
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
        .insert({ pack_id: await shelfId(), name: freeName(clean), url, tags: (tags || autoTags).trim() });
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
        .insert({ pack_id: await shelfId(), name: freeName(base), url: dataUrl, tags: tags.trim() })
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

        {library.length > 0 && (
          <div className="library">
            <input className="search" value={q} onChange={e => setQ(e.target.value)}
                   placeholder={`Search ${library.length} GIF${library.length > 1 ? 's' : ''} in this group`} />
            <div className="gif-grid">
              {shown.map(g => (
                <button key={g.key} className={'gif-cell' + (g.kept ? ' kept' : '')}
                        title={g.kept ? `:${g.name}:${g.tags ? ' - ' + g.tags : ''}` : 'Sent earlier'}
                        onClick={() => (g.kept ? onSendEmoji(g.emoji) : onSend(g.url))}>
                  <img src={g.url} alt={g.name} loading="lazy" />
                </button>
              ))}
            </div>
            {shown.length === 0 && <p className="muted">Nothing matches "{q}".</p>}
          </div>
        )}

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
                {busy ? 'Keeping...' : 'Keep'}
              </button>
            </div>
            <input className="tagbox" value={tags} onChange={e => setTags(e.target.value)}
                   placeholder={autoTags ? `Tags: ${autoTags}` : 'Tags, so you can find it later'} />
            <p className="muted hint">Keeping it puts it in the group's library, one tap away next time.</p>
          </>
        )}

        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}
