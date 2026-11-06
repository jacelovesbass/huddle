import { splitBody } from '../lib/packs.js';

/** A message body: text with [[e:id]] tokens swapped for pictures. */
export function Body({ body, byId }) {
  return splitBody(body).map((part, i) => {
    if (part.text !== undefined) return <span key={i}>{part.text}</span>;
    if (part.media) return <img key={i} className="media" src={part.media} alt="" loading="lazy" />;
    const e = byId.get(part.emojiId);
    return e
      ? <img key={i} className="emoji" src={e.url} alt={':' + e.name + ':'} title={':' + e.name + ':'} />
      : <span key={i} className="muted">[emoji]</span>;
  });
}
