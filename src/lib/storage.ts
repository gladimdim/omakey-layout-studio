// Per-browser autosave. Storage can be missing or throw (private windows,
// blocked site data), so every access is guarded and failure is harmless.

const KEY = "omakey-studio:layout";
const PREFS = "omakey-studio:prefs";

export function loadSaved(): unknown {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export function save(value: unknown): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadPrefs<T extends object>(defaults: T): T {
  try {
    const raw = localStorage.getItem(PREFS);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export function savePrefs(value: object): void {
  try {
    localStorage.setItem(PREFS, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
