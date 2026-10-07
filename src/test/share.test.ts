import { describe, expect, it } from "vitest";
import { CLASSIC_QWERTY } from "../lib/layout";
import { deflateSync } from "fflate";
import {
  APP_LINK_PREFIX, appLink, decodePayload, encodeLayout, extractPayload, fromBase64Url, MAX_INFLATED_BYTES,
  PayloadTooLargeError, studioLink, toBase64Url,
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

  it("finds d= in any position of an app link or https link", async () => {
    const payload = await encodeLayout(CLASSIC_QWERTY);
    expect(extractPayload(`omakey://layout?x=1&d=${payload}`)).toBe(payload);
    expect(extractPayload(`omakey://layout?d=${payload}&v=1`)).toBe(payload);
    expect(extractPayload(`omakey://layout?a=&b=2&d=${payload}&c`)).toBe(payload);
    expect(extractPayload(`https://omakey.example/layout?ref=qr&d=${payload}`)).toBe(payload);
    expect(extractPayload(`https://example.org/studio/?x=1#layout=${payload}`)).toBe(payload);
    expect(extractPayload(`https://example.org/studio/#v=2&layout=${payload}`)).toBe(payload);
    expect(extractPayload("omakey://layout?x=1&dd=abc")).toBeUndefined();
    expect(extractPayload("https://example.org/studio/#old")).toBeUndefined();
  });
});

describe("share decode size cap", () => {
  // 16 MB of zeros compresses to ~16 KB: a deflate bomb. Built once.
  let cached = "";
  const bomb = () => (cached ||= toBase64Url(deflateSync(new Uint8Array(16 * 1024 * 1024), { level: 9 })));

  it.each([[true], [false]])("refuses to inflate past 256 KB (streams: %s)", async (useStreams) => {
    const payload = bomb();
    expect(payload.length).toBeLessThan(MAX_INFLATED_BYTES * 2);
    const t = Date.now();
    await expect(decodePayload(payload, useStreams)).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(Date.now() - t).toBeLessThan(5000);
  });

  it.each([[true], [false]])("still decodes a layout just under the cap (streams: %s)", async (useStreams) => {
    const json = JSON.stringify({ pad: "x".repeat(MAX_INFLATED_BYTES - 20) });
    expect(json.length).toBeLessThanOrEqual(MAX_INFLATED_BYTES);
    const payload = toBase64Url(deflateSync(new TextEncoder().encode(json)));
    expect(await decodePayload(payload, useStreams)).toEqual(JSON.parse(json));
    await expect(decodePayload(payload, useStreams, 1024)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it.each([[true], [false]])("rejects corrupt payloads (streams: %s)", async (useStreams) => {
    await expect(decodePayload("not-a-deflate-stream-at-all", useStreams)).rejects.toThrow();
  });
});
