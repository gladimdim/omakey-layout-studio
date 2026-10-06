import { describe, expect, it } from "vitest";
import { historyReducer, initHistory } from "../lib/history";

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
});
