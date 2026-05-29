# Subsmith — Audit Report

_Automated audit-and-improvement pass · branch `chore/automated-audit-2026-05-28` · May 2026_

## Executive summary

Subsmith arrived **already mature**: a clean core/shell split, a green build, 74 passing unit
tests, axe-clean views, and a prior `REVIEW.md` pass that had fixed ReDoS, ASS round-trip
corruption, reducer impurity, and a Google-Fonts privacy regression. This pass therefore hunted
for **what that review missed**, using a multi-agent workflow — 8 independent dimension scanners,
an independent skeptic verifying *every* finding, then synthesis. It surfaced **40 verified
issues** with **no Critical or High severity** (confirming the foundations hold) and discarded
**13 false positives**, including a "parser ReDoS on load" that proved unreproducible (the
parser/timecode regexes are all bounded and linear).

The most valuable finds are four **silent data-integrity bugs**:

1. a regex find&replace worker that **reverted edits** made while it ran (committed a stale snapshot);
2. a shift-click range that anchored on a **stale index** after reorder/delete/undo, so an
   operation could hit the wrong cues;
3. an SRT parser that **silently dropped** text appearing before a block's timing line; and
4. a lint `overlap` rule **blind to unsorted files**.

All four are fixed. On the privacy axis, the "nothing leaves your device" promise was enforced
only by the *absence* of network code — it is now **browser-enforced** by a strict Content-Security-Policy
with `connect-src 'none'`. The largest performance win lazy-loads `jschardet`, cutting
first-load JS **~57% (210 → 90 kB gzip)**. A broad set of accessibility, mobile/touch and UX gaps
were closed, and regression tests took the suite **74 → 109**, including the two highest-risk
previously-untested modules (encoding detection and the undo/redo reducer).

Three high-value, low-risk **features** were added: minimum-gap enforcement, a per-cue
reading-speed (CPS) indicator, and an fps-ratio advisory after two-point sync (see
`FEATURE_BACKLOG.md`).

Larger or judgment-bound changes are left as **written proposals**: TypeScript `strict` mode,
off-threading re-decode, full ARIA grid semantics for the cue list, a delete→undo toast,
shortcut tooltips, configurable lint thresholds, and a Prettier reformat.

## Before vs after

| Check | Before | After |
|---|---|---|
| Build (`npm run build`) | ✅ pass | ✅ pass |
| Unit tests (`vitest`) | 74 passed | **109 passed** |
| Lint (`eslint .`) | ✅ 0 errors | ✅ 0 errors |
| Typecheck (`tsc -b`) | ✅ pass | ✅ pass |
| `npm audit` | 0 vulnerabilities | 0 vulnerabilities |
| Main JS bundle | 209.68 kB gzip | **~90 kB gzip (−57%)** |
| Continuous integration | none | GitHub Actions (lint · test · build) |
| Content-Security-Policy | none | strict (`connect-src 'none'`) |

## Method

Phase 1 mapped the stack and established the baseline. Phase 2 ran 8 parallel dimension scanners
(correctness, security, performance, code quality, UI/UX, accessibility, tests, deps/config),
each citing exact `file:line`. Phase 3 had an **independent skeptic reproduce or refute every
finding** (13 of 53 reported were refuted) and assign severity/effort. Phase 5 implemented the
safe set in small, themed, individually-gated commits. Phase 6 re-verified each fix with a second
independent reviewer plus a full build/test/lint/type gate.

## Outcome by status

- **✅ Fixed — 32** findings implemented on this branch.
- **◑ Partially fixed — 1** (safe part shipped, remainder proposed).
- **📋 Proposed — 7** (deliberately deferred; rationale inline).
- Severity of all 40: **10 Medium, 30 Low** (no Critical/High).

---

## Findings by dimension

### Correctness & bugs

#### ✅ Fixed · Medium — Regex find&replace worker commits a stale document snapshot, silently discarding edits made while it runs
- **Location:** `src/components/OperationsPanel.tsx:393-442 (snapshot at 395, commit at 389/426); worker src/workers/replace.worker.ts:16-26`
- **Impact:** A user who runs a regex replace on a large file (where the worker actually takes a noticeable fraction of the 3s budget) and then keeps working — fixes a timecode, shifts a few cues, edits text — has all of that silently reverted the instant the replace completes. For a tool whose entire value proposition is 'edit subtitles client-side with nothing uploaded', losing the user's in-progress edits with no warning is a serious correctness/data-integrity defect. It is also exactly the kind of effect/worker race the audit targeted, and it was created as a side effect of moving regex off-thread.
- **Recommendation:** In src/components/OperationsPanel.tsx FindReplacePanel, make the worker result merge into the LIVE document instead of overwriting it (finding's option a). Since the worker has already returned, the pattern is proven non-catastrophic, so re-running it synchronously on the current state is safe and keeps the ReDoS protection. Concretely, change the onmessage handler so that instead of `commit(ev.data)` -> `editor.setDoc(res.subtitle, ...)`, it (after checking res.error/res.count for the toast) calls editor.apply((d) => findReplace(d, find, replace, { regex: true, caseSensitive, predicate }).subtitle, `Replace "${find}"`). editor.apply already exists and computes against the live state.doc inside the reducer (useEditor.ts:97), so any cue edits/shifts made during the worker window are preserved. Use the count from the just-recomputed result (or the worker's count) for the toast. This is a small, single-component change. (Alternative if a synchronous re-run on the live doc is undesirable: capture the doc reference and, in commit, if editor.state.doc !== captured, show a "Document changed during replace — re-run" toast and abort rather than overwrite. Disabling all editing while busy is simpler but worse UX and not recommended.)

