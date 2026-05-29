/**
 * Timecode parsing and formatting.
 *
 * Canonical unit is the integer millisecond. Negative inputs are accepted by the
 * transforms layer (so linear/shift math stays exact) but are clamped to zero by the
 * format functions, because no subtitle format can represent a negative timestamp.
 */

const clampNonNeg = (ms: number): number => (ms < 0 ? 0 : Math.round(ms))

const pad = (n: number, width: number): string => String(n).padStart(width, '0')

interface Hms {
  h: number
  m: number
  s: number
  ms: number
}

function split(ms: number): Hms {
  const total = clampNonNeg(ms)
  const h = Math.floor(total / 3_600_000)
  const m = Math.floor((total % 3_600_000) / 60_000)
  const s = Math.floor((total % 60_000) / 1000)
  const millis = total % 1000
  return { h, m, s, ms: millis }
}

/** `HH:MM:SS,mmm` — SubRip (SRT). */
export function formatSrt(ms: number): string {
  const { h, m, s, ms: millis } = split(ms)
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(millis, 3)}`
}

/** `HH:MM:SS.mmm` — WebVTT. */
export function formatVtt(ms: number): string {
  const { h, m, s, ms: millis } = split(ms)
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(millis, 3)}`
}

/** `H:MM:SS.cc` — Advanced SubStation Alpha (centisecond precision). */
export function formatAss(ms: number): string {
  const { h, m, s, ms: millis } = split(ms)
  // ASS uses centiseconds; round to nearest cs.
  const cs = Math.round(millis / 10)
  // A carry from rounding 995..999ms -> 100cs is handled by re-splitting.
  if (cs === 100) return formatAss((Math.floor(clampNonNeg(ms) / 1000) + 1) * 1000)
  return `${h}:${pad(m, 2)}:${pad(s, 2)}.${pad(cs, 2)}`
}

/** Human-friendly display timecode (`HH:MM:SS.mmm`, signed for negatives). */
export function formatDisplay(ms: number): string {
  if (ms < 0) return '-' + formatVtt(-ms)
  return formatVtt(ms)
}

/**
 * Parse a flexible timecode string to milliseconds.
 *
 * Accepts: `HH:MM:SS,mmm`, `HH:MM:SS.mmm`, `MM:SS.mmm`, `SS.mmm`, `H:MM:SS.cc`
 * (ASS centiseconds when fractional part is 2 digits), and bare integers (ms).
 * The fractional separator may be `.` or `,`. Returns `null` if unparseable.
 */
export function parseTimecode(input: string): number | null {
  const raw = input.trim()
  if (raw === '') return null

  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1) : raw

  // Bare integer => milliseconds.
  if (/^\d+$/.test(body)) {
    const v = parseInt(body, 10)
    return negative ? -v : v
  }

  // Split off the fractional part (after the last . or ,).
  const fracMatch = body.match(/[.,](\d+)\s*$/)
  let fracMs = 0
  let timePart = body
  if (fracMatch) {
    timePart = body.slice(0, fracMatch.index)
    const digits = fracMatch[1]
    if (digits.length === 2) {
      // Two digits => centiseconds (ASS style).
      fracMs = parseInt(digits, 10) * 10
    } else {
      // Treat as milliseconds, normalizing to exactly 3 digits.
      fracMs = parseInt(digits.padEnd(3, '0').slice(0, 3), 10)
    }
  }

  const parts = timePart.split(':')
  if (parts.length === 0 || parts.length > 3) return null
  if (parts.some((p) => p !== '' && !/^\d+$/.test(p))) return null

  let h = 0
  let m = 0
  let s = 0
  if (parts.length === 3) {
    h = parseInt(parts[0] || '0', 10)
    m = parseInt(parts[1] || '0', 10)
    s = parseInt(parts[2] || '0', 10)
  } else if (parts.length === 2) {
    m = parseInt(parts[0] || '0', 10)
    s = parseInt(parts[1] || '0', 10)
  } else {
    s = parseInt(parts[0] || '0', 10)
  }

  if (m > 59 || s > 59) {
    // Be lenient: allow overflow seconds/minutes by normalizing.
  }

  const total = h * 3_600_000 + m * 60_000 + s * 1000 + fracMs
  return negative ? -total : total
}

/** Clamp a time to a non-negative integer millisecond. */
export function clampTime(ms: number): number {
  return clampNonNeg(ms)
}
