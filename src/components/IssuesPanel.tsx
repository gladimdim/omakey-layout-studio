import type { Issue } from "../lib/validate";

interface Props {
  issues: Issue[];
  onSelectKey: (index: number) => void;
}

export function IssuesPanel({ issues, onSelectKey }: Props) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  return (
    <div className="inspector">
      <h3>Check</h3>
      {!issues.length && <p className="ok">✓ Valid layout. Ready for the phone.</p>}
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
    </div>
  );
}
