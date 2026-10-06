import { useEffect, useMemo, useRef, useState } from "react";
import { linuxKeyFromDomCode } from "../lib/domCodes";
import { GROUP_ORDER, KEYCODE_BY_NAME, searchKeycodes, type KeyCode } from "../lib/keycodes";

interface Props {
  value: string | undefined;
  onChange: (name: string | undefined) => void;
  /** Offer a "none" entry (used by layer overrides to disable a key). */
  allowNone?: string;
}

export function KeyPicker({ value, onChange, allowNone }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const current = value ? KEYCODE_BY_NAME.get(value) : undefined;

  const groups = useMemo(() => {
    const byGroup = new Map<string, KeyCode[]>();
    for (const k of searchKeycodes(query)) {
      const g = GROUP_ORDER.includes(k.group) ? k.group : "misc";
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(k);
    }
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => [g, byGroup.get(g)!] as const);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setListening(false);
      }
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const name = linuxKeyFromDomCode(e.code);
      if (name && KEYCODE_BY_NAME.has(name)) {
        onChange(name);
        setListening(false);
        setOpen(false);
        setHint("");
      } else {
        setHint(`"${e.code || e.key}" has no Linux key code here. Pick it from the list.`);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening, onChange]);

  function choose(name: string | undefined) {
    onChange(name);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="picker" ref={root}>
      <button type="button" className="picker-button" onClick={() => setOpen(!open)}>
        {current ? (
          <>
            <span className="kbd">{current.label}</span>
            <span className="muted">{current.name}</span>
          </>
        ) : value ? (
          <span className="error-text">{value} (unknown)</span>
        ) : (
          <span className="muted">{allowNone ?? "Choose a key…"}</span>
        )}
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="picker-pop" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          <div className="picker-head">
            <input
              autoFocus
              type="search"
              placeholder="Search: ctrl, f5, volume, 125…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className={listening ? "active" : ""}
              onClick={() => {
                setListening(!listening);
                setHint("");
              }}
              title="Press a key on your physical keyboard to pick it"
            >
              {listening ? "Press a key…" : "⌨ Press key"}
            </button>
          </div>
          {hint && <div className="picker-hint">{hint}</div>}
          <div className="picker-list">
            {allowNone && !query && (
              <button type="button" className="picker-item" onClick={() => choose(undefined)}>
                <span className="kbd">∅</span>
                <span>{allowNone}</span>
              </button>
            )}
            {groups.map(([group, keys]) => (
              <div key={group}>
                <div className="picker-group">{group}</div>
                {keys.map((k) => (
                  <button
                    type="button"
                    key={k.name}
                    className={"picker-item" + (k.name === value ? " current" : "")}
                    onClick={() => choose(k.name)}
                  >
                    <span className="kbd">{k.label}</span>
                    <span>{k.name}</span>
                    <span className="muted code">{k.code}</span>
                  </button>
                ))}
              </div>
            ))}
            {!groups.length && <div className="picker-hint">No key matches “{query}”.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
