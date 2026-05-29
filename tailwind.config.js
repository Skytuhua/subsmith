/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: 'var(--color-primary)', fg: 'var(--color-on-primary)' },
        secondary: 'var(--color-secondary)',
        accent: { DEFAULT: 'var(--color-accent)', fg: 'var(--color-on-accent)' },
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        card: { DEFAULT: 'var(--color-card)', fg: 'var(--color-card-foreground)' },
        muted: { DEFAULT: 'var(--color-muted)', fg: 'var(--color-muted-foreground)' },
        border: 'var(--color-border)',
        destructive: 'var(--color-destructive)',
        warning: 'var(--color-warning)',
        ring: 'var(--color-ring)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        lg: '0.75rem', // 12px panels/cards
        md: '0.5rem', // 8px controls
        sm: '0.375rem', // 6px inputs
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
      },
    },
  },
  plugins: [],
}
