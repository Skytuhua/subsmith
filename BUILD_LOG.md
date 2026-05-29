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
