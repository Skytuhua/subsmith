import type { Subtitle } from '../types'
import { applyLinearTransform, type CuePredicate } from './common'

export interface LinearTransform {
  a: number
  b: number
}

/**
 * Solve the linear transform `t' = a·t + b` that maps two known points:
 * the current time of an anchor cue to where it *should* be, for two anchors.
 * This corrects a constant offset **and** progressive drift in one step.
 *
 * Returns `null` if the two source times are equal (no unique solution).
 */
export function computeLinear(
  t1Old: number,
  t1New: number,
  t2Old: number,
  t2New: number,
): LinearTransform | null {
  if (t1Old === t2Old) return null
  const a = (t2New - t1New) / (t2Old - t1Old)
  const b = t1New - a * t1Old
  return { a, b }
}

/** Apply a previously computed linear transform to matching cues. */
export function applyLinear(
  sub: Subtitle,
  transform: LinearTransform,
  predicate?: CuePredicate,
): Subtitle {
  return applyLinearTransform(sub, transform.a, transform.b, predicate)
}

/** Convenience: compute then apply a two-point sync across matching cues. */
export function twoPointSync(
  sub: Subtitle,
  t1Old: number,
  t1New: number,
  t2Old: number,
  t2New: number,
  predicate?: CuePredicate,
): Subtitle | null {
  const t = computeLinear(t1Old, t1New, t2Old, t2New)
  if (!t) return null
  return applyLinear(sub, t, predicate)
}
