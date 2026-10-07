// String lengths as the spec counts them: Unicode code points, the way JSON
// Schema's maxLength and Android's codePointCount do, not UTF-16 code units.

export function codePointLength(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

/** `s` cut to at most `max` code points, never splitting a surrogate pair. */
export function clampCodePoints(s: string, max: number): string {
  return codePointLength(s) <= max ? s : Array.from(s).slice(0, max).join("");
}
