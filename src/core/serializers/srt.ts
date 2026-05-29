import type { SerializeOptions, Subtitle } from "../types";
import { formatSrt } from "../time";

/** Remove ASS override blocks like `{\an8}` that are meaningless in SRT. */
export function stripAssOverrides(text: string): string {
  return text
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/\\h/g, " ")
    .replace(/\\N/g, "\n");
}

/**
 * Prepare cue text for a blank-line-delimited format (SRT/VTT): strip ASS overrides and
 * collapse interior blank lines so the output can always be parsed back (a blank line
 * would otherwise be read as a cue boundary and silently truncate the cue).
 */
export function textForBlockFormat(text: string): string {
  return stripAssOverrides(text).replace(/\n[ \t]*\n+/g, "\n");
}

/** Drop ASS `Comment` events when converting to a display-only format. */
export function visibleCues<T extends { ass?: { kind: "Dialogue" | "Comment" } }>(
  cues: T[],
): T[] {
  return cues.filter((c) => c.ass?.kind !== "Comment");
}

/** Serialize a subtitle document to SubRip (.srt). */
export function serializeSrt(
  sub: Subtitle,
  opts: SerializeOptions = {},
): string {
  const eol = opts.eol ?? "\n";
  const blocks = visibleCues(sub.cues).map((c, i) => {
    const body = textForBlockFormat(c.text);
    return [
      `${i + 1}`,
      `${formatSrt(c.start)} --> ${formatSrt(c.end)}`,
      body,
    ].join("\n");
  });
  let out = blocks.join("\n\n") + "\n";
  if (eol !== "\n") out = out.replace(/\n/g, eol);
  return opts.bom ? "\uFEFF" + out : out;
}
