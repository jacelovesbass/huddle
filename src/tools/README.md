# Tools

A tool is a button on the composer bar and the sheet it opens. Emoji and GIF
are tools. Games will be a tool. Anything somebody brings later is a tool.

**The built-ins go through this same contract on purpose.** If they used a
private path, the public one would rot before anyone outside ever touched it.

## The contract

```js
export const myTool = {
  id:    'games',          // stable, unique, used for per-user bar config
  label: 'Games',          // accessible name and tooltip
  icon:  '🎲',             // short text or an element; keep it one glyph wide
  Sheet,                   // component rendered when the button is tapped
  render: undefined,       // optional: how to draw messages of a given kind
};
```

### `Sheet`

Rendered inside the chat when the button is tapped. It receives:

| Prop | What it is |
|---|---|
| `room`, `name` | The group, and who you are |
| `packs`, `emoji` | The group's packs and emoji, already loaded |
| `msgs` | The conversation, for a tool that works from what is already there |
| `onSendText(text)` | Put text in the message box |
| `onSendEmoji(emoji)` | Put a specific emoji in the box, by identity not name |
| `onSend({kind, payload, body})` | Send a structured message |
| `onClose()` | Close the sheet |

A sheet should put something in the box rather than sending it outright, unless
sending is unambiguously the point. People expect to be able to change their
mind before it leaves.

### `render`

Optional. `{ kind, Component }`, where `Component` receives `{ message }` and
draws messages whose `messages.kind` matches. Text messages are handled by the
app; a tool only needs this if it invents a new kind.

## Adding one

1. Write `src/tools/<id>.jsx` exporting the object above.
2. Add it to the array in `src/tools/index.js`.

That is the whole procedure. Nothing in `Chat.jsx` changes.

## Later: tools nobody here wrote

The shape is deliberately the same. A third-party tool's `Sheet` would be an
iframe pointing at their page, with the same props delivered over
`postMessage` and the result coming back the same way. **Never evaluate
somebody else's code in the page**; the iframe sandbox is the whole safety
story, and it is why the contract is small.
