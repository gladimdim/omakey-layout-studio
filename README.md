# Omakey Layout Studio

Design your own phone keyboard for Omakey, the app that turns your phone
into a real keyboard for an Omarchy desktop. Build any layout from any Linux
key: a full laptop board, a split ergo layout, a gaming pad, or a column of
media keys. Then send it to the phone.

It is a static web app with no backend. Your work autosaves in the browser.

## What it does

- **Presets.** Open **New / Presets** for visual previews of Classic QWERTY,
  Colemak, Dvorak, Omakey Pro, Alice, Corne, Lily58, ErgoDox, Ferris Sweep,
  and Kinesis Advantage. Search by name or description, filter to split
  keyboards, or start blank. Choosing a preset is undoable. Presets come
  directly from `spec/layouts/`, the same files bundled in the Android app.
- **Canvas in key units.** Drag keys, resize them from the handles, snap to
  0.25u (toggle), shift-click or drag a box to select several, nudge with the
  arrow keys (Shift = 1u), duplicate (Ctrl+D), delete, add (A), undo/redo
  (Ctrl+Z / Ctrl+Shift+Z), zoom to fit. Copy, cut and paste keys with
  Ctrl+C / Ctrl+X / Ctrl+V: they travel through the system clipboard as JSON,
  so they paste into another tab or layout, with fresh ids. Align a
  multi-selection's edges or centres, or distribute it with equal gaps, from
  the toolbar (each is one undo step). Keys are focusable: Tab to one,
  Enter or Space selects it (Shift adds it), the arrows move it.
- **Inspector.** Label, secondary label, style (normal, mod, fkey, accent,
  space), position and size, id. Each key either sends a Linux key code, picked
  from a searchable, grouped list or by **pressing the key on your
  keyboard**, or is a **layer key** (like Fn) that switches the other keys
  while held. **Shape** edits a shaped key's extra rectangles (`parts`):
  add, remove and type their x, y, w, h, or drag their handles on the
  canvas.
- **Layers.** Per-key overrides for any layer (`fn`, `nav`, …), each with its
  own code and label, or disabled. The toolbar's layer switch previews what
  the phone shows while that layer key is held; labels follow the rule in
  [`spec/LAYOUT.md`](spec/LAYOUT.md#layers).
- **Check.** Validates against the spec. Errors (the app would refuse the
  layout) and warnings (overlapping keys, keys outside the area, layers no
  key can reach) link to the key. An imported file with fields the editor
  can't display (a label that isn't text, `parts` that aren't a list) is
  repaired on import and the repairs are listed here.
- **Share.** Download the `.json`, copy an `omakey://layout?d=…` link that
  opens the phone app, copy a studio link (`#layout=…`) that reopens the
  layout here, or scan the QR code when the link fits in one. A phone
  preview shows the layout letterboxed the way the app draws it; **Phone
  emulation** draws the labels exactly as the Android app does (lowercase
  letters, shifted symbols, corner legends, the Fn legend) with Shift and
  Caps toggles.
- **Import.** A file, pasted JSON, either kind of link, or drop a `.json`
  file anywhere on the page.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: validator, import repair, share codec, layer labels, history, clipboard, align
npm run build      # type-check + static build into dist/
npm run preview    # serve dist/
```

`npm run keycodes` regenerates `spec/keycodes.json` from the kernel's
`/usr/include/linux/input-event-codes.h`.

## Deploy

`dist/` is self-contained and uses relative paths (`base: "./"`), so it
works from any sub-path. For GitHub Pages, publish `dist/` with the official
Pages action, or push it to a `gh-pages` branch.

## The spec lives here

This repo is the home of the layout format. The phone app vendors copies of
these files.

| File | What |
|------|------|
| [`spec/LAYOUT.md`](spec/LAYOUT.md) | Layout format v1, in prose |
| [`spec/layout.schema.json`](spec/layout.schema.json) | JSON Schema for the same |
| [`spec/keycodes.json`](spec/keycodes.json) | Every Linux key code a layout may send, with labels and groups |
| [`spec/layouts/classic-qwerty.json`](spec/layouts/classic-qwerty.json) | The stock 78-key laptop layout |
| [`scripts/gen-keycodes.py`](scripts/gen-keycodes.py) | Generates `keycodes.json` |

The studio's validator (`src/lib/validate.ts`) is hand-written to match the
schema, and adds the warnings above. The share-link payload is the layout
JSON compressed with raw DEFLATE and encoded as base64url without padding
(`src/lib/share.ts`).

## Source map

```
src/
  App.tsx              state, history, shortcuts, import/export, toolbar
  components/
    Canvas.tsx         board: drag, resize, marquee selection
    Keycap.tsx         one key, shared by the canvas and the phone preview
    Inspector.tsx      key editor, shape (parts) editor, layer overrides
    KeyPicker.tsx      searchable key-code picker + press-a-key capture
    LayoutPanel.tsx    name, id, author, description, size
    SharePanel.tsx     links, QR
    PhonePreview.tsx   letterboxed preview + Android-exact phone emulation
    IssuesPanel.tsx    validation results
    ImportDialog.tsx
    Modal.tsx          dialog shell: focus trap, Escape, focus restore
    ErrorBoundary.tsx  "reset to last good layout" when rendering fails
  lib/
    types.ts validate.ts share.ts layout.ts keycodes.ts domCodes.ts history.ts storage.ts
    normalize.ts       repairs untrusted JSON before the editor renders it
    phone.ts           the Android app's label logic, for phone emulation
    clipboard.ts align.ts text.ts
  test/                vitest suites
```
