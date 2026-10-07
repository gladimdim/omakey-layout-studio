import { useState } from "react";
import { blankLayout, cloneLayout, keyRects, layerNames, STOCK_LAYOUTS } from "../lib/layout";
import type { Layout } from "../lib/types";
import { Modal } from "./Modal";

/** Geometry comes from the bundled layout, including split gaps and shaped keys. */
function PresetPreview({ layout }: { layout: Layout }) {
  return (
    <svg className="preset-preview" viewBox={`-0.3 -0.3 ${layout.width + 0.6} ${layout.height + 0.6}`} aria-hidden="true">
      {layout.keys.flatMap((key) => keyRects(key).map((r, i) => (
        <rect key={`${key.id}-${i}`} x={r.x + 0.04} y={r.y + 0.04} width={r.w - 0.08} height={r.h - 0.08}
          rx={0.1} className={`preset-key preset-key-${key.layer ? "layer" : key.style ?? "normal"}`} />
      )))}
    </svg>
  );
}

export function PresetDialog({ onPick, onClose }: { onPick: (layout: Layout) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [splitOnly, setSplitOnly] = useState(false);
  const words = query.toLowerCase().trim().split(/\s+/);
  const layouts = STOCK_LAYOUTS.filter((layout) => {
    const text = `${layout.name} ${layout.description ?? ""}`.toLowerCase();
    return (!splitOnly || layout.splitAt !== undefined) && words.every((word) => text.includes(word));
  });

  return (
    <Modal title="Start from a preset" onClose={onClose} className="preset-dialog">
      <p className="hint">Pick a keyboard, make it yours, then send it to your phone. Undo brings back your current layout.</p>
      <div className="preset-tools">
        <input autoFocus type="search" aria-label="Search presets" placeholder="Search layouts…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="check"><input type="checkbox" checked={splitOnly} onChange={(e) => setSplitOnly(e.target.checked)} />Split only</label>
      </div>
      <p className="hint" role="status">{layouts.length} of {STOCK_LAYOUTS.length} presets</p>
      <div className="preset-grid">
        {layouts.map((layout) => {
          const layers = layerNames(layout);
          return (
            <button type="button" className="preset-card" key={layout.id} onClick={() => onPick(cloneLayout(layout))} aria-label={`Use ${layout.name}`}>
              <PresetPreview layout={layout} />
              <strong>{layout.name}</strong>
              <span className="preset-meta">{layout.keys.length} keys · {layout.splitAt !== undefined ? "Split" : "Classic"}{layers.length > 0 ? ` · ${layers.length} ${layers.length === 1 ? "layer" : "layers"}` : ""}</span>
              <span className="preset-description">{layout.description}</span>
            </button>
          );
        })}
      </div>
      {layouts.length === 0 && <p className="preset-empty">No matching presets. Try another name or turn off “Split only”.</p>}
      <div className="preset-actions">
        <button type="button" onClick={() => onPick(blankLayout())}>Start blank</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
