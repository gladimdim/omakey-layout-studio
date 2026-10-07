import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { keyRects, stretchRect } from "../lib/layout";
import {
  INK_FILL, PALETTE, phoneFnLegend, phoneInk, phoneLabel, phoneSub, phoneTone, TONE_FILL, type PhoneState,
} from "../lib/phone";
import type { KeyRect, Layout, LayoutKey } from "../lib/types";
import { Keycap } from "./Keycap";

/** The layout letterboxed into a landscape phone screen, as the app draws it. */
export function PhonePreview({ layout, layer }: { layout: Layout; layer: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 138 });
  const [emulate, setEmulate] = useState(false);
  const [shift, setShift] = useState(false);
  const [caps, setCaps] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const unit = Math.min(size.w / layout.width, size.h / layout.height) || 1;
  // A split layout pins each side to its screen edge, as the app does.
  const slack = size.w - layout.width * unit;
  const split = layout.splitAt;
  const stretch = split !== undefined && slack > 0 ? slack : 0;
  const left = stretch > 0 ? 0 : slack / 2;
  const top = (size.h - layout.height * unit) / 2;
  const stretchKey = (k: LayoutKey): LayoutKey => {
    if (!stretch) return k;
    const m = stretchRect(k, split, stretch / unit);
    return { ...k, x: m.x, w: m.w, parts: k.parts?.map((p) => stretchRect(p, split, stretch / unit)) };
  };
  const state: PhoneState = { layer, shift, caps };
  return (
    <>
      <div className="phone">
        <div className="phone-screen" ref={ref}>
          {emulate ? (
            <PhoneCanvas layout={layout} state={state} width={size.w} height={size.h} unit={unit} left={left} top={top} stretch={stretch / unit} />
          ) : (
            <div style={{ position: "absolute", left, top, width: size.w, height: layout.height * unit }}>
              {layout.keys.map((k, i) => (
                <Keycap key={i} k={stretchKey(k)} index={i} unit={unit} offset={0} layer={layer} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="row emulate">
        <label className="check" title="Draw the labels exactly as the Android app does">
          <input type="checkbox" checked={emulate} onChange={(e) => setEmulate(e.target.checked)} />
          Phone emulation
        </label>
        {emulate && (
          <>
            <button type="button" aria-pressed={shift} className={shift ? "active" : ""} onClick={() => setShift(!shift)}>Shift</button>
            <button type="button" aria-pressed={caps} className={caps ? "active" : ""} onClick={() => setCaps(!caps)}>Caps</button>
          </>
        )}
      </div>
      {emulate && (
        <p className="hint">
          As the phone draws it{layer ? <>, with the <b>{layer}</b> layer key held</> : ""}: letters are lowercase unless Shift or Caps is on,
          Shift shows symbol keys’ shifted character, and fn labels sit in the corner. Switch layers in the toolbar.
        </p>
      )}
    </>
  );
}

interface CanvasProps {
  layout: Layout;
  state: PhoneState;
  width: number;
  height: number;
  unit: number;
  left: number;
  top: number;
  /** Units the right side of a split moves right. */
  stretch: number;
}

/** A port of KeyboardView.onDraw onto a 2D canvas. */
function PhoneCanvas({ layout, state, width, height, unit, left, top, stretch }: CanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, width, height);
    const gap = unit * 0.05;
    const radius = unit * 0.12;
    const mono = 'ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace';

    for (const k of layout.keys) {
      const drawn = keyRects(k).map((r) => stretchRect(r, layout.splitAt, stretch));
      const tone = phoneTone(k, state);
      ctx.fillStyle = TONE_FILL[tone];
      // Each rectangle inset by the gap, except on sides that meet another part of the same key.
      for (const p of drawn) {
        const s = sides(p, drawn);
        roundRect(ctx,
          left + p.x * unit + (s.l ? -gap : gap), top + p.y * unit + (s.t ? -gap : gap),
          left + (p.x + p.w) * unit - (s.r ? -gap : gap), top + (p.y + p.h) * unit - (s.b ? -gap : gap), radius);
      }
      const m = drawn[0];
      const r = { l: left + m.x * unit + gap, t: top + m.y * unit + gap, r: left + (m.x + m.w) * unit - gap, b: top + (m.y + m.h) * unit - gap };

      const label = phoneLabel(k, state);
      ctx.fillStyle = INK_FILL[phoneInk(k, state, tone)];
      if (label) {
        // drawFitted: 0.4u for one or two characters, else 0.24u, shrunk to fit the key.
        let px = unit * (label.length <= 2 ? 0.4 : 0.24);
        ctx.font = `bold ${px}px ${mono}`;
        const maxW = r.r - r.l - unit * 0.12;
        const w = ctx.measureText(label).width;
        if (w > maxW && w > 0) {
          px *= maxW / w;
          ctx.font = `bold ${px}px ${mono}`;
        }
        const mt = ctx.measureText(label);
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const ascent = mt.fontBoundingBoxAscent ?? px * 0.8, descent = mt.fontBoundingBoxDescent ?? px * 0.2;
        ctx.fillText(label, (r.l + r.r) / 2, (r.t + r.b) / 2 + (ascent - descent) / 2);
      }

      const pressed = tone === "pressed";
      const sub = phoneSub(k, state);
      if (sub) {
        ctx.font = `${unit * 0.2}px ${mono}`;
        ctx.textAlign = "left";
        ctx.fillStyle = pressed ? PALETTE.bg : PALETTE.fgDim;
        ctx.fillText(sub, r.l + unit * 0.1, r.t + unit * 0.26);
      }
      const fn = phoneFnLegend(k, state, (r.r - r.l) / unit);
      if (fn) {
        ctx.font = `${unit * 0.16}px ${mono}`;
        ctx.textAlign = "right";
        ctx.fillStyle = pressed ? PALETTE.bg : PALETTE.layer;
        ctx.fillText(fn, r.r - unit * 0.08, r.b - unit * 0.1);
      }
    }
  }, [layout, state.layer, state.shift, state.caps, width, height, unit, left, top, stretch]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, width, height }}
      role="img"
      aria-label={`Phone emulation of ${layout.name || "the layout"}${state.layer ? `, ${state.layer} layer held` : ""}${state.shift ? ", Shift held" : ""}${state.caps ? ", Caps Lock on" : ""}`}
    />
  );
}