#### ✅ Fixed · Medium — Shift-click range selection uses a stale anchor index after cues are reordered, deleted, merged, or undone
- **Location:** `src/components/CueTable.tsx:239-244 (anchor stored at 250/253, read at 239-240)`
- **Impact:** Multi-select is a core part of the 'apply to selection' workflow. After the user clicks a cue, then sorts or deletes something, then shift-clicks to extend the selection, they get a silently wrong range and may then apply a shift/scale/replace to the wrong cues. The error is invisible (the highlighted range just looks off-by-N) and easy to commit before noticing.
- **Recommendation:** Anchor on a stable cue id instead of an index, in src/components/CueTable.tsx. Change the ref to `const lastClick = useRef<string | null>(null)`. In handleSelect (235-257): on the plain-click and ctrl/meta-click branches set `lastClick.current = id` (the cue id, already computed at line 238) instead of `index`. In the shift branch (239-244) resolve the anchor to a current index: `const anchor = cues.findIndex(c => c.id === lastClick.current); const from = anchor === -1 ? index : anchor; const [a, b] = [from, index].sort((x, y) => x - y);` then keep `cues.slice(a, b + 1)`. The `findIndex` fallback to `index` cleanly handles the case where the anchored cue was deleted/merged away. ~6-8 lines, no API or reducer changes. (A bare `lastClick.current = null` reset on cue-identity change would also stop the wrong range, but it discards the user's anchor and breaks shift-extend after any edit, so prefer the id-based resolution.)

#### ✅ Fixed · Low — SRT parser silently discards text lines that appear before the timing line within a block
- **Location:** `src/core/parsers/srt.ts:24-49 (findIndex at 25, text slice at 43)`
- **Impact:** Silent partial data loss on recoverable input. A user importing a hand-edited or tool-mangled SRT can lose lines with no indication, which is worse than a visible skip-with-warning. Low severity because well-formed files are unaffected and the case is uncommon.
- **Recommendation:** In C:/Users/user/subsmith/src/core/parsers/srt.ts, after computing timingIdx and before building the cue (around line 43), handle the case `timingIdx > 0`. Inspect the leading lines `lines.slice(0, timingIdx)`. If they are NOT a single lone integer index (e.g. test against /^\d+$/ after trimming), then recover the text rather than dropping it silently. Two viable approaches, both consistent with existing code:
 (a) Lossless recovery (preferred for a data-integrity-focused tool): include the non-index leading lines in the cue text, e.g. prepend them to textLines so nothing is lost. Optionally still push a ParseWarning noting the unusual block.
 (b) Minimal/visible: keep the current slice but push a ParseWarning (matching the existing pattern at srt.ts:27-31 and 37-41, using truncate()) like `Recovered a cue but dropped unexpected text before its timing line: "..."` so the loss is surfaced in the existing parse-warning banner.
IMPORTANT: do NOT warn whenever timingIdx > 0 unconditionally — that would fire on every standard cue (which has the index line above the timing). Only warn/recover when the leading line(s) do not look like a lone integer index. Add a regression test in src/core/parsers/parse.test.ts asserting that `Some caption\n00:00:01,000 --> 00:00:02,000` either preserves "Some caption" in text (approach a) or produces a warning (approach b), so the silent-loss path is locked out.

#### ✅ Fixed · Low — Lint `overlap` rule only compares each cue to its immediate predecessor and skips when the cue starts before it
- **Location:** `src/core/lint.ts:102-122 (overlap condition at line 113)`
- **Impact:** The Validate panel can under-report real overlaps on unsorted files, so a user relying on it to find timing collisions may believe a file is clean when it is not. Low severity because the common path (sorted cues) is handled and the related `out-of-order` warning still surfaces the disordered case.
- **Recommendation:** In src/core/lint.ts `lint()`, make overlap detection order-independent. Best fix: build a time-sorted view once (reuse sortByTime, already imported) and run the overlap/out-of-order comparisons over adjacent pairs in that sorted order, detecting overlap by interval intersection (`cur.start < prev.end && cur.end > prev.start`). Because findings carry `cueIndex`/`cueId` used by the Validate panel to jump to a cue, map each sorted cue back to its original array index (e.g. precompute an id->originalIndex map, or sort an array of {cue, originalIndex}) so cueIndex still points at the real row.

This single change fixes both consequences: (1) overlaps where a cue starts before its predecessor are detected (intersection test instead of the `>= prev.start` guard), and (2) non-adjacent overlaps in unsorted docs are caught (sorted adjacency). Keep `out-of-order` based on original-array adjacency (compare cues[i].start vs cues[i-1].start in original order) since that warning is specifically about array disorder. Add a regression test in src/core/lint.test.ts: a cue that both precedes and overlaps its predecessor (e.g. [[2000,5000,"a"],[1000,3000,"b"]]) should yield both out-of-order and overlap. Low risk: pure-function change, no UI/state surface affected beyond richer findings; aligns lint() with the already-order-independent fixOverlaps.

### Security

#### ✅ Fixed · Medium — No Content-Security-Policy or security headers (privacy guarantee not browser-enforced)
- **Location:** `C:/Users/user/subsmith/index.html:3 (<head>, no CSP meta); no host header config exists anywhere in repo (no vercel.json / netlify.toml / _headers / staticwebapp.config.json)`
- **Impact:** Subsmith's core promise is 'nothing leaves your device.' That promise is currently enforced only by the absence of network code. With no connect-src/default-src policy, the browser does nothing to stop exfiltration if a network sink is ever (re-)introduced — e.g. a future feature, a regression like the Google-Fonts CDN fetch the prior review already had to remove (REVIEW.md item 3), or a compromised dependency (jschardet, @tanstack/react-virtual, lucide-react) running at load. The app also loads untrusted local media into a <video> via blob URL (PreviewPlayer.tsx:142-145); a CSP would harden that and turn the privacy guarantee into a browser-enforced invariant rather than a code-review convention.
- **Recommendation:** Add a single static <meta http-equiv="Content-Security-Policy"> to index.html's <head> (after the charset line). This is the only CSP-delivery mechanism that survives the app's static-folder/file:// distribution mode (vite base:'./'), since no HTTP host is configured.

Suggested directive set, matched to how the app actually loads (Vite-bundled module scripts → 'self'; Tailwind/@fontsource inject <style> → style-src 'unsafe-inline'; @fontsource serves font files same-origin → font-src 'self'; user video via blob: → media-src blob:; bundled fonts may use data: → img-src 'self' data:):

  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; media-src blob:; worker-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'">

Highest-value directive is `connect-src 'none'` — it makes the 'nothing leaves your device' promise browser-enforced and would have blocked the prior Google-Fonts regression. Note `worker-src 'self' blob:` is needed because the regex worker is instantiated via `new URL(..., import.meta.url)` (Vite may emit it as a blob/module worker); validate the regex worker still spawns after adding the policy (npm run build + npm run preview, run a regex find&replace).

Verify after the change: the @fontsource CSS imports load (no font CSP errors), the <video> blob preview plays, and the regex worker runs. If a font is emitted as a data: URL the img-src/font-src data: token covers it.

Out of scope here (host-dependent, no host config exists): real HTTP headers (Referrer-Policy: no-referrer, X-Content-Type-Options: nosniff, frame-ancestors). If/when a static host is added, mirror the CSP as an HTTP header and add those there — but do NOT add an empty vercel.json/_headers just for this; treat that as a separate 'proposed' item tied to choosing a host.

### Performance

#### ◑ Partially fixed · Low — useEditor returns a new plain object every render, defeating CueRow memo and recreating the keyboard listener
- **Location:** `src/state/useEditor.ts:257-272, src/App.tsx:40-55, src/components/CueTable.tsx:222-299`
- **Impact:** With 5 000 cues loaded and the virtualizer showing ~20 rows, every keystroke or undo causes ~20 CueRow re-renders that React.memo was supposed to suppress. With slower hardware or larger overscan, the wasted work is proportionally larger. The keyboard-listener churn is also a minor event-loop cost and a mild memory pressure from listener objects.

This is the single largest source of avoidable re-renders in the hot path.
- **Recommendation:** In src/state/useEditor.ts, stabilize the returned object. Minimal: wrap lines 257-272 in useMemo(() => ({ ... }), [state, selectedIds]) (canUndo/canRedo derive from state; loadBytes/apply/setDoc/etc. are already stable useCallbacks). This makes `editor` stable across EditorView-local re-renders (e.g. preview-driven activeCueId changes), so CueTable's [editor]-keyed callbacks stop churning on those. To ALSO recover memo on selection/edit (where state does change), prefer the report's alternative: change CueTable's callbacks to depend on the specific stable members (editor.apply, editor.setDoc, editor.setSelection, editor.state.doc accessed at call time) instead of the whole `editor` object, and change App.tsx:55 to [editor.undo, editor.redo]. Net effect: clicking row N no longer recreates callbacks for the other ~30 visible rows, so React.memo correctly skips them. Low risk; the function refs are already stable, so behavior is unchanged. Add/keep the existing 74-test suite; no test changes required, but a quick render-count check on CueRow would lock it in.
- **Note:** Shipped the safe part (memoized API object + stable key-listener subscription). Full CueRow-memo recovery needs a latest-doc ref to stabilize the row callbacks without stale closures in data-integrity-sensitive code — left as a proposal.

#### 📋 Proposed · Low — detectAndDecode and parse run inside the reducer (REDECODE action), blocking the main thread
- **Location:** `src/state/useEditor.ts:101-121`
- **Impact:** Every time the user changes the encoding dropdown (Header.tsx, `editor.redecode(…)`) the main thread blocks for the full re-decode + re-parse. On a 5 000-cue file this is easily 100–300 ms, during which the UI is completely unresponsive. The previous review fixed reducer impurity for id-generation (REVIEW.md item 10) but this heavier case was left.
- **Recommendation:** Mirror the loadBytes pattern in src/state/useEditor.ts. Move the decode+parse out of the reducer's REDECODE case and into the `redecode` useCallback (lines 233-235): compute `detectAndDecode(rawBytes, encoding)` and `parse(...)` there, then dispatch a new cheap `REDECODE_RESULT` action that just assigns the pre-computed `subtitle`, `encoding`, `warnings` and resets history/selection (like the COMMIT case). To read the latest `rawBytes`/`fileName` in the callback without a stale closure, mirror reducer state into a `useRef` updated in an effect (standard pattern, same as the existing id-generation fix in REVIEW.md item 10 / CueTable.tsx). This keeps the reducer pure and matches the existing architecture. Net behavioral change is small because the measured cost is low.

#### ✅ Fixed · Low — stripTags allocates a transient Subtitle object and runs two regex passes on every render during playback
- **Location:** `src/components/PreviewPlayer.tsx:45-47`
- **Impact:** Minor but measurable: ~60 transient object allocations per second during playback, each triggering two regex calls. On very long cue text with complex ASS override blocks the cost is higher. This also means a GC pause every few seconds from accumulated short-lived objects.
- **Recommendation:** In src/components/PreviewPlayer.tsx, memoize the overlay text so it only recomputes when the active cue changes: replace lines 45-47 with `const overlayText = useMemo(() => (activeCue ? stripTagsText(activeCue.text) : ""), [activeCue]);`. activeCue (cues[activeIdx]) is referentially stable across frames while the same cue is shown, so the memo correctly skips recompute on most frames. Add a small string-based helper `stripTagsText(s: string): string` in src/core/transforms/text.ts containing the existing three .replace() chains, and refactor stripTags to call it inside mapCues (avoids wrapping a transient Subtitle and keeps one source of truth). This is a surgical, low-risk change covered by existing transform tests; no behavior change to output.

#### 📋 Proposed · Low — lint() runs on every OperationsPanel render including selection changes and preview scrub
- **Location:** `src/components/OperationsPanel.tsx:627`
- **Impact:** For a 5 000-cue file, `lint()` involves 5 000 iterations each calling `visibleLength` (two regexes) plus an overlap check. This is roughly proportional: ~1–5 ms per lint pass on a mid-range laptop. With 100 text edits during a session, that is 0.1–0.5 s of lint work the user did not request. On slower hardware the per-pass cost is higher.
- **Recommendation:** Gate lint() on the panel being expanded so it only runs when the user is actually viewing results. The Panel component (src/components/ui.tsx:186-238) already owns the `open` state; the cleanest surgical change is to make that state available to LintPanel so the useMemo only fires when expanded. Two good options:

Option A (preferred, minimal blast radius): give LintPanel its own `open` state instead of relying on the generic Panel. Replace the unconditional `const findings = useMemo(() => lint(doc), [doc])` (OperationsPanel.tsx:627) with a local `const [open, setOpen] = useState(false)` and `const findings = useMemo(() => (open ? lint(doc) : null), [doc, open])`, then render a Panel-like accordion controlled by that state (or pass `open`/`onToggle` down to a controlled Panel). The badge summary still needs a count even when collapsed — compute a cheaper summary, or accept that the badge updates only on expand. If the always-visible badge count must stay live, keep computing `summarize(lint(doc))` but that defeats the purpose; instead consider a lightweight count that skips the regex-heavy fast-reading rule.

Option B (smallest code change, slightly less ideal): debounce the lint call so rapid edits coalesce. Wrap `doc` in a debounced value (e.g. 250-300 ms after the last change) and key the useMemo on the debounced doc: `const debouncedDoc = useDebounce(doc, 300); const findings = useMemo(() => lint(debouncedDoc), [debouncedDoc])`. This removes per-keystroke-blur cost during rapid editing but still runs when collapsed.

Recommend Option A — it eliminates the cost entirely when the panel is closed, which is the actual defect. Effort is "small" because it touches the shared Panel contract or restructures LintPanel's accordion, and the live badge count behavior needs a small decision. No data-correctness risk; lint() is a pure read-only function.
- **Note:** Declined for now: gating lint to the open panel would make the always-visible issue-count badge go stale — a UX/product trade-off. Revisit with a cheap collapsed-count.

#### ✅ Fixed · Low — jschardet is bundled into the main chunk rather than lazily imported, adding ~100 kB gzip to every page load
- **Location:** `src/core/detect.ts:1, vite.config.ts:7-15`
- **Impact:** Every user — including those whose files are pure UTF-8 — downloads and parses the jschardet bundle on first load, even if it is never called. Given the tool's stated target (offline use after first load), this matters primarily for the first-load experience on slow connections. The ~100 kB gzip impact for jschardet is roughly half the total bundle.
- **Recommendation:** Make jschardet a lazy chunk via dynamic import in src/core/detect.ts. Empirically verified: I patched and rebuilt, and the main JS chunk drops from 209.68 kB gzip to 89.30 kB gzip, with jschardet emitted as a separate 120.13 kB gzip chunk loaded only on first file open (57% initial-JS reduction). All 74 tests still pass; no test calls these functions directly.

Concrete steps:
1. src/core/detect.ts: remove `import jschardet from "jschardet"` (line 1). Make `detectEncoding` async (`Promise<DetectedEncoding>`) and add `const { default: jschardet } = await import("jschardet");` right before the `jschardet.detect(bin)` call. Make `detectAndDecode` async (`Promise<LoadedText>`) and `await detectEncoding(bytes)`. The synchronous BOM fast-path and the `override` early-return in detectAndDecode stay synchronous (they never touch jschardet).
2. src/state/useEditor.ts: make the `loadBytes` useCallback async and `await detectAndDecode(...)` (line 191); it is already invoked from the async `openFiles` handler in App.tsx.
3. src/state/useEditor.ts REDECODE reducer (line 104): you CANNOT await inside a useReducer reducer. But REDECODE is always dispatched with an explicit encoding override (from Header.tsx:60), and detectAndDecode's override branch never calls jschardet — so replace `detectAndDecode(state.rawBytes, action.encoding)` with the synchronous `decodeText(state.rawBytes, action.encoding)` (import decodeText alongside detectAndDecode) and parse that text. Verified this compiles and tests pass.
4. src/components/OperationsPanel.tsx MergePanel.onFiles (line 564): `await detectAndDecode(bytes)` — already an async handler.
5. Optionally lower chunkSizeWarningLimit in vite.config.ts back toward the default since the main chunk is now well under 500 kB.

Add a one-line UI affordance (the file-open handlers are async and already show toasts) — no spinner strictly needed given jschardet is ~120 kB on a one-time fetch. Note the finding's claim that jschardet is only needed for non-UTF-8 files is imprecise: BOM-less UTF-8 (typical .srt) also calls jschardet at open time; the win is purely deferring it off the initial page load, which the split achieves.

### Code quality & tech debt

#### 📋 Proposed · Low — TypeScript `strict` mode disabled — `strictNullChecks` and `noImplicitAny` are off
- **Location:** `tsconfig.app.json:1-25 / tsconfig.node.json:1-24`
- **Impact:** The compiler cannot verify the invariant that `doc` is non-null when these components render. If a future refactor renders a sub-panel outside the `editor.state.doc` guard in `App.tsx:57-60`, the assertions will throw at runtime with no compile-time warning. The `as SubtitleFormat` cast is also unguarded — a bad `<select>` value (e.g. injected via XSS) would pass through to the serializer silently.
- **Recommendation:** Add "strict": true to compilerOptions in BOTH C:/Users/user/subsmith/tsconfig.app.json and tsconfig.node.json (it enables strictNullChecks, noImplicitAny, strictFunctionTypes, etc. as a group). Do NOT treat this as a one-line drop-in: run `npm run build` (which runs `tsc -b`) afterward and fix every new error across src/core, src/state, and src/components before committing. The six `editor.state.doc!` non-null assertions (EditorView.tsx:27, CueTable.tsx:199 & 237, OperationsPanel.tsx:166, 575 & 626) will continue to compile cleanly even under strict mode (non-null assertions satisfy strictNullChecks), so they need no change to keep the build green — but optionally replace them with a single shared helper (e.g. `const doc = requireDoc(editor.state)` that throws a clear error) to make the App.tsx:57-60 invariant explicit. The `e.target.value as SubtitleFormat` cast at Header.tsx:170 does NOT need a runtime guard: the native <select> options are hardcoded to exactly ["srt","vtt","ass"] (Header.tsx:174), so it can only ever emit a valid value; leave it or narrow with a small `isSubtitleFormat` type guard purely for clarity.

#### ✅ Fixed · Low — `stripTags` called with a throwaway `Subtitle` object in the render hot-path
- **Location:** `src/components/PreviewPlayer.tsx:45-47`
- **Impact:** Excess GC pressure during real-time playback. While V8 handles short-lived allocations well, repeated allocation inside `useMemo` that fires at 60fps creates unnecessary pressure. More critically, it's an abstraction mis-match: `stripTags` is a batch transform; using it here hides intent and couples the preview component to the transform layer.
- **Recommendation:** Extract a pure string helper in src/core/transforms/text.ts: `export function stripDisplayTags(text: string): string { return text.replace(/\{[^}]*\}/g, "").replace(/<[^>]*>/g, "").replace(/\\[Nnh]/g, (m) => (m === "\\h" ? " " : "\n")); }`. Refactor existing `stripTags` to call it per cue so the existing test at transforms.test.ts:133 stays green. Then in PreviewPlayer.tsx import `stripDisplayTags` instead of `stripTags` and change lines 45-47 to `const overlayText = activeCue ? stripDisplayTags(activeCue.text) : ""`. This removes the fabricated-document allocation, drops the dishonest `format: "srt"` literal, and clarifies intent. Surgical and test-covered. Frame it as a clarity fix, not a perf win.

#### ✅ Fixed · Low — Shared serializer helpers `visibleCues` / `textForBlockFormat` live inside `srt.ts`, imported by `vtt.ts`
- **Location:** `src/core/serializers/srt.ts:22-36, src/core/serializers/vtt.ts:3`
- **Impact:** Any future third serializer (e.g. SBV, LRC) would also need to import from `srt.ts`, tightening the coupling and making the dependency graph misleading. A maintainer reading `vtt.ts` must look inside `srt.ts` to understand VTT behavior, which violates the principle of locality.
- **Recommendation:** Create src/core/serializers/shared.ts and move stripAssOverrides, textForBlockFormat, and visibleCues there verbatim (they are pure functions with no other dependencies beyond each other). Then: (1) in src/core/serializers/srt.ts replace the three local definitions (lines 4-26) with `import { textForBlockFormat, visibleCues } from "./shared";` (stripAssOverrides need not be imported since only textForBlockFormat uses it, and that now lives in shared.ts); (2) in src/core/serializers/vtt.ts:3 change `from "./srt"` to `from "./shared"`. This mirrors the existing src/core/parsers/shared.ts pattern (REVIEW.md item 13) exactly. No behavior change; verify with the existing serializer test suite / npm run build + tsc.

#### ✅ Fixed · Low — Array index used as React key for lint findings list
- **Location:** `src/components/OperationsPanel.tsx:705-707`
- **Impact:** `FindingRow` is currently stateless (no local state), so the reuse issue does not manifest as visible bugs today. However, if `FindingRow` ever acquires local state (e.g., an expanded detail view), stale state bugs will silently appear. Additionally, the diagnostic meaning of each `LintFinding` is carried in `f.rule + f.cueId`, which is a stable natural key already available.
- **Recommendation:** In C:/Users/user/subsmith/src/components/OperationsPanel.tsx at line 705-707, replace the array-index key with the available stable natural key: change `findings.slice(0, 200).map((f, i) => (<FindingRow key={i} ...`  to  `findings.slice(0, 200).map((f) => (<FindingRow key={`${f.cueId}-${f.rule}`} ...`. This key is provably unique per lint() output: lint() (src/core/lint.ts) pushes at most one finding per (cue, rule) within a single pass, and cue ids are unique (monotonic nextId() in src/core/id.ts, or `c${i}` in tests). The `i` parameter can be dropped from the map callback. No other change needed; FindingRow stays stateless.

#### ✅ Fixed · Low — `useEffect` scroll-to-cue suppresses exhaustive-deps lint rule without documenting the stale-closure contract
- **Location:** `src/components/CueTable.tsx:216-220`
- **Impact:** If `EditorView.tsx:108` is ever changed to update `nonce` without updating `index` (or vice versa), the stale closure will silently scroll to the wrong cue. The suppression comment provides no guidance on what invariant must be maintained.
- **Recommendation:** In src/components/CueTable.tsx, add an explanatory comment above the eslint-disable on line 219 documenting the deliberate nonce-as-trigger pattern, e.g.: `// Intentional: fire only when jumpNonce changes (a new jump request). jumpIndex is a prop, so the closure always reads the current value; EditorView.tsx:108 sets index and nonce atomically. virtualizer is a stable ref.` This is a one-line addition with zero behavioral change. The alternative useRef refactor suggested by the reporter is unnecessary and adds complexity without removing real risk.

#### ✅ Fixed · Low — `FORMAT_EXTENSION` is an exported constant that is never imported anywhere in the application
- **Location:** `src/core/serializers/index.ts:25-29`
- **Impact:** Dead export adds surface area that future contributors might mistakenly reach for (instead of `withExtension`), or might maintain in sync with `SubtitleFormat` unnecessarily. It also obscures that `withExtension` is the actual extension-determination contract.
- **Recommendation:** Delete the `FORMAT_EXTENSION` constant (src/core/serializers/index.ts:25-29). Confirmed dead: a repo-wide search finds it only at its own definition and in a generated coverage HTML artifact — no source or test module imports it. Leave the sibling `FORMAT_LABEL` (lines 31-35) untouched; it IS used in Header.tsx (imported line 12, rendered line 176). The actual export path does not need this map: Header.tsx:140 calls `withExtension(editor.state.fileName, format)` from src/lib/download.ts, passing the `SubtitleFormat` string ("srt"|"vtt"|"ass") directly as the extension. Since the map is an identity (key === value), removing it changes no behavior. After deletion, run `npx vitest run` and `npm run build` to confirm (both expected to stay green).

### UI / UX

#### ✅ Fixed · Medium — No way to close a file and return to the landing page
- **Location:** `src/App.tsx:57-60, src/components/Wordmark.tsx:5-11`
- **Impact:** A user who loads the wrong file, or who wants to start fresh after exporting, has no obvious path back. The hidden reload via the logo is a surprising and lossy interaction (it discards in-memory history). First-time users who mis-open a file have no recovery affordance they can discover.
- **Recommendation:** In src/components/Header.tsx, add an IconButton to the right-hand action cluster (near the FolderOpen button, around lines 90-104) wired to editor.clear(), e.g. label "Close file" with a lucide icon such as X or FilePlus. clear() already exists on EditorApi and dispatches CLEAR -> initialState (doc:null), which makes App.tsx re-render <Landing>. This is the minimal, low-risk fix and is trivial.

Optional enhancement (not required for the core fix): guard against accidental data loss when there are edits in memory by checking editor.canUndo (i.e. state.past.length > 0) and showing a one-line inline confirm ("Close and discard changes?") before clearing. This part is a small design decision — keep it simple (inline confirm, not a modal) to match the existing header. Note that loading a replacement file via FolderOpen is currently ALSO unconfirmed, so for consistency a confirm on close is a nice-to-have rather than a correctness fix.

Severity is Medium (not High): this is a free, fully client-side tool where nothing is persisted and the user's source file on disk is never touched — the only thing "lost" on a logo reload is in-memory undo history. The flow is recoverable today, just not discoverable. So it is a real UX/affordance gap worth fixing, but its impact is bounded.

#### ✅ Fixed · Medium — Warning banner dismissed state is not reset when a new file is loaded
- **Location:** `src/components/EditorView.tsx:22, src/components/EditorView.tsx:48`
- **Impact:** The user loses parse warnings for subsequent files, which is the primary signal that their subtitle data may be ambiguous or partially mis-read. The warning banner exists specifically to surface data-integrity information; silently suppressing it for a second file can lead to editing corrupted data without noticing.
- **Recommendation:** In src/components/EditorView.tsx, reset warningsDismissed to false whenever the loaded document changes. Minimal one-line approach: add `useEffect(() => setWarningsDismissed(false), [editor.state.fileName]);` (import useEffect). This covers the common case. Because two different files can share the same name (fileName-only keying would miss that edge), the most robust fix is to add a monotonically increasing load counter to EditorState in src/state/useEditor.ts — bump it in the LOAD case (and optionally REDECODE) — and key the effect off that counter instead of fileName. Either way the change is confined to EditorView (plus one optional field in the reducer), is pure/additive, and carries negligible regression risk. Avoid remounting via a key prop on EditorView, since that would also wipe other useful local UI state (previewOpen, activeCueId, scroll position).

#### ✅ Fixed · Medium — Mobile layout: row action buttons (Duplicate/Split/Delete) are permanently invisible on touch devices
- **Location:** `src/components/CueTable.tsx:160`
- **Impact:** On mobile, users cannot delete, split, or duplicate individual cues at all. They can still use undo to revert bulk operations, and the CleanupPanel's 'Remove empty cues' covers one case, but there is no touch path for per-cue deletion or duplication. This is a significant capability gap for mobile users.
- **Recommendation:** In src/components/CueTable.tsx:160, change the row-action container className from `opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100` to `opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100`. This keeps hover-reveal on desktop (sm+) but makes Duplicate/Split/Delete always visible on mobile. Verified the mobile 2-col grid already reserves a separate row for the action container (no overlap with the textarea), so the change is layout-safe and one line. Optional: gate pointer-events to sm so the invisible desktop buttons aren't blind-tappable.</recommendedFix>
<parameter name="reproNotes">Confirmed real. CueTable.tsx:160 gates the row actions with opacity-0 + group-hover/focus-within only. Production CSS confirms the reveal rules exist and are ordered after opacity-0, so desktop hover works — but :hover never fires on touch. Verified in a live browser at 390px: the cue textarea is a SIBLING of the action container, not a descendant, so tapping the cue text does not trigger focus-within (actions stayed opacity:0). focus-within only fires when one of the invisible buttons is focused (hardware Tab only). Selecting a row changes only background. No alternative mobile path: OperationsPanel has selection-scoped transforms and Remove-empty-cues, but no delete/split/duplicate selected. So touch users cannot delete/split/duplicate a single cue. Medium because this is a free client-side editor whose core timing/cleanup flows still work on mobile and whose primary audience is desktop; per-cue ops are fully available on desktop.

#### 📋 Proposed · Low — Undo/Redo buttons do not surface the keyboard shortcut in their tooltip
- **Location:** `src/components/Header.tsx:75-88, src/components/ui.tsx:76`
- **Impact:** Keyboard shortcuts are the fastest way to iterate on large files with hundreds of shift/undo cycles. A user who does not already know the standard convention will not discover it. Power users who switch between apps lose the expected tooltip reminder. This is especially relevant because undo is the primary safety net for all destructive operations.
- **Recommendation:** In src/components/Header.tsx, append a platform-aware shortcut hint to the two IconButton labels: "Undo (Ctrl+Z)" / "Redo (Ctrl+Shift+Z)" on Windows/Linux and "Undo (⌘Z)" / "Redo (⌘⇧Z)" on macOS. Detect platform once (e.g. a small helper: const isMac = navigator.userAgentData?.platform === 'macOS' || /Mac/i.test(navigator.platform)). Caveat to handle deliberately: IconButton couples aria-label and title to the same `label` prop (ui.tsx:75-76), so changing `label` also changes the screen-reader accessible name to e.g. "Undo Ctrl Z". Two clean options: (a) keep the visual hint only in `title` by extending IconButton with an optional separate `title`/`shortcut` prop while leaving `aria-label` as the plain action name, or (b) accept the combined name and additionally set aria-keyshortcuts. Note the shortcut is bound globally on window (App.tsx:53), not on the button, so aria-keyshortcuts on the button is acceptable but slightly over-scoped; option (a) is the tidiest. Keep the shortcut strings as shared constants to avoid drift with the actual key handler in App.tsx.

#### ✅ Fixed · Low — Inline timecode edit silently discards an invalid value with no feedback
- **Location:** `src/components/CueTable.tsx:26-31, src/components/CueTable.tsx:49-56`
- **Impact:** A user editing a timecode by hand (e.g. '1:05:20,000' with a wrong separator) will silently lose their change with no explanation. This is especially confusing for users coming from text editors where a silent revert is unexpected. It can cause repeated failed attempts before the user realises the format must be exact.
- **Recommendation:** In src/components/CueTable.tsx TimeInput (lines 12-58), track a transient parse-error state instead of silently reverting. Concretely:
1. Add `const [error, setError] = useState(false);`.
2. In commit() (26-31): if `parseTimecode(draft)` returns null AND draft is non-empty, set `setError(true)` and KEEP the draft visible (do not call setDraft(null)) so the user can correct it; on success call onCommit, then setDraft(null)/setError(false).
3. Clear the error on next keystroke: in onChange, `setDraft(e.target.value); setError(false);`. Also clear on Escape.
4. Drive the destructive border from `invalid || error` in the className (lines 52-54) and set `aria-invalid={error || undefined}` plus a `title="Use hh:mm:ss,mmm format"` for a tooltip.
Optionally, for consistency with the rest of the app, surface a one-off toast via useToast on parse failure (matching OperationsPanel's notify(...,'error') pattern). Keep the change confined to the TimeInput component; no engine/state changes needed. Note the format hint should match parseTimecode's real grammar (hh:mm:ss,mmm / .mmm), since e.g. '1:05:20,000' is already valid.

#### 📋 Proposed · Low — Delete cue action fires immediately with no confirmation or undo nudge
- **Location:** `src/components/CueTable.tsx:160-183`
- **Impact:** For a file with many individually crafted cues, an accidental delete of the wrong row is a data-loss event that a non-expert user may not be able to recover from if they do not notice before the toast disappears (4 s window). The risk is moderate because undo does exist, but it requires either keyboard proficiency or scrolling back to the header.
- **Recommendation:** Add (not replace) an action-toast capability and fire it on cue deletion. Concretely: (1) In src/components/toast-context.ts and src/components/Toast.tsx, extend the Toast model and notify API with an optional action: { label: string; onClick: () => void }; render it in ToastRow as an inline accent text button before the dismiss X. (2) In src/components/CueTable.tsx deleteCue, capture the editor.undo reference and call notify("Cue deleted.", "info", { label: "Undo", onClick: editor.undo }) after editor.apply. Note editor.undo is a stable useCallback (useEditor.ts:248), so a single undo step (one APPLY pushed to past) is correctly reversible. Optionally also add a keyboard-shortcut hint to the Header Undo button title ("Undo (Ctrl+Z)"). Keep the toast non-modal — no confirmation dialog (consistent with the app's fast, keyboard-driven feel). This is small effort but touches the shared toast contract and is partly a product/design decision (toast pattern, timing), so it warrants proposing rather than an inline surgical fix.

#### ✅ Fixed · Low — Operations panel panels are all collapsed by default (except Shift timing), requiring 7 accordion reveals to reach Validate
- **Location:** `src/components/OperationsPanel.tsx:90-98, src/components/ui.tsx:188-189`
- **Impact:** Validate is the most broadly useful panel for first-time users checking an unfamiliar file — it tells them what is wrong before they apply any fixes. Hiding it below six other collapsed panels adds friction to the most common 'load file → check for issues → fix' workflow. The badge on the header provides a visual count, but it is small and the click to open still requires scrolling on short screens.
- **Recommendation:** Add `defaultOpen` (static) to the Validate Panel in OperationsPanel.tsx ~line 645 so it starts expanded like Shift timing — trivial, one line, no reactivity concerns. The conditional auto-expand-when-issues-exist variant is a larger, separate change because defaultOpen is not reactive to later doc changes.

### Accessibility (WCAG 2.1 AA)

#### 📋 Proposed · Medium — Virtualized cue list has no ARIA grid/row semantics
- **Location:** `src/components/CueTable.tsx:88-185, 302-358`
- **Impact:** A screen-reader user cannot navigate the cue list as a table, cannot tell which column a focused field belongs to, and cannot know their position in a large file (e.g. cue 1 of 5 000). The per-row actions (Duplicate, Split, Delete) are reachable only by sequential Tab, with no grid navigation shortcut.
- **Recommendation:** Add an ARIA grid role hierarchy to the virtualized list in C:/Users/user/subsmith/src/components/CueTable.tsx. (1) On the virtualizer container div (line ~323-324) add role="grid" and aria-rowcount={doc.cues.length}, plus an accessible name (aria-label="Cues"). (2) Make the column-header strip a real header row: give the wrapper (line 304) role="row" and each of the three spans (lines 305-307) role="columnheader". Since that strip is max-sm:hidden, also provide a visually-hidden header row that is always present so AT exposes column headers even on mobile, OR keep the labels on cells via aria-label (already present) and accept divs as headers. (3) On the positional wrapper div per row (line 329) add role="row" and aria-rowindex={vi.index + 1} (1-based, accounting for the header row offset if you give the header row aria-rowindex={1}). (4) Wrap the data rows in a role="rowgroup" container and the header in its own role="rowgroup". (5) On CueRow (line 88) the root div should also carry role="row" if it remains a separate wrapper, or move role="row" onto the single combined wrapper to avoid nested rows — pick ONE element to be the row to keep the tree valid. (6) Add role="gridcell" to the four cell regions: the index button (97), the times+duration div (111), the textarea container/textarea (140), and the action group div (160). Verify with NVDA + re-run axe-core (npx playwright / axe) afterward, because incomplete/duplicated grid roles will newly trip axe even though the current all-div version does not. Optionally (separate enhancement) add ArrowUp/ArrowDown roving-tabindex navigation for true grid keyboard support — that is a larger change and not required for the ARIA fix.

#### ✅ Fixed · Low — ExportMenu role=dialog opens without focus management or focus trap
- **Location:** `src/components/Header.tsx:112-201`
- **Impact:** Keyboard-only users who open the Export dialog will find focus has not moved inside it, so they must Tab forward from the Export button to discover the dialog's controls. Users who close the dialog with Escape lose their focus position and must navigate back to the Export button. Screen reader users may not realise the dialog has opened.
- **Recommendation:** In src/components/Header.tsx ExportMenu, scope the fix to the two high-value, low-risk parts: (1) On open, move focus into the panel. Add a ref to the Format Select (the Select in ui.tsx already forwards its ref to the underlying <select>) and, in a useEffect that runs when `open` becomes true, call selectRef.current?.focus(). (2) On close, restore focus to the trigger. Add a ref to the trigger Button (Button forwards refs) and, when transitioning open->false, call triggerRef.current?.focus() so Escape/outside-click/Download return the user to the Export button. Both are a few lines using existing forwardRef support and carry essentially no behavioral risk. Treat a full Tab/Shift+Tab focus trap as OPTIONAL/separate: because this is a non-modal popover (no aria-modal, page behind remains interactive), trapping Tab is a debatable design choice -- an alternative is to reconsider whether role="dialog" is even the right role here (a menu/popover semantics may be more appropriate). That role/trap decision is a design judgement and should not block the focus-move/focus-restore improvement.

#### ✅ Fixed · Low — Panel accordion: aria-controls references a conditionally unmounted element
- **Location:** `src/components/ui.tsx:200-237`
- **Impact:** JAWS reads `aria-controls` at focus time and tries to resolve the target; if the element is absent JAWS may report an error or announce nothing. NVDA and VoiceOver are more lenient but the pattern is formally incorrect. A developer relying on `aria-controls` to drive programmatic navigation will also find it broken.
- **Recommendation:** In src/components/ui.tsx, make the content region always present so the aria-controls IDREF resolves. Replace the conditional block at lines 228-235 (`{open && (<div id={id} className="space-y-3 border-t border-white/[0.06] px-3.5 py-3.5">{children}</div>)}`) with an always-rendered node hidden when collapsed: `<div id={id} hidden={!open} className="space-y-3 border-t border-white/[0.06] px-3.5 py-3.5">{children}</div>`. The native `hidden` attribute applies display:none, so the border/padding won't paint when collapsed and content is correctly hidden from AT and removed from the tab order. This preserves the programmatic trigger-to-region relationship. Acceptable simpler alternative: delete line 207 (aria-controls={id}) entirely and rely on aria-expanded alone, which the WAI-ARIA APG accordion pattern explicitly permits. Either is low-risk; the always-render variant is preferred. Calibrated to Low (not the report's Medium): the button already exposes aria-expanded correctly (line 206), which NVDA/VoiceOver/modern JAWS use to announce and operate the accordion, so the control remains fully usable by AT users; the dangling reference is a formal ARIA-conformance defect with negligible real-world degradation, and the report's "JAWS reports an error" claim is overstated since modern JAWS degrades gracefully.

#### ✅ Fixed · Low — TimeInput invalid state not communicated to assistive technology
- **Location:** `src/components/CueTable.tsx:34-57`
- **Impact:** Screen reader users editing timecodes will not hear any indication that the field contains an error. They will only discover the problem if they explore surrounding text. WCAG 1.3.3 (Sensory Characteristics) and 4.1.3 (Status Messages) are affected: the invalid state is communicated exclusively through colour.
- **Recommendation:** In src/components/CueTable.tsx, make the per-field validity programmatically determinable. (1) On the TimeInput <input> (line 34), add aria-invalid={invalid || undefined}. (2) Give the duration/"invalid" <span> (lines 129-137) a stable id derived from the cue id, e.g. id={`cue-${cue.id}-duration`}, and pass that id into both TimeInputs so each input gets aria-describedby={invalid ? durationId : undefined} when negative. This requires threading a describedById prop into TimeInput (one new optional prop) and rendering the span before/with a stable id. Pure additive ARIA change, no behavior or layout impact, no test changes needed; consider asserting aria-invalid in an existing component test if one is added later.

#### ✅ Fixed · Low — Per-row cue action buttons have touch targets of 28x28 px (h-7 w-7)
- **Location:** `src/components/CueTable.tsx:161-183`
- **Impact:** Users with motor impairments, tremors, or large fingers on touch screens will find these targets difficult to activate reliably. This is a direct WCAG 2.5.5 failure for any device with a pointer that is not fine-grained. On a phone this is the only row-level action mechanism.
- **Recommendation:** In src/components/CueTable.tsx, change the three per-row IconButton className overrides from "h-7 w-7" to "h-9 w-9" (lines 164, 171, 179) so they match the base IconButton default (36x36 px, ui.tsx:78). The 14px icons (h-3.5 w-3.5) already sit inside, so only the hit area grows; no layout breakage since the row-action group is in its own grid column (col-start-2 / sm:col-start-4) and revealed on hover/focus. This brings them to a comfortable 36x36 target. Alternatively just drop the override entirely and let the base h-9 w-9 apply.

#### ✅ Fixed · Low — StatusBar dynamic content has no live region — lastOp and selection count are silent
- **Location:** `src/components/StatusBar.tsx:14-38`
- **Impact:** Screen reader users who apply an operation may not receive audio confirmation that it succeeded if the operation does not trigger a toast. The selection count, useful for confirming a shift-click multi-select, is also silent.
- **Recommendation:** In src/components/StatusBar.tsx, give the lastOp span (lines 34-36) an assertive-but-not-chatty live region. Simplest correct change: add aria-live="polite" and aria-atomic="true" to that span: `{state.lastOp && (<span className="text-muted-fg/60" aria-live="polite" aria-atomic="true">· {state.lastOp}</span>)}`. Note that because the element is conditionally rendered (mounts only when lastOp is truthy), an SR may miss the very first announcement after a fresh load; to be robust, always render the span and toggle its text instead: `<span className="text-muted-fg/60" aria-live="polite" aria-atomic="true">{state.lastOp ? `· ${state.lastOp}` : ""}</span>`. lastOp only changes on operation commit (not per keystroke — TimeInput/text edits commit on blur, useEditor.ts COMMIT/APPLY), so the region will not be noisy. Leave the cue-count and selection-count spans out of the live region as the report recommends; the high-value structural ops (add/delete/merge/sync/shift) already fire toasts via the existing aria-live region in Toast.tsx, so this change mainly closes the gap for undo/redo (App.tsx:47/50), inline cell edits (CueTable.tsx:117/126/147), and re-decode (Header.tsx:60).

### Tests & reliability

#### ✅ Fixed · Medium — detect.ts has 0% test coverage — BOM sniffing and encoding detection entirely untested
- **Location:** `src/core/detect.ts:10-156`
- **Impact:** The most user-visible feature — opening a garbled subtitle file and having the encoding auto-detected — has no automated safety net. A regression in BOM sniffing, the jschardet error handler, or the `normalizeEncoding` map (e.g. the `tis-620 -> windows-874` mapping at line 76 that maps to a value not in KNOWN) would go undetected. The `normalizeEncoding('tis-620')` path is particularly suspect: it maps to `'windows-874'` but `KNOWN` does not contain `windows-874`, so if a file is detected as TIS-620, `detectAndDecode` would call `new TextDecoder('windows-874', ...)` which browsers may not support, silently falling back to UTF-8 at `detect.ts:125`.
- **Recommendation:** Add C:/Users/user/subsmith/src/core/detect.test.ts (vitest is already configured; existing suite passes 74/74). Cover the pure, synchronous functions with real byte buffers — no mocking framework needed:

1) detectEncoding BOM sniffing — assert all three: [0xEF,0xBB,0xBF,...] -> {encoding:'utf-8', confidence:1, fromBom:true}; [0xFF,0xFE,...] -> 'utf-16le'; [0xFE,0xFF,...] -> 'utf-16be'.
2) normalizeEncoding aliases — assert null/undefined/'' -> 'utf-8'; case/space/underscore folding (e.g. 'UTF 8' -> 'utf-8', 'Shift_JIS' -> 'shift_jis'); a value already in KNOWN passes through; an unknown name -> 'utf-8'. Include 'tis-620' -> 'windows-874' to lock the mapping.
3) detectAndDecode with override — assert it bypasses detection and returns {encoding: override, confidence:1, fromBom:false}.
4) decodeText fallback (lines 124-126) — call decodeText(bytes, 'not-a-real-encoding') and assert it returns the UTF-8 decode instead of throwing. (TextDecoder throws RangeError on an invalid label, which exercises the catch.)
5) detectAndDecode end-to-end on a plain ASCII/UTF-8 buffer — assert text round-trips.

