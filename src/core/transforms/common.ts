import type { Cue, Subtitle } from '../types'

/** Predicate to scope an operation to a subset of cues (e.g. the current selection). */
export type CuePredicate = (cue: Cue, index: number) => boolean

/** Return a new Subtitle with `fn` applied to cues matching `predicate` (default: all). */
export function mapCues(
  sub: Subtitle,
  fn: (cue: Cue, index: number) => Cue,
  predicate?: CuePredicate,
): Subtitle {
  const cues = sub.cues.map((c, i) => (predicate && !predicate(c, i) ? c : fn(c, i)))
  return { ...sub, cues }
}

/** Apply a linear time transform `t' = a·t + b` (rounded) to start/end of matching cues. */
export function applyLinearTransform(
  sub: Subtitle,
  a: number,
  b: number,
  predicate?: CuePredicate,
): Subtitle {
  return mapCues(
    sub,
    (c) => ({
      ...c,
      start: Math.round(a * c.start + b),
      end: Math.round(a * c.end + b),
    }),
    predicate,
  )
}
