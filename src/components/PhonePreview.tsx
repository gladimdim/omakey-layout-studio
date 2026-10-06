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
  const left = (size.w - layout.width * unit) / 2;
  const top = (size.h - layout.height * unit) / 2;
  return (
    <div className="phone">
      <div className="phone-screen" ref={ref}>
        <div style={{ position: "absolute", left, top, width: layout.width * unit, height: layout.height * unit }}>
          {layout.keys.map((k, i) => (
            <Keycap key={i} k={k} index={i} unit={unit} offset={0} layer={layer} />
          ))}
        </div>
      </div>
    </div>
  );
}
