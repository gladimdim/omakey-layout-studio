// Turns untrusted JSON (an imported file, a share link, autosave, the
// clipboard) into a Layout the editor can render without crashing.
//
// Only what would break rendering or editing is fixed: wrong types, missing
// required fields, numbers that aren't finite, absurd sizes. Values that are
// the right type but break the spec (a 0.1u key, an unknown key code, a
// 40-character label) are kept, so the validator still reports them. Every
// fix is described in `fixes`, which the Check panel shows.

import { bounds } from "./layout";
import type { KeyRect, LayerOverride, Layout, LayoutKey } from "./types";

export interface Normalized<T> {
  value: T;
  fixes: string[];
}

/** Coordinates and sizes beyond these are clamped: the canvas can't draw them sensibly. */
const MAX_POS = 1024;
const MAX_SIZE = 64;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** A string for any primitive, or undefined for objects, arrays and null. */
function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") return String(v);
  return undefined;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function num(v: unknown, fallback: number, lo: number, hi: number, what: string, fixes: string[]): number {
  if (!isNum(v)) {
    fixes.push(`${what} was ${v === undefined ? "missing" : "not a number"}; set to ${fallback}.`);
    return fallback;
  }
  const c = clamp(v, lo, hi);
  if (c !== v) fixes.push(`${what} was ${v}; clamped to ${c}.`);
  return c;
}

function rect(raw: unknown, what: string, fixes: string[]): KeyRect | undefined {
  if (!isObject(raw)) {
    fixes.push(`${what} wasn't an object with x, y, w and h; dropped.`);
    return undefined;
  }
  if (![raw.x, raw.y, raw.w, raw.h].every(isNum)) {
    fixes.push(`${what} had a missing or non-numeric x, y, w or h; dropped.`);
    return undefined;
  }
  const out: KeyRect & Record<string, unknown> = { ...raw } as KeyRect & Record<string, unknown>;
  out.x = num(raw.x, 0, -MAX_POS, MAX_POS, `${what} x`, fixes);
  out.y = num(raw.y, 0, -MAX_POS, MAX_POS, `${what} y`, fixes);
  out.w = num(raw.w, 1, 0.05, MAX_SIZE, `${what} w`, fixes);
  out.h = num(raw.h, 1, 0.05, MAX_SIZE, `${what} h`, fixes);
  return out;
}

