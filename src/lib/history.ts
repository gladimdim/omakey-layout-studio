// Undo/redo. Consecutive edits with the same merge key (one drag gesture,
// typing into one field) collapse into a single undo step.
//
// An edit can also carry a merge window: then it only merges into the
// previous one if it came within `window` ms of it, and a group stops
// growing after MAX_MERGED edits. Arrow-key nudges use this, so a pause, or
// a long run of nudges, starts a new undo step even though no pointerup or
// focusout sealed the group.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  mergeKey?: string;
  /** Time (ms) of the last edit in the open merge group. */
  mergeAt?: number;
  /** Edits in the open merge group. */
  mergeCount?: number;
}

export type HistoryAction<T> =
  | { type: "apply"; fn: (prev: T) => T; merge?: string; at?: number; window?: number }
  | { type: "reset"; value: T }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "seal" };

const LIMIT = 200;
/** Idle gap that ends a windowed merge group (arrow-key nudges). */
export const MERGE_IDLE_MS = 600;
/** Largest number of windowed edits merged into one undo step. */
export const MAX_MERGED = 25;

function canMerge<T>(h: History<T>, a: Extract<HistoryAction<T>, { type: "apply" }>): boolean {
  if (!a.merge || a.merge !== h.mergeKey) return false;
  if (a.window === undefined) return true;
  const at = a.at ?? 0;
  return h.mergeAt !== undefined && at - h.mergeAt <= a.window && (h.mergeCount ?? 1) < MAX_MERGED;
}

export function historyReducer<T>(h: History<T>, a: HistoryAction<T>): History<T> {
  switch (a.type) {
    case "apply": {
      const next = a.fn(h.present);
      if (next === h.present) return h;
      if (canMerge(h, a)) {
        return { ...h, present: next, future: [], mergeAt: a.at, mergeCount: (h.mergeCount ?? 1) + 1 };
      }
      return {
        past: [...h.past, h.present].slice(-LIMIT), present: next, future: [],
        mergeKey: a.merge, mergeAt: a.at, mergeCount: 1,
      };
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
      return h.mergeKey === undefined ? h : { ...h, mergeKey: undefined, mergeAt: undefined, mergeCount: undefined };
  }
}

export function initHistory<T>(value: T): History<T> {
  return { past: [], present: value, future: [] };
}
