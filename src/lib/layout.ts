import classic from "../../spec/layouts/classic-qwerty.json";
import { defaultLabel } from "./keycodes";
import { LIMITS, type KeyRect, type LayerOverride, type Layout, type LayoutKey } from "./types";

export const CLASSIC_QWERTY = classic as Layout;

// Every layout in spec/layouts, Classic QWERTY first, then by name.
const stockModules = import.meta.glob("../../spec/layouts/*.json", { eager: true, import: "default" });
export const STOCK_LAYOUTS: Layout[] = Object.values(stockModules)
  .map((m) => m as Layout)
  .sort((a, b) => (a.id === CLASSIC_QWERTY.id ? -1 : b.id === CLASSIC_QWERTY.id ? 1 : a.name.localeCompare(b.name)));

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

/** A key's rectangles: its main one first, then its extra parts. */
export function keyRects(k: LayoutKey): KeyRect[] {
  const main = { x: k.x, y: k.y, w: k.w, h: k.h };
  return Array.isArray(k.parts) && k.parts.length ? [main, ...k.parts] : [main];
}

/** The key moved by (dx, dy), extra parts included. */
export function moveKey(k: LayoutKey, dx: number, dy: number): LayoutKey {
  const out = { ...k, x: round(k.x + dx), y: round(k.y + dy) };
  if (Array.isArray(k.parts)) out.parts = k.parts.map((p) => ({ ...p, x: round(p.x + dx), y: round(p.y + dy) }));
  return out;
}

/**
 * A rectangle as drawn with a split layout's gap widened by `stretch`:
 * rectangles right of the split move right, and ones crossing it get wider.
 */
export function stretchRect(r: KeyRect, splitAt: number | undefined, stretch: number): KeyRect {
  if (splitAt === undefined || stretch <= 0) return r;
  const left = r.x >= splitAt ? r.x + stretch : r.x;
  const right = r.x + r.w > splitAt ? r.x + r.w + stretch : r.x + r.w;
  return { x: left, y: r.y, w: right - left, h: r.h };
}

export function bounds(keys: LayoutKey[]): { width: number; height: number } {
  let width = 0, height = 0;
  for (const k of keys) {
    for (const r of keyRects(k)) {
      width = Math.max(width, r.x + r.w);
      height = Math.max(height, r.y + r.h);
    }
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
  // Defensive about shapes too: this runs on every render, before validation.
  const parts = Array.isArray(k.parts) ? k.parts.filter((p) => typeof p === "object" && p !== null) : [];
  if (parts.length) out.parts = parts.map((p) => ({ x: round(p.x), y: round(p.y), w: round(p.w), h: round(p.h) }));
  if (k.layers && typeof k.layers === "object") {
    const layers: Record<string, { code?: string; label?: string }> = {};
    for (const [name, ov] of Object.entries(k.layers)) {
      if (typeof ov !== "object" || ov === null) continue;
      const o: { code?: string; label?: string } = {};
      if (ov.code) o.code = ov.code;
      // An empty label is meaningful ("show nothing"), so it is kept.
      if (typeof ov.label === "string") o.label = ov.label;
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
  const splitAt = typeof l.splitAt === "number" && l.splitAt > 0 && l.splitAt < l.width ? round(l.splitAt) : undefined;
  return splitAt === undefined ? { ...meta, width, height, keys } : { ...meta, width, height, splitAt, keys };
}

/**
 * The label a layer entry shows (spec/LAYOUT.md, "Layers"): its `label`
 * when it has one, even an empty one; else the keycodes.json label of its
 * `code`; else nothing, because an entry without a code disables the key.
 */
export function overrideLabel(ov: LayerOverride): string {
  if (typeof ov.label === "string") return ov.label;
  return ov.code ? defaultLabel(ov.code) : "";
}

/** What a key shows and sends on a layer ("" = base). */
export function keyOnLayer(k: LayoutKey, layer: string): { label: string; code?: string; overridden: boolean; disabled: boolean } {
  const ov = layer ? k.layers?.[layer] : undefined;
  if (!ov) return { label: k.label, code: k.code, overridden: false, disabled: false };
  return { label: overrideLabel(ov), code: ov.code ?? undefined, overridden: true, disabled: !ov.code };
}

/**
 * A new override that leaves the key looking and acting as on the base
 * layer: the same code, plus the base label when it differs from the one
 * keycodes.json would show for that code.
 */
export function initialOverride(k: LayoutKey): LayerOverride {
  if (!k.code) return {};
  return k.label === defaultLabel(k.code) ? { code: k.code } : { code: k.code, label: k.label };
}

/** Why a part breaks the spec, or "" when it is fine. */
export function partProblem(p: KeyRect): string {
  if (!(p.x >= 0 && p.y >= 0)) return "x and y must be 0 or more.";
  if (!(p.w >= LIMITS.minKeySize && p.w <= LIMITS.maxKeySize && p.h >= LIMITS.minKeySize && p.h <= LIMITS.maxKeySize))
    return `w and h must be between ${LIMITS.minKeySize} and ${LIMITS.maxKeySize}.`;
  return "";
}

/** A new part: a 1u-high strip under the key's lowest rectangle, as wide as the main one. */
export function newPart(k: LayoutKey): KeyRect {
  const bottom = Math.max(...keyRects(k).map((r) => r.y + r.h));
  return { x: k.x, y: round(bottom), w: k.w, h: 1 };
}
