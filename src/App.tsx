import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Canvas, MARGIN_UNITS } from "./components/Canvas";
import { CommitProbe, EditorBoundary } from "./components/ErrorBoundary";
import { ImportDialog } from "./components/ImportDialog";
import { Inspector } from "./components/Inspector";
import { IssuesPanel } from "./components/IssuesPanel";
import { LayoutPanel } from "./components/LayoutPanel";
import { PresetDialog } from "./components/PresetDialog";
import { SharePanel } from "./components/SharePanel";
import { alignKeys, distributeKeys, type AlignMode, type DistributeAxis } from "./lib/align";
import { pasteKeys, parseKeys, serializeKeys } from "./lib/clipboard";
import { historyReducer, initHistory, MERGE_IDLE_MS, type History, type HistoryAction } from "./lib/history";
import {
  bounds, cleanLayout, CLASSIC_QWERTY, cloneLayout, moveKey, fitToKeys, layerNames, newKey, round, snap, STEP, uniqueId,
} from "./lib/layout";
import { normalizeLayout } from "./lib/normalize";
import { decodePayload, extractPayload, HASH_PREFIX, PayloadTooLargeError } from "./lib/share";
import { loadPrefs, loadSaved, save, savePrefs } from "./lib/storage";
import { LIMITS, type Layout } from "./lib/types";
import { hasErrors, validateLayout } from "./lib/validate";

type Tab = "key" | "layout" | "share" | "check";
const TABS: Tab[] = ["key", "layout", "share", "check"];

