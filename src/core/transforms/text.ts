import type { Subtitle } from "../types";
import { mapCues, type CuePredicate } from "./common";
import { fixMojibake } from "../mojibake";

export interface FindReplaceOptions {
  regex?: boolean;
  caseSensitive?: boolean;
  predicate?: CuePredicate;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Find & replace across matching cues. Returns the new subtitle and the replacement count. */
export function findReplace(
  sub: Subtitle,
  find: string,
  replace: string,
  opts: FindReplaceOptions = {},
): { subtitle: Subtitle; count: number; error?: string } {
  if (find === "") return { subtitle: sub, count: 0 };
  let re: RegExp;
  try {
    const flags = "g" + (opts.caseSensitive ? "" : "i");
    re = new RegExp(opts.regex ? find : escapeRegExp(find), flags);
  } catch (e) {
    return { subtitle: sub, count: 0, error: (e as Error).message };
  }

  let count = 0;
  const subtitle = mapCues(
    sub,
    (c) => {
      const next = c.text.replace(re, (...args) => {
        count += 1;
        // Support $1.. backreferences for regex mode; literal otherwise.
        if (!opts.regex) return replace;
        // args = [match, p1, …, pN, offset, whole(, groups?)]; capture-group count is N.
        const lastIsGroups = typeof args[args.length - 1] === "object";
        const groupCount = args.length - (lastIsGroups ? 4 : 3);
        return replace.replace(/\$(\d+)/g, (whole, n) => {
          const k = Number(n);
          if (k >= 1 && k <= groupCount) return (args[k] as string) ?? "";
          return whole; // leave out-of-range $n literal (no group to substitute)
        });
      });
      return next === c.text ? c : { ...c, text: next };
    },
    opts.predicate,
  );
  return { subtitle, count };
}

/**
 * Strip ASS `{...}` override blocks and HTML `<...>` tags from a single string, turning
 * ASS `\N`/`\n` line breaks into newlines and `\h` into a space. Pure string→string so it
 * can be used in render hot paths (e.g. the preview overlay) without allocating a Subtitle.
 */
export function stripDisplayTags(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\\[Nnh]/g, (m) => (m === "\\h" ? " " : "\n"));
}

/** Remove HTML-style `<...>` tags and ASS `{...}` override blocks from matching cues. */
export function stripTags(sub: Subtitle, predicate?: CuePredicate): Subtitle {
  return mapCues(
    sub,
    (c) => {
      const text = stripDisplayTags(c.text);
      return text === c.text ? c : { ...c, text };
    },
    predicate,
  );
}

/** Trim trailing/leading whitespace per line and collapse repeated spaces. */
export function trimWhitespace(
  sub: Subtitle,
  predicate?: CuePredicate,
): Subtitle {
  return mapCues(
    sub,
    (c) => {
      const text = c.text
        .split("\n")
        .map((l) => l.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/^\n+|\n+$/g, "");
      return text === c.text ? c : { ...c, text };
    },
    predicate,
  );
}

/** Drop cues whose text is empty after trimming. */
export function removeEmpty(sub: Subtitle): Subtitle {
  return { ...sub, cues: sub.cues.filter((c) => c.text.trim() !== "") };
}

/** Stable-sort cues by start time, then end time. */
export function sortByTime(sub: Subtitle): Subtitle {
  const cues = sub.cues
    .map((c, i) => ({ c, i }))
    .sort((x, y) => x.c.start - y.c.start || x.c.end - y.c.end || x.i - y.i)
    .map((w) => w.c);
  return { ...sub, cues };
}

/** Apply mojibake repair to matching cues. */
export function fixMojibakeAll(
  sub: Subtitle,
  predicate?: CuePredicate,
): Subtitle {
  return mapCues(
    sub,
    (c) => {
      const text = fixMojibake(c.text);
      return text === c.text ? c : { ...c, text };
    },
    predicate,
  );
}
