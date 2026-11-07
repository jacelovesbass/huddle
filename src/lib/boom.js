// Tic Tak Toe BOOM!, the rules only. No React, no DOM, no database.
//
// This is a port of the engine inside public/tic-tak-toe-boom.html, which is a
// sealed single file by definition and therefore cannot import anything. The
// two copies can drift, so test/test-versus.mjs runs the same scenarios
// against both and fails if they ever disagree.
//
// Everything here is a pure function of a move list. That is what makes a game
// in the chat cheap: nobody is in charge, every phone replays the moves and
// arrives at the same board.

export const COLS = 7;
export const ROWS = 6;
export const NEED = 4;
export const BOMBS = 3;
export const EMPTY = -1;

/** Row 0 is the BOTTOM, so gravity is decreasing r. */
export function emptyBoard() {
  const g = [];
  for (let r = 0; r < ROWS; r++) g.push(new Array(COLS).fill(EMPTY));
  return g;
}

export function lowestFree(g, c) {
  for (let r = 0; r < ROWS; r++) if (g[r][c] === EMPTY) return r;
  return -1;
}

export function collapse(g) {
  const n = emptyBoard();
  for (let c = 0; c < COLS; c++) {
    let k = 0;
    for (let r = 0; r < ROWS; r++) if (g[r][c] !== EMPTY) n[k++][c] = g[r][c];
  }
  return n;
}

/** The plus: the target and the four cells touching it edge on. */
export const BLAST = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]];

export function bomb(g, c0, r0) {
  const n = g.map(row => row.slice());
  for (const [dc, dr] of BLAST) {
    const c = c0 + dc, r = r0 + dr;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
    n[r][c] = EMPTY;
  }
  return collapse(n);
}

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

/** The longest run anywhere for one player. A length, not a boolean, because
    a double has to be arbitrated and a win test cannot do that. */
export function longest(g, p) { return longestLine(g, p).len; }

/** The longest run and the cells in it, so a winning line can be lit. */
export function longestLine(g, p) {
  let best = { len: 0, cells: [] };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g[r][c] !== p) continue;
      for (const [dc, dr] of DIRS) {
        const pr = r - dr, pc = c - dc;
        if (pr >= 0 && pr < ROWS && pc >= 0 && pc < COLS && g[pr][pc] === p) continue;
        const run = [];
        let rr = r, cc = c;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && g[rr][cc] === p) {
          run.push([cc, rr]); rr += dr; cc += dc;
        }
        if (run.length > best.len) best = { len: run.length, cells: run };
      }
    }
  }
  return best;
}

/**
 * Replay a move list into a board, the bombs left, and the outcome.
 *
 * A move is { d: column } for a drop or { b: [c, r] } for a bomb. Short keys
 * because every move list is written into a jsonb column on every turn.
 *
 * Returns { board, bombs, turn, done, winner, run, reason }.
 *   winner: 0 or 1, or -1 for a dead heat, or -2 for a full board.
 */
export function replay(moves) {
  let board = emptyBoard();
  const bombs = [BOMBS, BOMBS];
  let done = false, winner = null, run = 0, reason = null, line = [];
  let p = 0;

  for (let i = 0; i < moves.length && !done; i++) {
    const m = moves[i];

    if (m.d !== undefined) {
      const r = lowestFree(board, m.d);
      if (r < 0) continue;                     // an illegal move is ignored, not fatal
      board[r][m.d] = p;
      // A drop can only ever finish a line for the player who made it.
      const mine = longestLine(board, p);
      if (mine.len >= NEED) { done = true; winner = p; run = mine.len; line = mine.cells; reason = 'four'; }
    } else if (m.b) {
      if (!bombs[p]) continue;
      bombs[p]--;
      board = bomb(board, m.b[0], m.b[1]);
      // The rubble counts for whoever it belongs to, and the longer line wins.
      const la = longestLine(board, 0), lb = longestLine(board, 1);
      const a = la.len, b = lb.len;
      if (a >= NEED && b >= NEED) {
        done = true; reason = 'collapse';
        if (a > b) { winner = 0; run = a; line = la.cells; }
        else if (b > a) { winner = 1; run = b; line = lb.cells; }
        else { winner = -1; run = a; line = la.cells.concat(lb.cells); }
      } else if (a >= NEED) { done = true; winner = 0; run = a; line = la.cells; reason = 'collapse'; }
      else if (b >= NEED) { done = true; winner = 1; run = b; line = lb.cells; reason = 'collapse'; }
    }

    if (!done && board.flat().every(v => v !== EMPTY)) {
      done = true; winner = -2; reason = 'full';
    }
    if (!done) p = 1 - p;
  }

  return { board, bombs, turn: p, done, winner, run, reason, line };
}

/** Is this move legal for the player whose turn it is? */
export function legal(state, move) {
  if (state.done) return false;
  if (move.d !== undefined) return lowestFree(state.board, move.d) >= 0;
  if (move.b) {
    const [c, r] = move.b;
    return bombsLeft(state) > 0 && r >= 0 && r < ROWS && c >= 0 && c < COLS
      && state.board[r][c] !== EMPTY;
  }
  return false;
}

export function bombsLeft(state) { return state.bombs[state.turn]; }

/** One bomb, two bombs. */
export function bombPhrase(n) { return n + (n === 1 ? ' bomb' : ' bombs'); }