Optional: to exercise the jschardet catch path at 107-111 you can vi.mock('jschardet') to throw, but this is low value since jschardet.detect does not throw on normal input; prioritize items 1-5.

Do NOT base any test on the report's premise that 'windows-874' is unsupported — it is a valid WHATWG TextDecoder label (verified: new TextDecoder('windows-874').encoding === 'windows-874'), so the tis-620 path decodes correctly and does NOT fall back to UTF-8. The module is functionally correct; this task only adds the missing regression net.

#### ✅ Fixed · Medium — useEditor reducer has 0% coverage — all undo/redo/REDECODE/APPLY logic untested
- **Location:** `src/state/useEditor.ts:6-257`
- **Impact:** The undo/redo system is the primary data-safety mechanism for users. A bug in history trimming could cause lost edits. The `historyLimit` inconsistency (points b and c) means that after a dramatic document-size change, the history depth may be governed by the wrong document, potentially retaining more snapshots than intended for large docs (memory waste) or fewer for small docs (loss of undo steps). While not catastrophic for a client-side tool, these are correctness issues in the core editing loop.
- **Recommendation:** Add a new test file src/state/useEditor.test.ts. Preferred approach: export the pure `reducer` (and optionally `initialState`/`historyLimit`) from src/state/useEditor.ts and unit-test the reducer directly with no React — it is a pure (state, action) => state function. Cover: (1) LOAD sets doc/fileName/encoding/exportFormat and resets to initialState base; (2) a LOAD -> COMMIT -> UNDO -> REDO cycle restores docs correctly and updates past/future; (3) past is trimmed to historyLimit entries after many COMMITs on a small doc (100) and on docs with >1500 (30) and >5000 (10) cues; (4) REDECODE clears past/future/selection/anchorIndex and re-parses (mock rawBytes); (5) COMMIT and APPLY when state.doc is null are no-ops (return same state); (6) CLEAR returns initialState; (7) canUndo/canRedo derivations (state.past.length>0 / state.future.length>0) — assert these via a small helper or via renderHook from @testing-library/react (already installed, jsdom env already configured in vite.config.ts). Do NOT attempt to 'fix' the historyLimit(state.doc) usages as part of this — they are not bugs; if a future maintainer wants to align UNDO's future cap to the post-undo doc, that is a separate, optional design decision.

