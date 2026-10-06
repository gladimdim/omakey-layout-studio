// Undo/redo. Consecutive edits with the same merge key (one drag gesture,
// typing into one field) collapse into a single undo step.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  mergeKey?: string;
}

export type HistoryAction<T> =
  | { type: "apply"; fn: (prev: T) => T; merge?: string }
  | { type: "reset"; value: T }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "seal" };

const LIMIT = 200;

export function historyReducer<T>(h: History<T>, a: HistoryAction<T>): History<T> {
  switch (a.type) {
    case "apply": {
      const next = a.fn(h.present);
      if (next === h.present) return h;
      if (a.merge && a.merge === h.mergeKey) return { ...h, present: next, future: [] };
      return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [], mergeKey: a.merge };
    }
    case "reset":
      // Loading a layout is undoable too.
      return { past: [...h.past, h.present].slice(-LIMIT), present: a.value, future: [] };
    case "undo": {
      if (!h.past.length) return h;
      return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
    }
    case "redo": {
      if (!h.future.length) return h;
      return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
    }
    case "seal":
      return h.mergeKey === undefined ? h : { ...h, mergeKey: undefined };
  }
}

export function initHistory<T>(value: T): History<T> {
  return { past: [], present: value, future: [] };
}
