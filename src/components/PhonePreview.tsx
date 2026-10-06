import { useLayoutEffect, useRef, useState } from "react";
import type { Layout } from "../lib/types";
import { Keycap } from "./Keycap";

/** The layout letterboxed into a landscape phone screen, as the app draws it. */
export function PhonePreview({ layout, layer }: { layout: Layout; layer: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 138 });
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
  const box = { position: "absolute" as const, top, width: layout.width * unit, height: layout.height * unit };
  const side = (right: boolean) =>
    layout.keys.map((k, i) =>
      (split !== undefined && k.x >= split) === right ? (
        <Keycap key={i} k={k} index={i} unit={unit} offset={0} layer={layer} />
      ) : null,
    );
  return (
    <div className="phone">
      <div className="phone-screen" ref={ref}>
        <div style={{ ...box, left }}>{side(false)}</div>
        {split !== undefined && <div style={{ ...box, left: left + stretch }}>{side(true)}</div>}
      </div>
    </div>
  );
}
