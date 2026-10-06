import { useRef, useState } from "react";

interface Props {
  onImport: (text: string) => Promise<string | undefined>;
  onClose: () => void;
}

export function ImportDialog({ onImport, onClose }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);

  async function run(t: string) {
    const err = await onImport(t);
    if (err) setError(err);
    else onClose();
  }

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Import layout" onKeyDown={(e) => e.key === "Escape" && onClose()}>
        <h3>Import layout</h3>
        <p className="hint">Paste layout JSON, an <code>omakey://layout</code> link or a studio link. You can also drop a .json file anywhere on the page.</p>
        <textarea autoFocus rows={10} value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} placeholder='{"format": "omakey-layout", …}' />
        {error && <p className="error-text">{error}</p>}
        <div className="row end">
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) run(await f.text());
              e.target.value = "";
            }}
          />
          <button type="button" onClick={() => file.current?.click()}>Choose file…</button>
          <span className="spacer" />
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary" disabled={!text.trim()} onClick={() => run(text)}>Import</button>
        </div>
      </div>
    </div>
  );
}
