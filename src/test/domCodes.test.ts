import { describe, expect, it } from "vitest";
import { DOM_CODE_TO_LINUX } from "../lib/domCodes";
import { isKnownCode } from "../lib/keycodes";
import { CLASSIC_QWERTY } from "../lib/layout";

describe("KeyboardEvent.code mapping", () => {
  it("maps only to key codes in keycodes.json", () => {
    const unknown = Object.entries(DOM_CODE_TO_LINUX).filter(([, name]) => !isKnownCode(name));
    expect(unknown).toEqual([]);
  });

  it("can pick every base key of Classic QWERTY by pressing it", () => {
    const reachable = new Set(Object.values(DOM_CODE_TO_LINUX));
    const missing = CLASSIC_QWERTY.keys.filter((k) => k.code && !reachable.has(k.code)).map((k) => k.code);
    expect(missing).toEqual([]);
  });
});
