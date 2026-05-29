import type { SerializeOptions, Subtitle } from '../types'
import { formatSrt } from '../time'

/** Remove ASS override blocks like `{\an8}` that are meaningless in SRT. */
export function stripAssOverrides(text: string): string {
  return text.replace(/\{\\[^}]*\}/g, '').replace(/\\h/g, ' ').replace(/\\N/g, '\n')
}

/** Serialize a subtitle document to SubRip (.srt). */
export function serializeSrt(sub: Subtitle, opts: SerializeOptions = {}): string {
  const eol = opts.eol ?? '\n'
  const blocks = sub.cues.map((c, i) => {
    const body = stripAssOverrides(c.text)
    return [`${i + 1}`, `${formatSrt(c.start)} --> ${formatSrt(c.end)}`, body].join('\n')
  })
  let out = blocks.join('\n\n') + '\n'
  if (eol !== '\n') out = out.replace(/\n/g, eol)
  return opts.bom ? '﻿' + out : out
}
