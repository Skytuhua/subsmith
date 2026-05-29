import { describe, it, expect } from "vitest";
import type { Cue, Subtitle } from "../types";
import { shift } from "./shift";
import { computeLinear, twoPointSync } from "./linear";
import { applyFramerate, fpsFactor } from "./framerate";
import { applyScale } from "./scale";
import {
  findReplace,
  stripTags,
  trimWhitespace,
  removeEmpty,
  sortByTime,
  fixMojibakeAll,
} from "./text";
import { merge } from "./merge";
import { setMinGap } from "./gap";

function sub(cues: Array<[number, number, string]>): Subtitle {
  return {
    format: "srt",
    cues: cues.map(
      ([start, end, text], i): Cue => ({ id: `c${i}`, start, end, text }),
    ),
  };
}

describe("shift", () => {
  it("moves all cues by a signed offset", () => {
    const s = shift(
      sub([
        [1000, 2000, "a"],
        [3000, 4000, "b"],
      ]),
      -500,
    );
    expect(s.cues.map((c) => [c.start, c.end])).toEqual([
      [500, 1500],
      [2500, 3500],
    ]);
  });
  it("can scope to a predicate", () => {
    const s = shift(
      sub([
        [1000, 2000, "a"],
        [3000, 4000, "b"],
      ]),
      1000,
      (_c, i) => i === 1,
    );
    expect(s.cues[0].start).toBe(1000);
    expect(s.cues[1].start).toBe(4000);
  });
});

describe("two-point linear sync", () => {
  it("solves a pure offset", () => {
    const t = computeLinear(1000, 3000, 5000, 7000)!; // +2000 everywhere
    expect(t.a).toBeCloseTo(1);
    expect(t.b).toBeCloseTo(2000);
  });
  it("corrects progressive drift (scale + offset)", () => {
    // First line right (1000->1000), last line 2% late (61000->60000): compress.
    const s = twoPointSync(
      sub([
        [1000, 2000, "a"],
        [61000, 62000, "b"],
      ]),
      1000,
      1000,
      61000,
      60000,
    )!;
    expect(s.cues[0].start).toBe(1000);
    expect(s.cues[1].start).toBe(60000);
  });
  it("returns null when the two source points are equal", () => {
    expect(computeLinear(1000, 2000, 1000, 5000)).toBeNull();
  });
});

describe("framerate conversion", () => {
  it("factor is from/to", () => {
    expect(fpsFactor(25, 23.976)).toBeCloseTo(1.0427, 3);
  });
  it("25 -> 23.976 slows timings down", () => {
    const s = applyFramerate(sub([[1000, 2000, "a"]]), 25, 23.976);
    expect(s.cues[0].start).toBe(Math.round(1000 * (25 / 23.976)));
    expect(s.cues[0].start).toBeGreaterThan(1000);
  });
  it("is a no-op when from === to", () => {
    const input = sub([[1000, 2000, "a"]]);
    expect(applyFramerate(input, 25, 25)).toBe(input);
  });
});

describe("scale", () => {
  it("stretches by percentage", () => {
    const s = applyScale(sub([[1000, 2000, "a"]]), 110);
    expect(s.cues[0].start).toBe(1100);
    expect(s.cues[0].end).toBe(2200);
  });
});

describe("text operations", () => {
  it("find & replace literal, counting matches", () => {
    const { subtitle, count } = findReplace(
      sub([
        [0, 1, "la la la"],
        [1, 2, "la"],
      ]),
      "la",
      "LA",
    );
    expect(count).toBe(4);
    expect(subtitle.cues[0].text).toBe("LA LA LA");
  });
  it("find & replace regex with backreference", () => {
    const { subtitle, count } = findReplace(
      sub([[0, 1, "John Smith"]]),
      "(\\w+) (\\w+)",
      "$2 $1",
      {
        regex: true,
      },
    );
    expect(count).toBe(1);
    expect(subtitle.cues[0].text).toBe("Smith John");
  });
  it("reports an error for an invalid regex", () => {
    const { error } = findReplace(sub([[0, 1, "x"]]), "(", "", { regex: true });
    expect(error).toBeTruthy();
  });
  it("strips HTML and ASS tags", () => {
    const s = stripTags(sub([[0, 1, "<i>hi</i> {\\an8}there"]]));
    expect(s.cues[0].text).toBe("hi there");
  });
  it("trims and collapses whitespace", () => {
    const s = trimWhitespace(sub([[0, 1, "  hello   world  \n  next "]]));
    expect(s.cues[0].text).toBe("hello world\nnext");
  });
  it("removes empty cues", () => {
    const s = removeEmpty(
      sub([
        [0, 1, "a"],
        [1, 2, "   "],
        [2, 3, "b"],
      ]),
    );
    expect(s.cues).toHaveLength(2);
  });
  it("sorts by start time stably", () => {
    const s = sortByTime(
      sub([
        [3000, 4000, "c"],
        [1000, 2000, "a"],
        [2000, 2500, "b"],
      ]),
    );
    expect(s.cues.map((c) => c.text)).toEqual(["a", "b", "c"]);
  });
  it("repairs mojibake", () => {
    // "Ã©" is the UTF-8 bytes of "é" misread as Latin-1.
    const s = fixMojibakeAll(sub([[0, 1, "cafÃ©"]]));
    expect(s.cues[0].text).toBe("café");
  });
});

describe("minimum gap", () => {
  it("trims an earlier cue's end so the gap to the next is at least gapMs", () => {
    const s = setMinGap(
      sub([
        [0, 1000, "a"],
        [1100, 2000, "b"],
      ]),
      200,
    );
    expect(s.cues[0].end).toBe(900); // 1100 - 200
    expect(s.cues[1].start).toBe(1100);
  });
  it("is order-independent (sorts first)", () => {
    const s = setMinGap(
      sub([
        [2000, 3000, "b"],
        [0, 1900, "a"],
      ]),
      100,
    );
    expect(s.cues.map((c) => c.text)).toEqual(["a", "b"]);
    expect(s.cues[0].end).toBe(1900); // already exactly 100 ms before b.start
  });
  it("clamps a trimmed end so it never precedes the cue's own start", () => {
    const s = setMinGap(
      sub([
        [500, 5000, "a"],
        [600, 2000, "b"],
      ]),
      200,
    );
    expect(s.cues[0].end).toBe(500); // limit 400 < start 500 → clamp to start
    expect(s.cues[0].end).toBeGreaterThanOrEqual(s.cues[0].start);
  });
  it("leaves an already-spaced document untouched in timings", () => {
    const s = setMinGap(
      sub([
        [0, 1000, "a"],
        [3000, 4000, "b"],
      ]),
      100,
    );
    expect(s.cues[0].end).toBe(1000);
  });
});

describe("merge", () => {
  it("appends a second file with an offset and re-sorts", () => {
    const a = sub([[1000, 2000, "a1"]]);
    const b = sub([[0, 1000, "b1"]]);
    const m = merge(a, b, 60000);
    expect(m.cues.map((c) => c.text)).toEqual(["a1", "b1"]);
    expect(m.cues[1].start).toBe(60000);
  });
});
