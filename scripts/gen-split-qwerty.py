#!/usr/bin/env python3
"""Generate spec/layouts/split-qwerty.json.

A column-based (ortho) QWERTY split for two thumbs on a landscape phone:

- The letter columns sit on the outer screen edges, where thumbs are: Q/A/Z
  and 1 on the far left, P/;// and 0 on the far right. Each half has its own
  space bar under its letters.
- The right half has one inner column for the right-hand symbols - [ ' ] \\.
- Everything else is in the centre: Tab, Caps, Esc, ` and =, navigation
  (arrows in an inverted T with Home/End/PgUp/PgDn/Ins/Del), and the big
  Shift, Enter, Ctrl and Backspace with Fn, Super and Alt.

Keys are square; the F row is shorter and the space row a little taller.

    python3 scripts/gen-split-qwerty.py
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "spec" / "layouts" / "split-qwerty.json"

FROW_H = 0.85  # the F-key row is shorter, as on a laptop
ROW_H = 1.0  # number and letter rows: square keys
SPACE_H = 1.25  # the space row is a little taller, for thumbs
GAP = 0.25  # between a half and the centre

LEFT_X = 0.0
LEFT_COLS = 5
CENTER_X = LEFT_X + LEFT_COLS + GAP
CENTER_COLS = 6
RIGHT_X = CENTER_X + CENTER_COLS + GAP  # the right half's inner symbol column
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


def add(code, label, x, r, w=1, rows=1, style=None, kid=None, layer=None):
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
            k["layers"] = {"fn": {"code": "KEY_" + MEDIA[code][0], "label": MEDIA[code][1]}}
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

# ---- centre ----
C = CENTER_X
add("F6", "F6", C, 0, style="fkey")
columns(C + 1, 0, [("ESC", "Esc"), ("SYSRQ", "PrtSc"), ("INSERT", "Ins"), ("DELETE", "Del"),
                   ("COMPOSE", "Menu")], style=M)
columns(C, 1, [("GRAVE", "`"), ("TAB", "Tab")])
columns(C + 2, 1, [("HOME", "Home"), ("UP", "↑"), ("END", "End"), ("PAGEUP", "PgUp")], style=M)
columns(C, 2, [("EQUAL", "="), ("CAPSLOCK", "Caps")])
columns(C + 2, 2, [("LEFT", "←"), ("DOWN", "↓"), ("RIGHT", "→"), ("PAGEDOWN", "PgDn")], style=M)
for k in keys:  # Tab and Caps are modifiers in looks
    if k["id"] in ("tab", "capslock"):
        k["style"] = M

add("LEFTSHIFT", "Shift", C, 3, w=2, rows=2, style=M, kid="center-shift")
add(None, "Fn", C + 2, 3, style=M, layer="fn")
add("LEFTMETA", "Super", C + 3, 3, style=M, kid="center-super")
add("ENTER", "Enter", C + 4, 3, w=2, rows=2, style="accent", kid="center-enter")
add("LEFTALT", "Alt", C + 2, 4, style=M, kid="center-alt")
add("RIGHTALT", "AltGr", C + 3, 4, style=M, kid="center-altgr")
add("LEFTCTRL", "Ctrl", C, 5, w=4, style=M, kid="center-ctrl")
add("BACKSPACE", "⌫", C + 4, 5, w=2, style=M, kid="center-backspace")

width = max(k["x"] + k["w"] for k in keys)
height = row_y(5) + SPACE_H
layout = {
    "format": "omakey-layout",
    "version": 1,
    "id": "split-qwerty",
    "name": "Split QWERTY",
    "author": "Omakey",
    "description": "Column-based QWERTY split for two thumbs: letters on the outer edges with a space bar "
                   "under each half, and everything else in the centre: Tab, Caps, Esc, navigation, and "
                   "big Shift, Enter, Ctrl and Backspace with Fn, Super and Alt.",
    "width": round(width, 4),
    "height": round(height, 4),
    "keys": keys,
}
OUT.write_text(json.dumps(layout, ensure_ascii=False, indent=1) + "\n")
print(f"wrote {len(keys)} keys, {layout['width']} x {layout['height']} units, to {OUT}")
