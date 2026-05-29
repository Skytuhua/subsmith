import { describe, it, expect } from "vitest";
import {
  detectEncoding,
  detectAndDecode,
  decodeText,
  normalizeEncoding,
} from "./detect";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("detectEncoding — BOM sniffing", () => {
  it("detects a UTF-8 BOM authoritatively", async () => {
    const r = await detectEncoding(bytes(0xef, 0xbb, 0xbf, 0x41));
    expect(r).toMatchObject({ encoding: "utf-8", confidence: 1, fromBom: true });
  });
  it("detects UTF-16 LE and BE BOMs", async () => {
    expect((await detectEncoding(bytes(0xff, 0xfe, 0x41, 0x00))).encoding).toBe(
      "utf-16le",
    );
    expect((await detectEncoding(bytes(0xfe, 0xff, 0x00, 0x41))).encoding).toBe(
      "utf-16be",
    );
  });
});

describe("normalizeEncoding", () => {
  it("defaults blank/unknown input to utf-8", () => {
    expect(normalizeEncoding(null)).toBe("utf-8");
    expect(normalizeEncoding(undefined)).toBe("utf-8");
    expect(normalizeEncoding("")).toBe("utf-8");
    expect(normalizeEncoding("totally-made-up")).toBe("utf-8");
  });
  it("folds case/space/underscore and maps known aliases", () => {
    expect(normalizeEncoding("UTF 8")).toBe("utf-8");
    expect(normalizeEncoding("Shift_JIS")).toBe("shift_jis");
    expect(normalizeEncoding("ascii")).toBe("utf-8");
    expect(normalizeEncoding("gb2312")).toBe("gbk");
    expect(normalizeEncoding("tis-620")).toBe("windows-874");
  });
  it("passes through a label already in the supported set", () => {
    expect(normalizeEncoding("windows-1251")).toBe("windows-1251");
  });
});

describe("decodeText", () => {
  it("falls back to UTF-8 for an invalid label instead of throwing", () => {
    expect(decodeText(bytes(0x68, 0x69), "not-a-real-encoding")).toBe("hi");
  });
  it("decodes UTF-8 multibyte sequences", () => {
    expect(decodeText(bytes(0x63, 0x61, 0x66, 0xc3, 0xa9), "utf-8")).toBe(
      "café",
    );
  });
});

describe("detectAndDecode", () => {
  it("uses an explicit override and skips detection", async () => {
    const r = await detectAndDecode(bytes(0x41, 0x42), "utf-8");
    expect(r).toMatchObject({
      encoding: "utf-8",
      confidence: 1,
      fromBom: false,
    });
    expect(r.text).toBe("AB");
  });
  it("detects and decodes a plain ASCII/UTF-8 buffer end to end", async () => {
    const r = await detectAndDecode(bytes(0x68, 0x65, 0x6c, 0x6c, 0x6f));
    expect(r.text).toBe("hello");
  });
});
