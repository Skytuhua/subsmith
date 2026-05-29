# Subsmith — Product Specification (v1)

A privacy-first subtitle workbench that runs entirely in the browser. This document is the
binding scope for v1: the feature set, explicit non-goals, primary user flows, and the
definition of "done."

## 1. v1 feature set

### F1 — Load & decode
- Open subtitle files via **drag-and-drop** or **file picker**.
- Supported formats: **SRT**, **WebVTT** (`.vtt`), **SubStation Alpha** (`.ass` / `.ssa`).
- **Auto-detect format** from content (not just extension).
- **Auto-detect text encoding** (UTF-8, UTF-16 LE/BE, Windows-125x, ISO-8859-x, etc.) via
  `jschardet` + `TextDecoder`; **manual encoding override** dropdown with instant re-decode.
- Robust to BOMs, CRLF/LF, and minor malformations (recoverable parse with warnings).

### F2 — Cue editor
- Virtualized-friendly list of cues showing index, **start**, **end**, **duration**, **text**.
- Inline edit of cue **text** and **start/end** times (`hh:mm:ss,mmm`).
- **Add**, **delete**, **duplicate**, **split** (at caret/midpoint), and **merge adjacent** cues.
- Multi-select (range + toggle) to scope timing/text operations to a subset.
- Live stats: cue count, total duration, selected count.

### F3 — Timing operations
- **Shift** selected/all cues by a signed offset (entered as ms or `hh:mm:ss,mmm`).
- **Two-point linear sync**: provide the correct time for two anchor cues; compute and apply
  the linear transform `t' = a·t + b` (fixes constant offset **and** progressive drift).
- **Frame-rate conversion** with presets (23.976→25, 25→23.976, 23.976→24, 24→23.976,
  24→25, 25→24, 29.97→25, 25→29.97, NTSC↔PAL) and a **custom from/to fps**.
- **Scale by percentage** (stretch/compress).
- All operations support **undo/redo**.

### F4 — Text operations
- **Find & replace** with **regex** toggle, **case-sensitivity** toggle, scope to selection.
- **Strip formatting tags** (HTML-style `<i>`, `{...}` ASS overrides).
- **Fix mojibake** (common UTF-8-misread-as-Latin1 repairs).
- Trim whitespace, **remove empty cues**, **sort by start time**, **renumber**.

### F5 — Merge
- **Append/merge** a second subtitle file with an optional time offset (e.g., CD1 + CD2),
  re-sorted and renumbered.

### F6 — Validation / lint
- Detect **overlapping** cues, **negative/zero durations**, **out-of-order** cues, display
  times that are **too short** or **too long**, and large **gaps**.
- Show a warnings panel; provide **one-click fixes** (e.g., resolve overlaps, drop empties).

### F7 — Export
- Download as **SRT**, **VTT**, or **ASS** (format conversion on export).
- Encoding choice: **UTF-8** with or without **BOM**.
- Lossless round-trip where formats allow; documented, predictable downgrades where they don't.

### F8 — Live preview
- Always-available **timeline scrubber** that highlights the active cue at any time position.
- Optional **local video overlay**: load a local video file (never uploaded) and see the
  edited subtitles rendered live over playback to verify sync. Play/pause/seek.

### Cross-cutting
- **100% client-side** — no network requests with user data, ever.
- Full UI states: empty, loading, error, success.
- Keyboard accessible; responsive at 375 / 768 / 1024 / 1440 px.
- Sample file loader ("Try a demo file") so the tool is usable with zero setup.

## 2. Non-goals (explicit)
- ❌ Automatic **audio/AI-based** sync (needs ML/ffmpeg; breaks client-side guarantee).
- ❌ Accounts, cloud storage, server uploads, telemetry.
- ❌ Subtitle **search/download library** (legal + scope).
- ❌ **Image-based** subtitles (PGS/VobSub) or OCR.
- ❌ Machine **translation**.
- ❌ Bitmap/style-heavy full ASS rendering (we preserve ASS styling on round-trip but the
  preview renders plain text positioning only).

## 3. Primary user flows
1. **Fix a constant offset:** load `.srt` → Shift −2.5s → preview → export `.srt`.
2. **Fix progressive drift:** load file → open Two-point sync → set correct time for the
   first and last line → apply → preview against video → export.
3. **Frame-rate mismatch:** load file → pick `23.976 → 25` preset → export.
4. **Repair garbled text:** load file (auto-detect flags suspicious encoding) → override to
   Windows-1251 → text fixes → export UTF-8.
5. **Merge split subs:** load CD1 → merge CD2 with offset → renumber → export.
6. **Convert format:** load `.ass` → export `.vtt`.

## 4. Definition of "done"
- Every feature F1–F8 is implemented and works on real-world files — no placeholders.
- Core logic (parsers, serializers, timing math, fps math, encoding, lint) is covered by
  passing automated unit tests, including malformed/edge-case inputs.
- SRT/VTT/ASS round-trip without data loss for the parts each format supports.
- Graceful handling of empty input, malformed input, huge files, and unusual Unicode.
- Faithful to the Phase 3.5 design system; Pre-Delivery accessibility checklist passes.
- Builds green; static artifact runs from a clean state; deployed live.
