/** Trigger a browser download of text content (encoded as UTF-8). */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Replace (or add) a file extension. */
export function withExtension(filename: string | null, ext: string): string {
  const base = (filename ?? "subtitles").replace(/\.[^./\\]+$/, "");
  return `${base}.${ext}`;
}
