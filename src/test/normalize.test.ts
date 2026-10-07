import { describe, expect, it } from "vitest";
import { CLASSIC_QWERTY, cleanLayout, cloneLayout, keyOnLayer, keyRects, layerNames } from "../lib/layout";
import { normalizeLayout } from "../lib/normalize";
import { hasErrors, validateLayout } from "../lib/validate";

/** What the editor does with a layout on every render; none of it may throw. */
function renderPath(input: unknown) {
  const n = normalizeLayout(input);
  expect(n).toBeDefined();
  const l = n!.value;
  validateLayout(l);
  cleanLayout(l);
  layerNames(l);
  for (const k of l.keys) {
    expect(typeof k.label).toBe("string");
    [...keyOnLayer(k, "").label];
    for (const layer of layerNames(l)) [...keyOnLayer(k, layer).label];
    for (const r of keyRects(k)) for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isFinite(v)).toBe(true);
  }
  return n!;
}

const withKey = (patch: Record<string, unknown>) => {
  const l = cloneLayout(CLASSIC_QWERTY) as unknown as { keys: Record<string, unknown>[] };
  l.keys[0] = { ...l.keys[0], ...patch };
  return l;
};

describe("import normalisation", () => {
  it("leaves a valid layout alone", () => {
    const n = normalizeLayout(CLASSIC_QWERTY)!;
    expect(n.fixes).toEqual([]);
    expect(n.value).toEqual(CLASSIC_QWERTY);
  });

  it("rejects what isn't a layout at all", () => {
    expect(normalizeLayout(null)).toBeUndefined();
    expect(normalizeLayout([1, 2])).toBeUndefined();
    expect(normalizeLayout({ keys: "nope" })).toBeUndefined();
  });

  it("coerces a missing or non-string label, and the validator still reports it on the original", () => {
    for (const label of [undefined, 5, null, { a: 1 }, ["x"]]) {
      const raw = withKey({ label });
      expect(hasErrors(validateLayout(raw))).toBe(true);
      const n = renderPath(raw);
      expect(n.fixes.some((f) => f.includes('"label"'))).toBe(true);
    }
    expect(renderPath(withKey({ label: 5 })).value.keys[0].label).toBe("5");
    expect(renderPath(withKey({ label: null })).value.keys[0].label).toBe("");
  });

  it('drops "parts" that aren\'t a list and part entries that aren\'t rectangles', () => {
    expect(renderPath(withKey({ parts: "x" })).value.keys[0].parts).toBeUndefined();
    expect(renderPath(withKey({ parts: [null] })).value.keys[0].parts).toBeUndefined();
    const mixed = renderPath(withKey({ parts: [null, 3, { x: 1 }, { x: 0, y: 6, w: 1, h: 1 }, { x: "1", y: 0, w: 1, h: 1 }] }));
    expect(mixed.value.keys[0].parts).toEqual([{ x: 0, y: 6, w: 1, h: 1 }]);
    expect(mixed.fixes).toHaveLength(4);
  });

  it("keeps an empty parts list so the validator can still flag it", () => {
    const n = renderPath(withKey({ parts: [] }));
    expect(n.value.keys[0].parts).toEqual([]);
    expect(hasErrors(validateLayout(n.value))).toBe(true);
  });

  it("replaces numbers that aren't finite and clamps absurd ones", () => {
    const n = renderPath(withKey({ x: "3", y: null, w: Infinity, h: 1e9 }));
    const k = n.value.keys[0];
    expect([k.x, k.y, k.w, k.h]).toEqual([0, 0, 1, 64]);
    const l = renderPath({ ...CLASSIC_QWERTY, width: "wide", height: NaN }).value;
    expect(l.width).toBe(15);
    expect(l.height).toBeGreaterThan(0);
  });

  it("drops non-object keys, layers and layer entries, and non-string codes", () => {
    const raw = cloneLayout(CLASSIC_QWERTY) as unknown as { keys: unknown[] };
    raw.keys.push(null, 7, "key");
    const n = renderPath(raw);
    expect(n.value.keys).toHaveLength(CLASSIC_QWERTY.keys.length);
    expect(renderPath(withKey({ layers: "fn" })).value.keys[0].layers).toBeUndefined();
    const k = renderPath(withKey({ layers: { fn: null, nav: { code: 42, label: 7 }, sym: { code: null } } })).value.keys[0];
    expect(k.layers).toEqual({ nav: { label: "7" }, sym: {} });
    expect(renderPath(withKey({ code: 30 })).value.keys[0].code).toBeUndefined();
  });

  it("keeps type-correct spec violations for the validator to report", () => {
    const n = renderPath(withKey({ w: 0.1, label: "x".repeat(40), code: "KEY_NOPE", color: "red" }));
    expect(n.fixes).toEqual([]);
    const e = validateLayout(n.value).filter((i) => i.severity === "error").map((i) => i.message).join("\n");
    expect(e).toMatch(/"w"/);
    expect(e).toMatch(/label/);
    expect(e).toMatch(/KEY_NOPE/);
    expect(e).toMatch(/color/);
  });

  it("coerces non-string layout meta", () => {
    const n = renderPath({ ...CLASSIC_QWERTY, name: { x: 1 }, id: 3, author: ["me"], splitAt: "half" });
    expect(n.value.name).toBe("");
    expect(n.value.id).toBe("3");
    expect("author" in n.value).toBe(false);
    expect("splitAt" in n.value).toBe(false);
  });
});