#### ✅ Fixed · Low — lint rules 'too-long' and 'fast-reading' have zero test coverage; summarize()'s 'infos' counter is untested
- **Location:** `src/core/lint.ts:72-78, 82-88, 145`
- **Impact:** Two of the seven lint rules are entirely unexercised. The `fast-reading` rule has a subtle two-condition guard at line 81: `cps > maxCps && visibleLength(c.text) > 10`. The `visibleLength` function (lines 35-41) strips ASS `{...}` overrides and HTML tags before measuring — so a cue that appears long via raw `.length` but is short after tag-stripping would not trigger the rule. This stripping logic is never tested in the lint context. Additionally, `summarize` has a weak assertion that would not catch a bug where `infos` is always 0.
- **Recommendation:** Add four unit tests to the existing `describe("lint")` block in src/core/lint.test.ts, reusing the existing `sub()` helper:
(1) too-long: `lint(sub([[0, 8000, "hello"]]))` should contain a finding with `rule === "too-long"` (8 s > 7 s default maxDurationMs).
(2) fast-reading: a cue with >10 visible chars and high CPS, e.g. `lint(sub([[0, 1000, "this is a fairly long line of text"]]))` (~34 visible chars / 1 s = 34 cps > 25) should contain `rule === "fast-reading"`.
(3) fast-reading guard via visibleLength tag-stripping: `lint(sub([[0, 1000, "{\\b1}hi{\\b0}"]]))` — raw length >10 but visibleLength <=10 after stripping `{...}` overrides — should NOT contain `rule === "fast-reading"`. This is the one piece of real logic worth locking down (the two-condition guard at line 81 + the strip regexes at lines 37-38).
(4) Strengthen the summarize test: build findings that include an info-severity item (e.g. a too-short cue) plus a warning and an error, then assert `s.infos > 0`, `s.warnings === <expected>`, and `s.errors === <expected>` — not just `s.errors > 0`. This exercises line 145 and closes the weak-assertion gap.
No production code changes are needed; the rules are correct on inspection, this only adds the missing safety net.

