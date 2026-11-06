import { useState } from 'react';
import { Halo } from './Halo.jsx';

export function NameGate({ onDone }) {
  const [v, setV] = useState('');
  return (
    <form className="center gate" onSubmit={e => { e.preventDefault(); v.trim() && onDone(v.trim()); }}>
      <Halo size={92} />
      <h1>Pure Chat</h1>
      <p className="muted">A private place for your group.</p>
      <input autoFocus value={v} onChange={e => setV(e.target.value)} placeholder="Your name" maxLength={24} />
      <button disabled={!v.trim()}>Continue</button>
      <a className="about" href="about.html">What is Pure Chat?</a>
    </form>
  );
}
