import type { SerializeOptions, Subtitle } from "../types";
import { formatAss } from "../time";
import { DEFAULT_ASS_EVENT_FORMAT, synthHeader } from "../parsers/ass";

/** Serialize a subtitle document to Advanced SubStation Alpha (.ass). */
export function serializeAss(
  sub: Subtitle,
  opts: SerializeOptions = {},
): string {
  const eol = opts.eol ?? "\n";
  const format = sub.assEventFormat ?? DEFAULT_ASS_EVENT_FORMAT;
  const header = (sub.assHeader ?? synthHeader(format))
    .replace(/\r\n?/g, "\n")
    .replace(/\n+$/, "");

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
