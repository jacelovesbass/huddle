// Play a Versus game in a real group, as a named member.
//
// Not part of the app and not a test. This is Claude taking its own turns in
// Pure Empathy, using the same rules module the chat board uses and the same
// move ordering the in-game computer uses.
//
//   node scripts/play-versus.mjs start "Pure Empathy" Claude Jason
//   node scripts/play-versus.mjs move  "Pure Empathy" Claude
//   node scripts/play-versus.mjs watch "Pure Empathy" Claude [minutes]
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import * as B from '../src/lib/boom.js';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const [, , cmd, roomName, me, other, mins] = process.argv;

const { data: room } = await sb.from('rooms').select('id,name').eq('name', roomName).single();
if (!room) throw new Error(`no room called ${roomName}`);

const body = p => {
  const s = B.replay(p.moves);
  const [a, b] = p.players;
  if (!s.done) return `${a} v ${b}, ${p.moves.length} moves in`;
  if (s.winner === -2) return `${a} v ${b}: board full, no four`;
  if (s.winner === -1) return `${a} v ${b}: dead heat`;
  return `${p.players[s.winner]} beat ${p.players[1 - s.winner]}, ${s.run} in a row`;
};

/** EVERY unfinished game waiting on me, oldest first.
    This used to return only the newest, which meant a second challenge
    arriving while one game was live was silently never answered. That is
    exactly what happened the first time it was used in anger. */
async function pending() {
  const { data } = await sb.from('messages').select('id,payload')
    .eq('room_id', room.id).eq('kind', 'versus').order('created_at').limit(50);
  return (data || []).filter(m => {
    const p = m.payload;
    if (!p?.players?.includes(me)) return false;
    const s = B.replay(p.moves || []);
    return !s.done && p.players[s.turn] === me;
  });
}

/** Any unfinished game I am in, whosever turn it is. */
async function live() {
  const { data } = await sb.from('messages').select('id,payload')
    .eq('room_id', room.id).eq('kind', 'versus').order('created_at').limit(50);
  return (data || []).filter(m =>
    m.payload?.players?.includes(me) && !B.replay(m.payload.moves || []).done);
}

/* ---------------- Choosing a move ----------------
   The same order the in-game computer uses: win, win by bomb, block, bomb a
   double threat, then score drops and bombs on one scale. */

const BOMB_COST = 10;
const winningDrops = (g, p) => {
  const out = [];
  for (let c = 0; c < B.COLS; c++) {
    if (B.lowestFree(g, c) < 0) continue;
    const n = g.map(r => r.slice());
    n[B.lowestFree(g, c)][c] = p;
    if (B.longest(n, p) >= B.NEED) out.push(c);
  }
  return out;
};
const occupied = g => {
  const out = [];
  for (let r = 0; r < B.ROWS; r++) for (let c = 0; c < B.COLS; c++) if (g[r][c] !== B.EMPTY) out.push([c, r]);
  return out;
};
const verdict = (g, me_, them) => {
  const a = B.longest(g, me_), b = B.longest(g, them);
  if (a >= B.NEED && b >= B.NEED) return a > b ? 1 : b > a ? -1 : 0;
  if (a >= B.NEED) return 1;
  if (b >= B.NEED) return -1;
  return null;
};
const score = (g, me_, them) => 10 * B.longest(g, me_) - 12 * B.longest(g, them);

