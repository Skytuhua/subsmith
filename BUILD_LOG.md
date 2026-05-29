# Build Log

A running journal of decisions, dead ends, fixes, and review findings, so the whole journey
is reconstructable after the fact. Newest entries at the bottom of each phase.

## Phase 0 — Environment & capability setup

- **Toolchain present:** bash, git 2.43, node 22.22, npm 10.9, python 3.11, go 1.24, rust 1.94.
- **Network:** github.com / pypi.org / registry.npmjs.org all reachable (HTTP 200).
- **Browser automation:** Playwright 1.56 available (for Phase 5 screenshots/review).
- **MCP servers available:** Vercel (live deploy), Supabase, Figma, Canva, Google Drive/Gmail/Calendar, PDF viewer, Three.js viewer.
- **`gh` CLI:** not preinstalled → downloaded the official `gh` 2.63.2 linux-amd64 binary to
  `~/.local/bin/gh` and symlinked into `/usr/local/bin`.
- **Git identity:** set globally to owner `Skytuhua <Skytuhua@users.noreply.github.com>`;
  `commit.gpgsign=false` and removed the inherited Anthropic signing key so commits are
  authored solely under the owner identity.
- **GitHub token:** initially **absent** (`GH_TOKEN`/`GITHUB_TOKEN` not set) — documented as the
  single missing credential, with Vercel as the live-deploy fallback. The user then supplied a
  token mid-run; authenticated `gh` with it via `gh auth login --with-token` (stored in gh's
  own config outside the repo, **never** echoed/logged/committed) and ran `gh auth setup-git`.
  `gh api user` confirms login as **Skytuhua** (matches owner identity). GitHub publishing is
  fully unblocked.
- **Dynamic workflow runtime:** no dedicated `Workflow` tool is exposed in this harness, so
  per Directive 9's fallback, scale/parallel work uses ordinary background subagents (the
  `Agent` tool) plus multi-pass self-review. The underlying work is not skipped.
- **Design skill:** cloned `ui-ux-pro-max` into `../scratch/uipro`; smoke-tested
  `src/ui-ux-pro-max/scripts/search.py --design-system` — prints a valid design system. ✅

## Phase 1 — Discovery & research

- Ran demand-validation research across 5 candidate fully-client-side web tools.
- Winner: **Subtitle sync/resync & editor** — strongest recurring *blocking* demand, a
  *fragmented* competitor landscape (web tools each do one slice; the comprehensive tool is a
  Windows desktop app), fully client-side, instantly demonstrable, defensible, legal/ethical.
- Rejected: HEIC converter (commoditized), GPX editor (gpx.studio incumbent + needs tiles),
  CSV cleaner (saturated, no defensibility), EPUB editor (niche + DRM legal caveat).
- See `RESEARCH.md` for the scored shortlist, evidence, and the chosen pitch.

## Phase 2 — Scaffolding

- Scaffolded with Vite `react-ts` template → project `subsmith/`, `git init`.
- Wrote `SPEC.md` (features F1–F8 + non-goals + flows + done) and `ARCHITECTURE.md`
  (stack rationale, module layout, data flow, decisions, licenses).
- Installed deps: jschardet, lucide-react, clsx; dev: tailwindcss@3, postcss, autoprefixer,
  vitest, @testing-library/{react,jest-dom}, jsdom, @vitest/coverage-v8, prettier.
- Initialized Tailwind (`tailwind.config.js`, `postcss.config.js`).

## Phase 3.5 — UI/UX design system (ui-ux-pro-max)

- **Step 1 brief:** product = subtitle editor / developer-media utility; audience = home-media
  users, language learners, fansubbers on any OS; style = minimal, dark, professional,
  data-dense workbench; stack = `react`.
- **Step 2 master:** generated `design-system/MASTER.md` → Pattern (Minimal Single Column for
  empty state / workbench shell), Style = Dark Mode (OLED), Inter typography, slate palette +
  green accent, anti-patterns + pre-delivery checklist.
