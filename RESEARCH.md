# Research & Product Selection

This document records the discovery process behind **Subsmith**: the market scan, the
candidate shortlist with scores, the chosen product, the target user, the core problem,
and why the project is both genuinely in demand and fully buildable.

## 1. Goal of this phase

Choose **one** niche, fully client-side (browser-only, no backend) web tool with:

- A specific underserved audience.
- Observable, recurring demand.
- A scope that can be built to a polished, production-quality state with no paid APIs
  and only lawful data (here: the user's own files).
- A clearly demonstrable, screenshot-able result.

## 2. Market scan & shortlist

Five candidate client-side web tools were researched against real demand signals
(Reddit/HN/forum threads, "is there a tool that…" posts, complaints about existing
tools, GitHub issues) and against the saturation of the existing client-side space.

### Scoring rubric

Weights: Niche (High), Real demand (High), Doable purely client-side (High),
Demonstrable (Medium), Defensible scope (Medium), Legal/ethical (pass/fail gate).
Scores are 1–5; the weighted total is honest, not flattering.

| Idea | Niche | Demand | Doable (client-side) | Demonstrable | Defensible | Legal | Weighted |
|---|---|---|---|---|---|---|---|
| **Subtitle sync/resync & editor** | 4 | 5 | 5 | 5 | 4 | ✅ | **Highest** |
| EPUB metadata editor | 4 | 3 | 4 | 4 | 3 | ✅ (DRM caveat) | Medium |
| HEIC→JPG/PNG/WebP converter | 2 | 5 | 4 | 4 | 2 | ✅ | Medium-low |
| GPX route editor/cleaner | 3 | 3 | 3 (needs map tiles) | 4 | 2 | ✅ | Low |
| CSV cleaner/deduper | 2 | 4 | 5 | 3 | 1 | ✅ | Low |

**Why the others lost:**

- **HEIC converter** — huge demand but *commoditized*. Reddit already crowns multiple
  free, no-upload, client-side winners; the privacy gap is already solved. Low defensibility.
- **GPX editor** — the incumbent **gpx.studio** is free, client-side, and excellent; it
  already does trim/merge/simplify/elevation, and the tool needs external map tiles. High bar.
- **CSV cleaner** — extremely saturated, including many near-identical "100% client-side,
  private" offerings (Ivandt, CSVClean, Tolyo, etc.). Very low defensibility.
- **EPUB metadata editor** — real but niche, a capable client-side incumbent exists
  (E-BOOKA), and DRM legally narrows the addressable audience.

## 3. Chosen product: Subsmith — browser subtitle workbench

### The core problem

People constantly download subtitles that don't match their video:

- **Constant offset** — subs start a few seconds early/late.
- **Progressive drift** — subs slowly desync over a film because the subtitle was timed
  for a different frame rate (the classic **23.976 vs 25 fps / PAL↔NTSC** problem). The
  well-documented pain point: *up to ~7 seconds of drift over a 2-hour movie.*
- **Garbled text** — wrong character encoding turns `é` into `Ã©`.
- **Split files** — CD1/CD2 subtitles that need merging with an offset.
- **Wrong format** — a player wants `.vtt` but the file is `.srt` or `.ass`.

These block the activity entirely: you cannot comfortably watch until the subtitle is fixed,
and the problem recurs per file.

### The target user

- Plex / Jellyfin / Kodi / home-media users watching downloaded media with separately
  sourced subtitles.
- Foreign-film fans and **language learners** who rely on subtitles.
- Amateur fansubbers / translators doing light timing cleanup.
- Anyone on **macOS / Linux / Chromebook / mobile** who can't or won't install the
  Windows-centric desktop tools.

### Why it's in demand (evidence)

A 20+ year, still-active stream of forum threads asks for exactly this:

- VideoHelp — "Syncing subtitles from 25 fps to 29.97 fps":
  https://forum.videohelp.com/threads/385109-Syncing-subtitles-from-25-fps-to-29-97-fps
- VideoHelp — "Subtitles That Progressively Drift from the Voice Dialog":
  https://forum.videohelp.com/threads/403559
- AfterDawn — "Synchronizing subtitles from 23.976 Input FPS to 25":
  https://forums.afterdawn.com/threads/synchronizing-subtitles-from-23-976-input-fps-to-25.714725/
- OpenSubtitles forum — "Subtitles getting out of sync, in a constant way":
  https://forum.opensubtitles.org/viewtopic.php?t=15716
- groups.io / Spot — "Exported SRT file for 23.976 fps video is progressively out of sync":
  https://groups.io/g/Spot/topic/82635625
- Encoding garble is its own recurring complaint:
  https://subtitlesedit.com/blog/fix-subtitle-encoding-errors-garbled-text

### Why existing options fall short (the gap)

- **Desktop king — Subtitle Edit:** powerful but a Windows-centric *download*; intimidating,
  not Mac/Linux/Chromebook/mobile-friendly, not "open a tab and go."
- **Web tools are fragmented and shallow:** each does only one slice — shift *or* fps *or*
  encoding *or* format conversion. Several upload your file to a server or carry ads.

No single, polished, fully client-side tool combines **shift + 2-point linear sync + fps
conversion + encoding fix + find/replace + merge + validation + format conversion** with a
**live local-video preview** to verify the result. That is the Subsmith niche.

### Why it's doable purely client-side

SRT/VTT/ASS are plain text. Parsing, timestamp math, 2-point linear interpolation, fps-ratio
scaling, and merge are straightforward, unit-testable JavaScript. Encoding detection uses
`jschardet` + the browser `TextDecoder`; file save uses a `Blob` download; the optional video
preview uses a local `<video>` + object URL. **No server, no API keys, no external data.**

### Scope caution (documented decision)

We deliberately **do not** promise *automatic, audio-based* sync — that needs ML/ffmpeg and
would break the pure-client-side guarantee. The manual / 2-point / fps / encoding feature set
is the defensible, fully-client-side sweet spot, and it directly answers the forum threads above.

## 4. One-paragraph pitch

> **Subsmith** is a privacy-first subtitle workbench that runs entirely in your browser.
> Drop in an out-of-sync `.srt`, `.vtt`, or `.ass` file and fix it in seconds: shift the
> timing, correct progressive drift with a two-point sync or a frame-rate conversion, repair
> garbled encoding, find-and-replace text, merge split files, lint for overlaps, and export to
> any format — then verify the result against your own video, all without a single byte
> leaving your device.

## 5. Legal / ethical gate — PASS

The tool only edits subtitle files the user already possesses, entirely on-device. It hosts
or distributes no copyrighted content, defeats no access controls, and collects no data. It is
unambiguously lawful and safe to publish publicly.
