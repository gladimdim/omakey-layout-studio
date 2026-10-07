import { forwardRef, useRef, useState } from "react";
import { round, snap, STEP, moveKey, keyRects } from "../lib/layout";
import type { Layout, LayoutKey } from "../lib/types";
import { Keycap, type Edge } from "./Keycap";

export const MARGIN_UNITS = 1;

interface Props {
  layout: Layout;
  layer: string;
  zoom: number;
  snapOn: boolean;
  selected: number[];
  invalid: Set<number>;
  onSelect: (indices: number[]) => void;
  onApply: (fn: (l: Layout) => Layout, merge?: string) => void;
}

type Drag =
  | { mode: "move"; startX: number; startY: number; anchor: number; orig: Map<number, LayoutKey>; moved: boolean; additive: boolean; merge: string }
  | { mode: "resize"; startX: number; startY: number; index: number; edge: Edge; part?: number; orig: LayoutKey; merge: string }
  | { mode: "marquee"; startX: number; startY: number; x: number; y: number; base: number[] };

let gesture = 0;

export const Canvas = forwardRef<HTMLDivElement, Props>(function Canvas(
  { layout, layer, zoom, snapOn, selected, invalid, onSelect, onApply },
  scrollRef,
) {
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const offset = MARGIN_UNITS * zoom;
  const q = (v: number) => (snapOn ? snap(v) : round(v, 3));

  const boardW = (Math.max(layout.width, 1) + MARGIN_UNITS * 2 + 2) * zoom;
  const boardH = (Math.max(layout.height, 1) + MARGIN_UNITS * 2 + 2) * zoom;

  function local(e: React.PointerEvent) {
    const r = boardRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onKeyDown(e: React.PointerEvent, index: number) {
    if (e.button !== 0) return;
    e.stopPropagation();
    boardRef.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    let sel = selected;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (additive) {
      sel = selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index];
      onSelect(sel);
    } else if (!selected.includes(index)) {
      sel = [index];
      onSelect(sel);
    }
    const orig = new Map<number, LayoutKey>();
    for (const i of sel) orig.set(i, layout.keys[i]);
    drag.current = { mode: "move", startX: p.x, startY: p.y, anchor: index, orig, moved: false, additive, merge: `drag-${++gesture}` };
  }

  function onHandleDown(e: React.PointerEvent, index: number, edge: Edge, part?: number) {
    if (e.button !== 0) return;
    e.stopPropagation();
    boardRef.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    drag.current = { mode: "resize", startX: p.x, startY: p.y, index, edge, part, orig: layout.keys[index], merge: `resize-${++gesture}` };
  }

  function onActivate(index: number, additive: boolean) {
    if (additive) onSelect(selected.includes(index) ? selected.filter((i) => i !== index) : [...selected, index]);
    else onSelect([index]);
  }

  function onBoardDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    boardRef.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    drag.current = { mode: "marquee", startX: p.x, startY: p.y, x: p.x, y: p.y, base: additive ? selected : [] };
    if (!additive) onSelect([]);
  }

  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = local(e);
    const dx = (p.x - d.startX) / zoom;
    const dy = (p.y - d.startY) / zoom;

    if (d.mode === "move") {
      if (!d.moved && Math.hypot(p.x - d.startX, p.y - d.startY) < 3) return;
      d.moved = true;
      const a = d.orig.get(d.anchor);
      if (!a) return;
      let ddx = q(a.x + dx) - a.x;
      let ddy = q(a.y + dy) - a.y;
      // Keep the whole selection inside the positive quadrant.
      const keys = [...d.orig.values()];
      ddx = Math.max(ddx, -Math.min(...keys.map((k) => k.x)));
      ddy = Math.max(ddy, -Math.min(...keys.map((k) => k.y)));
      onApply((l) => ({
        ...l,
        keys: l.keys.map((k, i) => {
          const o = d.orig.get(i);
          return o ? moveKey(o, ddx, ddy) : k;
        }),
      }), d.merge);
    } else if (d.mode === "resize") {
      const part = d.part;
      const o = part === undefined ? d.orig : d.orig.parts?.[part];
      if (!o) return;
      const w = d.edge === "s" ? o.w : clampSize(q(o.w + dx));
      const h = d.edge === "e" ? o.h : clampSize(q(o.h + dy));
      const resize = (k: LayoutKey): LayoutKey =>
        part === undefined ? { ...k, w, h } : { ...k, parts: k.parts?.map((p, n) => (n === part ? { ...p, w, h } : p)) };
      onApply((l) => ({ ...l, keys: l.keys.map((k, i) => (i === d.index ? resize(k) : k)) }), d.merge);
    } else {
      d.x = p.x;
      d.y = p.y;
      const r = { x: Math.min(d.startX, p.x), y: Math.min(d.startY, p.y), w: Math.abs(p.x - d.startX), h: Math.abs(p.y - d.startY) };
      setMarquee(r);
      const ux = (r.x - offset) / zoom, uy = (r.y - offset) / zoom, uw = r.w / zoom, uh = r.h / zoom;
      const hit = layout.keys
        .map((k, i) => (keyRects(k).some((r) => r.x < ux + uw && ux < r.x + r.w && r.y < uy + uh && uy < r.y + r.h) ? i : -1))
        .filter((i) => i >= 0);
      onSelect([...new Set([...d.base, ...hit])]);
    }
  }

  function onUp() {
    const d = drag.current;
    drag.current = null;
    setMarquee(null);
    if (d?.mode === "move" && !d.moved && !d.additive && selected.length > 1) onSelect([d.anchor]);
  }

  return (
    <div className="canvas-scroll" ref={scrollRef}>
      <div
        ref={boardRef}
        className="board"
        role="group"
        aria-label="Layout canvas: Tab through keys, Enter or Space selects, arrows move the selection"
        style={{ width: boardW, height: boardH, backgroundSize: `${zoom * (snapOn ? STEP * 4 : 1)}px ${zoom * (snapOn ? STEP * 4 : 1)}px`, backgroundPosition: `${offset}px ${offset}px` }}
        onPointerDown={onBoardDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div
          className="layout-area"
          style={{ left: offset, top: offset, width: layout.width * zoom, height: layout.height * zoom }}
        />
        {layout.keys.map((k, i) => (
          <Keycap
            key={i}
            k={k}
            index={i}
            unit={zoom}
            offset={offset}
            layer={layer}
            selected={selected.includes(i)}
            invalid={invalid.has(i)}
            onPointerDown={onKeyDown}
            showHandles={selected.length === 1 && selected[0] === i}
            onHandleDown={onHandleDown}
            onActivate={onActivate}
          />
        ))}
        {layout.splitAt !== undefined && (
          <div className="split-line" style={{ left: offset + layout.splitAt * zoom, top: offset, height: layout.height * zoom }} />
        )}
        {marquee && <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />}
      </div>
    </div>
  );
});

function clampSize(v: number) {
  return Math.min(16, Math.max(0.25, v));
}
