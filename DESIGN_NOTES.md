# Design Notes — Subsmith

My own-words synthesis of the design system the build implements to. The binding token values
live in `design-system/MASTER.md` and the per-page overrides in `design-system/pages/`.

## The feeling
Subsmith should feel like a precise, trustworthy developer/media **workbench** — closer to a
code editor than a marketing page. Calm, dark, dense-but-legible, with one confident green
accent that means "go / this worked." Nothing decorative competes with the data.

## Layout
- **Empty state (landing):** a single centered column — a short bold headline, a one-line
  promise ("Fix subtitle timing in your browser. Nothing is uploaded."), three benefit
  bullets, and the dropzone as the single primary CTA. Quiet footer with privacy note + a
  "Try a demo file" link.
- **Editor (the workbench):** a slim top app bar (wordmark, file name, format badge, undo/redo,
  Export). Below it the **cue table** dominates the canvas (index · start · end · duration ·
  text, with mono timecodes). A right-hand **operations panel** holds the tools as collapsible
  sections (Shift, Two-point sync, Frame rate, Scale, Find & replace, Clean-up, Merge, Lint).
  A bottom status strip shows cue count, total duration, selection, and encoding/format.
- **Preview:** a panel/overlay with the optional local video, a timeline scrubber, and the
  active cue rendered over the frame.

## Color
Deep slate canvas `#0F172A`; elevated surfaces (table, panels, app bar) on `#1B2336` cards
with hairline `rgba(255,255,255,0.08)` borders. Body text `#F8FAFC`; secondary/labels
`#94A3B8`. The one accent is green `#22C55E` — primary buttons, the focus ring, success.
Destructive red `#EF4444` for delete; amber `#F59E0B` for lint warnings. No pure black, no
light mode.

## Type
**Inter** for everything UI (tight tracking on headings, 400 body, 500 uppercase labels) and
**JetBrains Mono** for every timecode, index, and counter so numeric columns line up perfectly
— the small detail that makes a timing tool feel exact.

## Spacing & shape
4px scale. Rounded-xl (12px) panels/cards, rounded-lg (8px) controls, 6px inputs. Table rows
roomy enough to scan a film's worth of cues without feeling cramped.

## Motion
Subtle and fast: 150–300ms hover/focus transitions, a slight `scale(0.98)` press on buttons,
a faint glow only behind the primary CTA. Loaders for any async work (file decode/large ops);
no decorative perpetual motion. Everything is gated behind `prefers-reduced-motion`.

## Hard rules (must pass)
SVG icons only (Lucide, never emoji); `cursor-pointer` on every clickable; visible green focus
ring for keyboard nav; contrast ≥ 4.5:1 (7:1 for primary text); responsive at 375/768/1024/1440;
real loading/empty/error states; respect stacking contexts (no `z-index: 9999`); keep data
logic in the store/core, components stay presentational.
