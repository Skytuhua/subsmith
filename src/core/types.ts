/**
 * Core domain types for Subsmith.
 *
 * Everything in `core/` is pure and framework-free: no DOM, no React. Times are
 * always stored as integer **milliseconds**; timecode strings are purely a
 * presentation/serialization concern.
 */

export type SubtitleFormat = "srt" | "vtt" | "ass";

/** Per-event metadata preserved so a SubStation Alpha file round-trips faithfully. */
export interface AssEvent {
  kind: "Dialogue" | "Comment";
  layer: string;
  style: string;
  name: string;
  marginL: string;
  marginR: string;
  marginV: string;
  effect: string;
}

/** Optional WebVTT per-cue metadata (identifier + cue settings). */
export interface VttMeta {
  id?: string;
  settings?: string;
}

/** A single subtitle cue. */
export interface Cue {
  /** Stable internal id (not persisted to the file). */
  id: string;
  /** Start time in milliseconds. */
  start: number;
  /** End time in milliseconds. */
  end: number;
  /** Cue text. Line breaks are normalized to `\n`. Inline tags are preserved. */
  text: string;
  /** WebVTT-only metadata. */
  vtt?: VttMeta;
  /** ASS/SSA-only metadata. */
  ass?: AssEvent;
}

/** A parsed subtitle document. */
export interface Subtitle {
  format: SubtitleFormat;
  cues: Cue[];
  /**
   * Raw text between the `WEBVTT` line and the first cue (regions/STYLE/NOTE blocks),
   * preserved for round-tripping. WebVTT only.
   */
  vttHeader?: string;
  /**
   * Everything in an ASS/SSA file up to and including the `[Events]` `Format:` line,
   * preserved verbatim for faithful round-tripping. ASS only.
   */
  assHeader?: string;
  /** Lower-cased field names from the `[Events]` `Format:` line. ASS only. */
  assEventFormat?: string[];
}

/** A non-fatal issue encountered while parsing. */
export interface ParseWarning {
  line?: number;
  message: string;
}

export interface ParseResult {
  subtitle: Subtitle;
  warnings: ParseWarning[];
}

/** Options controlling serialization. */
export interface SerializeOptions {
  /** Prepend a UTF-8 byte-order mark. Default false. */
  bom?: boolean;
  /** Line ending. Default '\n'. */
  eol?: "\n" | "\r\n";
}
