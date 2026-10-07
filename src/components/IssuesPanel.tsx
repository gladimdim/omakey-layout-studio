import type { Issue } from "../lib/validate";

interface Props {
  issues: Issue[];
  /** What the studio repaired when it imported the layout (wrong types, missing fields). */
  fixes?: string[];
  onDismissFixes?: () => void;
  onSelectKey: (index: number) => void;
}

export function IssuesPanel({ issues, fixes = [], onDismissFixes, onSelectKey }: Props) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return (
    <div className="inspector">
      <h3>Check</h3>
      {!issues.length && !fixes.length && <p className="ok">✓ Valid layout. Ready for the phone.</p>}
      {errors.length > 0 && <p className="error-text">{errors.length} error{errors.length > 1 ? "s" : ""}: the app will refuse this layout until they are fixed.</p>}
      <ul className="issues">
        {[...errors, ...warnings].map((issue, n) => (
          <li key={n} className={issue.severity}>
            <span className="sev">{issue.severity === "error" ? "✕" : "!"}</span>
            {issue.keyIndex !== undefined ? (
              <button type="button" className="link" onClick={() => onSelectKey(issue.keyIndex!)}>
                {issue.message}
              </button>
            ) : (
              <span>{issue.message}</span>
            )}
          </li>
        ))}
      </ul>
      {fixes.length > 0 && (
        <>
          <h4>Repaired on import</h4>
          <p className="hint">
            The imported file had {fixes.length} problem{fixes.length > 1 ? "s" : ""} the editor couldn’t display as they were.
            They are fixed in the editor; the original file would be refused by the app.{" "}
            {onDismissFixes && <button type="button" className="link" onClick={onDismissFixes}>Dismiss</button>}
          </p>
          <ul className="issues">
            {fixes.map((f, n) => (
              <li key={n} className="error">
                <span className="sev">✕</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
