/** Shared helpers for the SRT/VTT/ASS parsers. */

/** Matches an SRT/VTT-style timing line and captures the two timecodes + trailing text. */
export const TIMING_RE =
  /(-?\d{1,3}:\d{1,2}:\d{1,2}[.,]\d{1,3}|-?\d{1,2}:\d{1,2}[.,]\d{1,3})\s*-->\s*(-?\d{1,3}:\d{1,2}:\d{1,2}[.,]\d{1,3}|-?\d{1,2}:\d{1,2}[.,]\d{1,3})(.*)/;

/** Normalize line endings and strip a leading BOM. */
export function normalize(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

/** Compact a block of text to a single short line for use in warning messages. */
export function truncate(s: string, n = 40): string {
  const flat = s.replace(/\n/g, "⏎");
  return flat.length > n ? flat.slice(0, n) + "…" : flat;
}
