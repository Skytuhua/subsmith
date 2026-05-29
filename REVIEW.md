# Review & QA

Phase 5 was run as multiple independent passes — functional, visual/design-fidelity,
edge-case/robustness, code-quality/security, accessibility/performance, and a "would a real
user keep this?" pass — plus **independent reviewer subagents** (code-quality/security and
adversarial robustness) and an **independent verifier** that re-ran every reported defect's
repro against the fixed code. Evidence (screenshots) lives in `review/screenshots/`.

## Tooling status (final)
- `npm run lint` → clean (0 errors).
- `npx vitest run` → **74 tests pass** across 5 files (core logic + edge cases + regressions).
- `npm run build` → succeeds; static bundle ~210 kB gzip; regex worker emitted as its own chunk.
- Playwright (real Chromium) functional run → **0 console errors, 0 page errors**.
- axe-core (WCAG 2A/2AA) → **0 violations** on the landing and editor views.

## Functional review
Drove the real app through every flow: load demo → shift → two-point sync → frame-rate →
find&replace (literal + regex) → clean-up → merge → validate + jump-to-cue → preview
(scrub + virtual playback) → export (SRT/VTT/ASS, BOM) → undo/redo. All work. Screenshots
`01`–`14`.

## Defects found and fixed (with re-verification)

### Functional
1. **Find&replace reported the wrong count** ("No matches found" despite replacing). Cause: the
   transform ran inside the reducer (deferred), so the count read right after dispatch was
   stale. **Fix:** compute find&replace against the live document in the component and commit
   the concrete result via `setDoc` (also avoids a no-op undo entry). Re-verified: now reports
   "Replaced N occurrences." (`05-find-replace.png`).

### Responsive
2. **Cue text column collapsed to ~2 chars at 375 px** — the textarea was auto-placed into the
   2.5rem index column. **Fix:** span the textarea full-width on mobile
   (`col-span-2 col-start-1 sm:col-span-1 sm:col-start-3`). Re-verified (`12-editor-mobile.png`).

### Privacy / offline
3. **App fetched fonts from the Google Fonts CDN** — a third-party request that contradicts the
   "nothing leaves your device" promise. **Fix:** self-hosted Inter + JetBrains Mono via
   `@fontsource`; removed the CDN `@import`. Re-verified: console shows **zero** network errors.

### Data integrity (from the adversarial pass)
4. **ASS round-trip corrupted a comma in dialogue when `Text` wasn't the last Format field**
   (silent mangling). **Fix (two parts, after adversarial convergence):** the serializer
   canonicalizes `Text` to the last field and rewrites the `[Events]` `Format:` line to match.
   An independent **verifier subagent then caught that this alone was insufficient** — the
   *parser* still mis-split the first parse — so the parser's `splitFields` was changed to make
   the `Text` column the comma-bearing catch-all wherever it sits (valid because only `Text` may
   contain commas in ASS). Now even a non-standard `Text`-not-last file parses losslessly on the
   first read. Regression test asserts the exact first-parse values.
