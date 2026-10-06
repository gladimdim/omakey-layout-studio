#!/usr/bin/env python3
"""Generate spec/layouts/split-qwerty.json.

A column-based (ortho) QWERTY split for two thumbs on a landscape phone:

- The letter columns sit on the outer screen edges, where thumbs are: Q/A/Z
  and 1 on the far left, P/;// and 0 on the far right. Each half has its own
  space bar under its letters.
- The right half has one inner column for the right-hand symbols - [ ' ] \\.
- Everything else is in two mirrored 4-column islands that travel with
  their half. Each has a 2x2 Ctrl in its top outer corner; below, Shift
  (left) mirrors Backspace (right). Enter is one U-shaped key: a 2x2 block
  on each island joined by a bar along the bottom that bridges the split
  (and stretches with it). The left island also has F6, PrtSc (Menu on
  Fn), Esc, `, Tab, Caps, =, Fn, Super and Alt (AltGr on Fn); the right one
  has the arrows in an inverted T with Home/End, PgUp/PgDn, Ins and Del.
- It is a split layout (splitAt): on a screen wider than the layout the app
  pins each side to its edge and opens the gap between the islands.

Keys are square; the F row is shorter and the space row a little taller.

    python3 scripts/gen-split-qwerty.py
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "spec" / "layouts" / "split-qwerty.json"

FROW_H = 0.85  # the F-key row is shorter, as on a laptop
ROW_H = 1.0  # number and letter rows: square keys
SPACE_H = 1.25  # the space row is a little taller, for thumbs
GAP = 0.2  # between a half's letters and its island
SPLIT_GAP = 1.5  # between the islands; the app widens it further on wider screens

LEFT_X = 0.0
LEFT_COLS = 5
LEFT_ISLAND_X = LEFT_X + LEFT_COLS + GAP
ISLAND_COLS = 4
RIGHT_ISLAND_X = LEFT_ISLAND_X + ISLAND_COLS + SPLIT_GAP
RIGHT_X = RIGHT_ISLAND_X + ISLAND_COLS + GAP  # the right half's inner symbol column
RIGHT_LETTERS_X = RIGHT_X + 1

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


def row_y(r):
    return 0.0 if r == 0 else FROW_H + (r - 1) * ROW_H


def row_h(r):
    return FROW_H if r == 0 else SPACE_H if r == 5 else ROW_H


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

# ---- right half: letters on the right edge, symbols in the inner column ----
add("F7", "F7", RIGHT_X, 0, style="fkey")
columns(RIGHT_LETTERS_X, 0, [(f"F{i}", f"F{i}") for i in range(8, 13)], style="fkey")
for r, (code, label) in enumerate([("MINUS", "-"), ("LEFTBRACE", "["), ("APOSTROPHE", "'"),
                                   ("RIGHTBRACE", "]"), ("BACKSLASH", "\\")], start=1):
    add(code, label, RIGHT_X, r)
columns(RIGHT_LETTERS_X, 1, list("67890"))
columns(RIGHT_LETTERS_X, 2, list("YUIOP"))
columns(RIGHT_LETTERS_X, 3, list("HJKL") + [("SEMICOLON", ";")])
columns(RIGHT_LETTERS_X, 4, list("NM") + [("COMMA", ","), ("DOT", "."), ("SLASH", "/")])
add("SPACE", "", RIGHT_LETTERS_X, 5, w=5, style="space", kid="space-right")

# ---- left island: columns L .. L+3, outer to inner ----
L = LEFT_ISLAND_X
add("LEFTCTRL", "Ctrl", L, 0, w=2, rows=2, style=M, kid="center-ctrl")
add("F6", "F6", L + 2, 0, style="fkey")
add("SYSRQ", "PrtSc", L + 3, 0, style=M, fn=("COMPOSE", "Menu"))
add("ESC", "Esc", L + 2, 1, style=M)
add("GRAVE", "`", L + 3, 1)
columns(L, 2, [("TAB", "Tab"), ("CAPSLOCK", "Caps")], style=M)
add("EQUAL", "=", L + 2, 2)
add(None, "Fn", L + 3, 2, style=M, layer="fn")
add("LEFTSHIFT", "Shift", L, 3, w=2, rows=2, style=M, kid="center-shift")
add("LEFTMETA", "Super", L, 5, style=M, kid="center-super")
add("LEFTALT", "Alt", L + 1, 5, style=M, kid="center-alt", fn=("RIGHTALT", "AltGr"))

# ---- right island: columns R .. R+3, inner to outer ----
R = RIGHT_ISLAND_X
columns(R, 0, [("HOME", "Home"), ("END", "End")], style=M)
add("RIGHTCTRL", "Ctrl", R + 2, 0, w=2, rows=2, style=M, kid="center-rctrl")
columns(R, 1, [("PAGEUP", "PgUp"), ("UP", "↑")], style=M)
columns(R, 2, [("LEFT", "←"), ("DOWN", "↓"), ("RIGHT", "→"), ("PAGEDOWN", "PgDn")], style=M)
add("BACKSPACE", "⌫", R + 2, 3, w=2, rows=2, style=M, kid="center-backspace")
columns(R + 2, 5, [("INSERT", "Ins"), ("DELETE", "Del")], style=M)

# ---- Enter: |_| across both islands ----
# The label sits on the bar, which crosses the split and stretches with it.
add("ENTER", "Enter", L + 2, 5, w=round(R + 2 - (L + 2), 4), style="accent", kid="center-enter",
    parts=[rect(L + 2, 3, 2, 2), rect(R, 3, 2, 2)])

width = max(k["x"] + k["w"] for k in keys)
height = row_y(5) + SPACE_H
layout = {
    "format": "omakey-layout",
    "version": 1,
    "id": "split-qwerty",
    "name": "Split QWERTY",
    "author": "Omakey",
    "description": "Column-based QWERTY split for two thumbs: letters on the outer edges with a space bar "
                   "under each half, and a mirrored island beside each: big Ctrl on both, Shift and Tab/Caps "
                   "left, arrows and Backspace right, and a U-shaped Enter bridging the split.",
    "width": round(width, 4),
    "height": round(height, 4),
    "splitAt": round(RIGHT_ISLAND_X, 4),
    "keys": keys,
}
OUT.write_text(json.dumps(layout, ensure_ascii=False, indent=1) + "\n")
print(f"wrote {len(keys)} keys, {layout['width']} x {layout['height']} units, to {OUT}")
