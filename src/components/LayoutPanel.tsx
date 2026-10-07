import { LIMITS, type Layout } from "../lib/types";
import { clampCodePoints } from "../lib/text";
import { NumberField, TextField } from "./Fields";

interface Props {
  layout: Layout;
  autoFit: boolean;
  onAutoFit: (on: boolean) => void;
  onApply: (fn: (l: Layout) => Layout, merge?: string) => void;
}

export function LayoutPanel({ layout, autoFit, onAutoFit, onApply }: Props) {
  const set = (field: keyof Layout, value: unknown) =>
    onApply((l) => ({ ...l, [field]: value }), `meta-${field}`);
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+/, "").slice(0, 64);

  return (
    <div className="inspector">
      <h3>Layout</h3>
      <TextField label="Name" value={layout.name ?? ""} maxChars={LIMITS.maxNameLength} onChange={(v) => set("name", v)} />
      <TextField label="Id" value={layout.id ?? ""} maxChars={LIMITS.maxIdLength} placeholder="my-layout" onChange={(v) => set("id", slug(v))} />
      <TextField label="Author" value={layout.author ?? ""} maxChars={LIMITS.maxAuthorLength} onChange={(v) => set("author", v)} />
      <label className="field">
        <span>Description</span>
        <textarea
          rows={3}
          value={layout.description ?? ""}
          onChange={(e) => set("description", clampCodePoints(e.target.value, LIMITS.maxDescriptionLength))}
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={autoFit} onChange={(e) => onAutoFit(e.target.checked)} />
        Fit size to keys
      </label>
      <div className="grid2">
        <NumberField label="Width (u)" value={layout.width} min={0.25} max={LIMITS.maxWidth} onChange={(v) => !autoFit && set("width", v)} />
        <NumberField label="Height (u)" value={layout.height} min={0.25} max={LIMITS.maxHeight} onChange={(v) => !autoFit && set("height", v)} />
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={layout.splitAt !== undefined}
          onChange={(e) => set("splitAt", e.target.checked ? Math.round(layout.width) / 2 : undefined)}
        />
        Split keyboard
      </label>
      {layout.splitAt !== undefined && (
        <NumberField label="Split at (u)" value={layout.splitAt} min={0.25} max={layout.width - 0.25} onChange={(v) => set("splitAt", v)} />
      )}
      <p className="hint">
        {layout.keys.length} keys. The phone scales the {layout.width}×{layout.height} area to fit its screen
        and keeps the aspect ratio.
        {layout.splitAt !== undefined &&
          ` Keys right of the dashed line at ${layout.splitAt}u are the right side: on a wider screen each side moves to its edge and the split grows.`}
      </p>
    </div>
  );
}