function choose(state, seat) {
  const g = state.board, them = 1 - seat, haveBomb = state.bombs[seat] > 0;
  const drop = c => { const n = g.map(r => r.slice()); n[B.lowestFree(g, c)][c] = seat; return n; };

  const mine = winningDrops(g, seat);
  if (mine.length) return { d: mine[0] };

  if (haveBomb) {
    for (const [c, r] of occupied(g)) {
      if (verdict(B.bomb(g, c, r), seat, them) === 1) return { b: [c, r] };
    }
  }

  const threats = winningDrops(g, them);
  if (threats.length === 1) return { d: threats[0] };
  if (threats.length > 1 && haveBomb) {
    for (const [c, r] of occupied(g)) {
      const n = B.bomb(g, c, r), v = verdict(n, seat, them);
      if (v === -1) continue;
      if (v === 1 || winningDrops(n, them).length === 0) return { b: [c, r] };
    }
  }
  if (threats.length > 1) return { d: threats[0] };

  let best = null, bestScore = -1e9;
  for (let c = 0; c < B.COLS; c++) {
    if (B.lowestFree(g, c) < 0) continue;
    const n = drop(c);
    let s = score(n, seat, them) + (3 - Math.abs(c - 3)) + Math.random();
    if (winningDrops(n, them).length) s -= 1000;
    if (s > bestScore) { bestScore = s; best = { d: c }; }
  }
  if (haveBomb) {
    for (const [c, r] of occupied(g)) {
      const n = B.bomb(g, c, r);
      if (verdict(n, seat, them) !== null) continue;
      let s = score(n, seat, them) - BOMB_COST + Math.random();
      if (winningDrops(n, them).length) s -= 1000;
      if (s > bestScore) { bestScore = s; best = { b: [c, r] }; }
    }
  }
  return best;
}

function show(state, players) {
  const sym = v => (v === B.EMPTY ? '.' : v === 0 ? 'O' : 'X');
  const rows = [];
  for (let r = B.ROWS - 1; r >= 0; r--) rows.push('  ' + state.board[r].map(sym).join(' '));
  console.log(`\n  O = ${players[0]}   X = ${players[1]}`);
  console.log(rows.join('\n'));
  console.log('  1 2 3 4 5 6 7');
  console.log(`  bombs: ${players[0]} ${state.bombs[0]}, ${players[1]} ${state.bombs[1]}`);
}

/** Play a move on every board waiting on me. Returns what happened. */
async function takeTurn() {
  const waiting = await pending();
  if (!waiting.length) return (await live()).length ? 'waiting on them' : 'no game';
  let last = 'moved';
  for (const msg of waiting) last = await playOne(msg);
  return last;
}

async function playOne(msg) {
  const p = msg.payload;
  const seat = p.players.indexOf(me);
  const state = B.replay(p.moves || []);

  const move = choose(state, seat);
  if (!move) return 'no move';
  const next = { ...p, moves: [...(p.moves || []), move] };
  const { error } = await sb.from('messages').update({ payload: next, body: body(next) }).eq('id', msg.id);
  if (error) throw new Error(error.message);

  const after = B.replay(next.moves);
  console.log(`
  board #${msg.id}`);
  show(after, p.players);
  const what = move.d !== undefined ? `dropped in column ${move.d + 1}` : `bombed column ${move.b[0] + 1}, row ${move.b[1] + 1}`;
  console.log(`  ${me} ${what}`);
  if (after.done) console.log(`  GAME OVER: ${body(next)}`);
  return after.done ? 'done' : 'moved';
}

if (cmd === 'start') {
  const payload = { game: 'boom', players: [me, other], moves: [] };
  const { error } = await sb.from('messages').insert({
    room_id: room.id, author: me, kind: 'versus', payload, body: body(payload),
  });
  if (error) throw new Error(error.message);
  console.log(`challenged ${other} in ${room.name}`);
  console.log(await takeTurn());
} else if (cmd === 'move') {
  console.log(await takeTurn());
} else if (cmd === 'watch') {
  const until = Date.now() + (Number(mins || 20) * 60_000);
  console.log(`watching for ${mins || 20} minutes...`);
  for (;;) {
    const r = await takeTurn();
    if (r === 'no game') { console.log('no games left'); break; }
    if (r === 'done' && !(await live()).length) { console.log('all games finished'); break; }
    if (Date.now() > until) { console.log('time up, stopping'); break; }
    await new Promise(res => setTimeout(res, 4000));
  }
} else {
  console.log('usage: start | move | watch');
}
