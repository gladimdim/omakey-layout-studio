#!/usr/bin/env python3
"""Generate stock layouts modelled on well-known keyboards.

- classic-colemak, classic-dvorak: Classic QWERTY's shape with the letters
  and punctuation moved. Each key sends the code for the character printed
  on it with the desktop on a US layout, so these type Colemak/Dvorak while
  the desktop stays on US QWERTY. (Don't also switch the desktop to
  Colemak/Dvorak, or the remapping happens twice.)
- corne, ferris-sweep, lily58, ergodox, kinesis-advantage, alice: key
  positions from each board's QMK definition (keyboards/<board>/*.json in
  qmk/qmk_firmware), with the board's usual default keymap. The small
  boards reach numbers, F-keys and navigation through momentary layers, as
  they do in QMK. Rotated thumb keys are drawn unrotated.

    python3 scripts/gen-boards.py
"""
import json
from pathlib import Path

SPEC = Path(__file__).resolve().parent.parent / "spec"
OUT = SPEC / "layouts"

# ---- tokens -> (code, label, style) ----

SHIFTED = {"1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", "8": "*", "9": "(",
           "0": ")", "`": "~", "-": "_", "=": "+", "[": "{", "]": "}", "\\": "|", ";": ":", "'": "\"",
           ",": "<", ".": ">", "/": "?"}
PUNCT = {"`": "GRAVE", "-": "MINUS", "=": "EQUAL", "[": "LEFTBRACE", "]": "RIGHTBRACE", "\\": "BACKSLASH",
         ";": "SEMICOLON", "'": "APOSTROPHE", ",": "COMMA", ".": "DOT", "/": "SLASH"}
M, A, S, F = "mod", "accent", "space", "fkey"
NAMED = {
    "Esc": ("ESC", "Esc", M), "Tab": ("TAB", "Tab", M), "Caps": ("CAPSLOCK", "Caps", M),
    "Shift": ("LEFTSHIFT", "Shift", M), "RShift": ("RIGHTSHIFT", "Shift", M),
    "Ctrl": ("LEFTCTRL", "Ctrl", M), "RCtrl": ("RIGHTCTRL", "Ctrl", M),
    "Alt": ("LEFTALT", "Alt", M), "AltGr": ("RIGHTALT", "AltGr", M),
    "Super": ("LEFTMETA", "Super", M), "RSuper": ("RIGHTMETA", "Super", M),
    "Enter": ("ENTER", "Enter", A), "Bksp": ("BACKSPACE", "⌫", M), "Del": ("DELETE", "Del", M),
    "Ins": ("INSERT", "Ins", M), "Home": ("HOME", "Home", M), "End": ("END", "End", M),
    "PgUp": ("PAGEUP", "PgUp", M), "PgDn": ("PAGEDOWN", "PgDn", M),
    "Up": ("UP", "↑", M), "Down": ("DOWN", "↓", M), "Left": ("LEFT", "←", M), "Right": ("RIGHT", "→", M),
    "Space": ("SPACE", "", S), "Menu": ("COMPOSE", "Menu", M), "PrtSc": ("SYSRQ", "PrtSc", M),
    "ScrLk": ("SCROLLLOCK", "ScrLk", M), "Pause": ("PAUSE", "Pause", M),
    "Mute": ("MUTE", "Mute", M), "Vol-": ("VOLUMEDOWN", "Vol-", M), "Vol+": ("VOLUMEUP", "Vol+", M),
    "Prev": ("PREVIOUSSONG", "Prev", M), "Play": ("PLAYPAUSE", "Play", M), "Next": ("NEXTSONG", "Next", M),
    "Bri-": ("BRIGHTNESSDOWN", "Bri-", M), "Bri+": ("BRIGHTNESSUP", "Bri+", M),
}
LAYER_LABELS = {"fn": "Fn", "lower": "Lower", "raise": "Raise", "nav": "Nav", "num": "Num"}


def resolve(tok):
    """A token -> dict with code/label/style/sub, or a layer key."""
    if tok.startswith("@"):
        name = tok[1:]
        return {"layer": name, "label": LAYER_LABELS.get(name, name.title()), "style": M}
    if tok in NAMED:
        code, label, style = NAMED[tok]
        return {"code": "KEY_" + code, "label": label, "style": style}
    if tok.startswith("F") and tok[1:].isdigit():
        return {"code": "KEY_" + tok, "label": tok, "style": F}
    if len(tok) == 1 and tok.isalpha():
        return {"code": "KEY_" + tok.upper(), "label": tok.upper()}
    if len(tok) == 1 and tok.isdigit():
        return {"code": "KEY_" + tok, "label": tok, "sub": SHIFTED[tok]}
    if tok in PUNCT:
        return {"code": "KEY_" + PUNCT[tok], "label": tok, "sub": SHIFTED[tok]}
    raise ValueError(f"unknown token {tok!r}")


