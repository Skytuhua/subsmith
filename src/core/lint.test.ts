import { describe, it, expect } from "vitest";
import type { Cue, Subtitle } from "./types";
import {
  lint,
  summarize,
  fixOverlaps,
  fixNegativeDurations,
  fixOrder,
  fixEmpty,
} from "./lint";

function sub(cues: Array<[number, number, string]>): Subtitle {
  return {
    format: "srt",
    cues: cues.map(
      ([start, end, text], i): Cue => ({ id: `c${i}`, start, end, text }),
    ),
  };
}

describe("lint", () => {
  it("flags a negative/zero duration as an error", () => {
    const f = lint(sub([[2000, 1000, "oops"]]));
    expect(
      f.some((x) => x.rule === "negative-duration" && x.severity === "error"),
    ).toBe(true);
  });

  it("flags overlapping cues", () => {
    const f = lint(
      sub([
        [1000, 5000, "a"],
        [4000, 6000, "b"],
      ]),
    );
    expect(f.some((x) => x.rule === "overlap")).toBe(true);
  });

  it("flags out-of-order cues", () => {
    const f = lint(
      sub([
        [5000, 6000, "a"],
        [1000, 2000, "b"],
      ]),
    );
    expect(f.some((x) => x.rule === "out-of-order")).toBe(true);
  });

  it("detects an overlap even when the cues are out of order", () => {
    // Cue b precedes AND overlaps cue a, but appears second in the array. The old
    // "compare to the array-previous cue" check missed this; the sorted sweep catches it.
    const f = lint(
      sub([
        [2000, 5000, "a"],
        [1000, 3000, "b"],
      ]),
    );
    expect(f.some((x) => x.rule === "out-of-order")).toBe(true);
    expect(f.some((x) => x.rule === "overlap")).toBe(true);
  });

  it("flags empty text", () => {
    const f = lint(sub([[1000, 2000, "   "]]));
    expect(f.some((x) => x.rule === "empty-text")).toBe(true);
  });

  it("flags too-short display time", () => {
    const f = lint(sub([[1000, 1100, "hi"]]));
    expect(f.some((x) => x.rule === "too-short")).toBe(true);
  });

  it("flags too-long display time", () => {
    const f = lint(sub([[0, 8000, "hello"]])); // 8s > 7s default max
    expect(f.some((x) => x.rule === "too-long")).toBe(true);
  });

  it("flags fast reading speed", () => {
    const f = lint(sub([[0, 1000, "this is a fairly long line of text"]]));
    expect(f.some((x) => x.rule === "fast-reading")).toBe(true);
  });

  it("does not flag fast-reading when visible text is short after tag-stripping", () => {
    // Raw length > 10, but visibleLength <= 10 once {…} overrides are stripped, so the
    // two-condition guard (cps > max AND visibleLength > 10) must not fire.
    const f = lint(sub([[0, 1000, "{\\b1}hi{\\b0}"]]));
    expect(f.some((x) => x.rule === "fast-reading")).toBe(false);
  });

  it("summarizes severities", () => {
    const f = lint(
      sub([
        [2000, 1000, "oops"],
        [1000, 5000, "a"],
        [4000, 6000, "b"],
      ]),
    );
    const s = summarize(f);
    expect(s.total).toBe(f.length);
    expect(s.errors).toBeGreaterThan(0);
  });

  it("counts infos, warnings and errors distinctly", () => {
    const f = lint(
      sub([
        [2000, 1000, "neg"], // negative-duration -> error
        [0, 300, "x"], // too-short -> info
        [0, 1000, ""], // empty-text -> warning
      ]),
    );
    const s = summarize(f);
    expect(s.errors).toBeGreaterThan(0);
    expect(s.warnings).toBeGreaterThan(0);
    expect(s.infos).toBeGreaterThan(0);
    expect(s.total).toBe(s.errors + s.warnings + s.infos);
  });
});

describe("auto-fixers", () => {
  it("fixOverlaps removes overlap by trimming the earlier cue", () => {
    const fixed = fixOverlaps(
      sub([
        [1000, 5000, "a"],
        [4000, 6000, "b"],
      ]),
    );
    expect(fixed.cues[0].end).toBeLessThan(fixed.cues[1].start);
    expect(lint(fixed).some((x) => x.rule === "overlap")).toBe(false);
  });

  it("fixNegativeDurations gives a default duration", () => {
    const fixed = fixNegativeDurations(sub([[2000, 1000, "x"]]));
    expect(fixed.cues[0].end).toBe(3000);
  });

  it("fixOrder sorts by time", () => {
    const fixed = fixOrder(
      sub([
        [5000, 6000, "a"],
        [1000, 2000, "b"],
      ]),
    );
    expect(fixed.cues[0].text).toBe("b");
  });

  it("fixEmpty drops blank cues", () => {
    const fixed = fixEmpty(
      sub([
        [1000, 2000, "a"],
        [2000, 3000, ""],
      ]),
    );
    expect(fixed.cues).toHaveLength(1);
  });
});
