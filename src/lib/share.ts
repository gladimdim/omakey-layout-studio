// Share links: the layout JSON, compressed with raw DEFLATE and encoded as
// base64url without padding (spec/LAYOUT.md, "Sharing").
//
//   omakey://layout?d=<payload>         opens the phone app
//   https://…/studio/#layout=<payload>  reopens the layout in the studio

import { deflateSync, inflateSync } from "fflate";
import type { Layout } from "./types";

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

export async function inflateRaw(bytes: Uint8Array, useStreams = hasCompressionStreams()): Promise<Uint8Array> {
  if (useStreams) return streamThrough(bytes, new DecompressionStream("deflate-raw"));
  return inflateSync(bytes);
}

export async function encodeLayout(layout: Layout, useStreams?: boolean): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(layout));
  return toBase64Url(await deflateRaw(json, useStreams));
}

export async function decodePayload(payload: string, useStreams?: boolean): Promise<unknown> {
  const bytes = await inflateRaw(fromBase64Url(payload.trim()), useStreams);
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Pulls the payload out of an app link, a studio URL, or a bare payload. */
export function extractPayload(text: string): string | undefined {
  const t = text.trim();
  if (t.startsWith(APP_LINK_PREFIX)) return t.slice(APP_LINK_PREFIX.length).split("&")[0];
  const hash = t.indexOf(HASH_PREFIX);
  if (hash >= 0) return t.slice(hash + HASH_PREFIX.length).split("&")[0];
  if (/^[A-Za-z0-9_-]{16,}$/.test(t)) return t;
  return undefined;
}

export function appLink(payload: string): string {
  return APP_LINK_PREFIX + payload;
}

export function studioLink(payload: string, base: string): string {
  return base.replace(/#.*$/, "") + HASH_PREFIX + payload;
}
