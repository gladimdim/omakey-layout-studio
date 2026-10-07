import { describe, expect, it } from "vitest";
import { pasteKeys, parseKeys, PASTE_OFFSET, serializeKeys } from "../lib/clipboard";
import { CLASSIC_QWERTY, cloneLayout } from "../lib/layout";
import { validateLayout } from "../lib/validate";

describe("copy and paste keys", () => {
  const l = cloneLayout(CLASSIC_QWERTY);
  const picked = [l.keys[0], l.keys[1], l.keys[2]];

  it("round-trips keys through clipboard JSON", () => {
    expect(parseKeys(serializeKeys(picked))).toEqual(picked);
  });

  it("gives pasted keys fresh ids unique in the layout and among themselves", () => {
    const once = pasteKeys(l, parseKeys(serializeKeys(picked))!);
    const twice = pasteKeys(once.layout, parseKeys(serializeKeys(picked))!);
    const ids = twice.layout.keys.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateLayout(twice.layout).filter((i) => i.message.includes("duplicate"))).toEqual([]);
    expect(twice.indices).toEqual([l.keys.length + 3, l.keys.length + 4, l.keys.length + 5]);
    // Two copies of a key with the same id in one paste still get distinct ids.
    const dup = pasteKeys(l, [picked[0], picked[0]]);
    expect(new Set(dup.layout.keys.map((k) => k.id)).size).toBe(l.keys.length + 2);
  });

  it("offsets pasted keys so they never sit exactly on existing ones", () => {
    const once = pasteKeys(l, picked);
    const p = once.layout.keys[once.indices[0]];
    expect([p.x, p.y]).toEqual([picked[0].x + PASTE_OFFSET, picked[0].y + PASTE_OFFSET]);
    // Pasting again moves further, past every exact match (Classic's "1" key sits at 1,1).
    const twice = pasteKeys(once.layout, picked);
    const q = twice.layout.keys[twice.indices[0]];
    expect(q.x).toBeGreaterThan(p.x);
    const rect = (key: { x: number; y: number; w: number; h: number }) => `${key.x},${key.y},${key.w},${key.h}`;
    const existing = new Set(once.layout.keys.map(rect));
    expect(twice.indices.map((i) => rect(twice.layout.keys[i])).filter((r) => existing.has(r))).toEqual([]);
    // Into a layout where the spot is free, keys keep their position.
    const empty = { ...l, keys: [l.keys[40]] };
    const r = pasteKeys(empty, [picked[0]]);
    expect(r.layout.keys[1].x).toBe(picked[0].x);
  });

  it("moves shaped keys' parts along with the offset", () => {
    const shaped = { id: "e", x: 1, y: 1, w: 1, h: 1, label: "E", code: "KEY_ENTER", parts: [{ x: 1, y: 2, w: 2, h: 1 }] };
    const r = pasteKeys({ ...l, keys: [shaped] }, [shaped]);
    expect(r.layout.keys[1].parts).toEqual([{ x: 1.5, y: 2.5, w: 2, h: 1 }]);
  });

  it("reads layouts, key lists and single keys, and ignores other text", () => {
    expect(parseKeys(JSON.stringify(l))).toHaveLength(l.keys.length);
    expect(parseKeys(JSON.stringify([picked[0]]))).toHaveLength(1);
    expect(parseKeys(JSON.stringify(picked[0]))).toHaveLength(1);
    expect(parseKeys("hello")).toBeUndefined();
    expect(parseKeys('{"a":1}')).toBeUndefined();
    expect(parseKeys("[1,2]")).toBeUndefined();
    // Malformed keys are repaired, not crashed on.
    expect(parseKeys('[{"x":1,"label":null,"parts":"x"}]')![0].label).toBe("");
  });
});
