# Changelog

All notable changes to Subsmith are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-05-29

First public release.

### Added
- Load **SRT**, **WebVTT**, and **SubStation Alpha (ASS/SSA)** subtitles via drag-and-drop or a
  file picker, with content-based format detection.
- Automatic **text-encoding detection** (UTF-8/16, Windows-125x, ISO-8859-x, Big5, Shift_JIS,
  EUC-JP/KR, …) with a manual override that re-decodes instantly.
- **Timing tools:** shift, two-point linear sync (fixes constant offset *and* progressive drift),
  frame-rate conversion (presets + custom fps), and percentage scaling — scoped to all or
  selected cues.
- **Text tools:** find & replace (literal and regex with capture groups; regex runs in a Web
  Worker with a timeout), strip tags, trim whitespace, fix mojibake, sort, remove empty cues.
- **Merge** a second subtitle file with a time offset.
- **Validation/lint** for overlaps, negative/zero durations, out-of-order cues, too-short/long
  display times, and fast reading speed, each with one-click fixes; click a finding to jump to it.
- **Live preview:** a timeline scrubber with virtual playback, plus an optional local video
  overlay to verify sync. No video is uploaded.
- **Export** to SRT, VTT, or ASS, with optional UTF-8 BOM (lossless ASS round-tripping; sensible
  downgrades when converting to a simpler format).
- Inline cue editing, multi-select, split/merge/duplicate/delete, and undo/redo.
- Fully client-side, offline-capable, with self-hosted fonts and no third-party requests.
- Virtualized cue list that stays smooth on files with thousands of cues.
- Dark, accessible UI (visible keyboard focus, `prefers-reduced-motion`, WCAG-AA contrast,
  responsive 375–1440 px).

[1.0.0]: https://github.com/Skytuhua/subsmith/releases/tag/v1.0.0
