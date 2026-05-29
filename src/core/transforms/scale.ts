import type { Subtitle } from '../types'
import { applyLinearTransform, type CuePredicate } from './common'

/**
 * Scale matching cues' timing by a percentage (100 = unchanged, 101 = 1% slower/longer,
 * 99 = 1% faster). Useful for fine drift correction when the exact fps pair is unknown.
 */
export function applyScale(sub: Subtitle, percent: number, predicate?: CuePredicate): Subtitle {
  if (!isFinite(percent) || percent <= 0 || percent === 100) return sub
  return applyLinearTransform(sub, percent / 100, 0, predicate)
}
