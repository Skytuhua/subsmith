/**
 * Reading-speed helpers, shared by the lint `fast-reading` rule and the per-cue CPS
 * indicator in the editor. Kept framework-free in core.
 */

/** Visible-character count: ASS `{...}` overrides, HTML `<...>` tags and repeated whitespace
 *  are excluded, since they are not read on screen. */
export function visibleLength(text: string): number {
  return text
    .replace(/\{[^}]*\}/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** Reading speed in characters per second for a cue of `durationMs`; 0 for a non-positive
 *  duration (so callers can simply skip it). */
export function readingSpeedCps(text: string, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return visibleLength(text) / (durationMs / 1000);
}
