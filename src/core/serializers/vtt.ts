import type { SerializeOptions, Subtitle } from '../types'
import { formatVtt } from '../time'
import { stripAssOverrides } from './srt'

/** Serialize a subtitle document to WebVTT (.vtt). */
export function serializeVtt(sub: Subtitle, opts: SerializeOptions = {}): string {
  const eol = opts.eol ?? '\n'
  const header = (sub.vttHeader && sub.vttHeader.trim() !== '' ? sub.vttHeader : 'WEBVTT').replace(
    /\r\n?/g,
    '\n',
  )

  const blocks = sub.cues.map((c) => {
    const lines: string[] = []
    if (c.vtt?.id) lines.push(c.vtt.id)
    const settings = c.vtt?.settings ? ' ' + c.vtt.settings : ''
    lines.push(`${formatVtt(c.start)} --> ${formatVtt(c.end)}${settings}`)
    lines.push(stripAssOverrides(c.text))
    return lines.join('\n')
  })

  let out = header.replace(/\n+$/, '') + '\n\n' + blocks.join('\n\n') + '\n'
  if (eol !== '\n') out = out.replace(/\n/g, eol)
  return opts.bom ? '﻿' + out : out
}
