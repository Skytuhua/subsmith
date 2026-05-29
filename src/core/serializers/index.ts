import type { SerializeOptions, Subtitle, SubtitleFormat } from "../types";
import { serializeSrt } from "./srt";
import { serializeVtt } from "./vtt";
import { serializeAss } from "./ass";

/** Serialize a subtitle to the given target format (independent of its source format). */
export function serialize(
  sub: Subtitle,
  format: SubtitleFormat,
  opts: SerializeOptions = {},
): string {
  switch (format) {
    case "vtt":
      return serializeVtt(sub, opts);
    case "ass":
      return serializeAss(sub, opts);
    case "srt":
    default:
      return serializeSrt(sub, opts);
  }
}

export { serializeSrt, serializeVtt, serializeAss };

export const FORMAT_EXTENSION: Record<SubtitleFormat, string> = {
  srt: "srt",
  vtt: "vtt",
  ass: "ass",
};

export const FORMAT_LABEL: Record<SubtitleFormat, string> = {
  srt: "SubRip (SRT)",
  vtt: "WebVTT",
  ass: "SubStation Alpha (ASS)",
};
