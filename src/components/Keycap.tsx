import { keyOnLayer, keyRects } from "../lib/layout";
import type { KeyRect, LayoutKey } from "../lib/types";

/** Grow each side of `r` that touches another rectangle of the same key, so the parts join without a seam. */
function joined(r: KeyRect, all: KeyRect[], pad: number): { l: number; t: number; r: number; b: number } {
  const e = 1e-6;
  const touches = (side: "l" | "r" | "t" | "b") =>
    all.some((o) => {
      if (o === r) return false;
      const overlapX = o.x < r.x + r.w - e && r.x < o.x + o.w - e;
      const overlapY = o.y < r.y + r.h - e && r.y < o.y + o.h - e;
      if (side === "l") return overlapY && Math.abs(o.x + o.w - r.x) < e;
      if (side === "r") return overlapY && Math.abs(r.x + r.w - o.x) < e;
      if (side === "t") return overlapX && Math.abs(o.y + o.h - r.y) < e;
      return overlapX && Math.abs(r.y + r.h - o.y) < e;
    });
  return { l: touches("l") ? pad : 0, r: touches("r") ? pad : 0, t: touches("t") ? pad : 0, b: touches("b") ? pad : 0 };
}

interface Props {
  k: LayoutKey;
  index: number;
  unit: number;
  offset: number;
  layer: string;
  selected?: boolean;
  invalid?: boolean;
  onPointerDown?: (e: React.PointerEvent, index: number) => void;
  showHandles?: boolean;
  onHandleDown?: (e: React.PointerEvent, index: number, edge: "e" | "s" | "se") => void;
}

export function Keycap({ k, index, unit, offset, layer, selected, invalid, onPointerDown, showHandles, onHandleDown }: Props) {
  const view = keyOnLayer(k, layer);
  const gap = Math.max(1, unit * 0.06);
  const width = Math.max(2, k.w * unit - gap);
  const text = view.disabled ? "∅" : view.label;
  // Shrink long labels (PrtSc, AltGr) to fit instead of cutting them off.
  const base = unit * 0.27 * (k.style === "mod" || k.style === "fkey" ? 0.88 : 1);
  const fit = (width - 6) / (Math.max(1, [...text].length) * 0.62);
  const style: React.CSSProperties = {
    left: offset + k.x * unit + gap / 2,
    top: offset + k.y * unit + gap / 2,
    width,
    height: Math.max(2, k.h * unit - gap),
    fontSize: Math.max(4, Math.min(base, fit)),
  };
  const classes = [
    "keycap",
    `style-${k.style ?? "normal"}`,
    selected && "selected",
    invalid && "invalid",
    view.overridden && "overridden",
    view.disabled && "disabled",
    k.layer && k.layer === layer && "held",
    k.layer && "layer-key",
    k.parts?.length && "shaped",
  ]
    .filter(Boolean)
    .join(" ");

  const rects = keyRects(k);
  const extra = rects.slice(1).map((r, n) => {
    const j = joined(r, rects, gap / 2 + 1);
    return (
      <div
        key={`part-${n}`}
        className={`${classes} part`}
        style={{
          left: offset + r.x * unit + gap / 2 - j.l,
          top: offset + r.y * unit + gap / 2 - j.t,
          width: Math.max(2, r.w * unit - gap) + j.l + j.r,
          height: Math.max(2, r.h * unit - gap) + j.t + j.b,
        }}
        data-index={index}
        onPointerDown={onPointerDown ? (e) => onPointerDown(e, index) : undefined}
      />
    );
  });
  if (rects.length > 1) {
    const j = joined(rects[0], rects, gap / 2 + 1);
    style.left = (style.left as number) - j.l;
    style.top = (style.top as number) - j.t;
    style.width = (style.width as number) + j.l + j.r;
    style.height = (style.height as number) + j.t + j.b;
  }

  return (
    <>
    {extra}
    <div
      className={classes}
      style={style}
      data-index={index}
      onPointerDown={onPointerDown ? (e) => onPointerDown(e, index) : undefined}
      title={`${k.id} · ${k.layer ? `layer ${k.layer}` : view.code ?? "no code"}`}
    >
      {k.sub && !layer && <span className="sub" style={{ fontSize: Math.max(4, unit * 0.19) }}>{k.sub}</span>}
      <span className="label">{text}</span>
      {showHandles && onHandleDown && (
        <>
          <span className="handle e" onPointerDown={(e) => onHandleDown(e, index, "e")} />
          <span className="handle s" onPointerDown={(e) => onHandleDown(e, index, "s")} />
          <span className="handle se" onPointerDown={(e) => onHandleDown(e, index, "se")} />
        </>
      )}
    </div>
    </>
  );
}
