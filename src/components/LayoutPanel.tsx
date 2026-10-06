import { LIMITS, type Layout } from "../lib/types";
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
      <TextField label="Name" value={layout.name ?? ""} maxLength={LIMITS.maxNameLength} onChange={(v) => set("name", v)} />
      <TextField label="Id" value={layout.id ?? ""} maxLength={64} placeholder="my-layout" onChange={(v) => set("id", slug(v))} />
      <TextField label="Author" value={layout.author ?? ""} maxLength={LIMITS.maxAuthorLength} onChange={(v) => set("author", v)} />
      <label className="field">
        <span>Description</span>
        <textarea
          rows={3}
          maxLength={LIMITS.maxDescriptionLength}
          value={layout.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
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
      <p className="hint">
        {layout.keys.length} keys. The phone scales the {layout.width}×{layout.height} area to fit its screen
        and keeps the aspect ratio.
      </p>
    </div>
  );
}
