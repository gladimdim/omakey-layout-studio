#!/usr/bin/env python3
"""Generate spec/keycodes.json from the kernel's input-event-codes.h.

The table lists every Linux key code a layout may send, with a default label
and a group for the studio's key picker. Codes are the physical-key codes the
kernel uses, so the desktop's own keyboard layout decides what a key types,
exactly like a real keyboard.

    python3 scripts/gen-keycodes.py [/usr/include/linux/input-event-codes.h]
"""
import json
import re
import sys
from pathlib import Path

HEADER = Path(sys.argv[1] if len(sys.argv) > 1 else "/usr/include/linux/input-event-codes.h")
OUT = Path(__file__).resolve().parent.parent / "spec" / "keycodes.json"

# Codes the desktop daemon registers on its virtual keyboard. 0x100-0x15f
# and 0x2c0+ are mouse/joystick buttons; registering those would make the
# compositor treat the device as a pointer too.
def allowed(code):
    return 1 <= code <= 0xFF or 0x160 <= code <= 0x2BF

LABELS = {
    "ESC": "Esc", "MINUS": "-", "EQUAL": "=", "BACKSPACE": "Backspace", "TAB": "Tab",
    "LEFTBRACE": "[", "RIGHTBRACE": "]", "ENTER": "Enter", "LEFTCTRL": "Ctrl",
    "SEMICOLON": ";", "APOSTROPHE": "'", "GRAVE": "`", "LEFTSHIFT": "Shift",
    "BACKSLASH": "\\", "COMMA": ",", "DOT": ".", "SLASH": "/", "RIGHTSHIFT": "Shift",
    "KPASTERISK": "KP *", "LEFTALT": "Alt", "SPACE": "Space", "CAPSLOCK": "Caps",
    "NUMLOCK": "Num", "SCROLLLOCK": "ScrLk", "KPMINUS": "KP -", "KPPLUS": "KP +",
    "KPDOT": "KP .", "KPENTER": "KP Enter", "RIGHTCTRL": "Ctrl", "KPSLASH": "KP /",
    "SYSRQ": "PrtSc", "RIGHTALT": "AltGr", "HOME": "Home", "UP": "↑", "PAGEUP": "PgUp",
    "LEFT": "←", "RIGHT": "→", "END": "End", "DOWN": "↓", "PAGEDOWN": "PgDn",
    "INSERT": "Ins", "DELETE": "Del", "MUTE": "Mute", "VOLUMEDOWN": "Vol-",
    "VOLUMEUP": "Vol+", "POWER": "Power", "KPEQUAL": "KP =", "PAUSE": "Pause",
    "LEFTMETA": "Super", "RIGHTMETA": "Super", "COMPOSE": "Menu", "NEXTSONG": "Next",
    "PLAYPAUSE": "Play", "PREVIOUSSONG": "Prev", "STOPCD": "Stop",
    "BRIGHTNESSDOWN": "Bri-", "BRIGHTNESSUP": "Bri+", "MICMUTE": "Mic", "102ND": "<>",
    "PRINT": "Print", "FN": "Fn",
}

MODIFIERS = {"LEFTCTRL", "RIGHTCTRL", "LEFTSHIFT", "RIGHTSHIFT", "LEFTALT", "RIGHTALT",
             "LEFTMETA", "RIGHTMETA", "CAPSLOCK", "FN"}
NAVIGATION = {"UP", "DOWN", "LEFT", "RIGHT", "HOME", "END", "PAGEUP", "PAGEDOWN"}
EDITING = {"ESC", "BACKSPACE", "TAB", "ENTER", "SPACE", "INSERT", "DELETE", "SYSRQ",
           "PAUSE", "SCROLLLOCK", "COMPOSE", "PRINT"}
PUNCT = {"MINUS", "EQUAL", "LEFTBRACE", "RIGHTBRACE", "SEMICOLON", "APOSTROPHE", "GRAVE",
         "BACKSLASH", "COMMA", "DOT", "SLASH", "102ND"}
MEDIA = {"MUTE", "VOLUMEDOWN", "VOLUMEUP", "NEXTSONG", "PLAYPAUSE", "PREVIOUSSONG",
         "STOPCD", "MICMUTE", "PLAY", "PAUSECD", "RECORD", "REWIND", "FASTFORWARD",
         "MEDIA", "EJECTCD"}
SYSTEM = {"POWER", "SLEEP", "WAKEUP", "BRIGHTNESSDOWN", "BRIGHTNESSUP", "KBDILLUMTOGGLE",
          "KBDILLUMDOWN", "KBDILLUMUP", "SWITCHVIDEOMODE", "SUSPEND", "WLAN", "BLUETOOTH",
          "CALC", "MAIL", "WWW", "HOMEPAGE", "SEARCH", "FILE", "COMPUTER", "SCREENLOCK",
          "DISPLAY_OFF", "RFKILL"}


def group(name):
    if re.fullmatch(r"[A-Z]", name):
        return "letters"
    if re.fullmatch(r"[0-9]", name):
        return "digits"
    if re.fullmatch(r"F([1-9]|1[0-9]|2[0-4])", name):
        return "function"
    if name in MODIFIERS:
        return "modifiers"
    if name in NAVIGATION:
        return "navigation"
    if name in EDITING:
        return "editing"
    if name in PUNCT:
        return "punctuation"
    if name.startswith("KP"):
        return "numpad"
    if name in MEDIA:
        return "media"
    if name in SYSTEM:
        return "system"
    if name in {"ZENKAKUHANKAKU", "RO", "KATAKANA", "HIRAGANA", "HENKAN",
                "KATAKANAHIRAGANA", "MUHENKAN", "HANGEUL", "HANJA", "YEN"}:
        return "international"
    return "misc"


def label(name):
    if name in LABELS:
        return LABELS[name]
    if name.startswith("KP") and len(name) == 3:
        return "KP " + name[2]
    if len(name) <= 3:
        return name
    return name.replace("_", " ").title()


def main():
    seen = {}
    for line in HEADER.read_text().splitlines():
        m = re.match(r"#define\s+KEY_(\w+)\s+(0x[0-9a-fA-F]+|\d+)\b", line)
        if not m:
            continue
        name, value = m.group(1), int(m.group(2), 0)
        if name in {"MAX", "CNT", "RESERVED", "MIN_INTERESTING"} or not allowed(value):
            continue
        # Several names alias one code (KEY_HANGUEL/KEY_HANGEUL...); keep the first.
        if value in seen.values():
            continue
        seen["KEY_" + name] = value

    keys = [
        {"name": n, "code": c, "label": label(n[4:]), "group": group(n[4:])}
        for n, c in sorted(seen.items(), key=lambda kv: kv[1])
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"format": "omakey-keycodes", "version": 1, "keys": keys},
                              ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {len(keys)} key codes to {OUT}")


if __name__ == "__main__":
    main()
