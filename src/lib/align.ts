// Align and distribute a multi-selection. Each key moves as a whole (its
// parts with it); its bounding box, parts included, is what gets aligned.

import { keyRects, moveKey, round, snap } from "./layout";
import type { Layout, LayoutKey } from "./types";

export type AlignMode = "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter";
export type DistributeAxis = "x" | "y";

interface Box { x: number; y: number; r: number; b: number }

function box(k: LayoutKey): Box {
  const rs = keyRects(k);
  return {
    x: Math.min(...rs.map((r) => r.x)),
    y: Math.min(...rs.map((r) => r.y)),
    r: Math.max(...rs.map((r) => r.x + r.w)),
    b: Math.max(...rs.map((r) => r.y + r.h)),
  };
}

/** Grid quantiser: `snap` to `step`, or plain rounding when step is 0. */
function quant(step: number) {
  return (v: number) => Math.max(0, step > 0 ? snap(v, step) : round(v));
}

function moveTo(k: LayoutKey, b: Box, x: number, y: number): LayoutKey {
  const dx = round(x - b.x), dy = round(y - b.y);
  return dx || dy ? moveKey(k, dx, dy) : k;
}

function withKeys(l: Layout, moved: Map<number, LayoutKey>): Layout {
  let changed = false;
  const keys = l.keys.map((k, i) => {
    const m = moved.get(i);
    if (m && m !== k) changed = true;
    return m ?? k;
  });
  return changed ? { ...l, keys } : l;
}

/** Aligns the keys at `indices` (2 or more) to the selection's edge or centre line. */
export function alignKeys(l: Layout, indices: number[], mode: AlignMode, step = 0): Layout {
  const sel = indices.filter((i) => l.keys[i]);
  if (sel.length < 2) return l;
  const q = quant(step);
  const boxes = new Map(sel.map((i) => [i, box(l.keys[i])]));
  const all = [...boxes.values()];
  const minX = Math.min(...all.map((b) => b.x)), maxR = Math.max(...all.map((b) => b.r));
  const minY = Math.min(...all.map((b) => b.y)), maxB = Math.max(...all.map((b) => b.b));
  const moved = new Map<number, LayoutKey>();
  for (const [i, b] of boxes) {
    const w = b.r - b.x, h = b.b - b.y;
    let x = b.x, y = b.y;
    if (mode === "left") x = q(minX);
    else if (mode === "right") x = q(maxR - w);
    else if (mode === "hcenter") x = q((minX + maxR) / 2 - w / 2);
    else if (mode === "top") y = q(minY);
    else if (mode === "bottom") y = q(maxB - h);
    else y = q((minY + maxB) / 2 - h / 2);
    moved.set(i, moveTo(l.keys[i], b, x, y));
  }
  return withKeys(l, moved);
}

/**
 * Spreads the keys at `indices` (3 or more) along an axis so the gaps
 * between neighbours are equal. The first and last key stay put.
 */
export function distributeKeys(l: Layout, indices: number[], axis: DistributeAxis, step = 0): Layout {
  const sel = indices.filter((i) => l.keys[i]);
  if (sel.length < 3) return l;
  const q = quant(step);
  const lo = (b: Box) => (axis === "x" ? b.x : b.y);
  const hi = (b: Box) => (axis === "x" ? b.r : b.b);
  const items = sel.map((i) => ({ i, b: box(l.keys[i]) })).sort((p, o) => lo(p.b) - lo(o.b) || p.i - o.i);
  const first = items[0].b, last = items[items.length - 1].b;
  const sizes = items.reduce((s, it) => s + hi(it.b) - lo(it.b), 0);
  const gap = (hi(last) - lo(first) - sizes) / (items.length - 1);
  const moved = new Map<number, LayoutKey>();
  let at = lo(first);
  items.forEach((it, n) => {
    const size = hi(it.b) - lo(it.b);
    const pos = n === 0 || n === items.length - 1 ? lo(it.b) : q(at);
    moved.set(it.i, axis === "x" ? moveTo(l.keys[it.i], it.b, pos, it.b.y) : moveTo(l.keys[it.i], it.b, it.b.x, pos));
    at += size + gap;
  });
  return withKeys(l, moved);
}