/** Arrow keys, Home and End move between the tabs of a tablist and focus the new tab. */
function tabArrows<T>(e: React.KeyboardEvent, all: T[], current: T, pick: (t: T) => void) {
  const i = all.indexOf(current);
  const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  e.stopPropagation();
  const n = (to + all.length) % all.length;
  pick(all[n]);
  const tabs = (e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')) ?? [];
  tabs[n]?.focus();
}

function initialLayout(): Layout {
  return normalizeLayout(loadSaved())?.value ?? cloneLayout(CLASSIC_QWERTY);
}

const ALIGN_TOOLS: { mode: AlignMode; icon: string; title: string }[] = [
  { mode: "left", icon: "⇤", title: "Align left edges" },
  { mode: "hcenter", icon: "↔", title: "Align horizontal centres" },
  { mode: "right", icon: "⇥", title: "Align right edges" },
  { mode: "top", icon: "⤒", title: "Align top edges" },
  { mode: "vcenter", icon: "↕", title: "Align vertical centres" },
  { mode: "bottom", icon: "⤓", title: "Align bottom edges" },
];

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
  /** What normalisation had to change in the last imported layout, shown in Check. */
  const [importFixes, setImportFixes] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  /** The last layout the editor rendered without crashing. */
  const lastGood = useRef<Layout>(layout);

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
    (fn: (l: Layout) => Layout, merge?: string, mergeWindow?: number) =>
      dispatch({
        type: "apply", fn: (l) => { const n = fn(l); return prefs.autoFit && n !== l ? fitToKeys(n) : n; },
        merge, window: mergeWindow, at: Date.now(),
      }),
    [prefs.autoFit],
  );

  const load = useCallback((value: Layout, message?: string, fixes: string[] = []) => {
    dispatch({ type: "reset", value });
    setSelected([]);
    setLayer("");
    setImportFixes(fixes);
    setFitToken((t) => t + 1);
    if (message) say(message);
  }, [say]);

  const importText = useCallback(async (text: string): Promise<string | undefined> => {
    if (new TextEncoder().encode(text).length > LIMITS.maxFileBytes) return "That file is over 256 KB; layouts are limited to 256 KB.";
    let raw: unknown;
    try {
      const payload = extractPayload(text);
      raw = payload ? await decodePayload(payload) : JSON.parse(text);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return `${e.message} Layouts are limited to 256 KB.`;
      return "That isn't layout JSON or a layout link.";
    }
    // Repair what would crash the editor; the validator still reports the rest.
    const n = normalizeLayout(raw);
    if (!n) return "That JSON isn't an Omakey layout (it has no \"keys\" list).";
    const bad = hasErrors(validateLayout(raw));
    load(n.value, bad ? "Imported with errors — see Check" : `Imported “${n.value.name || "layout"}”`, n.fixes);
    if (bad) setTab("check");
    return undefined;
  }, [load]);

  // Reopen a layout shared as a studio link, then drop the hash so a
  // refresh shows your edits instead of the original link.
  useEffect(() => {
    if (window.location.hash.startsWith(HASH_PREFIX) || /[#&]layout=/.test(window.location.hash)) {
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
        return { ...moveKey(structuredClone(k), b.width - minX, 0), id };
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

  const nudge = useCallback((dx: number, dy: number, merge: string, mergeWindow?: number) => {
    apply((l) => {
      const picked = selected.map((i) => l.keys[i]).filter(Boolean);
      if (!picked.length) return l;
      const ddx = Math.max(dx, -Math.min(...picked.map((k) => k.x)));
      const ddy = Math.max(dy, -Math.min(...picked.map((k) => k.y)));
      const q = (v: number) => (prefs.snapOn && Math.abs(dx + dy) >= STEP ? snap(v) : round(v));
      return { ...l, keys: l.keys.map((k, i) => (selected.includes(i) ? moveKey(k, q(k.x + ddx) - k.x, q(k.y + ddy) - k.y) : k)) };
    }, merge, mergeWindow);
  }, [apply, selected, prefs.snapOn]);

  const align = useCallback((mode: AlignMode) => {
    apply((l) => alignKeys(l, selected, mode, prefs.snapOn ? STEP : 0));
  }, [apply, selected, prefs.snapOn]);

  const distribute = useCallback((axis: DistributeAxis) => {
    apply((l) => distributeKeys(l, selected, axis, prefs.snapOn ? STEP : 0));
  }, [apply, selected, prefs.snapOn]);

  // Copy, cut and paste keys through the system clipboard. The DOM clipboard
  // events need no permission prompt, and the JSON works across tabs.
  useEffect(() => {
    const ours = (e: ClipboardEvent) => {
      if (importOpen || newOpen || isTyping(e.target) || isTyping(document.activeElement)) return false;
      const sel = window.getSelection();
      return !(sel && !sel.isCollapsed && sel.toString().trim()); // let page text be copied as usual
    };
    const onCopy = (e: ClipboardEvent) => {
      if (!ours(e) || !selected.length || !e.clipboardData) return;
      const keys = selected.map((i) => layout.keys[i]).filter(Boolean);
      e.clipboardData.setData("text/plain", serializeKeys(keys));
      e.preventDefault();
      if (e.type === "cut") {
        apply((l) => ({ ...l, keys: l.keys.filter((_, i) => !selected.includes(i)) }));
        setSelected([]);
        say(`Cut ${keys.length} key${keys.length > 1 ? "s" : ""}`);
      } else {
        say(`Copied ${keys.length} key${keys.length > 1 ? "s" : ""}`);
      }
    };
    const onPaste = (e: ClipboardEvent) => {
      if (!ours(e) || !e.clipboardData) return;
      const keys = parseKeys(e.clipboardData.getData("text/plain"));
      if (!keys) {
        say("The clipboard has no Omakey keys to paste.");
        return;
      }
      e.preventDefault();
      const room = LIMITS.maxKeys - layout.keys.length;
      if (room <= 0) {
        say(`A layout may have at most ${LIMITS.maxKeys} keys.`);
        return;
      }
      const picked = keys.slice(0, room);
      const { indices } = pasteKeys(layout, picked);
      apply((l) => pasteKeys(l, picked).layout);
      setSelected(indices);
      setTab("key");
      say(`Pasted ${picked.length} key${picked.length > 1 ? "s" : ""}${picked.length < keys.length ? ` (${keys.length - picked.length} over the limit left out)` : ""}`);
    };
    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCopy);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCopy);
      window.removeEventListener("paste", onPaste);
    };
  }, [apply, importOpen, newOpen, layout, say, selected]);

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
      if (e.defaultPrevented || isTyping(e.target) || importOpen || newOpen) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); dispatch({ type: e.shiftKey ? "redo" : "undo" }); return; }
      if (mod && k === "y") { e.preventDefault(); dispatch({ type: "redo" }); return; }
      if (mod && k === "a") { e.preventDefault(); setSelected(layout.keys.map((_, i) => i)); return; }
      if (mod && k === "d") { e.preventDefault(); duplicate(); return; }
      if (mod) return;
      if (k === "escape") { if (newOpen) setNewOpen(false); else setSelected([]); }
      else if (k === "delete" || k === "backspace") { e.preventDefault(); remove(); }
      else if (k === "a") addKey();
      else if (k.startsWith("arrow") && selected.length) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : prefs.snapOn ? STEP : 0.05;
        const [dx, dy] = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k] ?? [0, 0];
        // A pause or a long run of nudges starts a new undo step.
        nudge(dx, dy, `nudge-${selected.join(",")}`, MERGE_IDLE_MS);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addKey, duplicate, remove, nudge, selected, layout.keys, prefs.snapOn, importOpen, newOpen]);

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
          <button type="button" aria-haspopup="dialog" aria-expanded={newOpen} onClick={() => setNewOpen(true)}>New / Presets</button>
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

        <div className="group align" role="group" aria-label="Align and distribute">
          {ALIGN_TOOLS.map((t) => (
            <button key={t.mode} type="button" title={t.title} aria-label={t.title} disabled={selected.length < 2} onClick={() => align(t.mode)}>
              {t.icon}
            </button>
          ))}
          <button type="button" title="Distribute horizontally: equal gaps" aria-label="Distribute horizontally" disabled={selected.length < 3} onClick={() => distribute("x")}>
            ⋯
          </button>
          <button type="button" title="Distribute vertically: equal gaps" aria-label="Distribute vertically" disabled={selected.length < 3} onClick={() => distribute("y")}>
            ⋮
          </button>
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
            <button
              key={name || "base"}
              type="button"
              role="tab"
              aria-selected={layer === name}
              tabIndex={layer === name ? 0 : -1}
              className={layer === name ? "active" : ""}
              onClick={() => setLayer(name)}
              onKeyDown={(e) => tabArrows(e, ["", ...layers], name, setLayer)}
            >
              {name || "base"}
            </button>
          ))}
        </div>
      </header>

      <main className="workspace">
        <EditorBoundary
          onReset={() => { dispatch({ type: "reset", value: lastGood.current === layout ? cloneLayout(CLASSIC_QWERTY) : lastGood.current }); setSelected([]); setLayer(""); }}
          onUndo={() => dispatch({ type: "undo" })}
          canUndo={history.past.length > 0}
        >
        <CommitProbe onGood={() => { lastGood.current = layout; }} />
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
          <nav className="tabs" role="tablist" aria-label="Sidebar">
            {TABS.map((t) => (
              <button
                key={t}
                id={`tab-${t}`}
                type="button"
                role="tab"
                aria-selected={tab === t}
                aria-controls="sidebar-panel"
                tabIndex={tab === t ? 0 : -1}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
                onKeyDown={(e) => tabArrows(e, TABS, t, setTab)}
              >
                {t === "check" ? (
                  <>Check {errorCount ? <span className="badge err">{errorCount}</span> : issues.length + importFixes.length ? <span className="badge warn">{issues.length + importFixes.length}</span> : <span className="badge ok">✓</span>}</>
                ) : (
                  t[0].toUpperCase() + t.slice(1)
                )}
              </button>
            ))}
          </nav>
          <div className="panel" id="sidebar-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
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
            {tab === "check" && (
              <IssuesPanel issues={issues} fixes={importFixes} onDismissFixes={() => setImportFixes([])} onSelectKey={(i) => { setSelected([i]); setTab("key"); }} />
            )}
          </div>
        </aside>
        </EditorBoundary>
      </main>

      {importOpen && <ImportDialog onImport={importText} onClose={() => setImportOpen(false)} />}
      {newOpen && <PresetDialog onClose={() => setNewOpen(false)} onPick={(preset) => {
        load(preset, `Started from ${preset.name}. Undo brings back your old layout.`);
        setNewOpen(false);
      }} />}
      {dragOver && <div className="dropzone">Drop a layout .json to import it</div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
