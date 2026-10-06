import classic from "../../spec/layouts/classic-qwerty.json";
import split from "../../spec/layouts/split-qwerty.json";
import { defaultLabel } from "./keycodes";
import type { Layout, LayoutKey } from "./types";

export const CLASSIC_QWERTY = classic as Layout;
export const SPLIT_QWERTY = split as Layout;
export const STOCK_LAYOUTS: Layout[] = [CLASSIC_QWERTY, SPLIT_QWERTY];

export const STEP = 0.25;

export function round(v: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export function snap(v: number, step = STEP): number {
  return round(Math.round(v / step) * step);
}

export function cloneLayout(l: Layout): Layout {
  return structuredClone(l);
}

export function blankLayout(): Layout {
  return {
    format: "omakey-layout",
    version: 1,
    id: "my-layout",
    name: "My layout",
    author: "",
    description: "",
    width: 4,
    height: 1,
    keys: [
      { id: "esc", x: 0, y: 0, w: 1, h: 1, label: "Esc", code: "KEY_ESC", style: "mod" },
      { id: "space", x: 1, y: 0, w: 3, h: 1, label: "", code: "KEY_SPACE", style: "space" },
    ],
  };
}

export function bounds(keys: LayoutKey[]): { width: number; height: number } {
  let width = 0, height = 0;
  for (const k of keys) {
    width = Math.max(width, k.x + k.w);
    height = Math.max(height, k.y + k.h);
  }
  return { width: round(width) || 1, height: round(height) || 1 };
}

/** Recomputes width/height from the keys. */
export function fitToKeys(l: Layout): Layout {
  const b = bounds(l.keys);
  return b.width === l.width && b.height === l.height ? l : { ...l, ...b };
}

export function layerNames(l: Layout): string[] {
  const names = new Set<string>();
  for (const k of l.keys) {
    if (k.layer) names.add(k.layer);
    if (k.layers) for (const n of Object.keys(k.layers)) names.add(n);
  }
  return [...names].sort((a, b) => (a === "fn" ? -1 : b === "fn" ? 1 : a.localeCompare(b)));
}

export function uniqueId(base: string, taken: Set<string>): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 56) || "key";
  if (!taken.has(clean)) return clean;
  for (let n = 2; ; n++) {
    const id = `${clean}-${n}`;
    if (!taken.has(id)) return id;
  }
}

function overlaps(a: { x: number; y: number; w: number; h: number }, keys: LayoutKey[]): boolean {
  return keys.some((k) => a.x < k.x + k.w - 1e-6 && k.x < a.x + a.w - 1e-6 && a.y < k.y + k.h - 1e-6 && k.y < a.y + a.h - 1e-6);
}

/** First free 1u slot scanning row by row, or a new row underneath. */
export function freeSlot(l: Layout): { x: number; y: number } {
  const cols = Math.max(1, Math.ceil(l.width));
  const rows = Math.ceil(l.height);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) if (!overlaps({ x, y, w: 1, h: 1 }, l.keys)) return { x, y };
  return { x: 0, y: rows };
}

export function newKey(l: Layout, code = "KEY_A"): LayoutKey {
  const taken = new Set(l.keys.map((k) => k.id));
  const { x, y } = freeSlot(l);
  return { id: uniqueId(code.replace(/^KEY_/, ""), taken), x, y, w: 1, h: 1, label: defaultLabel(code), code };
}

/** Drops empty optional fields so exports stay tidy. */
export function cleanKey(k: LayoutKey): LayoutKey {
  const out: LayoutKey = { id: k.id, x: round(k.x), y: round(k.y), w: round(k.w), h: round(k.h), label: k.label };
  if (k.sub) out.sub = k.sub;
  if (k.layer !== undefined) out.layer = k.layer;
  else if (k.code !== undefined) out.code = k.code;
  if (k.style && k.style !== "normal") out.style = k.style;
  if (k.layers) {
    const layers: Record<string, { code?: string; label?: string }> = {};
    for (const [name, ov] of Object.entries(k.layers)) {
      const o: { code?: string; label?: string } = {};
      if (ov.code) o.code = ov.code;
      if (ov.label) o.label = ov.label;
      layers[name] = o;
    }
    if (Object.keys(layers).length) out.layers = layers;
  }
  return out;
}

export function cleanLayout(l: Layout): Layout {
  const out: Layout = {
    format: "omakey-layout",
    version: 1,
    id: l.id,
    name: l.name,
    width: round(l.width),
    height: round(l.height),
    keys: l.keys.map(cleanKey),
  };
  if (l.author) out.author = l.author;
  if (l.description) out.description = l.description;
  // Keep the spec's field order: meta first, then geometry, then keys.
  const { keys, width, height, ...meta } = out;
  return { ...meta, width, height, keys };
}

/** What a key shows and sends on a layer ("" = base). */
export function keyOnLayer(k: LayoutKey, layer: string): { label: string; code?: string; overridden: boolean; disabled: boolean } {
  const ov = layer ? k.layers?.[layer] : undefined;
  if (!ov) return { label: k.label, code: k.code, overridden: false, disabled: false };
  return {
    label: ov.label ?? (ov.code ? defaultLabel(ov.code) : ""),
    code: ov.code,
    overridden: true,
    disabled: !ov.code,
  };
}
