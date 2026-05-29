import type { Cue, ParseResult, ParseWarning, Subtitle } from "../types";
import { parseTimecode } from "../time";
import { nextId } from "../id";
import { TIMING_RE, normalize, truncate } from "./shared";

const isHeaderBlock = (block: string): boolean =>
  /^(WEBVTT|NOTE|STYLE|REGION)\b/.test(block.trimStart());

/**
 * Parse a WebVTT (.vtt) document. The `WEBVTT` line plus any `NOTE`/`STYLE`/`REGION`
 * header blocks are preserved verbatim in `vttHeader`. Per-cue identifiers and cue
 * settings (e.g. `line:0 position:50%`) are kept for faithful round-tripping.
 */
export function parseVtt(input: string): ParseResult {
  const text = normalize(input);
  const warnings: ParseWarning[] = [];
  const cues: Cue[] = [];

  if (!/^\uFEFF?WEBVTT/.test(text)) {
    warnings.push({
      message: 'File does not start with the "WEBVTT" signature.',
    });
  }

  const blocks = text.split(/\n[ \t]*\n+/);
  const headerBlocks: string[] = [];
  let seenCue = false;

  for (const block of blocks) {
    const trimmed = block.replace(/^\n+|\n+$/g, "");
    if (trimmed === "") continue;

    const hasTiming = TIMING_RE.test(trimmed);

    if (!hasTiming) {
      // Header material (WEBVTT / NOTE / STYLE / REGION). Only valid before cues.
      if (!seenCue && (isHeaderBlock(trimmed) || headerBlocks.length === 0)) {
        headerBlocks.push(trimmed);
      } else if (!seenCue) {
        headerBlocks.push(trimmed);
      } else {
        warnings.push({
          message: `Skipped a non-cue block after cues began: "${truncate(trimmed)}"`,
        });
      }
      continue;
    }

    seenCue = true;
    const lines = trimmed.split("\n");
    const timingIdx = lines.findIndex((l) => TIMING_RE.test(l));
    const m = lines[timingIdx].match(TIMING_RE)!;
    const start = parseTimecode(m[1]);
    const end = parseTimecode(m[2]);
    if (start === null || end === null) {
      warnings.push({
        message: `Skipped a cue with an unparseable timecode: "${lines[timingIdx]}"`,
      });
      continue;
    }

    // Lines before the timing line form an optional cue identifier.
    const idLine = lines.slice(0, timingIdx).join("\n").trim() || undefined;
    const settings = m[3]?.trim() || undefined;
    const textLines = lines.slice(timingIdx + 1);

    cues.push({
      id: nextId(),
      start,
      end,
      text: textLines.join("\n").replace(/\s+$/, ""),
      vtt: idLine || settings ? { id: idLine, settings } : undefined,
    });
  }

  const vttHeader =
    headerBlocks.length > 0 ? headerBlocks.join("\n\n") : "WEBVTT";
  const subtitle: Subtitle = { format: "vtt", cues, vttHeader };
  return { subtitle, warnings };
}
