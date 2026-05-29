import type { Subtitle } from "../types";
import { sortByTime } from "./text";

/**
 * Enforce a minimum gap (in ms) between consecutive cues by trimming each earlier cue's end
 * so that `end <= nextStart - gapMs`. Cues are sorted first, so the result is
 * order-independent; trimmed ends are clamped to never precede their own start (a degenerate
 * zero-length cue may remain, which the negative-duration lint rule then surfaces) — mirroring
 * the existing fixOverlaps. Complements fixOverlaps, which only removes overlap but does not
 * guarantee a readable gap (useful after a sync or frame-rate pass leaves cues touching).
 */
export function setMinGap(sub: Subtitle, gapMs: number): Subtitle {
  if (!(gapMs >= 0)) return sub;
  const cues = sortByTime(sub).cues.map((c) => ({ ...c }));
  for (let i = 0; i < cues.length - 1; i += 1) {
    const cur = cues[i];
    const limit = cues[i + 1].start - gapMs;
    if (cur.end > limit) cur.end = Math.max(cur.start, limit);
  }
  return { ...sub, cues };
}
