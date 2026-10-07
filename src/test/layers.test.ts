import { describe, expect, it } from "vitest";
import { CLASSIC_QWERTY, initialOverride, keyOnLayer, overrideLabel } from "../lib/layout";
import { isLetter, phoneFnLegend, phoneInk, phoneLabel, phoneSub, phoneTone, type PhoneState } from "../lib/phone";
import type { LayoutKey } from "../lib/types";
import { hasErrors, validateLayout } from "../lib/validate";

const key = (patch: Partial<LayoutKey> = {}): LayoutKey => ({ id: "k", x: 0, y: 0, w: 1, h: 1, label: "Esc", code: "KEY_ESC", ...patch });
const S = (p: Partial<PhoneState> = {}): PhoneState => ({ layer: "", shift: false, caps: false, ...p });

describe("layer label rule (spec/LAYOUT.md, Layers)", () => {
  it("shows the entry's label, even an empty one", () => {
    expect(overrideLabel({ code: "KEY_PAGEUP", label: "Pg↑" })).toBe("Pg↑");
    expect(overrideLabel({ code: "KEY_PAGEUP", label: "" })).toBe("");
  });

  it("falls back to the keycodes.json label, then the code name without KEY_", () => {
    expect(overrideLabel({ code: "KEY_PAGEUP" })).toBe("PgUp");
    expect(overrideLabel({ code: "KEY_NOT_IN_TABLE" })).toBe("NOT_IN_TABLE");
  });

  it("disables an entry without a code: sends nothing, shows an empty label", () => {
    const k = key({ layers: { fn: {} } });
    expect(keyOnLayer(k, "fn")).toEqual({ label: "", code: undefined, overridden: true, disabled: true });
    expect(phoneLabel(k, S({ layer: "fn" }))).toBe("");
    // A label still wins over the empty default.
    expect(keyOnLayer(key({ layers: { fn: { label: "—" } } }), "fn").label).toBe("—");
  });

  it('accepts "code": null as disabled, in the validator too', () => {
    const l = structuredClone(CLASSIC_QWERTY) as unknown as { keys: Record<string, unknown>[] };
    l.keys[0].layers = { fn: { code: null } };
    expect(hasErrors(validateLayout(l))).toBe(false);
  });

  it("keeps base code and label on layers without an entry", () => {
    expect(keyOnLayer(key(), "fn")).toEqual({ label: "Esc", code: "KEY_ESC", overridden: false, disabled: false });
  });

  it("pre-fills a new override so the key looks and acts as on the base layer", () => {
    expect(initialOverride(key())).toEqual({ code: "KEY_ESC" });
    expect(initialOverride(key({ label: "⎋" }))).toEqual({ code: "KEY_ESC", label: "⎋" });
    expect(initialOverride({ id: "fn", x: 0, y: 0, w: 1, h: 1, label: "Fn", layer: "fn" })).toEqual({});
  });
});

describe("phone emulation (KeyboardModel.labelFor / subFor)", () => {
  const a = key({ label: "A", code: "KEY_A" });
  const one = key({ label: "1", sub: "!", code: "KEY_1" });

  it("lowercases letters unless Shift or Caps (not both) is on", () => {
    expect(isLetter(a)).toBe(true);
    expect(isLetter(key({ label: "A", code: "KEY_B" }))).toBe(false);
    expect(phoneLabel(a, S())).toBe("a");
    expect(phoneLabel(a, S({ shift: true }))).toBe("A");
    expect(phoneLabel(a, S({ caps: true }))).toBe("A");
    expect(phoneLabel(a, S({ shift: true, caps: true }))).toBe("a");
  });

  it("shows the shifted symbol with Shift, and swaps the corner legend", () => {
    expect(phoneLabel(one, S())).toBe("1");
    expect(phoneSub(one, S())).toBe("!");
    expect(phoneLabel(one, S({ shift: true }))).toBe("!");
    expect(phoneSub(one, S({ shift: true }))).toBe("1");
    expect(phoneLabel(one, S({ caps: true }))).toBe("1");
  });

  it("draws the fn legend from layers.fn.label, only while no layer is held", () => {
    const up = key({ label: "↑", code: "KEY_UP", layers: { fn: { code: "KEY_PAGEUP", label: "PgUp" } } });
    expect(phoneFnLegend(up, S())).toBe("PgUp");
    expect(phoneFnLegend(up, S({ layer: "fn" }))).toBeUndefined();
    expect(phoneFnLegend(key({ w: 0.5, layers: { fn: { label: "x" } } }), S())).toBeUndefined();
    expect(phoneLabel(up, S({ layer: "fn" }))).toBe("PgUp");
    expect(phoneSub(one, S({ layer: "fn" }))).toBeUndefined();
  });

  it("highlights the held layer key, Caps Lock and held Shift, and dims keys without an entry", () => {
    const fn: LayoutKey = { id: "fn", x: 0, y: 0, w: 1, h: 1, label: "Fn", layer: "fn" };
    expect(phoneTone(fn, S({ layer: "fn" }))).toBe("held");
    expect(phoneTone(fn, S())).toBe("normal");
    expect(phoneTone(key({ code: "KEY_CAPSLOCK" }), S({ caps: true }))).toBe("caps");
    expect(phoneTone(key({ code: "KEY_LEFTSHIFT" }), S({ shift: true }))).toBe("pressed");
    expect(phoneInk(a, S({ layer: "fn" }), "normal")).toBe("dim");
    expect(phoneInk(key({ layers: { fn: {} } }), S({ layer: "fn" }), "normal")).toBe("layer");
  });
});
