import table from "../../spec/keycodes.json";

export interface KeyCode {
  name: string;
  code: number;
  label: string;
  group: string;
}

export const KEYCODES: KeyCode[] = table.keys;

export const KEYCODE_BY_NAME: ReadonlyMap<string, KeyCode> = new Map(
  KEYCODES.map((k) => [k.name, k]),
);

// Display order for the key picker; anything else falls under "misc".
export const GROUP_ORDER = [
  "letters",
  "digits",
  "punctuation",
  "modifiers",
  "function",
  "navigation",
  "editing",
  "numpad",
  "media",
  "system",
  "international",
  "misc",
];

export function isKnownCode(name: string): boolean {
  return KEYCODE_BY_NAME.has(name);
}

export function defaultLabel(name: string): string {
  return KEYCODE_BY_NAME.get(name)?.label ?? name.replace(/^KEY_/, "");
}

export function searchKeycodes(query: string): KeyCode[] {
  const q = query.trim().toLowerCase();
  if (!q) return KEYCODES;
  return KEYCODES.filter(
    (k) =>
      k.name.toLowerCase().includes(q) ||
      k.label.toLowerCase().includes(q) ||
      k.group.includes(q) ||
      String(k.code) === q,
  );
}
