import type { Subtitle } from '../types'
import { mapCues, type CuePredicate } from './common'
import { fixMojibake } from '../mojibake'

export interface FindReplaceOptions {
  regex?: boolean
  caseSensitive?: boolean
  predicate?: CuePredicate
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Find & replace across matching cues. Returns the new subtitle and the replacement count. */
export function findReplace(
  sub: Subtitle,
  find: string,
  replace: string,
  opts: FindReplaceOptions = {},
): { subtitle: Subtitle; count: number; error?: string } {
  if (find === '') return { subtitle: sub, count: 0 }
  let re: RegExp
  try {
    const flags = 'g' + (opts.caseSensitive ? '' : 'i')
    re = new RegExp(opts.regex ? find : escapeRegExp(find), flags)
  } catch (e) {
    return { subtitle: sub, count: 0, error: (e as Error).message }
  }

  let count = 0
  const subtitle = mapCues(
    sub,
    (c) => {
      const next = c.text.replace(re, (...args) => {
        count += 1
        // Support $1.. backreferences for regex mode; literal otherwise.
        if (!opts.regex) return replace
        return replace.replace(/\$(\d+)/g, (_, n) => {
          const idx = Number(n)
          return (args[idx] as string) ?? ''
        })
      })
      return next === c.text ? c : { ...c, text: next }
    },
    opts.predicate,
  )
  return { subtitle, count }
}

/** Remove HTML-style `<...>` tags and ASS `{...}` override blocks from matching cues. */
export function stripTags(sub: Subtitle, predicate?: CuePredicate): Subtitle {
  return mapCues(
    sub,
    (c) => {
      const text = c.text
        .replace(/\{[^}]*\}/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\\[Nnh]/g, (m) => (m === '\\h' ? ' ' : '\n'))
      return text === c.text ? c : { ...c, text }
    },
    predicate,
  )
}

/** Trim trailing/leading whitespace per line and collapse repeated spaces. */
export function trimWhitespace(sub: Subtitle, predicate?: CuePredicate): Subtitle {
  return mapCues(
    sub,
    (c) => {
      const text = c.text
        .split('\n')
        .map((l) => l.replace(/[ \t]+/g, ' ').trim())
        .join('\n')
        .replace(/^\n+|\n+$/g, '')
      return text === c.text ? c : { ...c, text }
    },
    predicate,
  )
}

/** Drop cues whose text is empty after trimming. */
export function removeEmpty(sub: Subtitle): Subtitle {
  return { ...sub, cues: sub.cues.filter((c) => c.text.trim() !== '') }
}

/** Stable-sort cues by start time, then end time. */
export function sortByTime(sub: Subtitle): Subtitle {
  const cues = sub.cues
    .map((c, i) => ({ c, i }))
    .sort((x, y) => x.c.start - y.c.start || x.c.end - y.c.end || x.i - y.i)
    .map((w) => w.c)
  return { ...sub, cues }
}

/** Apply mojibake repair to matching cues. */
export function fixMojibakeAll(sub: Subtitle, predicate?: CuePredicate): Subtitle {
  return mapCues(
    sub,
    (c) => {
      const text = fixMojibake(c.text)
      return text === c.text ? c : { ...c, text }
    },
    predicate,
  )
}
