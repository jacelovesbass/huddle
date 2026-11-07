import { splitBody } from '../lib/packs.js';
import { RENDERERS } from '../tools/index.js';

/** A message body: text with [[e:id]] tokens swapped for pictures. */
export function Body({ message, body, byId, name, onUpdate, onSend }) {
  // A tool that invented its own kind draws its own messages.
  const Custom = message && RENDERERS[message.kind];
  // A renderer that is interactive needs to know who is looking and how to
  // write back. A score card ignores both.
  if (Custom) return <Custom message={message} name={name} onUpdate={onUpdate} onSend={onSend} />;

  return splitBody(body).map((part, i) => {
    if (part.text !== undefined) return <span key={i}>{part.text}</span>;
    if (part.media) return <img key={i} className="media" src={part.media} alt="" loading="lazy" />;
    const e = byId.get(part.emojiId);
    return e
      ? <img key={i} className="emoji" src={e.url} alt={':' + e.name + ':'} title={':' + e.name + ':'} />
      : <span key={i} className="muted">[emoji]</span>;
  });
}
