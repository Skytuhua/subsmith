import type { Subtitle } from "../types";
import { applyLinearTransform, type CuePredicate } from "./common";

export interface FpsPreset {
  label: string;
  from: number;
  to: number;
}

/**
 * Frame-rate conversion. A subtitle authored for `from` fps shown on a `to` fps video
 * drifts by the ratio `from/to`; multiplying every timestamp by that factor realigns it.
 */
export const FPS_PRESETS: FpsPreset[] = [
  { label: "23.976 → 25 (NTSC-film → PAL)", from: 23.976, to: 25 },
  { label: "25 → 23.976 (PAL → NTSC-film)", from: 25, to: 23.976 },
  { label: "23.976 → 24", from: 23.976, to: 24 },
  { label: "24 → 23.976", from: 24, to: 23.976 },
  { label: "24 → 25", from: 24, to: 25 },
  { label: "25 → 24", from: 25, to: 24 },
  { label: "29.97 → 25", from: 29.97, to: 25 },
  { label: "25 → 29.97", from: 25, to: 29.97 },
  { label: "30 → 29.97", from: 30, to: 29.97 },
  { label: "29.97 → 30", from: 29.97, to: 30 },
];

/** The multiplicative factor for a from→to frame-rate conversion. */
export function fpsFactor(from: number, to: number): number {
  return from / to;
}

/**
 * If a speed factor (e.g. the `a` from a two-point sync) matches a standard frame-rate
 * conversion within `tolerance`, return that preset — so an opaque ratio can be explained as
 * "this is a 23.976→25 fps conversion". Returns the closest match within tolerance, or null.
 * The default tolerance (0.0005) is half the spacing between the nearest distinct ratios
 * (…0.999 / 1.000 / 1.001…), so a pure offset (factor ≈ 1) does not false-match.
 */
export function matchFpsRatio(
  a: number,
  tolerance = 0.0005,
): FpsPreset | null {
  let best: FpsPreset | null = null;
  let bestDiff = tolerance;
  for (const p of FPS_PRESETS) {
    const diff = Math.abs(fpsFactor(p.from, p.to) - a);
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best;
}

/** Convert matching cues from one frame rate to another. */
export function applyFramerate(
  sub: Subtitle,
  from: number,
  to: number,
  predicate?: CuePredicate,
): Subtitle {
  if (!isFinite(from) || !isFinite(to) || from <= 0 || to <= 0 || from === to)
    return sub;
  return applyLinearTransform(sub, fpsFactor(from, to), 0, predicate);
}
