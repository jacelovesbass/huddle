import { useState } from 'react';

/**
 * The smallest possible tool, and deliberately so: it exists to prove the
 * contract carries a tool that Chat.jsx knows nothing about, including one
 * that invents its own message kind. Games will be this shape, with more in it.
 *
 * Written without touching Chat.jsx, EmojiSheet, MediaSheet or the renderer.
 */
const FACES = ['\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

function DiceSheet({ name, onSend, onClose }) {
  const [sides, setSides] = useState(6);

  const roll = () => onSend({
    kind: 'dice',
    body: `rolled a d${sides}`,
    payload: { sides, value: 1 + Math.floor(Math.random() * sides), by: name },
  });

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-card" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <strong>Roll a die</strong>
          <button className="link" onClick={onClose}>Done</button>
        </div>
        <div className="dice-picker">
          {[2, 6, 20].map(n => (
            <button key={n} className={'ghost' + (sides === n ? ' on' : '')}
                    onClick={() => setSides(n)}>d{n}</button>
          ))}
        </div>
        <div className="pack-actions">
          <button onClick={roll}>Roll d{sides}</button>
        </div>
      </div>
    </div>
  );
}

/** How a dice message is drawn. Text messages never reach this. */
function DiceMessage({ message }) {
  const { sides, value } = message.payload ?? {};
  return (
    <span className="dice-result">
      <span className="pip">{sides === 6 ? FACES[value - 1] : value}</span>
      <span className="muted"> d{sides}</span>
    </span>
  );
}

export const diceTool = {
  id: 'dice',
  label: 'Roll a die',
  icon: '\u2684',
  Sheet: DiceSheet,
  render: { kind: 'dice', Component: DiceMessage },
};
