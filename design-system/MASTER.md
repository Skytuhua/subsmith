# Design System: Subsmith (canonical source of truth)

The binding design contract for the build. Page files under `pages/` override this where they
differ; otherwise this governs. Enriched from `--domain` (style/color/typography/ux) and
`--stack react` deep-dives.

### Pattern
- **App shell:** A focused **workbench** — top app bar (brand + primary actions), a main
  cue-table workspace, and a contextual operations panel. (The *landing/empty state* uses a
  Minimal Single Column hero: headline, one-line value prop, 3 benefit bullets, one primary
  CTA = the dropzone.)
- **Color Strategy:** Minimalist dark: deep slate base + a single vibrant green accent for the
  primary/confirmation action. High contrast (7:1+ for primary text).

### Style
- **Name:** Dark Mode (OLED-friendly), dark-only.
- **Keywords:** Dark theme, high contrast, deep slate, eye-friendly, technical, precision, clean.
- **Backgrounds:** avoid pure `#000000` (use deep slate `#0F172A`) to prevent OLED smear and
  keep elevation legible.
- **Performance:** Excellent. **Accessibility target:** WCAG AAA for text where feasible (AA min).

### Colors (Developer Tool / IDE palette — "code dark + run green")
| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1E293B` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#334155` | `--color-secondary` |
| Accent / CTA | `#22C55E` | `--color-accent` |
| On Accent | `#0F172A` | `--color-on-accent` |
| Background | `#0F172A` | `--color-background` |
| Foreground | `#F8FAFC` | `--color-foreground` |
| Card / Surface | `#1B2336` | `--color-card` |
| Card Foreground | `#F8FAFC` | `--color-card-foreground` |
| Muted | `#272F42` | `--color-muted` |
| Muted Foreground | `#94A3B8` | `--color-muted-foreground` |
| Border | `#475569` | `--color-border` |
| Destructive | `#EF4444` | `--color-destructive` |
| Warning | `#F59E0B` | `--color-warning` |
| Ring (focus) | `#22C55E` | `--color-ring` |

Focus ring uses the accent green for maximum visibility against the slate base.
*Note: "code dark + run green" — the IDE/developer-tool palette.*

### Typography (Inter + JetBrains Mono — technical precision)
- **Heading & body:** **Inter** — 700/-1.5 tracking for display, 600/-0.5 for H1/H2, 400 body,
  500 uppercase +1.2 tracking for labels.
- **Mono (timecodes, numbers, indices):** **JetBrains Mono** — tabular, precise; used wherever
  `hh:mm:ss,mmm` timestamps or counters appear so columns align.
- **Google Fonts:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
```
- **Tailwind:** `fontFamily: { sans: ['Inter','sans-serif'], mono: ['JetBrains Mono','monospace'] }`

### Spacing & shape
- 4px base spacing scale (4/8/12/16/24/32/48). Comfortable, data-dense but not cramped rows.
- Radius: cards/panels `12px` (`rounded-xl`), controls `8px` (`rounded-lg`), inputs `6px`.
- Hairline borders `rgba(255,255,255,0.08)` for surface separation; `--color-border` for inputs.

### Key Effects
- Minimal: subtle elevation via `--color-card` surfaces + hairline borders. No heavy glow.
- Smooth transitions **150–300ms** on hover/focus/press; `scale(0.98)` press on buttons.
- Accent green confirms success; destructive red for delete; amber for lint warnings.
- A tiny accent glow is permitted *only* behind the primary CTA, used sparingly.

### Avoid (Anti-patterns) — enriched via `--domain ux`
- Light-mode default (this app is dark-only and must declare `color-scheme: dark`).
- Pure black `#000000` backgrounds (OLED smear / no elevation).
- Emojis as icons — use **SVG** (Lucide).
- Blank/frozen UI during async work — show skeletons/spinners (Loading States, severity High).
- Infinite/decorative animations (e.g. `animate-bounce` on icons) — continuous animation only
  for genuine loaders (severity Medium).
- `z-index: 9999` cargo-culting — respect **stacking contexts**; isolate with a positioned
  parent instead (severity Medium).
- Prop drilling 5+ levels / mixing data logic into presentational components — use a store/
  context and a container/presentational split (React stack guideline).
- Slow performance / janky large-list rendering.

### Pre-Delivery Checklist
- [ ] No emojis as icons (SVG via Lucide).
- [ ] `cursor-pointer` on every clickable element.
- [ ] Hover states with 150–300ms transitions.
- [ ] Text contrast ≥ 4.5:1 (target 7:1 for primary text on slate).
- [ ] Visible keyboard focus (accent-green ring) on all interactive elements.
- [ ] `prefers-reduced-motion` respected (disable non-essential transitions/animations).
- [ ] Responsive at 375 / 768 / 1024 / 1440 px.
- [ ] Async actions show loading feedback; never a frozen UI.
- [ ] Error and empty states designed, not afterthoughts.
