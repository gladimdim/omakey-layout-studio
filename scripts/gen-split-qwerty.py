#!/usr/bin/env python3
"""Generate spec/layouts/split-qwerty.json.

Classic QWERTY split where touch typists split their hands, with a centre
cluster for the thumbs: navigation on top (arrows in an inverted T with
Home/End/PgUp/PgDn/Ins/Del around them), then big Shift, Ctrl and Enter
with Fn, Super and Alt. Each half keeps the classic row stagger and its own
space bar under the letters, and the pinky-side modifiers stay where QWERTY
hands expect them.

The layout is wider than the classic one, so rows are taller than keys are
wide; it then fills a landscape phone instead of leaving a band empty.

    python3 scripts/gen-split-qwerty.py
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "spec" / "layouts" / "split-qwerty.json"

FROW_H = 1.1  # the F-key row is shorter, as on a laptop
ROW_H = 1.55  # every other row
GAP = 0.25  # between a half and the centre cluster

LEFT_W = 7.25  # widest left row (the Z row)
CENTER_X = LEFT_W + GAP
CENTER_W = 5.0
RIGHT_X = CENTER_X + CENTER_W + GAP - 6  # classic x of the "6" key lands here

MEDIA = {
    "F1": ("MUTE", "Mute"), "F2": ("VOLUMEDOWN", "Vol-"), "F3": ("VOLUMEUP", "Vol+"),
    "F4": ("MICMUTE", "Mic"), "F5": ("BRIGHTNESSDOWN", "Bri-"), "F6": ("BRIGHTNESSUP", "Bri+"),
    "F7": ("PREVIOUSSONG", "Prev"), "F8": ("PLAYPAUSE", "Play"), "F9": ("NEXTSONG", "Next"),
    "F10": ("STOPCD", "Stop"),
}

keys = []
ids = set()


def row_y(r):
    return 0.0 if r == 0 else FROW_H + (r - 1) * ROW_H


def row_h(r):
    return FROW_H if r == 0 else ROW_H


def add(code, label, x, y, w, h, sub=None, style=None, fn=None, kid=None, layer=None):
    kid = kid or (layer or code).lower()
    base, n = kid, 2
    while kid in ids:
        kid, n = f"{base}-{n}", n + 1
    ids.add(kid)
    k = {"id": kid, "x": round(x, 4), "y": round(y, 4), "w": w, "h": round(h, 4), "label": label}
    if layer:
        k["layer"] = layer
    else:
        k["code"] = "KEY_" + code
    if sub:
        k["sub"] = sub
    if fn:
        k["layers"] = {"fn": {"code": "KEY_" + fn[0], "label": fn[1]}}
    if style:
        k["style"] = style
    keys.append(k)


def row(r, x0, items):
    """items: (code, label, width[, sub[, style]]); code None leaves a gap."""
    x = x0
    for it in items:
        code, label, w = it[0], it[1], it[2]
        sub = it[3] if len(it) > 3 else None
        style = it[4] if len(it) > 4 else None
        if code:
            add(code, label, x, row_y(r), w, row_h(r), sub=sub, style=style, fn=MEDIA.get(code))
        x += w


M = "mod"
digits_l = [(str(d), str(d), 1, s) for d, s in zip("12345", "!@#$%")]
digits_r = [(str(d), str(d), 1, s) for d, s in zip("67890", "^&*()")]
letters = lambda s: [(c, c, 1) for c in s]

# ---- left half (classic x positions) ----
row(0, 0, [("ESC", "Esc", 1, None, M)] + [(f"F{i}", f"F{i}", 1, None, "fkey") for i in range(1, 7)])
row(1, 0, [("GRAVE", "`", 1, "~")] + digits_l)
row(2, 0, [("TAB", "Tab", 1.5, None, M)] + letters("QWERT"))
row(3, 0, [("CAPSLOCK", "Caps", 1.75, None, M)] + letters("ASDFG"))
row(4, 0, [("LEFTSHIFT", "Shift", 2.25, None, M)] + letters("ZXCVB"))
row(5, 0, [("LEFTCTRL", "Ctrl", 1.25, None, M), ("LEFTMETA", "Super", 1, None, M), ("SPACE", "", 5, None, "space")])

# ---- right half (classic x positions, shifted) ----
X = RIGHT_X
row(0, X + 6, [(f"F{i}", f"F{i}", 1, None, "fkey") for i in range(7, 13)]
    + [("SYSRQ", "PrtSc", 1.5, None, M), ("COMPOSE", "Menu", 1.5, None, M)])
row(1, X + 6, digits_r + [("MINUS", "-", 1, "_"), ("EQUAL", "=", 1, "+"), ("BACKSPACE", "⌫", 2, None, M)])
row(2, X + 6.5, letters("YUIOP") + [("LEFTBRACE", "[", 1, "{"), ("RIGHTBRACE", "]", 1, "}"),
                                    ("BACKSLASH", "\\", 1.5, "|")])
row(3, X + 6.75, letters("HJKL") + [("SEMICOLON", ";", 1, ":"), ("APOSTROPHE", "'", 1, "\""),
                                    ("ENTER", "Enter", 2.25, None, "accent")])
row(4, X + 7.25, letters("NM") + [("COMMA", ",", 1, "<"), ("DOT", ".", 1, ">"), ("SLASH", "/", 1, "?"),
                                  ("RIGHTSHIFT", "Shift", 2.75, None, M)])
row(5, X + 7.25, [("SPACE", "", 5, None, "space"), ("RIGHTALT", "AltGr", 1.25, None, M),
                  ("RIGHTCTRL", "Ctrl", 1.5, None, M)])

# ---- centre cluster ----
C = CENTER_X
for i, (code, label) in enumerate([("PAGEUP", "PgUp"), ("HOME", "Home"), ("UP", "↑"), ("END", "End"),
                                   ("PAGEDOWN", "PgDn")]):
    add(code, label, C + i, row_y(0), 1, row_h(0), style=M)
for i, (code, label) in enumerate([("INSERT", "Ins"), ("LEFT", "←"), ("DOWN", "↓"), ("RIGHT", "→"),
                                   ("DELETE", "Del")]):
    add(code, label, C + i, row_y(1), 1, row_h(1), style=M)

top = row_y(2)
add("LEFTSHIFT", "Shift", C, top, 2, 2 * ROW_H, style=M, kid="center-shift")
add(None, "Fn", C + 2, top, 1, 2 * ROW_H, style=M, layer="fn")
add("ENTER", "Enter", C + 3, top, 2, 3 * ROW_H, style="accent", kid="center-enter")
add("LEFTCTRL", "Ctrl", C, top + 2 * ROW_H, 2, 2 * ROW_H, style=M, kid="center-ctrl")
add("LEFTMETA", "Super", C + 2, top + 2 * ROW_H, 1, 2 * ROW_H, style=M, kid="center-super")
add("LEFTALT", "Alt", C + 3, top + 3 * ROW_H, 2, ROW_H, style=M, kid="center-alt")

width = max(k["x"] + k["w"] for k in keys)
height = row_y(5) + ROW_H
layout = {
    "format": "omakey-layout",
    "version": 1,
    "id": "split-qwerty",
    "name": "Split QWERTY",
    "author": "Omakey",
    "description": "QWERTY split by hand with a space bar under each half, and a centre thumb cluster: "
                   "arrows, Home/End, PgUp/PgDn, Ins/Del, and big Enter, Shift and Ctrl with Fn, Super and Alt.",
    "width": round(width, 4),
    "height": round(height, 4),
    "keys": keys,
}
OUT.write_text(json.dumps(layout, ensure_ascii=False, indent=1) + "\n")
print(f"wrote {len(keys)} keys, {layout['width']} x {layout['height']} units, to {OUT}")
