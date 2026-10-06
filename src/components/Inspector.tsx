import { useState } from "react";
import { defaultLabel } from "../lib/keycodes";
import { layerNames } from "../lib/layout";
import { KEY_STYLES, LIMITS, type KeyStyle, type Layout, type LayoutKey } from "../lib/types";
import { NumberField, TextField } from "./Fields";
import { KeyPicker } from "./KeyPicker";

interface Props {
  layout: Layout;
  selected: number[];
  onApply: (fn: (l: Layout) => Layout, merge?: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAdd: () => void;
}

const LAYER_NAME = /^[a-z][a-z0-9]{0,15}$/;

export function Inspector({ layout, selected, onApply, onDuplicate, onDelete, onAdd }: Props) {
  const tag = selected.join(",");
  function patch(fields: Partial<LayoutKey> | ((k: LayoutKey) => LayoutKey), field: string) {
    onApply(
      (l) => ({
        ...l,
        keys: l.keys.map((k, i) =>
          selected.includes(i) ? (typeof fields === "function" ? fields(k) : { ...k, ...fields }) : k,
        ),
      }),
      `field-${tag}-${field}`,
    );
  }

  if (!selected.length) {
    return (
      <div className="inspector empty">
        <p>Select a key to edit it. Drag on empty space to select several.</p>
        <button type="button" onClick={onAdd}>+ Add key</button>
        <h4>Shortcuts</h4>
        <dl className="shortcuts">
          <dt>A</dt><dd>Add key</dd>
          <dt>Shift + click</dt><dd>Add to selection</dd>
          <dt>Arrows</dt><dd>Nudge 0.25u (Shift: 1u)</dd>
          <dt>Ctrl + D</dt><dd>Duplicate</dd>
          <dt>Del</dt><dd>Delete</dd>
          <dt>Ctrl + A</dt><dd>Select all</dd>
          <dt>Ctrl + Z</dt><dd>Undo (Shift: redo)</dd>
          <dt>Esc</dt><dd>Clear selection</dd>
        </dl>
      </div>
    );
  }

  const keys = selected.map((i) => layout.keys[i]).filter(Boolean);
  const actions = (
    <div className="row">
      <button type="button" onClick={onDuplicate}>Duplicate</button>
      <button type="button" className="danger" onClick={onDelete}>Delete</button>
    </div>
  );
  const common = <T,>(get: (k: LayoutKey) => T): T | undefined => {
    const first = get(keys[0]);
    return keys.every((k) => get(k) === first) ? first : undefined;
  };

  if (keys.length > 1) {
    return (
      <div className="inspector">
        <h3>{keys.length} keys selected</h3>
        <StyleSelect value={common((k) => k.style ?? "normal")} onChange={(style) => patch({ style }, "style")} />
        <div className="grid2">
          <NumberField label="Width" value={common((k) => k.w)} min={0.25} max={16} placeholder="mixed" onChange={(w) => patch({ w }, "w")} />
          <NumberField label="Height" value={common((k) => k.h)} min={0.25} max={16} placeholder="mixed" onChange={(h) => patch({ h }, "h")} />
        </div>
        {actions}
      </div>
    );
  }

  const k = keys[0];
  const isLayerKey = k.layer !== undefined;
  const layers = layerNames(layout);

  return (
    <div className="inspector">
      <h3>Key <span className="muted">{k.id}</span></h3>

      <div className="grid2">
        <TextField label="Label" value={k.label ?? ""} maxLength={LIMITS.maxLabelLength} onChange={(label) => patch({ label }, "label")} />
        <TextField label="Secondary" value={k.sub ?? ""} maxLength={LIMITS.maxLabelLength} placeholder="e.g. !" onChange={(sub) => patch({ sub }, "sub")} />
      </div>

      <div className="field">
        <span>Action</span>
        <div className="segmented">
          <button
            type="button"
            className={!isLayerKey ? "active" : ""}
            onClick={() => patch((x) => ({ ...withoutLayer(x), code: x.code ?? "KEY_A" }), "action")}
          >
            Key code
          </button>
          <button
            type="button"
            className={isLayerKey ? "active" : ""}
            onClick={() => patch((x) => ({ ...withoutCode(x), layer: x.layer ?? "fn" }), "action")}
          >
            Layer key
          </button>
        </div>
      </div>

      {isLayerKey ? (
        <>
          <TextField
            label="Layer while held"
            value={k.layer ?? ""}
            list="layer-names"
            placeholder="fn"
            onChange={(layer) => patch({ layer: layer.toLowerCase() }, "layer")}
          />
          <datalist id="layer-names">
            {layers.map((n) => <option key={n} value={n} />)}
          </datalist>
          <p className="hint">While this key is held, keys switch to their “{k.layer}” overrides. It sends nothing itself.</p>
        </>
      ) : (
        <div className="field">
          <span>Sends</span>
          <KeyPicker
            value={k.code}
            onChange={(code) =>
              patch((x) => {
                // Follow the code with the label while the label is still the default one.
                const followLabel = !x.label || (x.code && x.label === defaultLabel(x.code));
                return { ...x, code, label: followLabel && code ? defaultLabel(code) : x.label };
              }, "code")
            }
          />
        </div>
      )}

      <StyleSelect value={k.style ?? "normal"} onChange={(style) => patch({ style }, "style")} />

      <div className="grid4">
        <NumberField label="X" value={k.x} min={0} onChange={(x) => patch({ x: Math.max(0, x) }, "x")} />
        <NumberField label="Y" value={k.y} min={0} onChange={(y) => patch({ y: Math.max(0, y) }, "y")} />
        <NumberField label="W" value={k.w} min={0.25} max={16} onChange={(w) => patch({ w }, "w")} />
        <NumberField label="H" value={k.h} min={0.25} max={16} onChange={(h) => patch({ h }, "h")} />
      </div>

      <TextField label="Id" value={k.id ?? ""} maxLength={LIMITS.maxIdLength} onChange={(id) => patch({ id }, "id")} />

      <LayerOverrides k={k} layers={layers} patch={patch} />

      {actions}
    </div>
  );
}

function StyleSelect({ value, onChange }: { value: string | undefined; onChange: (s: KeyStyle) => void }) {
  return (
    <label className="field">
      <span>Style</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value as KeyStyle)}>
        {value === undefined && <option value="">mixed</option>}
        {KEY_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
  );
}