/** Which sides of `p` meet another rectangle of the same key. */
function sides(p: KeyRect, all: KeyRect[]) {
  const e = 1e-4;
  const meets = (test: (o: KeyRect) => boolean) => all.some((o) => o !== p && test(o));
  const overlapY = (o: KeyRect) => o.y < p.y + p.h - e && p.y < o.y + o.h - e;
  const overlapX = (o: KeyRect) => o.x < p.x + p.w - e && p.x < o.x + o.w - e;
  return {
    l: meets((o) => overlapY(o) && Math.abs(o.x + o.w - p.x) < e),
    r: meets((o) => overlapY(o) && Math.abs(p.x + p.w - o.x) < e),
    t: meets((o) => overlapX(o) && Math.abs(o.y + o.h - p.y) < e),
    b: meets((o) => overlapX(o) && Math.abs(p.y + p.h - o.y) < e),
  };
}

function roundRect(ctx: CanvasRenderingContext2D, l: number, t: number, r: number, b: number, radius: number) {
  const w = r - l, h = b - t;
  if (w <= 0 || h <= 0) return;
  const rr = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(l + rr, t);
  ctx.arcTo(r, t, r, b, rr);
  ctx.arcTo(r, b, l, b, rr);
  ctx.arcTo(l, b, l, t, rr);
  ctx.arcTo(l, t, r, t, rr);
  ctx.closePath();
  ctx.fill();
}
