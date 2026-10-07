import { describe, expect, it } from "vitest";
import { historyReducer, initHistory, MAX_MERGED, MERGE_IDLE_MS } from "../lib/history";

describe("history", () => {
  it("merges edits with the same merge key into one undo step", () => {
    let h = initHistory(0);
    h = historyReducer(h, { type: "apply", fn: (v) => v + 1, merge: "drag-1" });
    h = historyReducer(h, { type: "apply", fn: (v) => v + 1, merge: "drag-1" });
    h = historyReducer(h, { type: "apply", fn: (v) => v + 1, merge: "drag-2" });
    expect(h.present).toBe(3);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toBe(2);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toBe(0);
    h = historyReducer(h, { type: "redo" });
    expect(h.present).toBe(2);
  });

  it("starts a new step after a seal", () => {
    let h = initHistory(0);
    h = historyReducer(h, { type: "apply", fn: (v) => v + 1, merge: "f" });
    h = historyReducer(h, { type: "seal" });
    h = historyReducer(h, { type: "apply", fn: (v) => v + 1, merge: "f" });
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toBe(1);
  });

  it("breaks a windowed merge group after an idle gap", () => {
    let h = initHistory(0);
    const nudge = (at: number) => { h = historyReducer(h, { type: "apply", fn: (v) => v + 1, merge: "nudge-1", at, window: MERGE_IDLE_MS }); };
    nudge(1000);
    nudge(1200);
    nudge(1700); // 500 ms later: same step
    nudge(1700 + MERGE_IDLE_MS + 1); // a pause: new step
    expect(h.present).toBe(4);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toBe(3);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toBe(0);
  });

  it("caps a windowed merge group at MAX_MERGED edits", () => {
    let h = initHistory(0);
    for (let n = 0; n < MAX_MERGED * 2 + 1; n++) {
      h = historyReducer(h, { type: "apply", fn: (v) => v + 1, merge: "nudge-1", at: n * 30, window: MERGE_IDLE_MS });
    }
    expect(h.past).toHaveLength(3);
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toBe(MAX_MERGED * 2);
  });

  it("doesn't time out merges without a window (a slow drag stays one step)", () => {
    let h = initHistory(0);
    h = historyReducer(h, { type: "apply", fn: (v) => v + 1, merge: "drag-1", at: 0 });
    h = historyReducer(h, { type: "apply", fn: (v) => v + 1, merge: "drag-1", at: 60_000 });
    expect(h.past).toHaveLength(1);
  });
});
