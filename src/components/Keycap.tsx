import { keyOnLayer } from "../lib/layout";
import type { LayoutKey } from "../lib/types";

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
  ]
    .filter(Boolean)
    .join(" ");

  return (
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
  );
}
