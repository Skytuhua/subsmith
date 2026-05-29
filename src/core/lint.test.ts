import { describe, it, expect } from 'vitest'
import type { Cue, Subtitle } from './types'
import { lint, summarize, fixOverlaps, fixNegativeDurations, fixOrder, fixEmpty } from './lint'

function sub(cues: Array<[number, number, string]>): Subtitle {
  return {
    format: 'srt',
    cues: cues.map(([start, end, text], i): Cue => ({ id: `c${i}`, start, end, text })),
  }
}

describe('lint', () => {
  it('flags a negative/zero duration as an error', () => {
    const f = lint(sub([[2000, 1000, 'oops']]))
    expect(f.some((x) => x.rule === 'negative-duration' && x.severity === 'error')).toBe(true)
  })

  it('flags overlapping cues', () => {
    const f = lint(sub([[1000, 5000, 'a'], [4000, 6000, 'b']]))
    expect(f.some((x) => x.rule === 'overlap')).toBe(true)
  })

  it('flags out-of-order cues', () => {
    const f = lint(sub([[5000, 6000, 'a'], [1000, 2000, 'b']]))
    expect(f.some((x) => x.rule === 'out-of-order')).toBe(true)
  })

  it('flags empty text', () => {
    const f = lint(sub([[1000, 2000, '   ']]))
    expect(f.some((x) => x.rule === 'empty-text')).toBe(true)
  })

  it('flags too-short display time', () => {
    const f = lint(sub([[1000, 1100, 'hi']]))
    expect(f.some((x) => x.rule === 'too-short')).toBe(true)
  })

  it('summarizes severities', () => {
    const f = lint(sub([[2000, 1000, 'oops'], [1000, 5000, 'a'], [4000, 6000, 'b']]))
    const s = summarize(f)
    expect(s.total).toBe(f.length)
    expect(s.errors).toBeGreaterThan(0)
  })
})

describe('auto-fixers', () => {
  it('fixOverlaps removes overlap by trimming the earlier cue', () => {
    const fixed = fixOverlaps(sub([[1000, 5000, 'a'], [4000, 6000, 'b']]))
    expect(fixed.cues[0].end).toBeLessThan(fixed.cues[1].start)
    expect(lint(fixed).some((x) => x.rule === 'overlap')).toBe(false)
  })

  it('fixNegativeDurations gives a default duration', () => {
    const fixed = fixNegativeDurations(sub([[2000, 1000, 'x']]))
    expect(fixed.cues[0].end).toBe(3000)
  })

  it('fixOrder sorts by time', () => {
    const fixed = fixOrder(sub([[5000, 6000, 'a'], [1000, 2000, 'b']]))
    expect(fixed.cues[0].text).toBe('b')
  })

  it('fixEmpty drops blank cues', () => {
    const fixed = fixEmpty(sub([[1000, 2000, 'a'], [2000, 3000, '']]))
    expect(fixed.cues).toHaveLength(1)
  })
})
