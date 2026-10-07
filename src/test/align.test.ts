import { describe, expect, it } from "vitest";
import { alignKeys, distributeKeys } from "../lib/align";
import type { Layout, LayoutKey } from "../lib/types";

const k = (id: string, x: number, y: number, w = 1, h = 1, extra: Partial<LayoutKey> = {}): LayoutKey =>
  ({ id, x, y, w, h, label: id, code: "KEY_A", ...extra });
const layout = (keys: LayoutKey[]): Layout => ({ format: "omakey-layout", version: 1, id: "t", name: "t", width: 20, height: 20, keys });
const pos = (l: Layout) => l.keys.map((key) => [key.x, key.y]);

describe("align", () => {
  const l = layout([k("a", 1, 1), k("b", 3.3, 2, 2), k("c", 6, 4, 1, 2), k("other", 0, 9)]);
  const sel = [0, 1, 2];

  it("aligns edges to the selection's extreme edge", () => {
    expect(pos(alignKeys(l, sel, "left")).slice(0, 3)).toEqual([[1, 1], [1, 2], [1, 4]]);
    expect(pos(alignKeys(l, sel, "right")).slice(0, 3)).toEqual([[6, 1], [5, 2], [6, 4]]);
    expect(pos(alignKeys(l, sel, "top")).slice(0, 3)).toEqual([[1, 1], [3.3, 1], [6, 1]]);
    expect(pos(alignKeys(l, sel, "bottom")).slice(0, 3)).toEqual([[1, 5], [3.3, 5], [6, 4]]);
  });

  it("aligns centres", () => {
    // Selection spans x 1..7, centre 4.
    expect(pos(alignKeys(l, sel, "hcenter")).slice(0, 3)).toEqual([[3.5, 1], [3, 2], [3.5, 4]]);
    // y 1..6, centre 3.5.
    expect(pos(alignKeys(l, sel, "vcenter")).slice(0, 3)).toEqual([[1, 3], [3.3, 3], [6, 2.5]]);
  });

  it("snaps the result to the grid step", () => {
    const m = layout([k("a", 1.1, 0), k("b", 3, 0.6, 1.3)]);
    expect(pos(alignKeys(m, [0, 1], "left", 0.25))).toEqual([[1, 0], [1, 0.6]]);
    expect(pos(alignKeys(m, [0, 1], "right", 0.25))[0]).toEqual([3.25, 0]);
  });

  it("leaves unselected keys alone and needs two keys", () => {
    expect(alignKeys(l, sel, "left").keys[3]).toBe(l.keys[3]);
    expect(alignKeys(l, [0], "left")).toBe(l);
  });

  it("uses a shaped key's whole outline and moves its parts", () => {
    const m = layout([k("a", 2, 0), k("e", 3, 2, 1, 1, { parts: [{ x: 1, y: 3, w: 3, h: 1 }] })]);
    const out = alignKeys(m, [0, 1], "left");
    // e's outline starts at x 1 (its part), so a moves to 1 and e stays.
    expect(out.keys[0].x).toBe(1);
    expect(out.keys[1]).toBe(m.keys[1]);
    const right = alignKeys(m, [0, 1], "right");
    expect(right.keys[0].x).toBe(3);
  });
});

describe("distribute", () => {
  it("makes the gaps between neighbours equal, keeping the ends", () => {
    const l = layout([k("a", 0, 0), k("b", 1.5, 0, 2), k("c", 7, 0), k("d", 4, 3)]);
    const out = distributeKeys(l, [2, 0, 1, 3], "x");
    // Span 0..8, widths 1+2+1+1 = 5, so 3 gaps of 1: a 0, b 2, d 5, c 7.
    expect(out.keys.map((key) => key.x)).toEqual([0, 2, 7, 5]);
    expect(out.keys.map((key) => key.y)).toEqual([0, 0, 0, 3]);
  });

  it("distributes vertically and snaps", () => {
    const l = layout([k("a", 0, 0), k("b", 0, 1.1), k("c", 0, 5)]);
    expect(distributeKeys(l, [0, 1, 2], "y").keys[1].y).toBe(2.5);
    const m = layout([k("a", 0, 0), k("b", 0, 1.1), k("c", 0, 4.3)]);
    expect(distributeKeys(m, [0, 1, 2], "y").keys[1].y).toBe(2.15);
    expect(distributeKeys(m, [0, 1, 2], "y", 0.25).keys[1].y).toBe(2.25);
  });

  it("needs three keys", () => {
    const l = layout([k("a", 0, 0), k("b", 5, 0)]);
    expect(distributeKeys(l, [0, 1], "x")).toBe(l);
  });
});