def key_id(r):
    if "layer" in r:
        return r["layer"]
    name = r["code"][4:].lower()
    return name


def build(lid, name, description, positions, base, layers=None):
    """positions: [(x, y, w, h)], base: [token], layers: {name: [token or None]}."""
    assert len(positions) == len(base), (lid, len(positions), len(base))
    layers = layers or {}
    for lname, toks in layers.items():
        assert len(toks) == len(base), (lid, lname, len(toks), len(base))
    keys, ids = [], set()
    for i, ((x, y, w, h), tok) in enumerate(zip(positions, base)):
        r = resolve(tok)
        kid = key_id(r)
        n = 2
        while kid in ids:
            kid, n = f"{key_id(r)}-{n}", n + 1
        ids.add(kid)
        k = {"id": kid, "x": round(x, 4), "y": round(y, 4), "w": w, "h": h, "label": r["label"]}
        if "layer" in r:
            k["layer"] = r["layer"]
        else:
            k["code"] = r["code"]
        if r.get("sub"):
            k["sub"] = r["sub"]
        over = {}
        for lname, toks in layers.items():
            t = toks[i]
            if t is None:
                continue
            o = resolve(t)
            over[lname] = {"code": o["code"], "label": o["label"] or "Space"}
        if over:
            k["layers"] = over
        if r.get("style"):
            k["style"] = r["style"]
        keys.append(k)
    width = max(k["x"] + k["w"] for k in keys)
    height = max(k["y"] + k["h"] for k in keys)
    layout = {"format": "omakey-layout", "version": 1, "id": lid, "name": name, "author": "Omakey",
              "description": description, "width": round(width, 4), "height": round(height, 4), "keys": keys}
    (OUT / f"{lid}.json").write_text(json.dumps(layout, ensure_ascii=False, indent=1) + "\n")
    print(f"{lid}: {len(keys)} keys, {layout['width']} x {layout['height']}")


def toks(s):
    """Whitespace-separated tokens; '_' means no layer override."""
    return [None if t == "_" else t for t in s.split()]


def p(*rows):
    """Concatenate position lists."""
    out = []
    for r in rows:
        out.extend(r)
    return out


# ---- Classic Colemak / Dvorak, from Classic QWERTY ----

def remap_classic(lid, name, description, mapping):
    classic = json.loads((OUT / "classic-qwerty.json").read_text())
    by_code = {}
    for qwerty_char, new_char in mapping.items():
        q = resolve(qwerty_char)["code"]
        by_code[q] = new_char
    keys = []
    for k in classic["keys"]:
        k = dict(k)
        new = by_code.get(k.get("code"))
        if new is not None:
            r = resolve(new)
            k["code"], k["label"] = r["code"], r["label"]
            k.pop("sub", None)
            if r.get("sub"):
                k["sub"] = r["sub"]
            if "style" in r:
                k["style"] = r["style"]
            elif k.get("style") == M and len(r["label"]) == 1:
                del k["style"]
            k["id"] = key_id(r)
        keys.append(k)
    # Ids must stay unique after the move.
    seen = set()
    for k in keys:
        base, n = k["id"], 2
        while k["id"] in seen:
            k["id"], n = f"{base}-{n}", n + 1
        seen.add(k["id"])
    layout = dict(classic, id=lid, name=name, description=description, keys=keys)
    (OUT / f"{lid}.json").write_text(json.dumps(layout, ensure_ascii=False, indent=1) + "\n")
    print(f"{lid}: {len(keys)} keys")


def rows_map(qwerty_rows, new_rows):
    m = {}
    for q, n in zip(qwerty_rows, new_rows):
        qs, ns = q.split(), n.split()
        assert len(qs) == len(ns), (q, n)
        m.update({a: b for a, b in zip(qs, ns) if a != b})
    return m