- **Step 2b per-page:** generated `pages/landing.md`, `pages/editor.md`, `pages/preview.md`.
- **Step 3 domain deep-dives:** `--domain style` (Dark Mode OLED: avoid pure #000), `--domain
  color` (adopted the richer **Developer Tool / IDE** palette: card #1B2336, muted-fg #94A3B8,
  "code dark + run green"), `--domain typography` (added **JetBrains Mono** for timecodes
  alongside Inter — Sans+Mono technical precision), `--domain ux` (folded in Loading-States,
  Stacking-Context, and Continuous-Animation guidance as anti-patterns).
- **Step 4 stack:** `--stack react` → container/presentational split, store/context over prop
  drilling — recorded as anti-patterns and reflected in the `core/`+`state/` architecture.
- **Step 5 synthesize:** wrote `DESIGN_NOTES.md` in my own words; enriched `MASTER.md` is the
  canonical contract. Gate 3.5 PASS.
- No skill files copied into the repo; no attribution to the generator anywhere (per spec).

## Phase 4 — Build (summary)

- Core engine (`src/core/`): pure, framework-free — `time`, `types`, `id`, parsers (srt/vtt/ass +
  content detection), serializers (with ASS-override stripping on downgrade), transforms
  (shift, two-point linear sync, framerate, scale, text ops, merge), `lint` + auto-fixers,
  `detect` (jschardet + TextDecoder, 21 encodings), `mojibake`. 53 unit tests, all green.
- State (`src/state/useEditor.ts`): reducer store with undo/redo (100-deep), selection,
  encoding re-decode. Transforms run inside the reducer (APPLY) against the live doc — no refs.
- UI (`src/components/`): Landing (empty state), Header (+ Export menu + encoding switch),
  CueTable (inline edit, multi-select, split/merge/dup/delete, content-visibility rows),
  OperationsPanel (Shift, Two-point sync, Frame-rate, Scale, Find&replace, Clean-up, Merge,
  Validate), PreviewPlayer (virtual scrubber + optional local-video overlay), StatusBar, Toast.
- Design fidelity: slate/green tokens, Inter + JetBrains Mono, SVG (Lucide) icons, focus ring,
  reduced-motion, responsive — implemented to `design-system/MASTER.md`.

## Phase 5 — Review (in progress)

- Functional review via Playwright (real Chromium) across 12 flows + 4 breakpoints. The full
  demo→shift→sync→find/replace→validate→preview→export→undo path works; 8 cues render.
- **Bug found & fixed (functional):** find&replace toast reported "No matches found" though the
  text changed — because the transform ran inside the reducer (deferred) while the count was
  read synchronously. Fixed by computing find&replace against the live `doc` in the component
  and committing the concrete result via `setDoc` (also avoids a no-op undo entry). Re-verified:
  now reports "Replaced 7 occurrences."
- **Bug found & fixed (responsive):** at 375px the cue text column collapsed into the 2.5rem
  index column (grid auto-placement). Fixed by spanning the textarea full-width on mobile
  (`col-span-2 col-start-1 sm:col-span-1 sm:col-start-3`). Re-verified on mobile screenshot.
- **Improvement (privacy/offline):** removed the Google Fonts CDN `@import` (a third-party
  request that contradicted the "nothing leaves your device" promise) and self-hosted Inter +
  JetBrains Mono via `@fontsource`. Re-verified: console now reports zero errors/requests.

## Phase 5 — Review (continued) & convergence

- Ran two independent reviewer subagents (code-quality/security, adversarial robustness) plus an
  independent **verifier** subagent that re-ran every reported defect's repro against the fixed code.
- Code-quality pass: confirmed no XSS/HTML-injection, correct object-URL lifecycle, zero `any`.
  Fixed: ReDoS (regex find&replace moved to a Web Worker with a 3s timeout), reducer purity
  (id-gen moved out of the reducer), adaptive undo-history depth, a11y (file-input labels),
  de-duped TIMING_RE/normalize/truncate, THIRD_PARTY_NOTICES for jschardet LGPL.
- Adversarial pass: fixed `fixOverlaps` (equal-start/contained), SRT interior-blank-line
  round-trip, `$n` backreference, and ASS `Comment` leakage on conversion.
- **Verifier convergence:** the verifier flagged that the ASS comma fix was only half-done (the
  parser still mis-split a Text-not-last line on first parse). Fixed `splitFields` to make `Text`
  the comma catch-all wherever it appears. Re-verified: 74/74 tests incl. the strengthened
  first-parse assertion.
- Visual: fixed an export-menu stacking-context bug (header `relative z-30`).
- Performance: virtualized the cue list (`@tanstack/react-virtual`): 5000-cue load 2100ms→169ms,
  shift 30s-freeze→65ms.
- Accessibility: axe-core reports 0 WCAG 2A/2AA violations on landing + editor.

## Phase 6 — Documentation & packaging

- Strong `README.md` (problem, features, screenshots, install/usage, limitations, license),
  `CHANGELOG.md` (1.0.0), `THIRD_PARTY_NOTICES.md`. Screenshots in `docs/screenshots/`.
- Built static `dist/` and packaged `subsmith-dist.zip`; verified it loads + runs the demo from a
  clean unzip over a plain static server (no console errors).
