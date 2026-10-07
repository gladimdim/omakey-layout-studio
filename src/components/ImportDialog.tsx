import { useRef, useState } from "react";
import { Modal } from "./Modal";

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
    <Modal title="Import layout" onClose={onClose}>
      <p className="hint">Paste layout JSON, an <code>omakey://layout</code> link or a studio link. You can also drop a .json file anywhere on the page.</p>
      <textarea autoFocus aria-label="Layout JSON or link" rows={10} value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} placeholder='{"format": "omakey-layout", …}' />
      {error && <p className="error-text" role="alert">{error}</p>}
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
    </Modal>
  );
}
