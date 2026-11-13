import type { Config } from 'tailwindcss';

/**
 * LawTrack design tokens.
 *
 * The palette is intentionally limited to ivory, coal and royal blue. Every
 * colour below resolves to a CSS variable declared in `src/styles/globals.css`
 * (channels only, so Tailwind opacity modifiers keep working). Semantic status
 * colours are for status only — never decoration.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/features/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--lt-canvas) / <alpha-value>)',
        surface: 'rgb(var(--lt-surface) / <alpha-value>)',
        ink: 'rgb(var(--lt-ink) / <alpha-value>)',
        muted: 'rgb(var(--lt-muted) / <alpha-value>)',
        line: 'rgb(var(--lt-line) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--lt-primary) / <alpha-value>)',
          hover: 'rgb(var(--lt-primary-hover) / <alpha-value>)',
          pressed: 'rgb(var(--lt-primary-pressed) / <alpha-value>)',
          tint: 'rgb(var(--lt-primary-tint) / <alpha-value>)',
          foreground: 'rgb(var(--lt-primary-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--lt-success) / <alpha-value>)',
          tint: 'rgb(var(--lt-success-tint) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--lt-warning) / <alpha-value>)',
          tint: 'rgb(var(--lt-warning-tint) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--lt-danger) / <alpha-value>)',
          tint: 'rgb(var(--lt-danger-tint) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'var(--font-devanagari)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-heading)', 'var(--font-devanagari-heading)', 'ui-serif', 'Georgia', 'serif'],
      },
      spacing: {
        1.5: '0.375rem',
        18: '4.5rem',
        22: '5.5rem',
      },
      borderRadius: {
        card: '12px',
        input: '10px',
        pill: '999px',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(23 23 26 / 0.04), 0 8px 24px rgb(23 23 26 / 0.05)',
        lift: '0 2px 4px rgb(23 23 26 / 0.06), 0 16px 40px rgb(23 23 26 / 0.10)',
        focus: '0 0 0 2px rgb(var(--lt-canvas)), 0 0 0 4px rgb(var(--lt-primary))',
      },
      maxWidth: {
        prose: '70ch',
        shell: '1200px',
      },
      transitionDuration: {
        DEFAULT: '160ms',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-dot': {
          '0%, 80%, 100%': { opacity: '0.25' },
          '40%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'pulse-dot': 'pulse-dot 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
