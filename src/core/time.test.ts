import { describe, it, expect } from 'vitest'
import { parseTimecode, formatSrt, formatVtt, formatAss, formatDisplay, clampTime } from './time'

describe('parseTimecode', () => {
  it('parses SRT comma timecodes', () => {
    expect(parseTimecode('00:00:01,500')).toBe(1500)
    expect(parseTimecode('01:02:03,004')).toBe(3_723_004)
  })

  it('parses VTT dot timecodes', () => {
    expect(parseTimecode('00:00:01.500')).toBe(1500)
    expect(parseTimecode('01:02.250')).toBe(62_250) // mm:ss.mmm
  })

  it('parses ASS centisecond timecodes (2-digit fraction)', () => {
    expect(parseTimecode('0:00:01.50')).toBe(1500)
    expect(parseTimecode('1:00:00.05')).toBe(3_600_050)
  })

  it('parses bare integers as milliseconds', () => {
    expect(parseTimecode('2500')).toBe(2500)
  })

  it('handles negatives', () => {
    expect(parseTimecode('-00:00:02,000')).toBe(-2000)
    expect(parseTimecode('-1000')).toBe(-1000)
  })

  it('returns null for garbage', () => {
    expect(parseTimecode('')).toBeNull()
    expect(parseTimecode('abc')).toBeNull()
    expect(parseTimecode('1:2:3:4')).toBeNull()
  })
})

describe('format functions', () => {
  it('formats SRT/VTT/ASS', () => {
    expect(formatSrt(3_723_004)).toBe('01:02:03,004')
    expect(formatVtt(3_723_004)).toBe('01:02:03.004')
    expect(formatAss(1500)).toBe('0:00:01.50')
  })

  it('clamps negative times to zero on output', () => {
    expect(formatSrt(-500)).toBe('00:00:00,000')
    expect(formatVtt(-500)).toBe('00:00:00.000')
  })

  it('handles centisecond rounding carry', () => {
    // 999ms -> 100cs which must carry into the next second.
    expect(formatAss(1999)).toBe('0:00:02.00')
  })

  it('formatDisplay shows a sign for negatives', () => {
    expect(formatDisplay(-1500)).toBe('-00:00:01.500')
    expect(formatDisplay(1500)).toBe('00:00:01.500')
  })

  it('round-trips parse->format for SRT', () => {
    const tc = '00:42:17,123'
    expect(formatSrt(parseTimecode(tc)!)).toBe(tc)
  })

  it('clampTime rounds and floors at zero', () => {
    expect(clampTime(-3)).toBe(0)
    expect(clampTime(4.6)).toBe(5)
  })
})