QWERTY_ROWS = [
    "` 1 2 3 4 5 6 7 8 9 0 - =",
    "q w e r t y u i o p [ ] \\",
    "a s d f g h j k l ; '",
    "z x c v b n m , . /",
]
remap_classic(
    "classic-colemak", "Classic Colemak",
    "Classic laptop layout with Colemak letters (Caps Lock is Backspace, as Colemak specifies). "
    "Keep the desktop on US: the phone does the remapping.",
    {**rows_map(QWERTY_ROWS, [
        "` 1 2 3 4 5 6 7 8 9 0 - =",
        "q w f p g j l u y ; [ ] \\",
        "a r s t d h n e i o '",
        "z x c v b k m , . /",
    ]), "Caps": "Bksp"},
)
remap_classic(
    "classic-dvorak", "Classic Dvorak",
    "Classic laptop layout with US Dvorak letters and punctuation. Keep the desktop on US: the phone "
    "does the remapping.",
    rows_map(QWERTY_ROWS, [
        "` 1 2 3 4 5 6 7 8 9 0 [ ]",
        "' , . p y f g c r l / = \\",
        "a o e u i d h t n s -",
        "; q j k x b m w v z",
    ]),
)

# ---- Corne (crkbd), LAYOUT_split_3x6_3 ----

def corne_row(y):
    left = [(0, y + 0.3), (1, y + 0.3), (2, y + 0.1), (3, y), (4, y + 0.1), (5, y + 0.2)]
    right = [(9, y + 0.2), (10, y + 0.1), (11, y), (12, y + 0.1), (13, y + 0.3), (14, y + 0.3)]
    return [(x, yy, 1, 1) for x, yy in left + right]


CORNE_POS = p(corne_row(0), corne_row(1), corne_row(2),
              [(4, 3.7, 1, 1), (5, 3.7, 1, 1), (6, 3.2, 1, 1.5), (8, 3.2, 1, 1.5), (9, 3.7, 1, 1), (10, 3.7, 1, 1)])
build(
    "corne", "Corne (crkbd)",
    "The 42-key Corne: 3x6 column-staggered halves and three thumb keys each. Hold Lower for numbers, "
    "F-keys and vim-style arrows, Raise for symbols, media and navigation.",
    CORNE_POS,
    toks("Tab q w e r t  y u i o p Bksp "
         "Ctrl a s d f g  h j k l ; ' "
         "Shift z x c v b  n m , . / Esc "
         "Super @lower Space  Enter @raise Alt"),
    {
        "lower": toks("` 1 2 3 4 5  6 7 8 9 0 Del "
                      "_ F1 F2 F3 F4 F5  Left Down Up Right Home End "
                      "_ F6 F7 F8 F9 F10  PgUp PgDn F11 F12 Ins PrtSc "
                      "_ _ _  _ _ _"),
        "raise": toks("Esc Mute Vol- Vol+ Prev Play  - = [ ] \\ Del "
                      "Caps Bri- Bri+ _ _ Next  Left Down Up Right ` ' "
                      "_ _ _ _ _ _  Home PgDn PgUp End _ _ "
                      "_ _ _  _ _ _"),
    },
)

# ---- Ferris Sweep, LAYOUT_split_3x5_2 ----

def sweep_row(y):
    left = [(0, 0.93), (1, 0.31), (2, 0), (3, 0.28), (4, 0.42)]
    right = [(7, 0.42), (8, 0.28), (9, 0), (10, 0.31), (11, 0.93)]
    return [(x, y + dy, 1, 1) for x, dy in left + right]


build(
    "ferris-sweep", "Ferris Sweep",
    "34 keys, nothing else: 3x5 halves with steep pinky stagger and two thumb keys each. Hold Nav (left "
    "thumb) for arrows, Enter and Backspace; hold Num (right thumb) for numbers, symbols and modifiers.",
    p(sweep_row(0), sweep_row(1), sweep_row(2),
      [(3.5, 3.75, 1, 1), (4.5, 4, 1, 1), (6.5, 4, 1, 1), (7.5, 3.75, 1, 1)]),
    toks("q w e r t  y u i o p "
         "a s d f g  h j k l ; "
         "z x c v b  n m , . / "
         "@nav Space  Shift @num"),
    {
        "nav": toks("F1 F2 F3 F4 F5  PgUp Home Up End Bksp "
                    "F6 F7 F8 F9 F10  PgDn Left Down Right Enter "
                    "F11 F12 PrtSc Menu Caps  Del Ins Tab Esc ' "
                    "_ _  _ _"),
        "num": toks("1 2 3 4 5  6 7 8 9 0 "
                    "Ctrl Super Alt Tab Esc  Bksp - = [ ] "
                    "` \\ ' Del Enter  Enter Mute Vol- Vol+ Play "
                    "_ _  _ _"),
    },
)

