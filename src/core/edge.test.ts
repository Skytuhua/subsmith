import { describe, it, expect } from "vitest";
import { parse, detectFormat } from "./parsers";
import { serialize, serializeAss } from "./serializers";
import { parseAss } from "./parsers/ass";
import { shift } from "./transforms/shift";
import { sortByTime, findReplace } from "./transforms/text";
import { lint, fixOverlaps } from "./lint";
import { fixMojibake, looksLikeMojibake } from "./mojibake";
import { parseTimecode, formatSrt } from "./time";

describe("empty & whitespace input", () => {
  it("parses empty strings without throwing", () => {
    for (const fmt of ["srt", "vtt", "ass"] as const) {
      const { subtitle } = parse("", fmt);
      expect(subtitle.cues).toEqual([]);
    }
  });
  it("parses whitespace-only input", () => {
    const { subtitle } = parse("   \n\n  \t \n", "srt");
    expect(subtitle.cues).toEqual([]);
  });
  it("serializes an empty document for every format", () => {
    const { subtitle } = parse("", "srt");
    expect(() => serialize(subtitle, "srt")).not.toThrow();
    expect(() => serialize(subtitle, "vtt")).not.toThrow();
    expect(() => serialize(subtitle, "ass")).not.toThrow();
  });
});

describe("malformed SRT recovery", () => {
  it("skips bad blocks but keeps good ones", () => {
    const input = [
      "1",
      "garbage with no arrow",
      "",
      "2",
      "00:00:01,000 --> 00:00:02,000",
      "good",
      "",
      "3",
      "00:00:bad,000 --> 00:00:02,000",
      "bad time",
    ].join("\n");
    const { subtitle, warnings } = parse(input, "srt");
    expect(subtitle.cues).toHaveLength(1);
    expect(subtitle.cues[0].text).toBe("good");
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("handles CRLF, BOM, and no trailing newline", () => {
    const input = "﻿1\r\n00:00:01,000 --> 00:00:02,000\r\nhi";
    const { subtitle } = parse(input, "srt");
    expect(subtitle.cues).toHaveLength(1);
    expect(subtitle.cues[0].text).toBe("hi");
  });
});

describe("unusual Unicode", () => {
  it("preserves emoji, RTL and combining marks through a round-trip", () => {
    const text = "Café 😀 ‫مرحبا‬ é";
    const input = `1\n00:00:01,000 --> 00:00:02,000\n${text}`;
    const { subtitle } = parse(input, "srt");
    expect(subtitle.cues[0].text).toBe(text);
    expect(serialize(subtitle, "srt")).toContain(text);
  });
});

describe("ASS robustness", () => {
  it("respects a reordered Format line", () => {
    const ass = [
      "[Events]",
      "Format: Start, End, Text, Style",
      "Dialogue: 0:00:01.00,0:00:02.00,Hello there,Default",
    ].join("\n");
    const { subtitle } = parseAss(ass);
    expect(subtitle.cues[0].text).toBe("Hello there");
    expect(subtitle.cues[0].start).toBe(1000);
    expect(subtitle.cues[0].ass?.style).toBe("Default");
    // `Text` is canonicalized to the LAST field on export (with a matching Format line),
    // so a comma in dialogue can never corrupt the following column.
    const out = serializeAss(subtitle);
    expect(out).toContain("Format: Start, End, Style, Text");
    expect(out).toContain("Dialogue: 0:00:01.00,0:00:02.00,Default,Hello there");
    // And it round-trips back to the same values.
    const again = parseAss(out).subtitle;
    expect(again.cues[0].text).toBe("Hello there");
    expect(again.cues[0].ass?.style).toBe("Default");
  });

  it("does not corrupt a comma in dialogue when Text is not last", () => {
    const ass = [
      "[Events]",
      "Format: Start, End, Text, Style",
      "Dialogue: 0:00:01.00,0:00:02.00,Hello, world,Default",
    ].join("\n");
    // Only Text can hold commas in ASS, so the parser must read the FIRST parse correctly,
    // even with a non-standard Text-not-last Format line.
    const first = parseAss(ass).subtitle;
    expect(first.cues[0].text).toBe("Hello, world");
    expect(first.cues[0].ass?.style).toBe("Default");
    // …and it stays lossless across export (which canonicalizes Text to last) + re-import.
    const round = parseAss(serializeAss(first)).subtitle;
    expect(round.cues[0].text).toBe("Hello, world");
    expect(round.cues[0].ass?.style).toBe("Default");
  });

  it("keeps commas inside the final text field", () => {
    const ass = [
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,a, b, c",
    ].join("\n");
    const { subtitle } = parseAss(ass);
    expect(subtitle.cues[0].text).toBe("a, b, c");
    // Round-trips losslessly because Text is the final field.
    expect(parseAss(serializeAss(subtitle)).subtitle.cues[0].text).toBe("a, b, c");
  });

  it("drops ASS Comment events when converting to SRT/VTT but keeps them in ASS", () => {
    const ass = [
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,visible line",
      "Comment: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,production note",
    ].join("\n");
    const { subtitle } = parseAss(ass);
    const srt = serialize(subtitle, "srt");
    expect(srt).toContain("visible line");
    expect(srt).not.toContain("production note");
    // Staying in ASS preserves the comment.
    expect(serialize(subtitle, "ass")).toContain("production note");
  });
});

describe("VTT without signature", () => {
  it("still parses cues and warns", () => {
    const input = "00:00:01.000 --> 00:00:02.000\nhi";
    const { subtitle, warnings } = parse(input, "vtt");
    expect(subtitle.cues).toHaveLength(1);
    expect(warnings.some((w) => /WEBVTT/.test(w.message))).toBe(true);
  });
});

describe("large input performance", () => {
  it("parses, sorts and serializes 20k cues quickly", () => {
    const lines: string[] = [];
    for (let i = 0; i < 20000; i++) {
      const s = i * 2000;
      lines.push(
        `${i + 1}`,
        `${formatSrt(s)} --> ${formatSrt(s + 1500)}`,
        `Line number ${i}`,
        "",
      );
    }
    const big = lines.join("\n");
    const t0 = performance.now();
    const { subtitle } = parse(big, "srt");
    const shifted = shift(subtitle, 1000);
    const sorted = sortByTime(shifted);
    const out = serialize(sorted, "srt");
    const elapsed = performance.now() - t0;
    expect(subtitle.cues).toHaveLength(20000);
    expect(out.length).toBeGreaterThan(0);
    // Generous bound — pure logic should be well under this even on slow CI.
    expect(elapsed).toBeLessThan(3000);
  });
});

describe("timecode edge cases", () => {
  it("tolerates overflow fields", () => {
    expect(parseTimecode("00:00:90,000")).toBe(90000);
    expect(parseTimecode("00:90:00,000")).toBe(90 * 60000);
  });
  it("round-trips formatSrt(parseTimecode)", () => {
    expect(formatSrt(parseTimecode("01:23:45,678")!)).toBe("01:23:45,678");
  });
});

describe("mojibake guards", () => {
  it("does not change already-correct text", () => {
    expect(fixMojibake("Perfectly fine — café")).toBe("Perfectly fine — café");
  });
  it("leaves non-latin scripts untouched", () => {
    const jp = "こんにちは";
    expect(fixMojibake(jp)).toBe(jp);
    expect(looksLikeMojibake(jp)).toBe(false);
  });
});

describe("detectFormat stability", () => {
  it("falls back to srt for unknown content", () => {
    expect(detectFormat("just some text")).toBe("srt");
  });
});

describe("SRT serializer always produces parseable output", () => {
  it("collapses interior blank lines so cues never get truncated on reload", () => {
    // An ASS cue with `\N\N` yields text containing an interior blank line; converting to
    // SRT must not emit an unparseable block.
    const ass = [
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,line one\\N\\Nline three",
    ].join("\n");
    const { subtitle } = parseAss(ass);
    expect(subtitle.cues[0].text).toBe("line one\n\nline three");
    const out = serialize(subtitle, "srt");
    const reparsed = parse(out, "srt").subtitle;
    expect(reparsed.cues).toHaveLength(1);
    expect(reparsed.cues[0].text).toBe("line one\nline three");
  });
});

describe("fixOverlaps resolves all overlaps", () => {
  it("handles equal-start and fully-contained cues", () => {
    const sub = parse(
      [
        "1",
        "00:00:00,000 --> 00:00:09,000",
        "a",
        "",
        "2",
        "00:00:00,000 --> 00:00:08,000",
        "b",
        "",
        "3",
        "00:00:03,000 --> 00:00:04,000",
        "c",
      ].join("\n"),
      "srt",
    ).subtitle;
    const fixed = fixOverlaps(sub);
    expect(fixed.cues.some((_, i) => {
      if (i === 0) return false;
      const prev = fixed.cues[i - 1];
      const cur = fixed.cues[i];
      return cur.start < prev.end && cur.start >= prev.start;
    })).toBe(false);
    expect(lint(fixed).some((f) => f.rule === "overlap")).toBe(false);
  });
});

describe("find & replace $n backreference safety", () => {
  it("leaves $1 literal when the regex has no capture group", () => {
    const sub = parse("1\n00:00:01,000 --> 00:00:02,000\nab", "srt").subtitle;
    const { subtitle } = findReplace(sub, "a", "[$1]", { regex: true });
    expect(subtitle.cues[0].text).toBe("[$1]b");
  });
  it("substitutes real capture groups", () => {
    const sub = parse("1\n00:00:01,000 --> 00:00:02,000\nJohn Smith", "srt").subtitle;
    const { subtitle } = findReplace(sub, "(\\w+) (\\w+)", "$2 $1", { regex: true });
    expect(subtitle.cues[0].text).toBe("Smith John");
  });
});
