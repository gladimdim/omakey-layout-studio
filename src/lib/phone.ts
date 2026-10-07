// What the Android app draws on each key, ported from KeyboardModel.kt
// (labelFor, subFor, isLetter) and KeyboardView.kt (onDraw), so the studio's
// phone emulation shows the same text. Layer entries follow the label rule in
// spec/LAYOUT.md ("Layers").

import { overrideLabel } from "./layout";
import type { LayoutKey } from "./types";

export interface PhoneState {
  /** Layer whose layer key is held, or "" for none. */
  layer: string;
  /** A Shift key is held. */
  shift: boolean;
  /** Caps Lock is on. */
  caps: boolean;
}

/** A letter key: its label is one capital A–Z and its code types that letter. */
export function isLetter(k: LayoutKey): boolean {
  return k.label.length === 1 && k.label >= "A" && k.label <= "Z" && k.code === `KEY_${k.label}`;
}

/**
 * The main label: the layer entry's label while its layer is held;
 * otherwise letters are lowercase unless Shift or Caps Lock (not both) is on,
 * and with Shift held symbol keys show their shifted character (`sub`).
 */
export function phoneLabel(k: LayoutKey, s: PhoneState): string {
  const ov = s.layer ? k.layers?.[s.layer] : undefined;
  if (ov) return overrideLabel(ov);
  if (isLetter(k)) return s.shift !== s.caps ? k.label : k.label.toLowerCase();
  if (s.shift && k.sub) return k.sub;
  return k.label;
}

/**
 * The small top-left legend, drawn only while no layer is held: the shifted
 * character, or the plain one while Shift shows the shifted one.
 */
export function phoneSub(k: LayoutKey, s: PhoneState): string | undefined {
  if (s.layer || !k.sub) return undefined;
  return s.shift ? k.label : k.sub;
}

/**
 * The laptop-style Fn legend in the bottom-right corner: the fn entry's own
 * `label`, drawn while no layer is held on keys whose drawn rectangle is
 * wider than 0.6u. `drawnWidth` is that width in units (the key minus its
 * 0.05u gap on each side, wider when a split stretches it).
 */
export function phoneFnLegend(k: LayoutKey, s: PhoneState, drawnWidth = k.w - 0.1): string | undefined {
  if (s.layer) return undefined;
  const fn = k.layers?.fn?.label;
  return fn && drawnWidth > 0.6 ? fn : undefined;
}

export type PhoneTone = "pressed" | "held" | "caps" | "accent" | "mod" | "fkey" | "normal";

/** The key's fill, as onDraw picks it. The emulator treats Shift keys as pressed while Shift is on. */
export function phoneTone(k: LayoutKey, s: PhoneState): PhoneTone {
  if (s.shift && (k.code === "KEY_LEFTSHIFT" || k.code === "KEY_RIGHTSHIFT")) return "pressed";
  if (k.layer && k.layer === s.layer) return "held";
  if (k.code === "KEY_CAPSLOCK" && s.caps) return "caps";
  if (k.style === "accent") return "accent";
  if (k.style === "mod") return "mod";
  if (k.style === "fkey") return "fkey";
  return "normal";
}

export type PhoneInk = "bg" | "layer" | "dim" | "onAccent" | "fg";

/** The label colour, as onDraw picks it. */
export function phoneInk(k: LayoutKey, s: PhoneState, tone: PhoneTone): PhoneInk {
  if (tone === "pressed") return "bg";
  const ov = s.layer ? k.layers?.[s.layer] : undefined;
  if (ov) return "layer";
  if (s.layer && !k.layer) return "dim";
  if (k.style === "accent") return "onAccent";
  return "fg";
}

/** Android's Palette (ui/Palette.kt). */
export const PALETTE = {
  bg: "#1a1b26",
  key: "#2a2f45",
  keyMod: "#1f2335",
  keyFkey: "#1f2335",
  keyAccent: "#3d59a1",
  accent: "#7aa2f7",
  layer: "#bb9af7",
  fg: "#c0caf5",
  fgDim: "#565f89",
  fgOnAccent: "#e0e6ff",
} as const;

export const TONE_FILL: Record<PhoneTone, string> = {
  pressed: PALETTE.accent,
  held: PALETTE.accent,
  caps: PALETTE.keyAccent,
  accent: PALETTE.keyAccent,
  mod: PALETTE.keyMod,
  fkey: PALETTE.keyFkey,
  normal: PALETTE.key,
};

export const INK_FILL: Record<PhoneInk, string> = {
  bg: PALETTE.bg,
  layer: PALETTE.layer,
  dim: PALETTE.fgDim,
  onAccent: PALETTE.fgOnAccent,
  fg: PALETTE.fg,
};
