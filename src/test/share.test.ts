import { describe, expect, it } from "vitest";
import { CLASSIC_QWERTY } from "../lib/layout";
import {
  APP_LINK_PREFIX, appLink, decodePayload, encodeLayout, extractPayload, fromBase64Url, studioLink, toBase64Url,
} from "../lib/share";

describe("share codec", () => {
  it("round-trips Classic QWERTY through CompressionStream", async () => {
    const payload = await encodeLayout(CLASSIC_QWERTY, true);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodePayload(payload, true)).toEqual(CLASSIC_QWERTY);
  });

  it("round-trips through the fflate fallback", async () => {
    const payload = await encodeLayout(CLASSIC_QWERTY, false);
    expect(await decodePayload(payload, false)).toEqual(CLASSIC_QWERTY);
  });

  it("is interchangeable between CompressionStream and fflate", async () => {
    const a = await encodeLayout(CLASSIC_QWERTY, true);
    const b = await encodeLayout(CLASSIC_QWERTY, false);
    expect(await decodePayload(a, false)).toEqual(CLASSIC_QWERTY);
    expect(await decodePayload(b, true)).toEqual(CLASSIC_QWERTY);
  });

  it("keeps the classic layout's phone link small enough for a QR code", async () => {
    const link = appLink(await encodeLayout(CLASSIC_QWERTY));
    expect(link.startsWith(APP_LINK_PREFIX)).toBe(true);
    expect(link.length).toBeLessThan(2953); // QR version 40, level L, byte mode
  });

  it("encodes base64url without padding and decodes it back", () => {
    for (let n = 0; n < 40; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) & 0xff);
      const text = toBase64Url(bytes);
      expect(text).not.toMatch(/[+/=]/);
      expect(fromBase64Url(text)).toEqual(bytes);
    }
  });

  it("extracts the payload from app links, studio links and bare payloads", async () => {
    const payload = await encodeLayout(CLASSIC_QWERTY);
    expect(extractPayload(appLink(payload))).toBe(payload);
    expect(extractPayload(studioLink(payload, "https://example.org/studio/#old"))).toBe(payload);
    expect(extractPayload(`  ${payload}\n`)).toBe(payload);
    expect(extractPayload('{"format":"omakey-layout"}')).toBeUndefined();
  });
});
