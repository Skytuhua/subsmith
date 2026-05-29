/** File-extension accept list for subtitle inputs. */
export const SUBTITLE_ACCEPT = ".srt,.vtt,.ass,.ssa,.txt,.sub";

/** Read a File into a byte array (used so we can detect/override the encoding ourselves). */
export function readFileBytes(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((buf) => new Uint8Array(buf));
}

/** True when a file looks like a subtitle we can parse. */
export function isSubtitleFile(file: File): boolean {
  return /\.(srt|vtt|ass|ssa|txt|sub)$/i.test(file.name);
}
