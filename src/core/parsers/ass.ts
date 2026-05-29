import type {
  AssEvent,
  Cue,
  ParseResult,
  ParseWarning,
  Subtitle,
} from "../types";
import { parseTimecode } from "../time";
import { nextId } from "../id";
import { normalize } from "./shared";

export const DEFAULT_ASS_EVENT_FORMAT = [
  "layer",
  "start",
  "end",
  "style",
  "name",
  "marginl",
  "marginr",
  "marginv",
  "effect",
  "text",
];

/**
 * Split an event's field string into exactly `count` fields. Every field except the
 * last is delimited by a comma; the final field (the dialogue text) keeps any commas
 * it contains, per the ASS spec.
 */
function splitFields(rest: string, count: number): string[] {
  const out: string[] = [];
  let idx = 0;
  for (let k = 0; k < count - 1; k += 1) {
    const c = rest.indexOf(",", idx);
    if (c === -1) {
      out.push(rest.slice(idx));
      while (out.length < count) out.push("");
      return out;
    }
    out.push(rest.slice(idx, c));
    idx = c + 1;
  }
  out.push(rest.slice(idx));
  return out;
}

/**
 * Parse an Advanced SubStation Alpha (.ass / .ssa) document. The header — `[Script Info]`,
 * `[V4+ Styles]`, and the `[Events]` `Format:` line — is preserved verbatim in `assHeader`
 * so styling round-trips. `\N` hard line breaks are converted to `\n` internally.
 */
export function parseAss(input: string): ParseResult {
  const text = normalize(input);
  const warnings: ParseWarning[] = [];
  const cues: Cue[] = [];
  const lines = text.split("\n");

  let eventFormat: string[] | null = null;
  let headerEndLine = -1;
  let firstEventLine = -1;
  let inEvents = false;

  interface RawEvent {
    kind: "Dialogue" | "Comment";
    rest: string;
    lineNo: number;
  }
  const rawEvents: RawEvent[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const sec = line.match(/^\s*\[(.+)\]\s*$/);
    if (sec) {
      inEvents = sec[1].trim().toLowerCase() === "events";
      continue;
    }
    if (inEvents && /^\s*Format\s*:/i.test(line)) {
      eventFormat = line
        .replace(/^\s*Format\s*:/i, "")
        .split(",")
        .map((s) => s.trim().toLowerCase());
      headerEndLine = i;
      continue;
    }
    const ev = line.match(/^\s*(Dialogue|Comment)\s*:\s*(.*)$/i);
    if (ev) {
      if (firstEventLine === -1) firstEventLine = i;
      rawEvents.push({
        kind: (ev[1][0].toUpperCase() + ev[1].slice(1).toLowerCase()) as
          | "Dialogue"
          | "Comment",
        rest: ev[2],
        lineNo: i,
      });
    }
  }

  const format = eventFormat ?? DEFAULT_ASS_EVENT_FORMAT;
  const textIdx = format.indexOf("text");
  const startIdx = format.indexOf("start");
  const endIdx = format.indexOf("end");

  if (startIdx === -1 || endIdx === -1 || textIdx === -1) {
    warnings.push({
      message: "ASS [Events] Format is missing Start/End/Text; using defaults.",
    });
  } else if (textIdx !== format.length - 1) {
    warnings.push({
      message:
        "ASS Format lists Text before other fields (non-standard); commas in dialogue may be ambiguous. Text will be written last on export.",
    });
  }

  for (const raw of rawEvents) {
    const fields = splitFields(raw.rest, format.length);
    const startStr = fields[startIdx === -1 ? 1 : startIdx] ?? "";
    const endStr = fields[endIdx === -1 ? 2 : endIdx] ?? "";
    const start = parseTimecode(startStr);
    const end = parseTimecode(endStr);
    if (start === null || end === null) {
      warnings.push({
        line: raw.lineNo + 1,
        message: `Skipped an event with bad timing: "${startStr} / ${endStr}"`,
      });
      continue;
    }
    const rawText = fields[textIdx === -1 ? format.length - 1 : textIdx] ?? "";
    const meta: AssEvent = {
      kind: raw.kind,
      layer: pick(fields, format, "layer", "0"),
      style: pick(fields, format, "style", "Default"),
      name: pick(fields, format, "name", ""),
      marginL: pick(fields, format, "marginl", "0"),
      marginR: pick(fields, format, "marginr", "0"),
      marginV: pick(fields, format, "marginv", "0"),
      effect: pick(fields, format, "effect", ""),
    };
    cues.push({
      id: nextId(),
      start,
      end,
      text: rawText.replace(/\\N/g, "\n"),
      ass: meta,
    });
  }

  // Header = everything up to & including the [Events] Format line. Fall back to the
  // text before the first event, or a synthesized minimal header.
  let assHeader: string;
  if (headerEndLine >= 0) {
    assHeader = lines.slice(0, headerEndLine + 1).join("\n");
  } else if (firstEventLine >= 0) {
    assHeader =
      lines.slice(0, firstEventLine).join("\n").replace(/\n+$/, "") +
      `\n\n[Events]\nFormat: ${formatTitleCase(format).join(", ")}`;
  } else {
    warnings.push({ message: "No subtitle events found in ASS file." });
    assHeader = synthHeader(format);
  }

  const subtitle: Subtitle = {
    format: "ass",
    cues,
    assHeader,
    assEventFormat: format,
  };
  return { subtitle, warnings };
}

function pick(
  fields: string[],
  format: string[],
  key: string,
  fallback: string,
): string {
  const i = format.indexOf(key);
  if (i === -1 || fields[i] === undefined) return fallback;
  return fields[i].trim();
}

export function formatTitleCase(format: string[]): string[] {
  const map: Record<string, string> = {
    layer: "Layer",
    start: "Start",
    end: "End",
    style: "Style",
    name: "Name",
    marginl: "MarginL",
    marginr: "MarginR",
    marginv: "MarginV",
    effect: "Effect",
    text: "Text",
  };
  return format.map((f) => map[f] ?? f);
}

export function synthHeader(
  format: string[] = DEFAULT_ASS_EVENT_FORMAT,
): string {
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1",
    "",
    "[Events]",
    `Format: ${formatTitleCase(format).join(", ")}`,
  ].join("\n");
}
