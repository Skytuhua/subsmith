import type { Subtitle } from '../types'
import { nextId } from '../id'
import { sortByTime } from './text'

/**
 * Merge a second subtitle into a base one, offsetting the addition's timing (e.g. to append
 * the subtitles for "CD2" after "CD1"). The result keeps the base document's format/header,
 * re-sorts by start time, and assigns fresh cue ids.
 */
export function merge(base: Subtitle, addition: Subtitle, offsetMs = 0): Subtitle {
  const shifted = addition.cues.map((c) => ({
    ...c,
    id: nextId(),
    start: c.start + offsetMs,
    end: c.end + offsetMs,
  }))
  const merged: Subtitle = {
    ...base,
    cues: [...base.cues.map((c) => ({ ...c })), ...shifted],
  }
  return sortByTime(merged)
}
