# Subsmith — Architecture

## 1. Tech stack & rationale

| Concern | Choice | Why |
|---|---|---|
| Build tool | **Vite 7** | Fast dev server, first-class TS, produces a static bundle deployable anywhere (Vercel, GitHub Pages, a zip). |
| UI | **React 19 + TypeScript** | Component model fits the cue-list/editor + panels; TS enforces correctness in timing math and parsers. |
| Styling | **Tailwind CSS 3** | Token-driven styling that maps directly onto the Phase 3.5 design system (colors, spacing, type scale). |
| Icons | **lucide-react** | Clean MIT-licensed **SVG** icons (design system forbids emoji-as-icons). |
| Encoding detection | **jschardet** | Mozilla universalchardet port (MIT); detects legacy charsets so we can `TextDecoder` correctly. |
| Class utility | **clsx** | Ergonomic conditional class names. |
| Tests | **Vitest + Testing Library + jsdom** | Unit tests for pure logic (parsers/serializers/timing) and component smoke tests; same toolchain as Vite. |
| Lint/format | **ESLint + Prettier** | Consistent, reviewable code. |

**Why fully client-side:** subtitles are plain text; all transforms are deterministic
functions. Keeping everything in the browser is the product's privacy promise *and* removes
all hosting cost and operational risk. There is no server, database, or external API.

## 2. Module layout

```
src/
  core/                # Pure, framework-free, fully unit-tested. No DOM, no React.
    time.ts            # Timecode <-> ms parsing/formatting; clamping.
    types.ts           # Cue, Subtitle, Format, ParseResult types.
    detect.ts          # Format + encoding detection (jschardet wrapper) and decode.
    parsers/
      srt.ts           # SRT parser
      vtt.ts           # WebVTT parser
      ass.ts           # SubStation Alpha parser (preserves styles/header)
      index.ts         # parse(text, format) dispatch
    serializers/
      srt.ts vtt.ts ass.ts index.ts   # serialize(subtitle, format[, opts])
    transforms/
      shift.ts         # constant offset
      linear.ts        # two-point linear sync (a, b solve)
      framerate.ts     # fps presets + custom ratio scaling
      scale.ts         # percentage stretch/compress
      text.ts          # find/replace, strip tags, mojibake fix, trim, dedupe-empty
      merge.ts         # merge two subtitles with offset
    lint.ts            # validation rules + auto-fixers
    mojibake.ts        # common UTF-8/Latin1 repair table
  state/
    useEditor.ts       # Editor store: subtitle, selection, undo/redo history.
  components/          # Presentational + interactive React components.
    ...                # Dropzone, CueTable, Toolbar, panels, PreviewPlayer, etc.
  data/
    samples.ts         # Built-in demo subtitle (for "Try a demo file").
  App.tsx main.tsx index.css
```

## 3. Data flow

1. **Input** → file bytes (`ArrayBuffer`).
2. `detect.ts` → guess encoding (jschardet) → decode to string (`TextDecoder`) → guess format.
3. `parsers/index.ts` → `Subtitle` (ordered list of `Cue { id, start, end, text, raw? }`
   plus format-specific `meta` for ASS styles/header) + non-fatal `warnings[]`.
4. UI renders cues from the **editor store**. Every transform is a pure function
   `Subtitle -> Subtitle`; the store pushes the result onto an **undo stack**.
5. **Lint** runs on demand over the current `Subtitle`, producing findings + fixers.
6. **Export** → `serializers/index.ts` → string → `Blob` (chosen encoding/BOM) → download.
7. **Preview** reads the current `Subtitle` to highlight the active cue against a scrub
   position or a locally loaded `<video>` element's `currentTime`.

The core layer is **pure and isolated** from React/DOM, which is what makes it thoroughly
unit-testable and keeps the timing math trustworthy.

## 4. Key design decisions
- **Immutable transforms.** Each operation returns a new `Subtitle`; the store owns history.
  This gives reliable undo/redo and makes operations trivially testable.
- **Milliseconds as the canonical time unit.** All cues store integer ms; timecode strings
  are only a presentation concern. Rounding happens once, at serialization.
- **Format-preserving ASS.** We keep the ASS `[Script Info]`/`[V4+ Styles]` header and each
  event's style fields so round-tripping `.ass` doesn't discard styling.
- **Recoverable parsing.** Malformed blocks are skipped with a warning rather than throwing,
  so a single bad cue never loses the whole file.
- **No external runtime calls.** The only network activity is loading the app's own static
  assets; user data never leaves the page.

## 5. Third-party dependencies & licenses
| Package | License |
|---|---|
| react, react-dom | MIT |
| vite, @vitejs/plugin-react | MIT |
| typescript | Apache-2.0 |
| tailwindcss, postcss, autoprefixer | MIT |
| jschardet | LGPL-2.1 (used unmodified as a library; not statically linked into a proprietary work — project is MIT/open) |
| lucide-react | ISC |
| clsx | MIT |
| vitest, @testing-library/*, jsdom | MIT |

All are permissively licensed and compatible with shipping an MIT-licensed open-source tool.
jschardet (LGPL) is consumed as an unmodified dependency; the project remains open source.

## 6. Build / run / test / deploy
- `npm run dev` — local dev server.
- `npm run build` — type-check + production static bundle in `dist/`.
- `npm run preview` — serve the built bundle.
- `npm test` / `npm run test:run` — Vitest unit suite.
- `npm run lint` — ESLint.
- Deploy: static `dist/` → Vercel (and/or GitHub Pages); also zipped as a release artifact.