function LayerOverrides({
  k,
  layers,
  patch,
}: {
  k: LayoutKey;
  layers: string[];
  patch: (fn: (k: LayoutKey) => LayoutKey, field: string) => void;
}) {
  const [newLayer, setNewLayer] = useState("");
  const overrides = k.layers ?? {};
  const names = [...new Set([...layers, ...Object.keys(overrides)])];

  const setOverride = (name: string, value: { code?: string; label?: string } | undefined, field: string) =>
    patch((x) => {
      const next = { ...(x.layers ?? {}) };
      if (value === undefined) delete next[name];
      else next[name] = value;
      const out: LayoutKey = { ...x, layers: next };
      if (!Object.keys(next).length) delete out.layers;
      return out;
    }, `layer-${name}-${field}`);

  const validNew = LAYER_NAME.test(newLayer) && !overrides[newLayer];

  return (
    <div className="overrides">
      <h4>Layers</h4>
      {!names.length && <p className="hint">No layers yet. Add one, then give a key “Layer key” as its action to switch to it.</p>}
      {names.map((name) => {
        const ov = overrides[name];
        return (
          <div className="override" key={name}>
            <div className="override-head">
              <span className="pill">{name}</span>
              {ov ? (
                <button type="button" className="link" onClick={() => setOverride(name, undefined, "remove")}>remove</button>
              ) : (
                <button type="button" className="link" onClick={() => setOverride(name, { code: k.code ?? "KEY_A" }, "add")}>+ override</button>
              )}
            </div>
            {ov && (
              <div className="grid2">
                <div className="field">
                  <span>Sends</span>
                  <KeyPicker
                    value={ov.code}
                    allowNone="Nothing (disabled)"
                    onChange={(code) => setOverride(name, { ...ov, code }, "code")}
                  />
                </div>
                <TextField
                  label="Label"
                  value={ov.label ?? ""}
                  maxLength={LIMITS.maxLabelLength}
                  placeholder={ov.code ? defaultLabel(ov.code) : ""}
                  onChange={(label) => setOverride(name, { ...ov, label: label || undefined }, "label")}
                />
              </div>
            )}
          </div>
        );
      })}
      <div className="row">
        <input
          type="text"
          placeholder="new layer, e.g. nav"
          value={newLayer}
          spellCheck={false}
          onChange={(e) => setNewLayer(e.target.value.toLowerCase())}
        />
        <button
          type="button"
          disabled={!validNew}
          onClick={() => {
            setOverride(newLayer, { code: k.code ?? "KEY_A" }, "add");
            setNewLayer("");
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function withoutLayer(k: LayoutKey): LayoutKey {
  const { layer: _layer, ...rest } = k;
  return rest;
}

function withoutCode(k: LayoutKey): LayoutKey {
  const { code: _code, ...rest } = k;
  return rest;
}
