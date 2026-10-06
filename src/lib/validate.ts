// Hand-written validator matching spec/LAYOUT.md and spec/layout.schema.json,
// plus warnings for layouts that are valid but probably not what you meant.

import { isKnownCode } from "./keycodes";
import { KEY_STYLES, LIMITS } from "./types";

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  message: string;
  /** Index into layout.keys, when the issue is about one key. */
  keyIndex?: number;
  keyId?: string;
}

const LAYOUT_FIELDS = new Set([
  "format", "version", "id", "name", "author", "description", "width", "height", "splitAt", "keys",
]);
const KEY_FIELDS = new Set([
  "id", "x", "y", "w", "h", "label", "sub", "code", "layer", "style", "layers", "parts",
]);
const RECT_FIELDS = new Set(["x", "y", "w", "h"]);
const OVERRIDE_FIELDS = new Set(["code", "label"]);
const LAYOUT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const KEY_NAME = /^KEY_[A-Z0-9_]+$/;
const LAYER_NAME = /^[a-z][a-z0-9]{0,15}$/;
const EPS = 1e-6;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function validateLayout(input: unknown): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string, keyIndex?: number, keyId?: string) =>
    issues.push({ severity: "error", message, keyIndex, keyId });
  const warn = (message: string, keyIndex?: number, keyId?: string) =>
    issues.push({ severity: "warning", message, keyIndex, keyId });

  if (!isObject(input)) {
    err("A layout must be a JSON object.");
    return issues;
  }
  const l = input;

  for (const f of Object.keys(l)) if (!LAYOUT_FIELDS.has(f)) err(`Unknown layout field "${f}".`);
  if (l.format !== "omakey-layout") err('"format" must be "omakey-layout".');
  if (l.version !== 1) err('"version" must be 1.');
  if (typeof l.id !== "string" || !LAYOUT_ID.test(l.id))
    err('Layout "id" must be 1–64 lowercase letters, digits or dashes, starting with a letter or digit.');
  if (typeof l.name !== "string" || l.name.length < 1 || l.name.length > LIMITS.maxNameLength)
    err(`Layout "name" must be 1–${LIMITS.maxNameLength} characters.`);
  if (l.author !== undefined && (typeof l.author !== "string" || l.author.length > LIMITS.maxAuthorLength))
    err(`"author" must be at most ${LIMITS.maxAuthorLength} characters.`);
  if (
    l.description !== undefined &&
    (typeof l.description !== "string" || l.description.length > LIMITS.maxDescriptionLength)
  )
    err(`"description" must be at most ${LIMITS.maxDescriptionLength} characters.`);
  const widthOk = isNum(l.width) && l.width > 0 && l.width <= LIMITS.maxWidth;
  const heightOk = isNum(l.height) && l.height > 0 && l.height <= LIMITS.maxHeight;
  if (!widthOk) err(`"width" must be a number above 0 and at most ${LIMITS.maxWidth}.`);
  if (!heightOk) err(`"height" must be a number above 0 and at most ${LIMITS.maxHeight}.`);
  const split = l.splitAt;
  const splitOk = split === undefined || (isNum(split) && split > 0 && (!widthOk || split < (l.width as number)));
  if (!splitOk) err(`"splitAt" must be a number between 0 and the layout width.`);

  if (!Array.isArray(l.keys)) {
    err('"keys" must be an array.');
    return issues;
  }
  if (l.keys.length < 1) err("A layout needs at least one key.");
  if (l.keys.length > LIMITS.maxKeys) err(`A layout may have at most ${LIMITS.maxKeys} keys.`);

  const ids = new Map<string, number>();
  const layerKeys = new Set<string>();
  const overrideLayers = new Set<string>();
  const rects: { i: number; id: string; x: number; y: number; w: number; h: number }[] = [];

  l.keys.forEach((raw: unknown, i: number) => {
    if (!isObject(raw)) {
      err(`Key #${i + 1} must be an object.`, i);
      return;
    }
    const k = raw;
    const id = typeof k.id === "string" ? k.id : undefined;
    const name = id ? `Key "${id}"` : `Key #${i + 1}`;
    const e = (m: string) => err(`${name}: ${m}`, i, id);

    for (const f of Object.keys(k)) if (!KEY_FIELDS.has(f)) e(`unknown field "${f}".`);

    if (id === undefined || id.length < 1 || id.length > LIMITS.maxIdLength) {
      e(`"id" must be a string of 1–${LIMITS.maxIdLength} characters.`);
    } else if (ids.has(id)) {
      e(`duplicate id; key #${ids.get(id)! + 1} already uses it.`);
    } else {
      ids.set(id, i);
    }

    let geomOk = true;
    for (const f of ["x", "y"] as const) {
      if (!isNum(k[f]) || (k[f] as number) < 0) {
        e(`"${f}" must be a number ≥ 0.`);
        geomOk = false;
      }
    }
    for (const f of ["w", "h"] as const) {
      const v = k[f];
      if (!isNum(v) || v < LIMITS.minKeySize || v > LIMITS.maxKeySize) {
        e(`"${f}" must be between ${LIMITS.minKeySize} and ${LIMITS.maxKeySize}.`);
        geomOk = false;
      }
    }

    const parts: { x: number; y: number; w: number; h: number }[] = [];
    if (k.parts !== undefined) {
      if (!Array.isArray(k.parts) || k.parts.length < 1 || k.parts.length > LIMITS.maxParts) {
        e(`"parts" must be a list of 1–${LIMITS.maxParts} rectangles.`);
      } else {
        k.parts.forEach((p, n) => {
          if (!isObject(p)) return e(`part ${n + 1} must be an object with x, y, w and h.`);
          for (const f of Object.keys(p)) if (!RECT_FIELDS.has(f)) e(`part ${n + 1} has unknown field "${f}".`);
          const ok = isNum(p.x) && p.x >= 0 && isNum(p.y) && p.y >= 0 &&
            isNum(p.w) && p.w >= LIMITS.minKeySize && p.w <= LIMITS.maxKeySize &&
            isNum(p.h) && p.h >= LIMITS.minKeySize && p.h <= LIMITS.maxKeySize;
          if (!ok) e(`part ${n + 1} needs x, y ≥ 0 and w, h between ${LIMITS.minKeySize} and ${LIMITS.maxKeySize}.`);
          else parts.push({ x: p.x as number, y: p.y as number, w: p.w as number, h: p.h as number });
        });
      }
    }

    if (typeof k.label !== "string") e('"label" is required (it may be empty).');
    else if (k.label.length > LIMITS.maxLabelLength) e(`"label" is longer than ${LIMITS.maxLabelLength} characters.`);
    if (k.sub !== undefined && (typeof k.sub !== "string" || k.sub.length > LIMITS.maxLabelLength))
      e(`"sub" must be a string of at most ${LIMITS.maxLabelLength} characters.`);

    const hasCode = k.code !== undefined;
    const hasLayer = k.layer !== undefined;
    if (hasCode && hasLayer) e('a key has either "code" or "layer", not both.');
    if (!hasCode && !hasLayer) e('a key needs a "code" or a "layer".');
    if (hasCode) checkCode(k.code, e, '"code"');
    if (hasLayer) {
      if (typeof k.layer !== "string" || !LAYER_NAME.test(k.layer))
        e('"layer" must be a lowercase word of 1–16 letters or digits, starting with a letter.');
      else layerKeys.add(k.layer);
    }

    if (k.style !== undefined && !KEY_STYLES.includes(k.style as never))
      e(`"style" must be one of ${KEY_STYLES.join(", ")}.`);

    if (k.layers !== undefined) {
      if (!isObject(k.layers)) {
        e('"layers" must be an object.');
      } else {
        for (const [layer, ov] of Object.entries(k.layers)) {
          if (!LAYER_NAME.test(layer)) e(`layer name "${layer}" is not a lowercase word.`);
          else overrideLayers.add(layer);
          if (!isObject(ov)) {
            e(`layer "${layer}" override must be an object.`);
            continue;
          }
          for (const f of Object.keys(ov))
            if (!OVERRIDE_FIELDS.has(f)) e(`layer "${layer}" override has unknown field "${f}".`);
          if (ov.code !== undefined) checkCode(ov.code, e, `layer "${layer}" code`);
          if (ov.label !== undefined && (typeof ov.label !== "string" || ov.label.length > LIMITS.maxLabelLength))
            e(`layer "${layer}" label must be a string of at most ${LIMITS.maxLabelLength} characters.`);
        }
      }
    }

    if (geomOk) {
      const main = { x: k.x as number, y: k.y as number, w: k.w as number, h: k.h as number };
      let outside = false;
      for (const r of [main, ...parts]) {
        rects.push({ i, id: id ?? `#${i + 1}`, ...r });
        if (r.x + r.w > (l.width as number) + EPS || r.y + r.h > (l.height as number) + EPS) outside = true;
      }
      if (widthOk && heightOk && outside) warn(`${name} sticks out of the ${l.width}×${l.height} layout area.`, i, id);
    }
  });

  // Overlaps: O(n²) is fine for 256 keys.
  const reported = new Set<string>();
  for (let a = 0; a < rects.length; a++) {
    for (let b = a + 1; b < rects.length; b++) {
      const p = rects[a], q = rects[b];
      if (p.i === q.i) continue; // a key's own parts may touch or overlap
      if (p.x < q.x + q.w - EPS && q.x < p.x + p.w - EPS && p.y < q.y + q.h - EPS && q.y < p.y + p.h - EPS &&
          !reported.has(`${p.i}:${q.i}`) && reported.add(`${p.i}:${q.i}`))
        warn(`Key "${q.id}" overlaps key "${p.id}"; a touch goes to "${q.id}".`, q.i, q.id);
    }
  }

  for (const layer of overrideLayers)
    if (!layerKeys.has(layer)) warn(`Keys have "${layer}" overrides but no key switches to the "${layer}" layer.`);
  for (const layer of layerKeys)
    if (!overrideLayers.has(layer)) warn(`The "${layer}" layer key has no keys that change on that layer.`);

  return issues;
}

function checkCode(code: unknown, e: (m: string) => void, what: string) {
  if (typeof code !== "string" || !KEY_NAME.test(code)) e(`${what} must be a key name like KEY_A.`);
  else if (!isKnownCode(code)) e(`${what} "${code}" is not a known Linux key code.`);
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