# ---- Lily58 ----

def lily_row(y):
    left = [(0, 0.5), (1, 0.375), (2, 0.125), (3, 0), (4, 0.125), (5, 0.25)]
    right = [(10.5, 0.25), (11.5, 0.125), (12.5, 0), (13.5, 0.125), (14.5, 0.375), (15.5, 0.5)]
    return [(x, y + dy, 1, 1) for x, dy in left], [(x, y + dy, 1, 1) for x, dy in right]


l0, r0 = lily_row(0)
l1, r1 = lily_row(1)
l2, r2 = lily_row(2)
l3, r3 = lily_row(3)
build(
    "lily58", "Lily58",
    "58 keys: 6x4 column-staggered halves, an inner key each side and four thumb keys. Lower gives F-keys "
    "and arrows, Raise gives = and \\ plus media.",
    p(l0, r0, l1, r1, l2, r2, l3, [(6, 2.75, 1, 1), (9.5, 2.75, 1, 1)], r3,
      [(2.5, 4.125, 1, 1), (3.5, 4.15, 1, 1), (4.5, 4.25, 1, 1), (6, 4.25, 1, 1.5),
       (9.5, 4.25, 1, 1.5), (11, 4.25, 1, 1), (12, 4.15, 1, 1), (13, 4.15, 1, 1)]),
    toks("Esc 1 2 3 4 5  6 7 8 9 0 ` "
         "Tab q w e r t  y u i o p - "
         "Ctrl a s d f g  h j k l ; ' "
         "Shift z x c v b [ ] n m , . / RShift "
         "Alt Super @lower Space  Enter @raise Bksp RSuper"),
    {
        "lower": toks("F1 F2 F3 F4 F5 F6  F7 F8 F9 F10 F11 F12 "
                      "_ _ _ _ _ _  PgUp Home Up End Ins Del "
                      "_ _ _ _ _ _  PgDn Left Down Right PrtSc Menu "
                      "_ _ _ _ _ _ _ _ _ _ _ _ _ _ "
                      "_ _ _ _  _ _ _ _"),
        "raise": toks("Mute Vol- Vol+ Prev Play Next  Bri- Bri+ _ _ _ _ "
                      "_ _ _ _ _ _  _ _ _ _ _ = "
                      "Caps _ _ _ _ _  _ _ _ _ _ \\ "
                      "_ _ _ _ _ _ _ _ _ _ _ _ _ _ "
                      "_ _ _ _  _ _ Del _"),
    },
)

# ---- ErgoDox, LAYOUT_ergodox_pretty ----

