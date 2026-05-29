# Third-Party Notices

Subsmith bundles the following open-source dependencies. Their license texts are available
in `node_modules/<package>/LICENSE` after `npm install`, and via the links below.

| Package | License | Notes |
|---|---|---|
| react, react-dom | MIT | https://github.com/facebook/react |
| jschardet | LGPL-2.1+ | https://github.com/aadsm/jschardet — used **unmodified** as a library for character-encoding detection. |
| lucide-react | ISC | https://github.com/lucide-icons/lucide — SVG icons |
| clsx | MIT | https://github.com/lukeed/clsx |
| @tanstack/react-virtual | MIT | https://github.com/TanStack/virtual — cue-list virtualization |
| @fontsource/inter | SIL OFL 1.1 | Inter typeface by Rasmus Andersson; self-hosted |
| @fontsource/jetbrains-mono | SIL OFL 1.1 | JetBrains Mono typeface; self-hosted |
| tailwindcss, postcss, autoprefixer | MIT | build-time only |
| vite, @vitejs/plugin-react, vitest, @testing-library/* | MIT | build/test only |

Subsmith itself is released under the MIT License (see `LICENSE`).

## LGPL-2.1 (jschardet) compliance note

jschardet is licensed under the GNU Lesser General Public License v2.1+. Subsmith uses it as
an **unmodified** dependency declared in `package.json`. A recipient can replace it with a
modified version of the library by swapping the dependency and rebuilding. The jschardet
source and license are available at https://github.com/aadsm/jschardet.
