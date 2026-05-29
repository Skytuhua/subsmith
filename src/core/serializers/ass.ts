import type { SerializeOptions, Subtitle } from "../types";
import { formatAss } from "../time";
import {
  DEFAULT_ASS_EVENT_FORMAT,
  formatTitleCase,
  synthHeader,
} from "../parsers/ass";

/**
 * ASS has no field escaping, so the `Text` column MUST be the final field or any comma in
 * the dialogue corrupts the following fields. We canonicalize `text` to last on output and
 * rewrite the `[Events]` `Format:` line to match, guaranteeing a faithful round-trip.
 */
function canonicalFormat(format: string[]): string[] {
  if (format[format.length - 1] === "text") return format;
  return [...format.filter((f) => f !== "text"), "text"];
}

/** Replace the `Format:` line in an ASS header so it matches the (canonical) event order. */
function rewriteFormatLine(header: string, format: string[]): string {
  const lines = header.split("\n");
  const wanted = `Format: ${formatTitleCase(format).join(", ")}`;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (/^\s*Format\s*:/i.test(lines[i])) {
      lines[i] = wanted;
      return lines.join("\n");
    }
  }
  return header;
}

/** Serialize a subtitle document to Advanced SubStation Alpha (.ass). */
export function serializeAss(
  sub: Subtitle,
  opts: SerializeOptions = {},
): string {
  const eol = opts.eol ?? "\n";
  const format = canonicalFormat(sub.assEventFormat ?? DEFAULT_ASS_EVENT_FORMAT);
  const rawHeader = (sub.assHeader ?? synthHeader(format))
    .replace(/\r\n?/g, "\n")
    .replace(/\n+$/, "");
  const header = rewriteFormatLine(rawHeader, format);

  const events = sub.cues.map((c) => {
    const a = c.ass;
    const kind = a?.kind ?? "Dialogue";
    const values = format.map((field) => {
      switch (field) {
        case "start":
          return formatAss(c.start);
        case "end":
          return formatAss(c.end);
        case "text":
          return c.text.replace(/\n/g, "\\N");
        case "layer":
          return a?.layer ?? "0";
        case "style":
          return a?.style ?? "Default";
        case "name":
          return a?.name ?? "";
        case "marginl":
          return a?.marginL ?? "0";
        case "marginr":
          return a?.marginR ?? "0";
        case "marginv":
          return a?.marginV ?? "0";
        case "effect":
          return a?.effect ?? "";
        default:
          return "";
      }
    });
    return `${kind}: ${values.join(",")}`;
  });

  let out = header + "\n" + events.join("\n") + "\n";
  if (eol !== "\n") out = out.replace(/\n/g, eol);
  return opts.bom ? "﻿" + out : out;
}
