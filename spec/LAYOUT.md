# Omakey layout format, version 1

A layout is one JSON file. The phone app draws it and the studio edits it.
`layout.schema.json` is the machine-checkable version of this page, and
`layouts/classic-qwerty.json` is the stock layout.

```json
{
  "format": "omakey-layout",
  "version": 1,
  "id": "classic-qwerty",
  "name": "Classic QWERTY",
  "author": "Omakey",
  "description": "Laptop-style 78-key ANSI layout",
  "width": 15,
  "height": 6,
  "keys": [
    { "id": "esc", "x": 0, "y": 0, "w": 1, "h": 1, "label": "Esc", "code": "KEY_ESC", "style": "mod" },
    { "id": "1", "x": 1, "y": 1, "w": 1, "h": 1, "label": "1", "sub": "!", "code": "KEY_1" },
    { "id": "up", "x": 14, "y": 4, "w": 1, "h": 1, "label": "↑", "code": "KEY_UP",
      "layers": { "fn": { "code": "KEY_PAGEUP", "label": "PgUp" } } },
    { "id": "fn", "x": 1.25, "y": 5, "w": 1, "h": 1, "label": "Fn", "layer": "fn" }
  ]
}
```

## Geometry

Positions and sizes are in **key units** (1u = one letter key). `x`/`y` is a
key's top-left corner; the origin is the top-left of the layout. `width` and
`height` give the layout's size in units; the app scales it to fit the
screen and keeps the aspect ratio. Keys may sit anywhere, so split, ortho and
column-staggered layouts work. Keys should not overlap; the app gives a touch
to the key drawn last.

### Split layouts

A split keyboard sets `splitAt`, a position in units:

```json
{ "width": 15, "height": 4.7, "splitAt": 7.5, "keys": [] }
```

Keys whose `x` is at least `splitAt` are the right side; the rest are the
left side. When the screen is wider than the layout, the app puts the left
side against the left edge and the right side against the right edge, and
the extra width goes into the split, so each half stays under its thumb.
Keys keep their size. On a narrower screen the layout is drawn as usual.
A rectangle that crosses `splitAt` stretches with the gap: its left edge
stays and its right edge moves with the right side, so a key can bridge the
two halves. The rest of the gap receives no touches.

## Keys

| field    | type   | required | meaning |
|----------|--------|----------|---------|
| `id`     | string | yes      | unique within the layout |
| `x`,`y`  | number | yes      | position in units, ≥ 0 |
| `w`,`h`  | number | yes      | size in units, 0.25 – 16 |
| `label`  | string | yes      | main label; may be empty (space bar) |
| `sub`    | string | no       | small secondary label (the shifted symbol) |
| `code`   | string | one of   | Linux key name from `keycodes.json`, e.g. `KEY_A` |
| `layer`  | string | one of   | momentary layer key: held, it switches keys to that layer |
| `layers` | object | no       | per-layer override: `{ "<layer>": { "code": "KEY_…", "label": "…" } }`; see [Layers](#layers) for what it sends and shows |
| `style`  | string | no       | `normal` (default), `mod`, `fkey`, `accent`, `space` |
| `parts`  | array  | no       | extra rectangles of the same key: `[{ "x": 7, "y": 5, "w": 6, "h": 1 }]` |

A key's `x`/`y`/`w`/`h` is its main rectangle, where the label goes. `parts`
(1–8 rectangles, same units) make shaped keys, such as an L-shaped ISO
Enter or a U-shaped Enter spanning both halves; a touch on any part presses
the key, and the app draws the parts as one key. A part's `x`/`y` is an
absolute position in the layout, like the key's own, not an offset from the
main rectangle, and follows the same limits (`x`, `y` ≥ 0; `w`, `h` 0.25–16).

A key has exactly one of `code` or `layer`. Layer names are free-form
lowercase words; `fn` is the conventional one.

Codes are **physical key codes**, not characters. The desktop's keyboard
layout decides what a key types, exactly as with a real keyboard, so a
QWERTY-positioned layout types Ukrainian when the desktop is switched to
Ukrainian. Labels are only what the phone draws.

Two codes are the app's own: `KEY_COPY` copies what's selected on the
computer and `KEY_PASTE` pastes there. The app presses Ctrl+Insert and
Shift+Insert for them, which copy and paste in terminals too, where few
programs know the Copy and Paste keys. With omakeyd the phone's clipboard
joins in: a copy lands on the phone as well, and a paste brings the phone's
clipboard when it has something newer.

## Layers

While a layer key is held, every key with an entry for that layer in its
`layers` object uses the entry instead of its base `code` and `label`. Keys
without an entry keep their base code and label. Layer keys themselves send
nothing on any layer, so entries on them have no effect.

An entry `{ "code": "KEY_…", "label": "…" }` sends its `code` and shows its
`label`. **Label rule:**

1. An entry with a `label` shows that label, even an empty one (`""`).
2. An entry without a `label` shows the `label` that `keycodes.json` lists
   for its `code` (`KEY_PAGEUP` → `PgUp`), or, if it lists none, the code
   name without `KEY_`.
3. An entry without a `code`, or with `"code": null` (for example `{}`),
   disables the key on that layer: it sends nothing. Unless it has a
   `label` (rule 1), it shows an empty label; apps draw no placeholder
   such as `∅`.

While no layer is held, the app may print an `fn` entry's own `label` small
in the key's corner, like the Fn legends on a laptop keyboard.

## Limits

- At most 256 keys per layout.
- `id` and `name` at most 64 characters; labels at most 16. Lengths count
  Unicode code points, as JSON Schema's `maxLength` does, so an emoji
  outside the Basic Multilingual Plane is one character, not two.
- Files over 256 KB are rejected.

## Sharing

The studio exports a `.json` file, and an `omakey://layout?d=<payload>` link,
where `payload` is the layout JSON compressed with raw DEFLATE and encoded as
base64url without padding. Opening the link on the phone imports the layout.
