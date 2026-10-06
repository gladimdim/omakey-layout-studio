import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Canvas, MARGIN_UNITS } from "./components/Canvas";
import { ImportDialog } from "./components/ImportDialog";
import { Inspector } from "./components/Inspector";
import { IssuesPanel } from "./components/IssuesPanel";
import { LayoutPanel } from "./components/LayoutPanel";
import { SharePanel } from "./components/SharePanel";
import { historyReducer, initHistory, type History, type HistoryAction } from "./lib/history";
import {
  blankLayout, bounds, cleanLayout, CLASSIC_QWERTY, cloneLayout, fitToKeys, layerNames, newKey, round, snap, STEP, uniqueId,
} from "./lib/layout";
import { decodePayload, extractPayload, HASH_PREFIX } from "./lib/share";
import { loadPrefs, loadSaved, save, savePrefs } from "./lib/storage";
import { LIMITS, type Layout } from "./lib/types";
import { hasErrors, validateLayout } from "./lib/validate";

type Tab = "key" | "layout" | "share" | "check";

function looksLikeLayout(v: unknown): v is Layout {
  return typeof v === "object" && v !== null && Array.isArray((v as Layout).keys) &&
    (v as Layout).keys.every((k) => typeof k === "object" && k !== null);
}

function initialLayout(): Layout {
  const saved = loadSaved();
  return looksLikeLayout(saved) ? saved : cloneLayout(CLASSIC_QWERTY);
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export function App() {
  const [history, dispatch] = useReducer(
    historyReducer as (h: History<Layout>, a: HistoryAction<Layout>) => History<Layout>,
    undefined,
    () => initHistory(initialLayout()),
  );
  const layout = history.present;
  const [prefs, setPrefs] = useState(() => loadPrefs({ snapOn: true, autoFit: true }));
  const [zoom, setZoom] = useState(56);
  const [selected, setSelected] = useState<number[]>([]);
  const [layer, setLayer] = useState("");
  const [tab, setTab] = useState<Tab>("key");
  const [importOpen, setImportOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState("");
  const [fitToken, setFitToken] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const issues = useMemo(() => validateLayout(layout), [layout]);
  const invalid = useMemo(
    () => new Set(issues.filter((i) => i.severity === "error" && i.keyIndex !== undefined).map((i) => i.keyIndex!)),
    [issues],
  );
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const layers = useMemo(() => layerNames(layout), [layout]);
  const cleaned = useMemo(() => cleanLayout(layout), [layout]);

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? "" : t)), 2500);
  }, []);

  const apply = useCallback(
    (fn: (l: Layout) => Layout, merge?: string) =>
      dispatch({ type: "apply", fn: (l) => { const n = fn(l); return prefs.autoFit && n !== l ? fitToKeys(n) : n; }, merge }),
    [prefs.autoFit],
  );

  const load = useCallback((value: Layout, message?: string) => {
    dispatch({ type: "reset", value });
    setSelected([]);
    setLayer("");
    setFitToken((t) => t + 1);
    if (message) say(message);
  }, [say]);

  const importText = useCallback(async (text: string): Promise<string | undefined> => {
    if (new TextEncoder().encode(text).length > LIMITS.maxFileBytes) return "That file is over 256 KB; layouts are limited to 256 KB.";
    let value: unknown;
    try {
      const payload = extractPayload(text);
      value = payload ? await decodePayload(payload) : JSON.parse(text);
    } catch {
      return "That isn't layout JSON or a layout link.";
    }
    if (!looksLikeLayout(value)) return "That JSON isn't an Omakey layout (it has no \"keys\" list).";
    const problems = validateLayout(value);
    load(value, hasErrors(problems) ? "Imported with errors — see Check" : `Imported “${value.name ?? "layout"}”`);
    if (hasErrors(problems)) setTab("check");
    return undefined;
  }, [load]);

  // Reopen a layout shared as a studio link, then drop the hash so a
  // refresh shows your edits instead of the original link.
  useEffect(() => {
    if (window.location.hash.startsWith(HASH_PREFIX)) {
      importText(window.location.href).then((err) => err && say(err));
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [importText, say]);

  useEffect(() => {
    const t = window.setTimeout(() => save(layout), 300);
    return () => window.clearTimeout(t);
  }, [layout]);
  useEffect(() => savePrefs(prefs), [prefs]);

  // Keep the selection pointing at real keys after undo/redo.
  useEffect(() => {
    setSelected((s) => (s.every((i) => i < layout.keys.length) ? s : s.filter((i) => i < layout.keys.length)));
  }, [layout.keys.length]);

  useEffect(() => {
    if (layer && !layers.includes(layer)) setLayer("");
  }, [layer, layers]);

  const zoomToFit = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const w = layout.width + MARGIN_UNITS * 2 + 0.5;
    const h = layout.height + MARGIN_UNITS * 2 + 0.5;
    setZoom(Math.max(12, Math.min(120, Math.floor(Math.min(el.clientWidth / w, el.clientHeight / h)))));
  }, [layout.width, layout.height]);

  useEffect(zoomToFit, [fitToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const addKey = useCallback(() => {
    apply((l) => ({ ...l, keys: [...l.keys, newKey(l)] }));
    setSelected([layout.keys.length]);
    setTab("key");
  }, [apply, layout.keys.length]);

  const duplicate = useCallback(() => {
    if (!selected.length) return;
    const start = layout.keys.length;
    apply((l) => {
      const picked = selected.map((i) => l.keys[i]).filter(Boolean);
      const b = bounds(picked);
      const minX = Math.min(...picked.map((k) => k.x));
      const taken = new Set(l.keys.map((k) => k.id));
      const copies = picked.map((k) => {
        const id = uniqueId(k.id, taken);
        taken.add(id);
        return { ...structuredClone(k), id, x: round(k.x + b.width - minX) };
      });
      return { ...l, keys: [...l.keys, ...copies] };
    });
    setSelected(selected.map((_, n) => start + n));
  }, [apply, layout.keys.length, selected]);

  const remove = useCallback(() => {
    if (!selected.length) return;
    apply((l) => ({ ...l, keys: l.keys.filter((_, i) => !selected.includes(i)) }));
    setSelected([]);
  }, [apply, selected]);

  const nudge = useCallback((dx: number, dy: number, merge: string) => {
    apply((l) => {
      const picked = selected.map((i) => l.keys[i]).filter(Boolean);
      if (!picked.length) return l;
      const ddx = Math.max(dx, -Math.min(...picked.map((k) => k.x)));
      const ddy = Math.max(dy, -Math.min(...picked.map((k) => k.y)));
      const q = (v: number) => (prefs.snapOn && Math.abs(dx + dy) >= STEP ? snap(v) : round(v));
      return { ...l, keys: l.keys.map((k, i) => (selected.includes(i) ? { ...k, x: q(k.x + ddx), y: q(k.y + ddy) } : k)) };
    }, merge);
  }, [apply, selected, prefs.snapOn]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(cleaned, null, 2) + "\n"], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${cleaned.id || "layout"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, [cleaned]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTyping(e.target) || importOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); dispatch({ type: e.shiftKey ? "redo" : "undo" }); return; }
      if (mod && k === "y") { e.preventDefault(); dispatch({ type: "redo" }); return; }
      if (mod && k === "a") { e.preventDefault(); setSelected(layout.keys.map((_, i) => i)); return; }
      if (mod && k === "d") { e.preventDefault(); duplicate(); return; }
      if (mod) return;
      if (k === "escape") setSelected([]);
      else if (k === "delete" || k === "backspace") { e.preventDefault(); remove(); }
      else if (k === "a") addKey();
      else if (k.startsWith("arrow") && selected.length) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : prefs.snapOn ? STEP : 0.05;
        const [dx, dy] = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k] ?? [0, 0];
        nudge(dx, dy, `nudge-${selected.join(",")}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addKey, duplicate, remove, nudge, selected, layout.keys, prefs.snapOn, importOpen]);

  // Seal merge groups when the pointer is released, so two separate field
  // edits or nudges don't become one undo step after a pause.
  useEffect(() => {
    const seal = () => dispatch({ type: "seal" });
    window.addEventListener("pointerup", seal);
    window.addEventListener("focusout", seal);
    return () => {
      window.removeEventListener("pointerup", seal);
      window.removeEventListener("focusout", seal);
    };
  }, []);

  return (
    <div
      className="app"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={async (e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) { const err = await importText(await f.text()); if (err) say(err); }
      }}
    >
      <header className="toolbar">
        <div className="brand">
          <span className="logo">⌨</span>
          <span>Omakey <b>Layout Studio</b></span>
        </div>

        <div className="group">
          <div className="menu">
            <button type="button" onClick={() => setNewOpen(!newOpen)}>New ▾</button>
            {newOpen && (
              <div className="menu-pop" onPointerLeave={() => setNewOpen(false)}>
                <button type="button" onClick={() => { load(cloneLayout(CLASSIC_QWERTY), "Started from Classic QWERTY. Undo brings back your old layout."); setNewOpen(false); }}>
                  From Classic QWERTY
                </button>
                <button type="button" onClick={() => { load(blankLayout(), "Blank layout. Undo brings back your old layout."); setNewOpen(false); }}>
                  Blank
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setImportOpen(true)}>Import</button>
          <button type="button" onClick={exportJson}>Export</button>
        </div>

        <div className="group">
          <button type="button" title="Undo (Ctrl+Z)" disabled={!history.past.length} onClick={() => dispatch({ type: "undo" })}>↶</button>
          <button type="button" title="Redo (Ctrl+Shift+Z)" disabled={!history.future.length} onClick={() => dispatch({ type: "redo" })}>↷</button>
        </div>

        <div className="group">
          <button type="button" title="Add key (A)" onClick={addKey}>+ Key</button>
          <button type="button" title="Duplicate (Ctrl+D)" disabled={!selected.length} onClick={duplicate}>Duplicate</button>
          <button type="button" title="Delete (Del)" disabled={!selected.length} onClick={remove}>Delete</button>
        </div>

        <div className="group">
          <label className="check">
            <input type="checkbox" checked={prefs.snapOn} onChange={(e) => setPrefs({ ...prefs, snapOn: e.target.checked })} />
            Snap 0.25u
          </label>
          <button type="button" title="Zoom out" onClick={() => setZoom((z) => Math.max(12, Math.round(z / 1.2)))}>−</button>
          <button type="button" title="Zoom to fit" onClick={zoomToFit}>Fit</button>
          <button type="button" title="Zoom in" onClick={() => setZoom((z) => Math.min(160, Math.round(z * 1.2)))}>+</button>
        </div>

        <div className="group layers" role="tablist" aria-label="Layer preview">
          <span className="muted">Layer</span>
          {["", ...layers].map((name) => (
            <button key={name || "base"} type="button" className={layer === name ? "active" : ""} onClick={() => setLayer(name)}>
              {name || "base"}
            </button>
          ))}
        </div>
      </header>

      <main className="workspace">
        <section className="stage">
          <div className="stage-title">
            <span>{layout.name || "Untitled"}</span>
            <span className="muted">
              {layout.width}×{layout.height}u · {layout.keys.length} keys
              {layer && <> · previewing <b>{layer}</b> layer</>}
            </span>
          </div>
          <Canvas
            ref={scrollRef}
            layout={layout}
            layer={layer}
            zoom={zoom}
            snapOn={prefs.snapOn}
            selected={selected}
            invalid={invalid}
            onSelect={(s) => { setSelected(s); if (s.length) setTab("key"); }}
            onApply={apply}
          />
        </section>

        <aside className="sidebar">
          <nav className="tabs">
            {(["key", "layout", "share", "check"] as Tab[]).map((t) => (
              <button key={t} type="button" className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                {t === "check" ? (
                  <>Check {errorCount ? <span className="badge err">{errorCount}</span> : issues.length ? <span className="badge warn">{issues.length}</span> : <span className="badge ok">✓</span>}</>
                ) : (
                  t[0].toUpperCase() + t.slice(1)
                )}
              </button>
            ))}
          </nav>
          <div className="panel">
            {tab === "key" && (
              <Inspector layout={layout} selected={selected} onApply={apply} onDuplicate={duplicate} onDelete={remove} onAdd={addKey} />
            )}
            {tab === "layout" && (
              <LayoutPanel
                layout={layout}
                autoFit={prefs.autoFit}
                onAutoFit={(autoFit) => { setPrefs({ ...prefs, autoFit }); if (autoFit) dispatch({ type: "apply", fn: fitToKeys }); }}
                onApply={apply}
              />
            )}
            {tab === "share" && <SharePanel layout={cleaned} layer={layer} valid={!errorCount} onExport={exportJson} />}
            {tab === "check" && <IssuesPanel issues={issues} onSelectKey={(i) => { setSelected([i]); setTab("key"); }} />}
          </div>
        </aside>
      </main>

      {importOpen && <ImportDialog onImport={importText} onClose={() => setImportOpen(false)} />}
      {dragOver && <div className="dropzone">Drop a layout .json to import it</div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
