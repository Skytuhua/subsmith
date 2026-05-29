/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the static build also works when opened from a sub-path
  // (e.g. GitHub Pages project sites or a downloaded zip opened via file://).
  base: './',
  plugins: [react()],
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
