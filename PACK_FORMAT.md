# Emoji pack format, v1

**A pack is an ordinary zip file.** No app owns it, nothing is registered anywhere, and you can email one to a friend or keep it in a folder for ten years. That is the whole point: every chat app today has packs and none of them let you take one out.

```
my-pack.zip
├── pack.json
├── kev.webp
├── shocked-kev.webp
└── chicken.gif
```

## pack.json

```json
{
  "format": "purepack/1",
  "name": "Kev reactions",
  "author": "Jason",
  "emoji": [
    { "name": "kev",         "file": "kev.webp" },
    { "name": "shocked-kev", "file": "shocked-kev.webp" },
    { "name": "chicken",     "file": "chicken.gif" }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `format` | yes | `purepack/1`. Refuse anything else rather than guessing |
| `name` | yes | What the shelf shows |
| `author` | no | Free text, not verified, not an identity |
| `emoji[].name` | yes | What goes between colons. Lowercase, digits and `-` only |
| `emoji[].file` | yes | A file in the zip. May instead be `url` (see below) |

## A pack can point outwards instead of carrying files

An entry may carry `url` in place of `file`:

```json
{ "name": "kev", "url": "https://example.com/kev.webp" }
```

**This is the hook for the bring-your-own-storage idea.** A pack whose entries are all URLs is a few hundred bytes and costs nobody anything to store; the images live in whoever's Drive, Dropbox or web host. The app does not care which, because by the time it renders an emoji it is only ever holding a URL. A `data:` URL is simply a third case, which is how v1 stores imported images without any storage service at all.

## What the importer does

1. Reads `pack.json`, refuses an unknown `format`.
2. Rejects names that are not `[a-z0-9-]{1,32}`, so `:kev:` can never be ambiguous to parse.
3. Re-encodes every image **in the browser** to at most 128x128 WebP. Animated GIFs are passed through untouched, because re-encoding animation in a browser is not worth it.
4. Refuses anything over 256 KB after that, which no legitimate emoji reaches.

Importing loose image files works too, with no `pack.json`: each file becomes an emoji named after the filename.

## What travels in a message

A sent message carries `[[e:<id>]]`, not `:kev:`. The shortcode is a typing convenience on the sender's keyboard only. Anyone in the room resolves the id against the room's packs, so **a person who has not installed the pack still sees the picture** rather than a word in colons.

## Deliberately not in v1

- Signing or verification. A pack is as trustworthy as the person who handed it to you.
- Per-user pack ordering and collision rules. Today the room has one shelf.
- Licensing metadata. Worth adding before anyone shares packs publicly.
