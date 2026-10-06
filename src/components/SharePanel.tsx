import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { appLink, encodeLayout, studioLink } from "../lib/share";
import type { Layout } from "../lib/types";
import { PhonePreview } from "./PhonePreview";

interface Props {
  layout: Layout;
  layer: string;
  valid: boolean;
  onExport: () => void;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function SharePanel({ layout, layer, valid, onExport }: Props) {
  const [payload, setPayload] = useState("");
  const [qr, setQr] = useState<{ svg?: string; error?: string }>({});
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const p = await encodeLayout(layout);
      if (cancelled) return;
      setPayload(p);
      try {
        const svg = await QRCode.toString(appLink(p), { type: "svg", errorCorrectionLevel: "L", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
        if (!cancelled) setQr({ svg });
      } catch {
        if (!cancelled) setQr({ error: "Too large for a QR code. Share the link or the file instead." });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [layout]);

  const app = payload ? appLink(payload) : "";
  const web = payload ? studioLink(payload, window.location.href) : "";
  const jsonBytes = new TextEncoder().encode(JSON.stringify(layout)).length;

  async function copy(what: string, text: string) {
    if (await copyText(text)) {
      setCopied(what);
      setTimeout(() => setCopied(""), 1500);
    }
  }

  return (
    <div className="inspector">
      <h3>Phone preview</h3>
      <PhonePreview layout={layout} layer={layer} />

      <h3>Share</h3>
      {!valid && <p className="error-text">This layout has errors; the phone app will refuse it. See Check.</p>}
      <button type="button" className="primary wide" onClick={onExport}>Download {layout.id || "layout"}.json</button>

      <div className="field">
        <span>Phone link (opens the Omakey app)</span>
        <div className="copyrow">
          <input readOnly value={app} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => copy("app", app)}>{copied === "app" ? "Copied" : "Copy"}</button>
        </div>
      </div>
      <div className="field">
        <span>Studio link (reopens it here)</span>
        <div className="copyrow">
          <input readOnly value={web} onFocus={(e) => e.target.select()} />
          <button type="button" onClick={() => copy("web", web)}>{copied === "web" ? "Copied" : "Copy"}</button>
        </div>
      </div>
      <p className="hint">
        {jsonBytes.toLocaleString()} bytes of JSON → {app.length.toLocaleString()} character link.
        {app && <> On the phone, <a href={app}>open in Omakey</a>.</>}
      </p>

      {qr.svg && (
        <>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qr.svg }} />
          <p className="hint">
            Scan with the phone camera.
            {app.length > 1200 && " It's a dense code: zoom the page in and hold the phone steady."}
          </p>
        </>
      )}
      {qr.error && <p className="hint">{qr.error}</p>}
    </div>
  );
}
