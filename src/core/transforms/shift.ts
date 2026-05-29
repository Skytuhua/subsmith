import type { Subtitle } from '../types'
import { mapCues, type CuePredicate } from './common'

/** Shift matching cues by a signed millisecond offset (constant offset fix). */
export function shift(sub: Subtitle, deltaMs: number, predicate?: CuePredicate): Subtitle {
  if (deltaMs === 0) return sub
  return mapCues(
    sub,
    (c) => ({ ...c, start: c.start + deltaMs, end: c.end + deltaMs }),
    predicate,
  )
}