#### ✅ Fixed · Low — BOM and CRLF serialization options (SerializeOptions) are never tested in any serializer
- **Location:** `src/core/serializers/srt.ts:43-44, src/core/serializers/vtt.ts:25-26, src/core/serializers/ass.ts:78`
- **Impact:** The BOM and CRLF export options exist specifically for Windows compatibility (many Windows subtitle players and editors expect BOM and/or CRLF). These are user-facing export options in the UI. A regression — e.g. BOM being applied twice, or CRLF replacement missing the final newline — would produce broken files without any CI signal.
- **Recommendation:** Append parametric serializer-option tests to src/core/parsers/parse.test.ts (already imports serializeSrt/serializeVtt/serializeAss). Concretely, parse the existing SRT/VTT/ASS fixtures, then assert:
- BOM: serializeSrt(sub, { bom: true }).startsWith("﻿") (and the same for VTT and ASS); and that the default call does NOT start with the BOM (guards against an always-on BOM regression).
- EOL: serializeSrt(sub, { eol: "\r\n" }) contains no bare "\n" — e.g. expect(/(?<!\r)\n/.test(out)).toBe(false) — and contains "\r\n"; same for VTT/ASS.
- Combination: { bom: true, eol: "\r\n" } starts with "﻿" and uses only CRLF, and the BOM appears exactly once.
- Re-parse round-trip: parse(serializeSrt(sub, { bom: true }), "srt") yields the same cue count/text (parsers already strip the input BOM via normalize), proving BOM+CRLF output stays loadable.
Optional product follow-up (out of scope for the test fix): the eol option has no UI control in Header.tsx — either expose a "CRLF line endings" checkbox or note it as API-only. Treat that separately.