ERGODOX_POS = [
    # row 0
    (0, 0.375, 1.5, 1), (1.5, 0.375, 1, 1), (2.5, 0.125, 1, 1), (3.5, 0, 1, 1), (4.5, 0.125, 1, 1),
    (5.5, 0.25, 1, 1), (6.5, 0.25, 1, 1),
    (9.5, 0.25, 1, 1), (10.5, 0.25, 1, 1), (11.5, 0.125, 1, 1), (12.5, 0, 1, 1), (13.5, 0.125, 1, 1),
    (14.5, 0.375, 1, 1), (15.5, 0.375, 1.5, 1),
    # row 1
    (0, 1.375, 1.5, 1), (1.5, 1.375, 1, 1), (2.5, 1.125, 1, 1), (3.5, 1, 1, 1), (4.5, 1.125, 1, 1),
    (5.5, 1.25, 1, 1), (6.5, 1.25, 1, 1.5),
    (9.5, 1.25, 1, 1.5), (10.5, 1.25, 1, 1), (11.5, 1.125, 1, 1), (12.5, 1, 1, 1), (13.5, 1.125, 1, 1),
    (14.5, 1.375, 1, 1), (15.5, 1.375, 1.5, 1),
    # row 2
    (0, 2.375, 1.5, 1), (1.5, 2.375, 1, 1), (2.5, 2.125, 1, 1), (3.5, 2, 1, 1), (4.5, 2.125, 1, 1),
    (5.5, 2.25, 1, 1),
    (10.5, 2.25, 1, 1), (11.5, 2.125, 1, 1), (12.5, 2, 1, 1), (13.5, 2.125, 1, 1), (14.5, 2.375, 1, 1),
    (15.5, 2.375, 1.5, 1),
    # row 3
    (0, 3.375, 1.5, 1), (1.5, 3.375, 1, 1), (2.5, 3.125, 1, 1), (3.5, 3, 1, 1), (4.5, 3.125, 1, 1),
    (5.5, 3.25, 1, 1), (6.5, 2.75, 1, 1.5),
    (9.5, 2.75, 1, 1.5), (10.5, 3.25, 1, 1), (11.5, 3.125, 1, 1), (12.5, 3, 1, 1), (13.5, 3.125, 1, 1),
    (14.5, 3.375, 1, 1), (15.5, 3.375, 1.5, 1),
    # row 4
    (0.5, 4.375, 1, 1), (1.5, 4.375, 1, 1), (2.5, 4.125, 1, 1), (3.5, 4, 1, 1), (4.5, 4.125, 1, 1),
    (11.5, 4.125, 1, 1), (12.5, 4, 1, 1), (13.5, 4.125, 1, 1), (14.5, 4.375, 1, 1), (15.5, 4.375, 1, 1),
    # thumbs
    (6, 5, 1, 1), (7, 5, 1, 1), (9, 5, 1, 1), (10, 5, 1, 1), (7, 6, 1, 1), (9, 6, 1, 1),
    (5, 6, 1, 2), (6, 6, 1, 2), (7, 7, 1, 1), (9, 7, 1, 1), (10, 6, 1, 2), (11, 6, 1, 2),
]
build(
    "ergodox", "ErgoDox",
    "The 76-key ErgoDox: column-staggered halves with tall inner keys and big thumb clusters "
    "(Space, Backspace, Enter, Home/End, PgUp/PgDn). Hold Fn for F1-F12.",
    ERGODOX_POS,
    toks("= 1 2 3 4 5 Esc  Del 6 7 8 9 0 - "
         "Tab q w e r t [  ] y u i o p \\ "
         "Caps a s d f g  h j k l ; ' "
         "Shift z x c v b Super  Menu n m , . / RShift "
         "Ctrl ` Alt Left Right  Up Down PgUp PgDn RCtrl "
         "@fn Super AltGr RCtrl Home PgUp Space Bksp End PgDn Enter Space"),
    {"fn": toks("F11 F1 F2 F3 F4 F5 _  _ F6 F7 F8 F9 F10 F12 "
                "_ _ _ _ _ _ _  _ _ _ _ _ _ _ "
                "_ Mute Vol- Vol+ Prev Play  Next _ _ _ _ _ "
                "_ Bri- Bri+ _ _ _ _  _ _ _ _ _ _ _ "
                "_ _ _ Home End  _ _ _ _ _ "
                "_ _ _ _ _ _ _ Del _ _ _ _")},
)

# ---- Kinesis Advantage ----

KINESIS_FROW = [(x, 0, 0.69, 0.85) for x in (0, 0.7, 1.39, 2.09, 2.78, 3.48, 4.17, 4.87, 5.56,
                                              9.25, 9.95, 10.64, 11.34, 12.03, 12.73, 13.42, 14.12, 14.81)]


def kin_row(y):
    left = [(0, y + 0.25, 1.25, 1), (1.25, y + 0.25, 1, 1), (2.25, y, 1, 1), (3.25, y, 1, 1), (4.25, y, 1, 1),
            (5.25, y, 1, 1)]
    right = [(9.25, y, 1, 1), (10.25, y, 1, 1), (11.25, y, 1, 1), (12.25, y, 1, 1), (13.25, y + 0.25, 1, 1),
             (14.25, y + 0.25, 1.25, 1)]
    return left + right


