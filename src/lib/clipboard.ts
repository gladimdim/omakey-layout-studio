// Copy/paste of keys through the system clipboard, as JSON, so keys move
// between tabs and layouts.

import { cleanKey, moveKey, uniqueId } from "./layout";
import { normalizeKey } from "./normalize";
import type { Layout, LayoutKey } from "./types";

export const CLIPBOARD_FORMAT = "omakey-keys";

/** Clipboard text for some keys. */
export function serializeKeys(keys: LayoutKey[]): string {
  return JSON.stringify({ format: CLIPBOARD_FORMAT, version: 1, keys: keys.map(cleanKey) }, null, 2);
}

/**
 * Keys from clipboard text: our own format, a whole layout, a list of keys
 * or a single key. Undefined when the text holds no keys.
 */
export function parseKeys(text: string): LayoutKey[] | undefined {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return undefined;
  }
  const isKeyLike = (o: unknown) => typeof o === "object" && o !== null && !Array.isArray(o) && ("x" in o || "code" in o || "layer" in o);
  let list: unknown[];
  if (Array.isArray(v)) list = v;
  else if (typeof v === "object" && v !== null && Array.isArray((v as { keys?: unknown }).keys)) list = (v as { keys: unknown[] }).keys;
  else if (isKeyLike(v)) list = [v];
  else return undefined;
  const fixes: string[] = [];
  const keys = list.filter(isKeyLike).map((k, i) => normalizeKey(k, i, fixes)).filter((k): k is LayoutKey => k !== undefined);
  return keys.length ? keys : undefined;
}

/** How far each repeated paste moves the keys, in units. */
export const PASTE_OFFSET = 0.5;

const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/**
 * `l` with `keys` appended: every pasted key gets an id unused in the
 * layout, and the group is moved down-right by PASTE_OFFSET steps until no
 * pasted key sits exactly on an existing one. Returns the new layout and the
 * pasted keys' indices.
 */
export function pasteKeys(l: Layout, keys: LayoutKey[]): { layout: Layout; indices: number[] } {
  const exact = (k: LayoutKey, d: number) =>
    l.keys.some((o) => same(o.x, k.x + d) && same(o.y, k.y + d) && same(o.w, k.w) && same(o.h, k.h));
  let d = 0;
  while (keys.some((k) => exact(k, d)) && d < 1000) d += PASTE_OFFSET;
  const taken = new Set(l.keys.map((k) => k.id));
  const pasted = keys.map((k) => {
    const id = uniqueId(k.id || k.code?.replace(/^KEY_/, "") || "key", taken);
    taken.add(id);
    return { ...moveKey(structuredClone(k), d, d), id };
  });
  const start = l.keys.length;
  return { layout: { ...l, keys: [...l.keys, ...pasted] }, indices: pasted.map((_, n) => start + n) };
}

/** Writes text to the clipboard, falling back to execCommand where the API is blocked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
