#!/usr/bin/env python3
"""Generate spec/layouts/omakey-pro.json, the Omakey Pro layout.

A column-based (ortho) QWERTY split for two thumbs on a landscape phone:

- The letter columns sit on the outer screen edges, where thumbs are: Q/A/Z
  and 1 on the far left, P/;// and 0 on the far right. Each half has its own
  space bar under its letters.
- Everything else is in two mirrored 4-column islands that travel with
  their half. Each has a 2x2 Ctrl in its top outer corner and a 2x2
  Backspace next to it; below, Shift on the left mirrors Shift on the
  right. Enter is one U-shaped key: a 2x2 block on each island joined by a
  bar along the bottom that bridges the split (and stretches with it).
  The left island also has Tab, `, =, Fn, Super and Alt; the right one has
  the arrows in vim order (left, down, up, right) and Alt and Super
  mirroring the left. Delete sits in the middle between the two
  Backspaces, bridging the split (and stretching with it).
- A top row above the F row holds the rarely used keys: Caps, Home, End,
  PgUp, PgDn on the left; F6, Esc, PrtSc (ScrLk on Fn), Ins (Pause on Fn)
  and Menu, AltGr, F7 over the islands; the right-hand symbols - [ ] \\ '
  and a regular Backspace in the top right corner. Media and brightness
  are on Fn + F1-F10. Small gaps set the top row and the F row apart.
- It is a split layout (splitAt): on a screen wider than the layout the app
  pins each side to its edge and opens the gap between the islands.

Keys are square; the F row is shorter and the space row a little taller.

    python3 scripts/gen-omakey-pro.py
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "spec" / "layouts" / "omakey-pro.json"

TOP_H = 0.85  # the top row of rarely used keys
TOP_GAP = 0.15  # between the top row and the F row
FROW_H = 0.85  # the F-key row is shorter, as on a laptop
F_GAP = 0.2  # sets the F row apart from the number and letter block
ROW_H = 1.0  # number and letter rows: square keys
SPACE_H = 1.25  # the space row is a little taller, for thumbs
GAP = 0.2  # between a half's letters and its island
SPLIT_GAP = 1.5  # between the islands; the app widens it further on wider screens

LEFT_X = 0.0
LEFT_COLS = 5
LEFT_ISLAND_X = LEFT_X + LEFT_COLS + GAP
ISLAND_COLS = 4
RIGHT_ISLAND_X = LEFT_ISLAND_X + ISLAND_COLS + SPLIT_GAP
RIGHT_X = RIGHT_ISLAND_X + ISLAND_COLS + GAP
RIGHT_LETTERS_X = RIGHT_X

MEDIA = {
    "F1": ("MUTE", "Mute"), "F2": ("VOLUMEDOWN", "Vol-"), "F3": ("VOLUMEUP", "Vol+"),
    "F4": ("MICMUTE", "Mic"), "F5": ("BRIGHTNESSDOWN", "Bri-"), "F6": ("BRIGHTNESSUP", "Bri+"),
    "F7": ("PREVIOUSSONG", "Prev"), "F8": ("PLAYPAUSE", "Play"), "F9": ("NEXTSONG", "Next"),
    "F10": ("STOPCD", "Stop"),
}
SHIFTED = {"1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", "8": "*", "9": "(",
           "0": ")", "MINUS": "_", "EQUAL": "+", "LEFTBRACE": "{", "RIGHTBRACE": "}", "BACKSLASH": "|",
           "APOSTROPHE": "\"", "SEMICOLON": ":", "COMMA": "<", "DOT": ">", "SLASH": "?", "GRAVE": "~"}

keys = []
ids = set()


TOP = -1  # the row above the F row


def row_y(r):
    if r == TOP:
        return 0.0
    f = TOP_H + TOP_GAP
    return f if r == 0 else f + FROW_H + F_GAP + (r - 1) * ROW_H


def row_h(r):
    return TOP_H if r == TOP else FROW_H if r == 0 else SPACE_H if r == 5 else ROW_H


def span_h(r0, r1):
    """Height of rows r0..r1 inclusive."""
    return row_y(r1) + row_h(r1) - row_y(r0)


def rect(x, r, w=1, rows=1):
    return {"x": round(x, 4), "y": round(row_y(r), 4), "w": w, "h": round(span_h(r, r + rows - 1), 4)}


def add(code, label, x, r, w=1, rows=1, style=None, kid=None, layer=None, fn=None, parts=None):
    kid = kid or (layer or code).lower()
    base, n = kid, 2
    while kid in ids:
        kid, n = f"{base}-{n}", n + 1
    ids.add(kid)
    k = {"id": kid, "x": round(x, 4), "y": round(row_y(r), 4), "w": w,
         "h": round(span_h(r, r + rows - 1), 4), "label": label}
    if layer:
        k["layer"] = layer
    else:
        k["code"] = "KEY_" + code
        if code in SHIFTED:
            k["sub"] = SHIFTED[code]
        if code in MEDIA:
            fn = MEDIA[code]
        if fn:
            k["layers"] = {"fn": {"code": "KEY_" + fn[0], "label": fn[1]}}
    if style:
        k["style"] = style
    if parts:
        k["parts"] = parts
    keys.append(k)


def columns(x0, r, items, style=None):
    for i, it in enumerate(items):
        code, label = it if isinstance(it, tuple) else (it, it)
        add(code, label, x0 + i, r, style=style)


M = "mod"

# ---- left half: letters on the left edge ----
columns(LEFT_X, 0, [(f"F{i}", f"F{i}") for i in range(1, 6)], style="fkey")
columns(LEFT_X, 1, list("12345"))
columns(LEFT_X, 2, list("QWERT"))
columns(LEFT_X, 3, list("ASDFG"))
columns(LEFT_X, 4, list("ZXCVB"))
add("SPACE", "", LEFT_X, 5, w=LEFT_COLS, style="space", kid="space-left")

# ---- right half: letters on the right edge ----
columns(RIGHT_LETTERS_X, 0, [(f"F{i}", f"F{i}") for i in range(8, 13)], style="fkey")
columns(RIGHT_LETTERS_X, 1, list("67890"))
columns(RIGHT_LETTERS_X, 2, list("YUIOP"))
columns(RIGHT_LETTERS_X, 3, list("HJKL") + [("SEMICOLON", ";")])
columns(RIGHT_LETTERS_X, 4, list("NM") + [("COMMA", ","), ("DOT", "."), ("SLASH", "/")])
add("SPACE", "", RIGHT_LETTERS_X, 5, w=5, style="space", kid="space-right")

# ---- top row: rarely used keys ----
columns(LEFT_X, TOP, [("CAPSLOCK", "Caps"), ("HOME", "Home"), ("END", "End"), ("PAGEUP", "PgUp"),
                      ("PAGEDOWN", "PgDn")], style=M)
columns(RIGHT_X, TOP, [("LEFTBRACE", "["), ("RIGHTBRACE", "]"), ("BACKSLASH", "\\"), ("APOSTROPHE", "'")])
# The one asymmetric key: a regular Backspace in the top right corner.
add("BACKSPACE", "⌫", RIGHT_X + 4, TOP, style=M, kid="corner-backspace")

# ---- left island: columns L .. L+3, outer to inner ----
L = LEFT_ISLAND_X
add("F6", "F6", L, TOP, style="fkey")
add("ESC", "Esc", L + 1, TOP, style=M)
add("SYSRQ", "PrtSc", L + 2, TOP, style=M, fn=("SCROLLLOCK", "ScrLk"))
add("INSERT", "Ins", L + 3, TOP, style=M, fn=("PAUSE", "Pause"))
add("LEFTCTRL", "Ctrl", L, 0, w=2, rows=2, style=M, kid="center-ctrl")
add("BACKSPACE", "⌫", L + 2, 0, w=2, rows=2, style=M, kid="center-backspace")
add("TAB", "Tab", L, 2, style=M)
add("GRAVE", "`", L + 1, 2)
add("EQUAL", "=", L + 2, 2)
add(None, "Fn", L + 3, 2, style=M, layer="fn")
add("LEFTSHIFT", "Shift", L, 3, w=2, rows=2, style=M, kid="center-shift")
add("LEFTMETA", "Super", L, 5, style=M, kid="center-super")
add("LEFTALT", "Alt", L + 1, 5, style=M, kid="center-alt")

# ---- right island: columns R .. R+3, inner to outer ----
R = RIGHT_ISLAND_X
columns(R, TOP, [("COMPOSE", "Menu"), ("RIGHTALT", "AltGr")], style=M)
add("F7", "F7", R + 2, TOP, style="fkey")
add("MINUS", "-", R + 3, TOP)
add("BACKSPACE", "⌫", R, 0, w=2, rows=2, style=M, kid="center-backspace-right")
add("RIGHTCTRL", "Ctrl", R + 2, 0, w=2, rows=2, style=M, kid="center-rctrl")
# Arrows in vim order: h j k l.
columns(R, 2, [("LEFT", "←"), ("DOWN", "↓"), ("UP", "↑"), ("RIGHT", "→")], style=M)
add("RIGHTSHIFT", "Shift", R + 2, 3, w=2, rows=2, style=M, kid="center-rshift")
# Alt and Super mirror the left island. The right Alt sends Left Alt, so it
# is Alt even where the desktop layout makes Right Alt into AltGr.
add("LEFTALT", "Alt", R + 2, 5, style=M, kid="center-ralt")
add("RIGHTMETA", "Super", R + 3, 5, style=M, kid="center-rsuper")

# ---- Delete: between the two Backspaces, across the split ----
add("DELETE", "Del", L + ISLAND_COLS, 0, w=SPLIT_GAP, rows=2, style=M, kid="center-delete")

# ---- Enter: |_| across both islands ----
# The label sits on the bar, which crosses the split and stretches with it.
add("ENTER", "Enter", L + 2, 5, w=round(R + 2 - (L + 2), 4), style="accent", kid="center-enter",
    parts=[rect(L + 2, 3, 2, 2), rect(R, 3, 2, 2)])

width = max(k["x"] + k["w"] for k in keys)
height = row_y(5) + SPACE_H
layout = {
    "format": "omakey-layout",
    "version": 1,
    "id": "omakey-pro",
    "name": "Omakey Pro",
    "author": "Omakey",
    "description": "Column-based QWERTY split for two thumbs: letters on the outer edges with a space bar "
                   "under each half, mirrored islands with big Ctrl, Backspace and Shift on both sides, a "
                   "U-shaped Enter bridging the split, and a top row for rarely used keys.",
    "width": round(width, 4),
    "height": round(height, 4),
    "splitAt": round(LEFT_ISLAND_X + ISLAND_COLS + SPLIT_GAP / 2, 4),
    "keys": keys,
}
OUT.write_text(json.dumps(layout, ensure_ascii=False, indent=1) + "\n")
print(f"wrote {len(keys)} keys, {layout['width']} x {layout['height']} units, to {OUT}")