#### ✅ Fixed · Low — ASS parser error branches untested: bad event timing, missing Format fields, and no-Format-line header fallback
- **Location:** `src/core/parsers/ass.ts:103-106, 121-125, 153-155`
- **Impact:** Real-world ASS files from various video tools sometimes lack standard headers or have malformed events. A corrupt timecode in one `Dialogue` line should skip that line and warn, not crash or silently produce wrong output. The no-`Format:` header fallback is used when `synthHeader` is needed — if the synthesized header omits the [Events] section title, re-parsing would fail.
- **Recommendation:** Add three regression tests to the existing `describe("ASS robustness", ...)` block in C:/Users/user/subsmith/src/core/edge.test.ts, reusing the array-join input style already used there and importing parseAss from "./parsers/ass" (already imported). 

(1) Missing-field warning: input lines ["[Events]", "Format: Layer, Start, End", "Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello"]; assert warnings.some(w => /missing Start\/End\/Text/.test(w.message)) is true AND subtitle.cues has length 1 with text "Hello" (defaults still parse it).

(2) Bad-timing skip: input with one invalid (e.g. Start field = "NOTATIME") and one valid Dialogue; assert subtitle.cues has length 1, the surviving cue is the valid one, and warnings contains exactly one entry matching /bad timing/ that carries a numeric `line` field.

