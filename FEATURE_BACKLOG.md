# Subsmith — Feature Backlog

_Prioritized high-value additions that fit the product and respect its explicit non-goals
(no server/AI/audio-sync, no accounts/cloud/telemetry, no subtitle download library, no
OCR/image subtitles, no machine translation). From the audit pass, May 2026._

## ✅ Implemented in this pass

Safe, well-scoped, clearly-valuable additions shipped on `chore/automated-audit-2026-05-28`:

### Per-cue reading-speed (CPS) & line-length indicators in the cue list
- **What shipped:** Shipped the per-cue CPS chip (amber over the lint maxCps). The separate over-length-line marker is a small follow-on.
- **Why:** The lint engine already computes characters-per-second and flags 'fast-reading' (lint.ts maxCps=25) and the research target users include fansubbers, translators, and language learners — audiences who care about readability per line, not just a buried warnings list. The data is computed but only surfaced as an aggregate lint finding. Showing a subtle CPS chip and an over-length line marker inline (next to the existing duration badge in CueRow) turns Subsmith from a timing-fixer into a light quality tool, with near-zero new logic.
- **Effort:** S · **Risk:** Low. Pure presentational addition in an already-virtualized row; must keep row height stable so the virtualizer's dynamic measurement doesn't thrash. No new dependency.

### Set/auto-fix gaps between adjacent cues (minimum gap enforcement)
- **What shipped:** Shipped in full as `setMinGap` + a 'Minimum gap' operations panel, with unit tests.
- **Why:** lint.ts already detects overlaps and the research drift problem often leaves cues touching or fractionally overlapping after a sync/fps pass. A 'minimum gap' operation (ensure at least N ms between consecutive cues by trimming ends) is a standard, expected cleanup in subtitle tooling and complements the existing fixOverlaps, which only removes overlap but doesn't guarantee a readable gap. It's a natural extension of code that already exists.
- **Effort:** S · **Risk:** Low. Self-contained, pure timing math closely paralleling the tested fixOverlaps; main care is not creating zero/negative durations (clamp + let the existing negative-duration lint surface residuals).

### Snap subtitle FPS to a video by deriving the ratio from one anchor
- **What shipped:** Shipped as a post-sync advisory: `matchFpsRatio` recognizes a two-point sync whose factor matches a standard fps ratio and names it in the toast.
- **Why:** RESEARCH centers the 23.976-vs-25 / PAL↔NTSC drift problem; the fps panel has presets + custom, but a user who doesn't KNOW their source/target fps is stuck guessing. If they load the local video (already supported) and tell the tool the correct time for the LAST line, the needed scale factor is just twoPointSync with the first line assumed already-aligned — or the fps ratio can be inferred from the applied linear 'a'. Surfacing 'your correction ≈ 23.976→25 fps' after a two-point sync turns an opaque number into an explainable, reusable conversion.
- **Effort:** S · **Risk:** Low and self-contained — it's a lookup against existing data plus a toast/label. Risk is mainly UX clarity (don't over-claim when the match is coincidental); use a tight tolerance.

## 📋 Proposed (not implemented)

Ranked by value ÷ effort. Each is a deliberate "leave for a human decision or a focused
follow-up" — either larger in scope, needing a product/design call, or carrying refactor risk.

### 1. Crash-safe session persistence (auto-restore last document)
- **Rationale:** The entire product promise is 'open a tab and fix it in seconds' for users who can't/won't install desktop tools (RESEARCH §3). But today an accidental refresh, tab close, or browser crash mid-edit silently discards the parsed doc, all edits, and undo history — useEditor holds everything in a useReducer with zero persistence (confirmed: no localStorage/IndexedDB/sessionStorage anywhere in src). For a manual timing tool where a user may spend 10+ minutes nudging anchors against a video, losing it is the single worst non-crash failure. Restoring the last session on reload makes the tool feel trustworthy and matches the zero-friction positioning.
- **Scope:** On each committed doc change, debounce-write the current Subtitle + fileName + encoding + exportFormat to IndexedDB (single 'last session' slot; IndexedDB, not localStorage, because multi-thousand-cue docs exceed the ~5MB string quota). On app mount with no doc, detect a saved session and show a non-intrusive 'Restore your last file?' prompt on the Landing screen; clear on explicit New/Clear. Stays 100% client-side. Do NOT persist the loaded video (object URL / large binary).
- **Effort:** M · **Risk:** Privacy-sensitivity: persisting subtitle text to disk must be clearly disclosed and easy to purge (add a one-click 'Clear saved data'); otherwise it mildly dents the 'nothing is stored' mental model. Quota/serialization edge cases on huge files. Needs care so StrictMode double-mount doesn't double-prompt.

