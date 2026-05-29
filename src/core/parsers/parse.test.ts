import { describe, it, expect, beforeEach } from "vitest";
import { parse, detectFormat, parseSrt, parseVtt, parseAss } from "./index";
import { serializeSrt, serializeVtt, serializeAss } from "../serializers";
import { resetIds } from "../id";

beforeEach(() => resetIds());

const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello world
second line

2
00:00:05,000 --> 00:00:06,500
Next cue
`;

const VTT = `WEBVTT - Some title

NOTE this is a comment

00:00:01.000 --> 00:00:04.000 line:0 position:50%
Hello world

cue-2
00:00:05.000 --> 00:00:06.500
Next cue
`;

const ASS = `[Script Info]
Title: Test
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize
Style: Default,Arial,20

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello world\\Nsecond line
Comment: 0,0:00:05.00,0:00:06.50,Default,,0,0,0,,Next cue, with comma
`;

describe("detectFormat", () => {
  it("detects each format from content", () => {
    expect(detectFormat(SRT)).toBe("srt");
    expect(detectFormat(VTT)).toBe("vtt");
    expect(detectFormat(ASS)).toBe("ass");
  });
  it("uses filename as a tie-breaker", () => {
    expect(detectFormat("no timing here", "x.vtt")).toBe("vtt");
    expect(detectFormat("no timing here", "x.ass")).toBe("ass");
  });
});

describe("SRT parsing", () => {
  it("parses cues with multi-line text", () => {
    const { subtitle, warnings } = parseSrt(SRT);
    expect(warnings).toHaveLength(0);
    expect(subtitle.cues).toHaveLength(2);
    expect(subtitle.cues[0]).toMatchObject({
      start: 1000,
      end: 4000,
      text: "Hello world\nsecond line",
    });
    expect(subtitle.cues[1]).toMatchObject({
      start: 5000,
      end: 6500,
      text: "Next cue",
    });
  });

  it("tolerates a missing index line", () => {
    const noIndex = `00:00:01,000 --> 00:00:02,000\nHi`;
    const { subtitle } = parseSrt(noIndex);
    expect(subtitle.cues).toHaveLength(1);
    expect(subtitle.cues[0].text).toBe("Hi");
  });

  it("skips a malformed block with a warning instead of throwing", () => {
    const bad = `1\nnonsense line\nstill nonsense\n\n2\n00:00:03,000 --> 00:00:04,000\nok`;
    const { subtitle, warnings } = parseSrt(bad);
    expect(subtitle.cues).toHaveLength(1);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("round-trips SRT byte-for-byte", () => {
    const { subtitle } = parseSrt(SRT);
    expect(serializeSrt(subtitle)).toBe(SRT);
  });

  it("recovers text that appears before the timing line instead of dropping it", () => {
    const { subtitle, warnings } = parseSrt(
      "Some caption\n00:00:01,000 --> 00:00:02,000",
    );
    expect(subtitle.cues).toHaveLength(1);
    expect(subtitle.cues[0].text).toBe("Some caption");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("does not warn on a normal index-then-timing block", () => {
    const { warnings } = parseSrt("7\n00:00:01,000 --> 00:00:02,000\nHi");
    expect(warnings).toHaveLength(0);
  });
});

describe("VTT parsing", () => {
  it("preserves header, cue ids and settings", () => {
    const { subtitle } = parseVtt(VTT);
    expect(subtitle.vttHeader).toContain("WEBVTT");
    expect(subtitle.vttHeader).toContain("NOTE this is a comment");
    expect(subtitle.cues[0].vtt?.settings).toBe("line:0 position:50%");
    expect(subtitle.cues[1].vtt?.id).toBe("cue-2");
  });

  it("round-trips VTT", () => {
    const { subtitle } = parseVtt(VTT);
    const out = serializeVtt(subtitle);
    const reparsed = parseVtt(out);
    expect(reparsed.subtitle.cues).toHaveLength(2);
    expect(reparsed.subtitle.cues[0].vtt?.settings).toBe("line:0 position:50%");
    // Verify timing and text survive serialization, not just the cue count/settings.
    expect(reparsed.subtitle.cues[0].start).toBe(1000);
    expect(reparsed.subtitle.cues[0].end).toBe(4000);
    expect(reparsed.subtitle.cues[0].text).toBe("Hello world");
    expect(reparsed.subtitle.cues[1].vtt?.id).toBe("cue-2");
  });
});

describe("ASS parsing", () => {
  it("parses events, converts \\N, and keeps commas in text", () => {
    const { subtitle } = parseAss(ASS);
    expect(subtitle.cues).toHaveLength(2);
    expect(subtitle.cues[0].text).toBe("Hello world\nsecond line");
    expect(subtitle.cues[0].ass?.kind).toBe("Dialogue");
    expect(subtitle.cues[1].text).toBe("Next cue, with comma");
    expect(subtitle.cues[1].ass?.kind).toBe("Comment");
  });

  it("preserves the header and round-trips events", () => {
    const { subtitle } = parseAss(ASS);
    const out = serializeAss(subtitle);
    expect(out).toContain("[V4+ Styles]");
    expect(out).toContain(
      "Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello world\\Nsecond line",
    );
    expect(out).toContain(
      "Comment: 0,0:00:05.00,0:00:06.50,Default,,0,0,0,,Next cue, with comma",
    );
  });
});

describe("serializer options", () => {
  it("prepends a UTF-8 BOM when requested, across formats", () => {
    const { subtitle } = parseSrt(SRT);
    expect(serializeSrt(subtitle, { bom: true }).startsWith("﻿")).toBe(true);
    expect(serializeSrt(subtitle, { bom: false }).startsWith("﻿")).toBe(
      false,
    );
    expect(serializeVtt(subtitle, { bom: true }).startsWith("﻿")).toBe(
      true,
    );
    expect(serializeAss(subtitle, { bom: true }).startsWith("﻿")).toBe(
      true,
    );
  });
  it("emits CRLF line endings when requested and no lone LF remains", () => {
    const { subtitle } = parseSrt(SRT);
    const out = serializeSrt(subtitle, { eol: "\r\n" });
    expect(out).toContain("\r\n");
    expect(out.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });
});

describe("format conversion", () => {
  it("converts ASS to SRT, stripping override tags", () => {
    const withTags = ASS.replace("Hello world", "{\\an8}Hello world");
    const { subtitle } = parseAss(withTags);
    const srt = serializeSrt(subtitle);
    expect(srt).toContain("Hello world");
    expect(srt).not.toContain("{\\an8}");
    expect(srt).toContain("00:00:01,000 --> 00:00:04,000");
  });

  it("converts SRT to ASS using a synthesized header", () => {
    const { subtitle } = parse(SRT, "srt");
    const ass = serializeAss(subtitle);
    expect(ass).toContain("[Events]");
    expect(ass).toContain("Dialogue: 0,0:00:01.00,0:00:04.00,Default");
  });

  it("converts SRT to VTT", () => {
    const { subtitle } = parse(SRT, "srt");
    const vtt = serializeVtt(subtitle);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:01.000 --> 00:00:04.000");
  });
});
