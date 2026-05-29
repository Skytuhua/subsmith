import type { Subtitle } from "../core/types";
import { formatDisplay } from "../core/time";

export interface DocStats {
  count: number;
  totalDurationMs: number;
  spanMs: number;
  spanLabel: string;
}

/** Aggregate stats for the status bar. */
export function docStats(sub: Subtitle | null): DocStats {
  if (!sub || sub.cues.length === 0) {
    return {
      count: 0,
      totalDurationMs: 0,
      spanMs: 0,
      spanLabel: "00:00:00.000",
    };
  }
  let total = 0;
  let max = 0;
  for (const c of sub.cues) {
    total += Math.max(0, c.end - c.start);
    if (c.end > max) max = c.end;
  }
  return {
    count: sub.cues.length,
    totalDurationMs: total,
    spanMs: max,
    spanLabel: formatDisplay(max),
  };
}