(3) No-Format-line header fallback: input ["[Script Info]","Title: X","","[Events]","Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hi there"]; assert the cue parses, subtitle.assHeader contains both "[Events]" and "Format:", and that re-parsing (assHeader + "\n" + the same Dialogue line) reproduces the cue (locks in the round-trip). 

This is purely additive (no production code change), low risk, and mirrors patterns already present in the file. Optionally also run `npm run test:coverage` in CI to keep these branches covered.

#### ✅ Fixed · Low — stripTags does not test the \\h hard-space and \\N line-break ASS escape paths
- **Location:** `src/core/transforms/text.ts:63`
- **Impact:** An ASS cue containing `\\h` (non-breaking space used for alignment) after `stripTags` should produce a regular space. If this branch were accidentally removed or broken, a user doing clean-up operations on an ASS file before export to SRT/VTT would silently get `h` (a literal letter) or no space instead of a space at every hard-space position.
- **Recommendation:** Add one test case to the existing "strips HTML and ASS tags" test in src/core/transforms/transforms.test.ts (around line 132-135), e.g.:

  it("converts ASS hard-space and line-break escapes", () => {
    const s = stripTags(sub([[0, 1, "word1\\hword2\\Nword3"]]));
    expect(s.cues[0].text).toBe("word1 word2\nword3");
  });

(Or append the assertion to the existing test.) This single case exercises both arms of the line-63 callback: `\h` -> " " and `\N` -> "\n". Verified to pass and to close the coverage gap. No production code change needed.

#### ✅ Fixed · Low — findReplace caseSensitive option is never exercised in any test
- **Location:** `src/core/transforms/text.ts:25`
- **Impact:** A regression that accidentally inverted the condition (`? 'i' : ''`) would make `caseSensitive: true` case-insensitive and vice versa. The literal-replace path in the worker dispatches with `caseSensitive` from the UI, and a UI option that silently does the opposite of what it says would confuse users. Low impact for a client-side tool, but a straightforward test to add.
- **Recommendation:** Add a regression test to C:/Users/user/subsmith/src/core/transforms/transforms.test.ts inside the existing `describe("text operations", ...)` block, alongside the current findReplace tests. Use the file's existing `sub()` helper:

