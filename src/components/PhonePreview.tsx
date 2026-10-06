import { useLayoutEffect, useRef, useState } from "react";
import { stretchRect } from "../lib/layout";
import type { Layout, LayoutKey } from "../lib/types";
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
  const stretchKey = (k: LayoutKey): LayoutKey => {
    if (!stretch) return k;
    const m = stretchRect(k, split, stretch / unit);
    return { ...k, x: m.x, w: m.w, parts: k.parts?.map((p) => stretchRect(p, split, stretch / unit)) };
  };
  return (
    <div className="phone">
      <div className="phone-screen" ref={ref}>
        <div style={{ position: "absolute", left, top, width: size.w, height: layout.height * unit }}>
          {layout.keys.map((k, i) => (
            <Keycap key={i} k={stretchKey(k)} index={i} unit={unit} offset={0} layer={layer} />
          ))}
        </div>
      </div>
    </div>
  );
}
