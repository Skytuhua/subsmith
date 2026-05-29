/** Shared helpers for the SRT/VTT serializers (block, blank-line-delimited formats). */

/** Remove ASS override blocks like `{\an8}` that are meaningless in SRT/VTT. */
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
export function visibleCues<
  T extends { ass?: { kind: "Dialogue" | "Comment" } },
>(cues: T[]): T[] {
  return cues.filter((c) => c.ass?.kind !== "Comment");
}