build(
    "kinesis-advantage", "Kinesis Advantage",
    "The Kinesis Advantage contoured keyboard flattened onto glass: small F-key row, column-aligned "
    "keywells, arrows under the wells, and the famous thumb clusters (Backspace, Delete, Ctrl, Alt left; "
    "Enter, Space, Super, Ctrl right).",
    p(KINESIS_FROW, kin_row(1), kin_row(2), kin_row(3), kin_row(4),
      [(1.25, 5.25, 1, 1), (2.25, 5, 1, 1), (3.25, 5, 1, 1), (4.25, 5, 1, 1),
       (10.25, 5, 1, 1), (11.25, 5, 1, 1), (12.25, 5, 1, 1), (13.25, 5.25, 1, 1)],
      [(5.25, 6, 1, 1), (6.25, 6, 1, 1), (8.25, 6, 1, 1), (9.25, 6, 1, 1), (6.25, 7, 1, 1), (8.25, 7, 1, 1),
       (4.25, 7, 1, 2), (5.25, 7, 1, 2), (6.25, 8, 1, 1), (8.25, 8, 1, 1), (9.25, 7, 1, 2), (10.25, 7, 1, 2)]),
    toks("Esc F1 F2 F3 F4 F5 F6 F7 F8  F9 F10 F11 F12 PrtSc ScrLk Pause Menu AltGr "
         "= 1 2 3 4 5  6 7 8 9 0 - "
         "Tab q w e r t  y u i o p \\ "
         "Caps a s d f g  h j k l ; ' "
         "Shift z x c v b  n m , . / RShift "
         "` Ins Left Right  Up Down [ ] "
         "Ctrl Alt RSuper RCtrl Home PgUp Bksp Del End PgDn Enter Space"),
)

# ---- Alice (TGR Alice) ----

build(
    "alice", "Alice",
    "The Alice: a staggered split with B on both halves, two space bars and a macro column. "
    "Hold Fn for F1-F12, IJKL arrows and Delete.",
    [
        (0, 0, 1, 1), (1.25, 0, 1, 1), (2.25, 0, 1, 1), (3.25, 0, 1, 1), (4.25, 0, 1, 1), (5.25, 0, 1, 1),
        (6.25, 0, 1, 1), (7.25, 0, 1, 1), (10.25, 0, 1, 1), (11.25, 0, 1, 1), (12.25, 0, 1, 1), (13.25, 0, 1, 1),
        (14.25, 0, 1, 1), (15.25, 0, 1, 1), (16.25, 0, 2, 1),
        (0, 1, 1, 1), (1.25, 1, 1.5, 1), (2.75, 1, 1, 1), (3.75, 1, 1, 1), (4.75, 1, 1, 1), (5.75, 1, 1, 1),
        (6.75, 1, 1, 1), (9.75, 1, 1, 1), (10.75, 1, 1, 1), (11.75, 1, 1, 1), (12.75, 1, 1, 1), (13.75, 1, 1, 1),
        (14.75, 1, 1, 1), (15.75, 1, 1, 1), (16.75, 1, 1.5, 1),
        (0, 2, 1, 1), (1.25, 2, 1.75, 1), (3, 2, 1, 1), (4, 2, 1, 1), (5, 2, 1, 1), (6, 2, 1, 1), (7, 2, 1, 1),
        (10, 2, 1, 1), (11, 2, 1, 1), (12, 2, 1, 1), (13, 2, 1, 1), (14, 2, 1, 1), (15, 2, 1, 1),
        (16, 2, 2.25, 1),
        (1.25, 3, 2.25, 1), (3.5, 3, 1, 1), (4.5, 3, 1, 1), (5.5, 3, 1, 1), (6.5, 3, 1, 1), (7.5, 3, 1, 1),
        (9.5, 3, 1, 1), (10.5, 3, 1, 1), (11.5, 3, 1, 1), (12.5, 3, 1, 1), (13.5, 3, 1, 1), (14.5, 3, 1, 1),
        (15.5, 3, 1.75, 1), (17.25, 3, 1, 1),
        (1.25, 4, 1.5, 1), (4.25, 4, 1.5, 1), (5.75, 4, 2, 1), (7.75, 4, 1.25, 1), (9.5, 4, 2.75, 1),
        (12.25, 4, 1.5, 1), (16.75, 4, 1.5, 1),
    ],
    toks("Esc ` 1 2 3 4 5 6  7 8 9 0 - = Bksp "
         "PgUp Tab q w e r t  y u i o p [ ] \\ "
         "PgDn Caps a s d f g  h j k l ; ' Enter "
         "Shift z x c v b  b n m , . / RShift @fn "
         "Ctrl Alt Space Super  Space AltGr RCtrl"),
    {"fn": toks("_ Esc F1 F2 F3 F4 F5 F6  F7 F8 F9 F10 F11 F12 Del "
                "Home _ _ _ _ _ _  _ _ Up _ PrtSc _ _ _ "
                "End _ _ _ _ _ _  _ Left Down Right _ _ _ "
                "_ _ _ _ _ _  _ _ Mute Vol- Vol+ Play _ _ "
                "_ _ _ _  _ _ _")},
)
