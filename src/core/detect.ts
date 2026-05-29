import jschardet from "jschardet";

/** A text encoding the user can pick from the manual override dropdown. */
export interface EncodingOption {
  /** TextDecoder label. */
  value: string;
  label: string;
}

export const ENCODINGS: EncodingOption[] = [
  { value: "utf-8", label: "UTF-8" },
  { value: "utf-16le", label: "UTF-16 LE" },
  { value: "utf-16be", label: "UTF-16 BE" },
  { value: "windows-1252", label: "Windows-1252 (Western European)" },
  { value: "windows-1250", label: "Windows-1250 (Central European)" },
  { value: "windows-1251", label: "Windows-1251 (Cyrillic)" },
  { value: "windows-1253", label: "Windows-1253 (Greek)" },
  { value: "windows-1254", label: "Windows-1254 (Turkish)" },
  { value: "windows-1255", label: "Windows-1255 (Hebrew)" },
  { value: "windows-1256", label: "Windows-1256 (Arabic)" },
  { value: "iso-8859-1", label: "ISO-8859-1 (Latin-1)" },
  { value: "iso-8859-2", label: "ISO-8859-2 (Latin-2)" },
  { value: "iso-8859-5", label: "ISO-8859-5 (Cyrillic)" },
  { value: "iso-8859-7", label: "ISO-8859-7 (Greek)" },
  { value: "iso-8859-9", label: "ISO-8859-9 (Turkish)" },
  { value: "iso-8859-15", label: "ISO-8859-15 (Latin-9)" },
  { value: "big5", label: "Big5 (Traditional Chinese)" },
  { value: "gbk", label: "GBK (Simplified Chinese)" },
  { value: "shift_jis", label: "Shift_JIS (Japanese)" },
  { value: "euc-jp", label: "EUC-JP (Japanese)" },
  { value: "euc-kr", label: "EUC-KR (Korean)" },
];

const KNOWN = new Set(ENCODINGS.map((e) => e.value));

export interface DetectedEncoding {
  /** A TextDecoder-compatible label. */
  encoding: string;
  /** 0..1 confidence (1 when a BOM was found). */
  confidence: number;
  /** True if a byte-order mark determined the result. */
  fromBom: boolean;
}

/** Map a jschardet/encoding name to a TextDecoder label we support. */
export function normalizeEncoding(name: string | null | undefined): string {
  if (!name) return "utf-8";
  const n = name.toLowerCase().replace(/[\s_]+/g, "-");
  const map: Record<string, string> = {
    ascii: "utf-8",
    utf8: "utf-8",
    "utf-8": "utf-8",
    "utf-16le": "utf-16le",
    "utf-16be": "utf-16be",
    "utf-16": "utf-16le",
    "iso-8859-1": "iso-8859-1",
    "iso-8859-2": "iso-8859-2",
    "iso-8859-5": "iso-8859-5",
    "iso-8859-7": "iso-8859-7",
    "iso-8859-9": "iso-8859-9",
    "iso-8859-15": "iso-8859-15",
    "windows-1250": "windows-1250",
    "windows-1251": "windows-1251",
    "windows-1252": "windows-1252",
    "windows-1253": "windows-1253",
    "windows-1254": "windows-1254",
    "windows-1255": "windows-1255",
    "windows-1256": "windows-1256",
    gb2312: "gbk",
    gbk: "gbk",
    big5: "big5",
    "shift-jis": "shift_jis",
    sjis: "shift_jis",
    "euc-jp": "euc-jp",
    "euc-kr": "euc-kr",
    "tis-620": "windows-874",
  };
  if (map[n]) return map[n];
  if (KNOWN.has(n)) return n;
  return "utf-8";
}

/** Detect the encoding of a byte buffer using BOM sniffing then jschardet. */
export function detectEncoding(bytes: Uint8Array): DetectedEncoding {
  // BOM sniffing is authoritative.
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return { encoding: "utf-8", confidence: 1, fromBom: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { encoding: "utf-16le", confidence: 1, fromBom: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: "utf-16be", confidence: 1, fromBom: true };
  }

  // jschardet wants a binary string; sample the head for speed.
  const sample = bytes.subarray(0, Math.min(bytes.length, 64 * 1024));
  let bin = "";
  for (let i = 0; i < sample.length; i += 1)
    bin += String.fromCharCode(sample[i]);
  let result: { encoding: string | null; confidence: number };
  try {
    result = jschardet.detect(bin);
  } catch {
    result = { encoding: "utf-8", confidence: 0 };
  }
  return {
    encoding: normalizeEncoding(result.encoding),
    confidence: result.confidence ?? 0,
    fromBom: false,
  };
}

/** Decode bytes to a string with the given (or detected) encoding. */
export function decodeText(bytes: Uint8Array, encoding: string): string {
  try {
    // BOM is stripped by TextDecoder for utf-8/16 automatically when ignoreBOM=false.
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

export interface LoadedText {
  text: string;
  encoding: string;
  confidence: number;
  fromBom: boolean;
}

/** Detect the encoding and decode in one step. */
export function detectAndDecode(
  bytes: Uint8Array,
  override?: string,
): LoadedText {
  if (override) {
    return {
      text: decodeText(bytes, override),
      encoding: override,
      confidence: 1,
      fromBom: false,
    };
  }
  const det = detectEncoding(bytes);
  return {
    text: decodeText(bytes, det.encoding),
    encoding: det.encoding,
    confidence: det.confidence,
    fromBom: det.fromBom,
  };
}
