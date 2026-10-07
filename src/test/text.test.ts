import { describe, expect, it } from "vitest";
import { CLASSIC_QWERTY, cloneLayout } from "../lib/layout";
import { clampCodePoints, codePointLength } from "../lib/text";
import { validateLayout } from "../lib/validate";

const labelErrors = (label: string) => {
  const l = cloneLayout(CLASSIC_QWERTY);
  l.keys[0].label = label;
  l.keys[1].sub = label;
  l.keys[2].layers = { fn: { code: "KEY_A", label } };
  return validateLayout(l).filter((i) => i.severity === "error");
};

describe("label length in code points", () => {
  it("counts astral characters once", () => {
    expect("😀".length).toBe(2);
    expect(codePointLength("😀")).toBe(1);
    expect(codePointLength("a😀b")).toBe(3);
  });

  it("accepts 16 emoji and rejects 17, in labels, subs and layer labels", () => {
    expect(labelErrors("😀".repeat(16))).toEqual([]);
    expect(labelErrors("😀".repeat(9))).toEqual([]); // 18 UTF-16 units, 9 characters
    expect(labelErrors("😀".repeat(17))).toHaveLength(3);
  });

  it("clamps without splitting a surrogate pair", () => {
    const s = clampCodePoints("ab😀😀", 3);
    expect(s).toBe("ab😀");
    expect(clampCodePoints("😀".repeat(20), 16)).toBe("😀".repeat(16));
    expect(clampCodePoints("short", 16)).toBe("short");
  });
});