### 2. Capture playhead into sync anchors + nudge active cue from the preview player
- **Rationale:** RESEARCH §3 names the verify-against-your-own-video loop as the core differentiator, and Flow 2 is 'set the correct time for the first and last line → apply.' Today that loop is broken in the middle: PreviewPlayer can play/scrub/overlay but cannot feed a time back into the editor — the user must read a timecode off the scrubber by eye and hand-type it into SyncPanel's anchor fields. Letting the user pause on the moment a line is actually spoken and click 'Use as first-anchor time' (or nudge the active cue's start to the playhead) closes the loop and is exactly how desktop tools like Subtitle Edit work.
- **Scope:** In PreviewPlayer expose the current playhead ms via a callback. Add small actions: 'Set as anchor 1 / anchor 2' (writes the formatted timecode into SyncPanel's existing new1/new2 inputs) and 'Snap active cue start to playhead' (an editor.apply on the active cue). Reuse existing applyLinear/patch paths — no new core math. Requires lifting a little state between PreviewPlayer and OperationsPanel (currently siblings under EditorView).
- **Effort:** M · **Risk:** Component wiring: preview and operations are separate subtrees, so this needs a shared handler in EditorView (modest refactor). UX must make clear which anchor is being set. Low algorithmic risk — all underlying transforms already exist and are tested.

### 3. Per-cue timing nudge via keyboard in the cue editor
- **Rationale:** Today the only global shortcuts are undo/redo (App.tsx); all timing edits require typing full hh:mm:ss,mmm strings into TimeInput. Manual sync work is repetitive small adjustments, and 'keyboard accessible' is an explicit cross-cutting requirement in SPEC §Cross-cutting. Letting a focused/selected cue be nudged ±10ms / ±100ms with arrow-key chords (and shift for the larger step) makes fine sync dramatically faster and is standard in subtitle editors.
- **Scope:** Add a keydown handler scoped to the selected cue(s): Alt+Arrow nudges start/end by a small step, Shift+Alt+Arrow by a larger step, applied through the existing editor.apply patch path (and respecting multi-select). Document the shortcuts in a small help affordance.
- **Effort:** S · **Risk:** Shortcut collisions with inline textarea/timecode editing and browser defaults — must only fire when focus is on a row, not inside a text field. Choosing non-conflicting chords needs care. Logic itself is trivial and reuses existing patch.
- **Note:** Flagged "now" by the audit but **deferred** under the Balanced fix appetite. Deferred: keyboard-chord nudging risks collisions with inline text/timecode editing and browser defaults; needs careful scoping to focused-but-not-in-a-field state.

### 4. Configurable lint thresholds (min/max duration, max CPS, gaps)
- **Rationale:** Subtitle conventions differ sharply by audience — streaming (Netflix-style) vs. fansub vs. language-learner all use different min duration / max CPS / max line length. lint.ts already centralizes these in DEFAULT_THRESHOLDS but nothing in the UI lets a user change them, so the validation either over-warns or under-warns for half the target users. A small settings popover that feeds the existing lint() call makes validation genuinely useful per workflow.
- **Scope:** Add a lightweight settings UI (popover in the Validate panel) bound to LintThresholds; thread the values into the existing lint() call (already parameterized) and into the new inline CPS indicator. Persist the chosen preset in the same client-side store as the session-persistence feature. Optionally ship 2-3 named presets.
- **Effort:** S · **Risk:** Low. The lint function already accepts thresholds; this is mostly UI + state. Slight scope creep if presets balloon — keep to a couple. Pairs naturally with the persistence feature but can ship standalone with in-memory state.
- **Note:** Flagged "now" by the audit but **deferred** under the Balanced fix appetite. Deferred: valuable, but adds settings UI + state/persistence surface; pairs with a future preferences store.

### 5. Find & replace: live match count + step-through preview before replacing
- **Rationale:** Current find&replace is a single destructive 'Replace all' (OperationsPanel FindReplacePanel) — the user can't see what or how many cues will change until after it's done, and on a regex this is risky. RESEARCH targets people doing 'light timing cleanup' and text repair who benefit from confidence before a bulk edit. A live count and find-next navigation (jump to and highlight the next matching cue) makes the existing, already-off-thread regex engine far safer and more usable, undo notwithstanding.
- **Scope:** Add a non-mutating 'count matches' pass (reuse the worker for regex, inline for literal) that reports N and lets the user step to the next/prev matching cue (reusing the existing jump-to-cue + selection plumbing used by lint findings). Keep 'Replace all'; optionally add 'Replace next'. No new core algorithm beyond a count variant of findReplace.
- **Effort:** M · **Risk:** Medium: counting/highlighting matches per-cue while keeping the regex on the worker (to preserve ReDoS protection) adds message round-trips and state. Must not regress the existing 3s-timeout safety. Find-next highlighting within a cue's textarea is fiddly.

### 6. Honor basic inline styling (italic/bold/color) in the preview overlay
- **Rationale:** SPEC explicitly keeps full ASS rendering as a non-goal and the preview 'renders plain text positioning only' — but the current overlay strips ALL tags via stripTags, so even a simple <i> emphasis or a basic ASS \i1 italic vanishes during the verify step. Honoring just italic/bold (and optionally a font color) makes the preview look like what a player will actually show, improving the 'does this look right?' verification without crossing into the heavy-rendering non-goal.
- **Scope:** Add a small, safe tag-to-style mapper for the overlay only: SRT/VTT <i>/<b>/<u> and the most common ASS overrides (\i1\b1 and \c/\1c color) → inline CSS on the overlay text; everything else still stripped. Strictly presentational, applied only in PreviewPlayer; export and the data model are untouched. Must sanitize (whitelist tags, never inject raw HTML).
- **Effort:** M · **Risk:** Security: rendering subtitle-derived markup must be a strict whitelist mapped to React elements/inline styles — never dangerouslySetInnerHTML — to avoid HTML/script injection from a malicious file. Risk of scope creep toward 'full ASS rendering' (the non-goal); must stay limited to a handful of inline styles.

### 7. Split a subtitle into two files at a point (inverse of merge)
- **Rationale:** Merge (CD1+CD2 with offset) exists and is called out in RESEARCH/SPEC Flow 5, but the symmetric real-world need — splitting one subtitle to match a movie that's distributed as two parts, re-basing the second half's timing to zero — is unaddressed. Home-media users who re-encode/split files hit this. It reuses the existing data model and serializer/export pipeline.
- **Scope:** Add an operation that, given a split cue/time, produces two Subtitles: the first up to the split, the second from the split with all timestamps rebased (shift by -splitStart) and renumbered. Offer a second 'Download part 2' export. Reuses shift + serialize; mostly UI plumbing for a second download.
- **Effort:** M · **Risk:** Medium mostly on UX/state: the app is single-document, so exposing a second resulting file (download both, or load part 2 as the active doc) needs a clear interaction. Core logic is simple and testable.

### 8. Batch processing: apply a fixed offset/fps/encoding to many files and download a ZIP
- **Rationale:** RESEARCH's primary persona is Plex/Jellyfin/Kodi users with whole seasons, and the forum threads are often about a consistent per-episode offset or a uniform fps mismatch across many files. Subsmith is strictly single-file today. A batch mode that takes N dropped files, applies one chosen operation (shift, fps preset, or encoding→UTF-8 conversion) headlessly, and returns a ZIP would 10× the value for the core audience while reusing the existing pure transforms and serializers entirely on-device.
- **Scope:** A separate 'Batch' surface: accept multiple files, pick ONE operation + params, run the existing parse → transform → serialize pipeline per file off the main thread, and bundle outputs into a ZIP for download. No editing UI per file. Requires a client-side zip dependency (e.g. fflate) and a worker to avoid blocking.
- **Effort:** L · **Risk:** Adds a new dependency (zip) — disqualifies it from 'now' per the brief. Notable surface area (multi-file UX, error aggregation, per-file encoding detection, memory for many large files). Must preserve the no-upload guarantee (zip built in-browser). High value but clearly a larger, riskier build.

### 9. Save/export and re-import a reusable sync 'recipe' (offset + fps + scale)
- **Rationale:** When a user figures out the exact correction for a release group's subtitles (e.g. -2.5s then 23.976→25), the same fix often applies to every episode from that source. Capturing the applied linear/fps/scale parameters as a tiny portable JSON they can re-apply to another file (or share) is a power-user multiplier that stays fully client-side and leans on transforms that already exist. It is a lighter, lower-risk cousin of full batch mode.
- **Scope:** Record the net linear transform (a,b) / fps / scale applied in the session; let the user export it as a small JSON and, on another file, import + apply it via the existing applyLinear/applyFramerate/applyScale functions. No server, no new heavy dep (JSON only).
- **Effort:** M · **Risk:** Medium: needs a clear, accurately-tracked notion of the 'current correction' (composing multiple operations into one transform, or recording a small op list) without misleading the user. Schema/versioning and validation of imported JSON (untrusted input) required.

### 10. Merge by overlap/interleave option (bilingual or partial-overlap merge)
- **Rationale:** merge() currently concatenates and re-sorts by start time — perfect for sequential CD1/CD2, but language learners (an explicit RESEARCH persona) frequently want to combine two language tracks that share the SAME timeline (stacking both languages), and fansub cleanup sometimes merges a partial track. The current merge silently interleaves overlapping cues rather than pairing/stacking them, which is wrong for that case. Offering a 'combine cues at the same time' mode addresses a distinct, named audience.
- **Scope:** Add a merge mode flag: alongside the existing append-with-offset, a 'stack overlapping' mode that, for cues overlapping in time, concatenates their text (newline-joined) into one cue rather than producing two interleaved cues. Extend the existing merge transform + tests; surface a mode toggle in MergePanel.
- **Effort:** M · **Risk:** Medium: defining 'same cue' across two imperfectly-aligned tracks is heuristic (overlap threshold, which timing wins) and can surprise users; needs sensible defaults and clear labeling. Confined to the merge transform, so blast radius is small.

---

_Verification, fixes and the full issue list are in [`AUDIT_REPORT.md`](AUDIT_REPORT.md)._
