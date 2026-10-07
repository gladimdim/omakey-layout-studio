// Share links: the layout JSON, compressed with raw DEFLATE and encoded as
// base64url without padding (spec/LAYOUT.md, "Sharing").
//
//   omakey://layout?d=<payload>         opens the phone app
//   https://…/studio/#layout=<payload>  reopens the layout in the studio

import { deflateSync, Inflate } from "fflate";
import { LIMITS, type Layout } from "./types";

export const APP_LINK_PREFIX = "omakey://layout?d=";
export const HASH_PREFIX = "#layout=";

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function streamThrough(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function hasCompressionStreams(): boolean {
  try {
    return typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined" &&
      !!new CompressionStream("deflate-raw");
  } catch {
    return false;
  }
}

/** Raw DEFLATE. Uses CompressionStream when the browser has it, fflate otherwise. */
export async function deflateRaw(bytes: Uint8Array, useStreams = hasCompressionStreams()): Promise<Uint8Array> {
  if (useStreams) return streamThrough(bytes, new CompressionStream("deflate-raw"));
  return deflateSync(bytes, { level: 9 });
}

/** Inflated payloads larger than this are refused: the same 256 KB limit as layout files. */
export const MAX_INFLATED_BYTES = LIMITS.maxFileBytes;

export class PayloadTooLargeError extends Error {
  constructor(limit: number) {
    super(`The layout in that link is over ${Math.round(limit / 1024)} KB.`);
    this.name = "PayloadTooLargeError";
  }
}

/**
 * Compressed input is fed in pieces this small. DEFLATE expands at most
 * ~1032:1, so one piece inflates to well under 1 MB and the size check
 * between pieces stops a deflate bomb before it fills memory.
 */
const INPUT_CHUNK = 512;

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

async function inflateStreams(bytes: Uint8Array, limit: number): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  let stopped = false;
  // Write and read at the same time: the stream only takes more input as its output is read.
  const feeding = (async () => {
    for (let i = 0; i < bytes.length && !stopped; i += INPUT_CHUNK) {
      await writer.ready;
      await writer.write(bytes.subarray(i, i + INPUT_CHUNK) as Uint8Array<ArrayBuffer>);
    }
    if (!stopped) await writer.close();
  })();
  feeding.catch(() => {}); // its errors also surface on the reader
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) throw new PayloadTooLargeError(limit);
      chunks.push(value);
    }
    await feeding;
  } catch (e) {
    stopped = true;
    reader.cancel().catch(() => {});
    writer.abort().catch(() => {});
    throw e;
  }
  return concat(chunks, total);
}

function inflateFflate(bytes: Uint8Array, limit: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const inflater = new Inflate((chunk) => {
    total += chunk.length;
    if (total <= limit) chunks.push(chunk);
  });
  if (!bytes.length) inflater.push(bytes, true);
  for (let i = 0; i < bytes.length; i += INPUT_CHUNK) {
    inflater.push(bytes.subarray(i, i + INPUT_CHUNK), i + INPUT_CHUNK >= bytes.length);
    if (total > limit) throw new PayloadTooLargeError(limit);
  }
  return concat(chunks, total);
}

/** Raw INFLATE, refusing output over `limit` bytes. */
export async function inflateRaw(bytes: Uint8Array, useStreams = hasCompressionStreams(), limit = MAX_INFLATED_BYTES): Promise<Uint8Array> {
  return useStreams ? inflateStreams(bytes, limit) : inflateFflate(bytes, limit);
}

export async function encodeLayout(layout: Layout, useStreams?: boolean): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(layout));
  return toBase64Url(await deflateRaw(json, useStreams));
}

export async function decodePayload(payload: string, useStreams?: boolean, limit = MAX_INFLATED_BYTES): Promise<unknown> {
  const bytes = await inflateRaw(fromBase64Url(payload.trim()), useStreams, limit);
  return JSON.parse(new TextDecoder().decode(bytes));
}

const PAYLOAD = /^[A-Za-z0-9_-]+$/;

/** The value of `name` in a `a=1&b=2` list, or undefined. */
function param(list: string, name: string): string | undefined {
  for (const pair of list.split("&")) {
    const eq = pair.indexOf("=");
    if (eq > 0 && pair.slice(0, eq) === name) return pair.slice(eq + 1);
  }
  return undefined;
}

/**
 * Pulls the payload out of an app link (`omakey://layout?…&d=…`), a studio
 * URL (`…#layout=…`), an https link with a `d` query parameter, or a bare
 * payload. Parameters may come in any order.
 */
export function extractPayload(text: string): string | undefined {
  const t = text.trim();
  const hashAt = t.indexOf("#");
  if (hashAt >= 0) {
    const p = param(t.slice(hashAt + 1), "layout");
    if (p !== undefined) return p;
  }
  if (/^(omakey:\/\/layout|https?:\/\/)/i.test(t)) {
    const beforeHash = hashAt >= 0 ? t.slice(0, hashAt) : t;
    const q = beforeHash.indexOf("?");
    const p = q >= 0 ? param(beforeHash.slice(q + 1), "d") : undefined;
    if (p !== undefined) return p;
    return undefined;
  }
  if (t.length >= 16 && PAYLOAD.test(t)) return t;
  return undefined;
}

export function appLink(payload: string): string {
  return APP_LINK_PREFIX + payload;
}

export function studioLink(payload: string, base: string): string {
  return base.replace(/#.*$/, "") + HASH_PREFIX + payload;
}
