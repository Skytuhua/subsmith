import type { Subtitle } from "./types";
import { sortByTime, removeEmpty } from "./transforms/text";

export type LintSeverity = "error" | "warning" | "info";
export type LintRule =
  | "negative-duration"
  | "overlap"
  | "out-of-order"
  | "too-short"
  | "too-long"
  | "empty-text"
  | "fast-reading";

export interface LintFinding {
  rule: LintRule;
  severity: LintSeverity;
  cueIndex: number;
  cueId: string;
  message: string;
}

export interface LintThresholds {
  minDurationMs: number;
  maxDurationMs: number;
  maxCps: number;
}

export const DEFAULT_THRESHOLDS: LintThresholds = {
  minDurationMs: 700,
  maxDurationMs: 7000,
  maxCps: 25,
};

/** Visible-character count (tags/whitespace excluded) for reading-speed estimates. */
function visibleLength(text: string): number {
  return text
    .replace(/\{[^}]*\}/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** Run all validation rules over a subtitle, returning ordered findings. */
export function lint(
  sub: Subtitle,
  thresholds: LintThresholds = DEFAULT_THRESHOLDS,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const cues = sub.cues;

  cues.forEach((c, i) => {
    const dur = c.end - c.start;
    if (dur <= 0) {
      findings.push({
        rule: "negative-duration",
        severity: "error",
        cueIndex: i,
        cueId: c.id,
        message: `Cue ${i + 1} ends before (or when) it starts.`,
      });
    } else {
      if (dur < thresholds.minDurationMs) {
        findings.push({
          rule: "too-short",
          severity: "info",
          cueIndex: i,
          cueId: c.id,
          message: `Cue ${i + 1} is on screen only ${dur} ms (under ${thresholds.minDurationMs} ms).`,
        });
      }
      if (dur > thresholds.maxDurationMs) {
        findings.push({
          rule: "too-long",
          severity: "info",
          cueIndex: i,
          cueId: c.id,
          message: `Cue ${i + 1} stays up ${(dur / 1000).toFixed(1)} s (over ${(thresholds.maxDurationMs / 1000).toFixed(0)} s).`,
        });
      }
      const cps = visibleLength(c.text) / (dur / 1000);
      if (cps > thresholds.maxCps && visibleLength(c.text) > 10) {
        findings.push({
          rule: "fast-reading",
          severity: "info",
          cueIndex: i,
          cueId: c.id,
          message: `Cue ${i + 1} reads fast (~${Math.round(cps)} chars/sec).`,
        });
      }
    }

    if (c.text.trim() === "") {
      findings.push({
        rule: "empty-text",
        severity: "warning",
        cueIndex: i,
        cueId: c.id,
        message: `Cue ${i + 1} has no text.`,
      });
    }

    if (i > 0) {
      const prev = cues[i - 1];
      if (c.start < prev.start) {
        findings.push({
          rule: "out-of-order",
          severity: "warning",
          cueIndex: i,
          cueId: c.id,
          message: `Cue ${i + 1} starts before the previous cue.`,
        });
      }
      if (c.start < prev.end && c.start >= prev.start) {
        findings.push({
          rule: "overlap",
          severity: "warning",
          cueIndex: i,
          cueId: c.id,
          message: `Cue ${i + 1} overlaps the previous cue by ${prev.end - c.start} ms.`,
        });
      }
    }
  });

  return findings;
}

export interface LintSummary {
  errors: number;
  warnings: number;
  infos: number;
  total: number;
}

export function summarize(findings: LintFinding[]): LintSummary {
  const s: LintSummary = {
    errors: 0,
    warnings: 0,
    infos: 0,
    total: findings.length,
  };
  for (const f of findings) {
    if (f.severity === "error") s.errors += 1;
    else if (f.severity === "warning") s.warnings += 1;
    else s.infos += 1;
  }
  return s;
}

// ---- Auto-fixers (each returns a new Subtitle) ----

/** Trim each cue's end so it never overlaps the next cue (leaves a 1 ms gap). */
export function fixOverlaps(sub: Subtitle): Subtitle {
  const cues = sub.cues.map((c) => ({ ...c }));
  for (let i = 0; i < cues.length - 1; i += 1) {
    const cur = cues[i];
    const next = cues[i + 1];
    if (cur.end > next.start && next.start > cur.start) {
      cur.end = Math.max(cur.start + 1, next.start - 1);
    }
  }
  return { ...sub, cues };
}

/** Give any cue with a non-positive duration a default 1000 ms display time. */
export function fixNegativeDurations(
  sub: Subtitle,
  defaultMs = 1000,
): Subtitle {
  return {
    ...sub,
    cues: sub.cues.map((c) =>
      c.end <= c.start ? { ...c, end: c.start + defaultMs } : c,
    ),
  };
}

export { sortByTime as fixOrder, removeEmpty as fixEmpty };
