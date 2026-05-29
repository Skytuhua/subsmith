import { describe, it, expect } from "vitest";
import { reducer, initialState } from "./useEditor";
import type { Subtitle } from "../core/types";

const doc = (n: number): Subtitle => ({
  format: "srt",
  cues: Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    start: i * 1000,
    end: i * 1000 + 500,
    text: `t${i}`,
  })),
});

const load = (d: Subtitle) =>
  reducer(initialState, {
    type: "LOAD",
    doc: d,
    fileName: "a.srt",
    rawBytes: null,
    encoding: "utf-8",
    confidence: 1,
    warnings: [],
  });

describe("useEditor reducer", () => {
  it("LOAD sets the document, export format and resets history", () => {
    const s = load(doc(2));
    expect(s.doc?.cues).toHaveLength(2);
    expect(s.fileName).toBe("a.srt");
    expect(s.exportFormat).toBe("srt");
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
  });

  it("COMMIT records history; UNDO/REDO move between past and future", () => {
    let s = load(doc(1));
    const d2 = doc(2);
    s = reducer(s, { type: "COMMIT", doc: d2, label: "edit" });
    expect(s.doc).toBe(d2);
    expect(s.past).toHaveLength(1);
    expect(s.future).toEqual([]);

    s = reducer(s, { type: "UNDO" });
    expect(s.doc?.cues).toHaveLength(1);
    expect(s.future).toHaveLength(1);

    s = reducer(s, { type: "REDO" });
    expect(s.doc).toBe(d2);
    expect(s.future).toEqual([]);
  });

  it("APPLY runs the transform against the live doc and records one undo step", () => {
    let s = load(doc(1));
    s = reducer(s, {
      type: "APPLY",
      fn: (d) => ({
        ...d,
        cues: [...d.cues, { id: "x", start: 9, end: 10, text: "n" }],
      }),
      label: "add",
    });
    expect(s.doc?.cues).toHaveLength(2);
    expect(s.past).toHaveLength(1);
  });

  it("COMMIT and APPLY are no-ops when there is no document", () => {
    expect(reducer(initialState, { type: "COMMIT", doc: doc(1), label: "x" })).toBe(
      initialState,
    );
    expect(
      reducer(initialState, { type: "APPLY", fn: (d) => d, label: "x" }),
    ).toBe(initialState);
  });

  it("trims undo history to the scaled limit for large documents", () => {
    let s = load(doc(5001)); // > 5000 cues => history limit 10
    for (let i = 0; i < 25; i += 1) {
      s = reducer(s, { type: "COMMIT", doc: doc(5001), label: "e" });
    }
    expect(s.past.length).toBeLessThanOrEqual(10);
  });

  it("CLEAR returns to the initial state", () => {
    const s = load(doc(1));
    expect(reducer(s, { type: "CLEAR" })).toEqual(initialState);
  });
});
