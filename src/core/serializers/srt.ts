import type { SerializeOptions, Subtitle } from "../types";
import { formatSrt } from "../time";
import { textForBlockFormat, visibleCues } from "./shared";

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
