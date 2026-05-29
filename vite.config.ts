/// <reference types="vitest/config" />
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'

// Browser-enforced version of the "nothing leaves your device" promise. connect-src 'none'
// blocks every network request (XHR/fetch/WebSocket/beacon), so a future regression or a
// compromised dependency cannot exfiltrate a user's subtitles — it would have blocked the
// Google-Fonts CDN fetch a prior review had to remove by hand. Tuned to how the app loads:
// Vite-bundled module scripts (and the lazy jschardet chunk) are 'self'; Tailwind/@tanstack
// inject inline styles → style-src 'unsafe-inline'; @fontsource serves fonts same-origin;
// the local-video preview uses a blob: URL → media-src blob:; the regex worker is a module
// worker → worker-src 'self' blob:.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src blob:",
  "worker-src 'self' blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ')

// Inject the CSP only into the production build's index.html. A static <meta> CSP in the
// source index.html would also apply during `npm run dev`, where Vite needs an inline HMR
// preamble and a dev-server WebSocket — both of which this policy would block.
function injectCsp(): PluginOption {
  return {
    name: 'subsmith-inject-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler: (html: string) => ({
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
            injectTo: 'head-prepend' as const,
          },
        ],
      }),
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the static build also works when opened from a sub-path
  // (e.g. GitHub Pages project sites or a downloaded zip opened via file://).
  base: './',
  plugins: [react(), injectCsp()],
  build: {
    // jschardet ships sizeable charset models, but it is now loaded lazily (dynamic import
    // in src/core/detect.ts) so it lands in its own chunk instead of the entry bundle. The
    // default 500 kB warning threshold is fine again now that the main chunk is ~90 kB gzip.
    chunkSizeWarningLimit: 500,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/state/**/*.ts'],
    },
  },
})
