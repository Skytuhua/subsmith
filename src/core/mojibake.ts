/**
 * Mojibake repair.
 *
 * The most common subtitle corruption is UTF-8 bytes that were decoded as Latin-1 /
 * Windows-1252, turning `é` into `Ã©`, `—` into `â€"`, and so on. The fix is to map each
 * character back to a byte and re-decode the result as UTF-8. We only attempt it when the
 * string is pure single-byte (all code points ≤ 0xFF) and the re-decode is valid UTF-8,
 * so clean text is never damaged.
 */

const SUSPICIOUS = /Ã[\x80-\xBF]|â€[\x9C\x9D\x93\x94\xA6]|Â[\xA0-\xBF]|Ã¢â‚¬|ï»¿/

/** Heuristic: does this text contain the tell-tale signatures of UTF-8-as-Latin1 mojibake? */
export function looksLikeMojibake(text: string): boolean {
  return SUSPICIOUS.test(text)
}

/** Attempt to repair UTF-8-misread-as-Latin1 mojibake. Returns the original on any doubt. */
export function fixMojibake(text: string): string {
  // Bail out if the string contains code points that can't have come from a single byte.
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) > 0xff) return text
  }
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i)
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    // Only accept the repair if it actually changed something and didn't introduce U+FFFD.
    if (decoded !== text && !decoded.includes('�')) return decoded
    return text
  } catch {
    return text
  }
}