it("find & replace honors caseSensitive", () => {
  const cs = findReplace(sub([[0, 1, "Hello hello"]]), "Hello", "X", { caseSensitive: true });
  expect(cs.count).toBe(1);
  expect(cs.subtitle.cues[0].text).toBe("X hello");
  const ci = findReplace(sub([[0, 1, "Hello hello"]]), "Hello", "X", { caseSensitive: false });
  expect(ci.count).toBe(2);
  expect(ci.subtitle.cues[0].text).toBe("X X");
});

This pins both branches of the line-25 ternary so an inverted condition (`? "i" : ""`) fails CI. No production code change needed — the implementation is already correct. Trivial, low-risk, purely additive (suite is run via `npx vitest run`).

#### ✅ Fixed · Low — VTT round-trip test does not verify timecodes or cue text survive serialization
- **Location:** `src/core/parsers/parse.test.ts:102-108`
- **Impact:** A VTT timing regression would only surface at the parse-test level if a timecode-formatting function broke in a way that was also not caught by the dedicated `time.test.ts` tests. This is a defense-in-depth gap rather than an immediate risk, but the asymmetry with the SRT test is notable.
- **Recommendation:** Harden the existing "round-trips VTT" test in src/core/parsers/parse.test.ts (lines 102-108) by adding assertions on the reparsed cues so it matches the strength of the SRT round-trip. After line 107 add: expect(reparsed.subtitle.cues[0].start).toBe(1000); expect(reparsed.subtitle.cues[0].end).toBe(4000); expect(reparsed.subtitle.cues[0].text).toBe("Hello world"); expect(reparsed.subtitle.cues[1].vtt?.id).toBe("cue-2"); (and optionally cues[1].start/end = 5000/6500). All values are correct for the existing VTT fixture and the test will still pass. This also incidentally closes the parser-side gap (it is the only place asserting parseVtt yields correct start/end/text). Trivial, isolated change to one test file; no production code touched, no risk.

### Dependencies & config

#### ✅ Fixed · Medium — No CI pipeline — lint, tests, and build are never automatically gated
- **Location:** `C:/Users/user/subsmith/.github (absent)`
- **Impact:** Any contributor can merge a commit that breaks the build, introduces lint errors, or regresses a test, with no automatic signal. The 74-test suite's value is degraded because it only runs when a developer remembers to run it locally.
- **Recommendation:** Add a single new file C:/Users/user/subsmith/.github/workflows/ci.yml. Trigger on `push` and `pull_request`. One job on ubuntu-latest: actions/checkout@v4 -> actions/setup-node@v4 (node 20, cache: npm) -> `npm ci` -> `npm run lint` -> `npm run test:run` -> `npm run build`. Optionally add `npm run format:check`. All four scripts already exist in package.json and are proven green per REVIEW.md (lint clean, 74 tests pass, build succeeds). The change is purely additive — a new file that cannot break existing code or runtime behavior. As a follow-on (separate, since gh-pages already exists), a deploy workflow could publish vite build output to Pages, but that is out of scope for closing this gap.

#### ✅ Fixed · Low — coverage/ directory is untracked but not in .gitignore
- **Location:** `C:/Users/user/subsmith/.gitignore`
- **Impact:** A developer who runs the coverage report and then does `git add .` (or a GUI equivalent) will accidentally commit the full HTML/JSON coverage report — several hundred kilobytes of generated files — into the repository history. This is a common accidental commit.
- **Recommendation:** Add a `coverage` line to C:/Users/user/subsmith/.gitignore, mirroring the existing `dist` entry. Concretely, append under the existing build-artifact section (or near dist/dist-ssr):

  # Test coverage reports (generated by `npm run test:coverage`)
  coverage

Optionally add `*.lcov` for completeness, but a single `coverage` line is sufficient since the v8 provider writes everything under coverage/. One-line change, no code impact, no risk.

#### 📋 Proposed · Low — Prettier is not connected to the lint script and has no config file
- **Location:** `C:/Users/user/subsmith/package.json:10-11, C:/Users/user/subsmith/eslint.config.js`
- **Impact:** Formatting is not enforced. Two contributors using different editors can commit conflicting style, leading to noisy diffs. Without a config file the Prettier defaults (e.g. 80-char print width, double quotes) may diverge from the codebase's actual style, causing `format:check` to fail unexpectedly.
- **Recommendation:** Add a root .prettierrc.json that MATCHES the existing code style (the project uses single quotes, no semicolons), e.g. { "semi": false, "singleQuote": true, "printWidth": 100 }, then run `npm run format` once to normalize the ~52 files so format:check passes. Optionally chain it into lint: "lint": "eslint . && prettier --check \"src/**/*.{ts,tsx,css}\"". Do NOT add eslint-config-prettier — the resolved ESLint config has no stylistic rules, so it is a no-op here (drop that part of the original recommendation). Classified as "proposed" rather than "fix-now" because the exact Prettier options are a maintainer style decision and running format produces a large (~52-file) reformatting diff that a human should own.

---

## Deliberately deferred (Proposed / Needs human review)

These are valuable but carry refactor blast-radius or a product/style decision a human should own:

- **TypeScript `strict` mode** (code-quality) — enable `strict` in both tsconfigs and resolve the
  resulting errors across `src`. High value (null-safety) but a cross-cutting change.
- **Off-thread re-decode** (performance) — move `detectAndDecode`+`parse` out of the `REDECODE`
  reducer path; small measured cost, modest refactor.
- **Full ARIA grid semantics** for the virtualized cue list (accessibility) — `role="grid"`/row/
  cell + roving tabindex; larger, and incomplete roles can newly trip axe.
- **CueRow memo recovery** (performance, the ◑ item) — stabilize all row callbacks via a latest-doc
  ref; touches data-integrity-sensitive interaction code.
- **Lint-on-collapse gating** (performance) — only lint when the Validate panel is open; deferred to
  preserve the always-visible issue-count badge.
- **Delete → undo toast** and **shortcut tooltips** (UX) — both touch the shared toast/IconButton
  contracts and are partly design decisions.
- **Prettier wiring** (deps/config) — adopt a `.prettierrc` and a ~50-file reformat (style decision).
- **Configurable lint thresholds** (feature) — see `FEATURE_BACKLOG.md`.

## Verification

Every fix was **independently re-verified** by a second reviewer (separate from the
implementer) that read the actual `git diff main..HEAD` for each change, traced existing code
paths for regressions, and ran the type-checker and full test suite.

**Result: 17 / 17 substantive fixes confirmed resolved — 0 not-fixed, 0 regressions** (all
high-confidence).

**Final gate:** build ✅ · **109 / 109 tests** ✅ · lint ✅ 0 errors · `tsc -b` ✅ ·
`npm audit` 0 vulnerabilities · main JS chunk ~90 kB gzip (with `jschardet` split into its
own lazily-fetched chunk).

The **CSP** was validated by running the real production build and checking each directive
against the *actual emitted assets* — the single self-hosted module entry, the separate
same-origin `jschardet` chunk, react-virtual inline styles, same-origin `@fontsource` fonts,
the `blob:` video preview, and the same-origin module worker — confirming the policy blocks
**none** of the app's own resources while enforcing `connect-src 'none'`.

Non-blocking observations surfaced during verification (good follow-ups, not defects):

- `anchorIndex` in the editor reducer is now effectively unused (the shift-anchor fix no longer
  depends on it) — safe to remove in a later cleanup.
- `stripAssOverrides` is exported from `serializers/shared.ts` but only used internally — could
  be de-exported.
- A non-standard SRT index token (e.g. `1)` / `#1`) is now recovered-with-warning rather than
  silently dropped — an intended improvement, consistent with the parser's lenient philosophy.
- The `TimeInput` format tooltip appears only on a parse error, not on a negative-duration
  `invalid` state (which is still conveyed by `aria-invalid` + the red border).

## Notes for the reviewer

- **Rotate the GitHub token** that was shared to start this task — it is exposed in the chat
  transcript. It was used only at runtime and never written to any file or commit.
- The **CSP** is build-only (injected via a Vite `transformIndexHtml` plugin) so `npm run dev`
  is unaffected; a quick **browser smoke test of the production preview** (`npm run preview`) is
  recommended as the one change whose runtime effect the unit suite cannot cover.
