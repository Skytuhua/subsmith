import type { ParseResult, SubtitleFormat } from '../types'
import { parseSrt } from './srt'
import { parseVtt } from './vtt'
import { parseAss } from './ass'

/**
 * Guess the subtitle format from file content (not the extension), with an optional
 * filename hint as a tie-breaker.
 */
export function detectFormat(text: string, filename?: string): SubtitleFormat {
  const head = text.replace(/^﻿/, '').trimStart()

  if (/^WEBVTT/.test(head)) return 'vtt'
  if (/^\[Script Info\]/i.test(head) || /\n\s*\[V4\+? Styles\]/i.test(text) || /\n\s*\[Events\]/i.test(text)) {
    return 'ass'
  }
  if (/^(Dialogue|Comment)\s*:/im.test(text) && /\d:\d{2}:\d{2}[.,]\d{2}/.test(text)) {
    return 'ass'
  }

  // SRT uses a comma decimal separator; VTT uses a dot.
  const hasComma = /\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(text)
  const hasDot = /\d{2}:\d{2}[:.]\d{2,3}\s*-->/.test(text)
  if (hasComma) return 'srt'
  if (hasDot) return 'vtt'

  // Filename fallback.
  if (filename) {
    const ext = filename.toLowerCase().split('.').pop()
    if (ext === 'vtt') return 'vtt'
    if (ext === 'ass' || ext === 'ssa') return 'ass'
  }
  return 'srt'
}

/** Parse subtitle text using an explicit format, or auto-detect when omitted. */
export function parse(text: string, format?: SubtitleFormat, filename?: string): ParseResult {
  const fmt = format ?? detectFormat(text, filename)
  switch (fmt) {
    case 'vtt':
      return parseVtt(text)
    case 'ass':
      return parseAss(text)
    case 'srt':
    default:
      return parseSrt(text)
  }
}

export { parseSrt, parseVtt, parseAss }
