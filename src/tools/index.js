// The composer bar is built from this list. Order is the order on screen.
//
// Adding a tool means adding a file and a line here. Nothing in Chat.jsx
// changes, which is the point: the bar is the product, so it needs a contract
// rather than a growing switch statement.
import { emojiTool } from './emoji.jsx';
import { gifTool } from './gif.jsx';
import { gamesTool } from './games.jsx';
import { versusTool } from './versus.jsx';

export const TOOLS = [emojiTool, gifTool, gamesTool, versusTool];

/** Renderers contributed by tools, keyed by messages.kind. */
export const RENDERERS = Object.fromEntries(
  TOOLS.filter(t => t.render).map(t => [t.render.kind, t.render.Component])
);
