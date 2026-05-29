import type { Cue, ParseResult, ParseWarning, Subtitle } from "../types";
import { parseTimecode } from "../time";
import { nextId } from "../id";
import { TIMING_RE, normalize, truncate } from "./shared";

export { normalize };

/**
 * Parse a SubRip (.srt) document. Lenient: blocks missing an index line are accepted,
 * malformed blocks are skipped with a warning rather than aborting the whole parse.
 */
export function parseSrt(input: string): ParseResult {
  const text = normalize(input);
  const warnings: ParseWarning[] = [];
  const cues: Cue[] = [];

  // Split into blocks on one-or-more blank lines.
  const blocks = text.split(/\n[ \t]*\n+/);

  for (const block of blocks) {
    const trimmed = block.replace(/^\n+|\n+$/g, "");
    if (trimmed === "") continue;

    const lines = trimmed.split("\n");
    const timingIdx = lines.findIndex((l) => TIMING_RE.test(l));
    if (timingIdx === -1) {
      warnings.push({
        message: `Skipped a block with no timing line: "${truncate(trimmed)}"`,
      });
      continue;
    }

    const m = lines[timingIdx].match(TIMING_RE)!;
    const start = parseTimecode(m[1]);
    const end = parseTimecode(m[2]);
    if (start === null || end === null) {
      warnings.push({
        message: `Skipped a block with an unparseable timecode: "${lines[timingIdx]}"`,
      });
      continue;
    }

    const textLines = lines.slice(timingIdx + 1);
    cues.push({
      id: nextId(),
      start,
      end,
      text: textLines.join("\n").replace(/\s+$/, ""),
    });
  }

  const subtitle: Subtitle = { format: "srt", cues };
  return { subtitle, warnings };
}