/** One key, or undefined when `raw` isn't an object at all. */
export function normalizeKey(raw: unknown, index: number, fixes: string[]): LayoutKey | undefined {
  if (!isObject(raw)) {
    fixes.push(`Key #${index + 1} wasn't an object; dropped.`);
    return undefined;
  }
  // Unknown fields are kept: the validator reports them and export drops them.
  const k: Record<string, unknown> = { ...raw };
  const idText = asString(raw.id);
  const name = idText ? `Key "${idText}"` : `Key #${index + 1}`;

  if (typeof raw.id !== "string") {
    k.id = idText ?? "";
    fixes.push(`${name}: "id" wasn't a string; set to "${k.id}".`);
  }
  k.x = num(raw.x, 0, -MAX_POS, MAX_POS, `${name}: "x"`, fixes);
  k.y = num(raw.y, 0, -MAX_POS, MAX_POS, `${name}: "y"`, fixes);
  k.w = num(raw.w, 1, 0.05, MAX_SIZE, `${name}: "w"`, fixes);
  k.h = num(raw.h, 1, 0.05, MAX_SIZE, `${name}: "h"`, fixes);

  if (typeof raw.label !== "string") {
    k.label = asString(raw.label) ?? "";
    fixes.push(`${name}: "label" was ${raw.label === undefined ? "missing" : "not a string"}; set to "${k.label}".`);
  }
  for (const f of ["sub", "code", "layer", "style"] as const) {
    if (raw[f] === undefined || typeof raw[f] === "string") continue;
    const s = f === "sub" ? asString(raw[f]) : undefined;
    if (s === undefined) delete k[f];
    else k[f] = s;
    fixes.push(`${name}: "${f}" wasn't a string; ${s === undefined ? "dropped" : `set to "${s}"`}.`);
  }

  if (raw.parts !== undefined) {
    if (!Array.isArray(raw.parts)) {
      delete k.parts;
      fixes.push(`${name}: "parts" wasn't a list; dropped.`);
    } else {
      const parts = raw.parts
        .map((p, n) => rect(p, `${name}: part ${n + 1}`, fixes))
        .filter((p): p is KeyRect => p !== undefined);
      // An empty list stays, so the validator can say parts need 1–8 entries.
      if (parts.length || !raw.parts.length) k.parts = parts;
      else delete k.parts;
    }
  }

  if (raw.layers !== undefined) {
    if (!isObject(raw.layers)) {
      delete k.layers;
      fixes.push(`${name}: "layers" wasn't an object; dropped.`);
    } else {
      const layers: Record<string, LayerOverride> = {};
      for (const [layer, ov] of Object.entries(raw.layers)) {
        if (!isObject(ov) || layer === "__proto__") {
          fixes.push(`${name}: the "${layer}" layer entry wasn't an object; dropped.`);
          continue;
        }
        const o: Record<string, unknown> = { ...ov };
        // "code": null is the spec's explicit "disabled"; it means the same as no code.
        if (ov.code === null) delete o.code;
        else if (ov.code !== undefined && typeof ov.code !== "string") {
          delete o.code;
          fixes.push(`${name}: the "${layer}" layer code wasn't a string; dropped (the key is disabled on that layer).`);
        }
        if (ov.label !== undefined && typeof ov.label !== "string") {
          const s = asString(ov.label);
          if (s === undefined) delete o.label;
          else o.label = s;
          fixes.push(`${name}: the "${layer}" layer label wasn't a string; ${s === undefined ? "dropped" : `set to "${s}"`}.`);
        }
        layers[layer] = o as LayerOverride;
      }
      k.layers = layers;
    }
  }
  return k as unknown as LayoutKey;
}

/**
 * A renderable layout from parsed JSON, or undefined when `input` is not
 * a layout at all (not an object, or no "keys" list).
 */
export function normalizeLayout(input: unknown): Normalized<Layout> | undefined {
  if (!isObject(input) || !Array.isArray(input.keys)) return undefined;
  const fixes: string[] = [];
  const l: Record<string, unknown> = { ...input };

  for (const f of ["id", "name"] as const) {
    if (typeof input[f] !== "string") {
      l[f] = asString(input[f]) ?? "";
      fixes.push(`Layout "${f}" wasn't a string; set to "${l[f]}".`);
    }
  }
  for (const f of ["author", "description"] as const) {
    if (input[f] === undefined || typeof input[f] === "string") continue;
    const s = asString(input[f]);
    if (s === undefined) delete l[f];
    else l[f] = s;
    fixes.push(`Layout "${f}" wasn't a string; ${s === undefined ? "dropped" : `set to "${s}"`}.`);
  }

  const keys = input.keys
    .map((k, i) => normalizeKey(k, i, fixes))
    .filter((k): k is LayoutKey => k !== undefined);
  l.keys = keys;

  const b = bounds(keys);
  for (const f of ["width", "height"] as const) {
    const v = input[f];
    if (!isNum(v) || v <= 0) {
      l[f] = b[f];
      fixes.push(`Layout "${f}" was ${v === undefined ? "missing" : `not a positive number`}; set to ${b[f]} to fit the keys.`);
    } else if (v > MAX_POS) {
      l[f] = MAX_POS;
      fixes.push(`Layout "${f}" was ${v}; clamped to ${MAX_POS}.`);
    }
  }
  if (input.splitAt !== undefined && !isNum(input.splitAt)) {
    delete l.splitAt;
    fixes.push(`Layout "splitAt" wasn't a number; dropped.`);
  }
  return { value: l as unknown as Layout, fixes };
}
