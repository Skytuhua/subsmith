/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the static build also works when opened from a sub-path
  // (e.g. GitHub Pages project sites or a downloaded zip opened via file://).
  base: './',
  plugins: [react()],
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
