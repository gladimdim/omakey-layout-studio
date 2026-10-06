#!/usr/bin/env python3
"""Generate spec/layouts/split-qwerty.json.

A column-based (ortho) QWERTY split for two thumbs on a landscape phone:

- The letter columns sit on the outer screen edges, where thumbs are: Q/A/Z
  and 1 on the far left, P/;// and 0 on the far right. Each half has its own
  space bar under its letters.
- The right half has one inner column for the right-hand symbols - [ ' ] \\.
- Everything else is in two islands that travel with their half: the left
  one has F6, Esc, PrtSc, ` and =, Tab, Caps, PgUp/PgDn, Fn, Super and the
  big Shift and Ctrl; the right one has Ins/Del/Menu, the arrows with
  Home/End, the big Enter, Alt (AltGr on Fn) and Backspace.
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
ISLAND_COLS = 3
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


def add(code, label, x, r, w=1, rows=1, style=None, kid=None, layer=None, fn=None):
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

# ---- left island ----
L = LEFT_ISLAND_X
add("F6", "F6", L, 0, style="fkey")
columns(L + 1, 0, [("ESC", "Esc"), ("SYSRQ", "PrtSc")], style=M)
columns(L, 1, [("GRAVE", "`")])
columns(L + 1, 1, [("TAB", "Tab"), ("PAGEUP", "PgUp")], style=M)
columns(L, 2, [("EQUAL", "=")])
columns(L + 1, 2, [("CAPSLOCK", "Caps"), ("PAGEDOWN", "PgDn")], style=M)
add(None, "Fn", L, 3, style=M, layer="fn")
add("LEFTSHIFT", "Shift", L + 1, 3, w=2, rows=2, style=M, kid="center-shift")
add("LEFTMETA", "Super", L, 4, style=M, kid="center-super")
add("LEFTCTRL", "Ctrl", L, 5, w=3, style=M, kid="center-ctrl")

# ---- right island ----
R = RIGHT_ISLAND_X
columns(R, 0, [("INSERT", "Ins"), ("DELETE", "Del"), ("COMPOSE", "Menu")], style=M)
columns(R, 1, [("HOME", "Home"), ("UP", "↑"), ("END", "End")], style=M)
columns(R, 2, [("LEFT", "←"), ("DOWN", "↓"), ("RIGHT", "→")], style=M)
add("ENTER", "Enter", R, 3, w=3, rows=2, style="accent", kid="center-enter")
add("LEFTALT", "Alt", R, 5, style=M, kid="center-alt", fn=("RIGHTALT", "AltGr"))
add("BACKSPACE", "⌫", R + 1, 5, w=2, style=M, kid="center-backspace")

width = max(k["x"] + k["w"] for k in keys)
height = row_y(5) + SPACE_H
layout = {
    "format": "omakey-layout",
    "version": 1,
    "id": "split-qwerty",
    "name": "Split QWERTY",
    "author": "Omakey",
    "description": "Column-based QWERTY split for two thumbs: letters on the outer edges with a space bar "
                   "under each half, and an island beside each half: Tab, Caps, big Shift and Ctrl on the "
                   "left; arrows, big Enter and Backspace on the right. The halves move to the screen edges.",
    "width": round(width, 4),
    "height": round(height, 4),
    "splitAt": round(RIGHT_ISLAND_X, 4),
    "keys": keys,
}
OUT.write_text(json.dumps(layout, ensure_ascii=False, indent=1) + "\n")
print(f"wrote {len(keys)} keys, {layout['width']} x {layout['height']} units, to {OUT}")
