import { describe, expect, it } from "vitest";
import { blankLayout, CLASSIC_QWERTY, cleanLayout, cloneLayout } from "../lib/layout";
import type { Layout } from "../lib/types";
import { hasErrors, validateLayout } from "../lib/validate";

const errors = (l: unknown) => validateLayout(l).filter((i) => i.severity === "error");

describe("validateLayout", () => {
  it("accepts the stock Classic QWERTY layout with no issues at all", () => {
    expect(validateLayout(CLASSIC_QWERTY)).toEqual([]);
  });

  it("accepts the blank starter layout", () => {
    expect(hasErrors(validateLayout(blankLayout()))).toBe(false);
  });

  it("keeps Classic QWERTY valid through cleanLayout", () => {
    expect(validateLayout(cleanLayout(CLASSIC_QWERTY))).toEqual([]);
  });

  it("rejects duplicate key ids and points at the second key", () => {
    const l = cloneLayout(CLASSIC_QWERTY);
    l.keys[5].id = l.keys[4].id;
    const e = errors(l);
    expect(e).toHaveLength(1);
    expect(e[0].message).toMatch(/duplicate id/);
    expect(e[0].keyIndex).toBe(5);
  });

  it("rejects unknown key codes, in base and layer overrides", () => {
    const l = cloneLayout(CLASSIC_QWERTY);
    l.keys[0].code = "KEY_NOPE";
    l.keys[1].layers = { fn: { code: "KEY_ALSO_NOPE" } };
    l.keys[2].code = "a";
    const e = errors(l);
    expect(e.map((i) => i.keyIndex)).toEqual([0, 1, 2]);
  });

  it("rejects a key with both code and layer, and a key with neither", () => {
    const l = cloneLayout(CLASSIC_QWERTY);
    l.keys[0].layer = "fn";
    delete l.keys[1].code;
    const e = errors(l);
    expect(e.find((i) => i.keyIndex === 0)?.message).toMatch(/not both/);
    expect(e.find((i) => i.keyIndex === 1)?.message).toMatch(/needs a "code" or a "layer"/);
  });

  it("rejects bad geometry, unknown fields, and long labels", () => {
    const l = cloneLayout(CLASSIC_QWERTY) as Layout & { extra?: number };
    l.extra = 1;
    l.keys[0].w = 0.1;
    l.keys[1].x = -1;
    l.keys[2].label = "x".repeat(17);
    (l.keys[3] as unknown as Record<string, unknown>).color = "red";
    const e = errors(l);
    expect(e.some((i) => i.message.includes('Unknown layout field "extra"'))).toBe(true);
    expect(e.some((i) => i.keyIndex === 0 && i.message.includes('"w"'))).toBe(true);
    expect(e.some((i) => i.keyIndex === 1 && i.message.includes('"x"'))).toBe(true);
    expect(e.some((i) => i.keyIndex === 2 && i.message.includes("label"))).toBe(true);
    expect(e.some((i) => i.keyIndex === 3 && i.message.includes('"color"'))).toBe(true);
  });

  it("rejects wrong format, version and id", () => {
    const e = errors({ ...CLASSIC_QWERTY, format: "x", version: 2, id: "Bad Id" });
    expect(e).toHaveLength(3);
  });

  it("warns, without failing, about overlaps and out-of-bounds keys", () => {
    const l = cloneLayout(CLASSIC_QWERTY);
    l.keys[1].x = l.keys[0].x + 0.5;
    l.keys.push({ id: "far", x: 20, y: 0, w: 1, h: 1, label: "", code: "KEY_A" });
    const issues = validateLayout(l);
    expect(hasErrors(issues)).toBe(false);
    expect(issues.some((i) => i.message.includes("overlaps"))).toBe(true);
    expect(issues.some((i) => i.message.includes("sticks out"))).toBe(true);
  });

  it("warns about layer overrides that no key can reach", () => {
    const l = cloneLayout(CLASSIC_QWERTY);
    l.keys = l.keys.filter((k) => k.layer !== "fn");
    const issues = validateLayout(l);
    expect(hasErrors(issues)).toBe(false);
    expect(issues.some((i) => i.message.includes('no key switches to the "fn" layer'))).toBe(true);
  });

  it("rejects non-objects and missing keys", () => {
    expect(hasErrors(validateLayout(null))).toBe(true);
    expect(hasErrors(validateLayout({ ...CLASSIC_QWERTY, keys: undefined }))).toBe(true);
    expect(hasErrors(validateLayout({ ...CLASSIC_QWERTY, keys: [] }))).toBe(true);
  });
});