5. **`fixOverlaps` left overlaps for equal-start / fully-contained cues** (an auto-fixer that
   didn't fully fix). **Fix:** sort first and clamp each cue's end to the next cue's start, so
   all overlaps are removed (a degenerate zero-length cue may remain, which the
   negative-duration rule then surfaces). Regression test asserts `lint()` reports no `overlap`.
6. **SRT serializer emitted interior blank lines** (from ASS `\N\N` or typed text) that it then
   couldn't re-parse → silent truncation on reload. **Fix:** collapse interior blank lines on
   SRT/VTT export so output always round-trips. Regression test added.
7. **`$n` backreference injected the match offset when the regex had no capture group**
   (e.g. `[$1]` → `[0]`). **Fix:** only substitute `$n` for real groups; leave out-of-range
   `$n` literal. Regression tests added.
8. **ASS `Comment` events leaked as visible cues when converting to SRT/VTT.** **Fix:** drop
   `Comment` events on conversion to display formats; keep them when staying ASS.

### Security / robustness (from the code-quality pass)
9. **ReDoS: a user-supplied regex could freeze the tab** (catastrophic backtracking, proven with
   `(a+)+$`). **Fix:** run regex find&replace in a **Web Worker** with a 3 s timeout; on timeout
   the worker is terminated and the user is told to simplify the pattern. Literal replace stays
   inline (it's linear-time). Re-verified in-browser: the UI stayed responsive through a
   catastrophic pattern (recovered in ~3.5 s) instead of hanging.
10. **Reducer impurity under StrictMode** — id-generating transforms (`Date.now()`) ran inside
    the reducer's `APPLY`. **Fix:** moved id generation into the component handlers
    (`duplicate`/`add`/`split` now build the doc with `nextId()` and call `setDoc`), keeping the
    reducer pure.
11. **Undo history could retain ~100 full copies of huge docs.** **Fix:** history depth now
    scales down with cue count (100 / 30 / 10).
12. **Accessibility:** hidden file `<input>`s had no label and were redundant tab stops. **Fix:**
    `aria-label` + `tabIndex={-1}`. axe now reports 0 violations.

### Visual (stacking context)
15. **Export dropdown was partially hidden behind the Preview panel** (the header's
    `backdrop-blur` made a stacking context with no `z-index`, so the content panel painted over
    its dropdown — the exact "stacking context" anti-pattern the design system flags). **Fix:**
    `relative z-30` on the header. Re-verified (`15-export-over-preview.png`).

### Code quality
13. Extracted the duplicated `TIMING_RE` / `normalize` / `truncate` into `core/parsers/shared.ts`.
14. Added a `Web Worker` chunk; raised the chunk-size warning limit; documented dependency
    licenses (incl. jschardet LGPL) in `THIRD_PARTY_NOTICES.md`.

## Performance
Virtualized the cue list with `@tanstack/react-virtual` (dynamic measurement). Measured in a
real browser:

| Scenario | Before | After |
|---|---|---|
| Load 5,000-cue file | ~2,100 ms | **169 ms** |
| Shift all 5,000 cues | timed out (>30 s, frozen) | **65 ms** |

Evidence: `13-large-file.png`.

## Visual / design-fidelity grading (against `design-system/MASTER.md`)
Graded the rendered UI against the canonical tokens:
- **Palette:** background `#0F172A`, card `#1B2336`, accent `#22C55E`, muted-fg `#94A3B8`,
  destructive `#EF4444`, warning `#F59E0B` — all present and used as specified.
- **Typography:** Inter (UI) + JetBrains Mono (timecodes/indices/counters) — verified rendering.
- **Spacing/shape:** 4px scale; rounded panels/controls; hairline borders. Matches.
- **Effects:** 150–300 ms transitions, button press `scale(0.98)`, subtle accent glow only on
  the primary CTA. Matches.

### Pre-Delivery Checklist (re-run via `--domain ux`)
- [x] No emojis as icons — all icons are SVG (Lucide / inline SVG).
- [x] `cursor-pointer` on every clickable element.
- [x] Hover states with 150–300 ms transitions.
- [x] Contrast ≥ 4.5:1 — axe reports 0 contrast violations (foreground `#F8FAFC` on `#0F172A`/
      `#1B2336`; accent text used on dark only).
- [x] Visible keyboard focus (accent-green ring) on all interactive elements.
- [x] `prefers-reduced-motion` respected (global CSS neutralizes animation/transitions).
- [x] Responsive at 375 / 768 / 1024 / 1440 px (screenshots at 375/768/1440; layout verified).
- [x] Async actions show feedback (regex worker shows "Working…"; operations show toasts).
- [x] Error & empty states designed (landing empty state, empty-doc state, parse-warning banner,
      error toasts, lint "clean" state).

## "Would a real user keep this?"
Yes. It directly answers the forum threads in `RESEARCH.md`: a Plex/Jellyfin user with an
out-of-sync `.srt` can fix a constant offset, correct progressive drift via two-point sync or a
frame-rate preset, repair garbled encoding, convert formats, and verify against their own
video — in one tab, with nothing uploaded, on any OS. The closest comprehensive alternative is a
Windows-only desktop download.

## Residual / documented limitations
- Negative timestamps (from over-shifting) are clamped to `00:00:00,000` on export — inherent to
  the formats; the lint panel and the validation rules surface the situation.
- Parsing a *non-standard* ASS file where `Text` is not the last column and a dialogue contains a
  comma is inherently ambiguous; Subsmith warns and canonicalizes on the next export.
- No automatic audio/AI sync — an explicit non-goal (it would break the client-side guarantee).
