import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Marca — herdada do legado (ver docs/06-identidade-visual.md)
        navy: {
          DEFAULT: 'hsl(var(--navy))',
          deep: 'hsl(var(--navy-deep))',
          soft: 'hsl(var(--navy-soft))',
        },
        teal: {
          DEFAULT: 'hsl(var(--teal))',
          hover: 'hsl(var(--teal-hover))',
        },
        gold: 'hsl(var(--gold))',

        background: 'hsl(var(--background))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          alt: 'hsl(var(--surface-alt))',
        },
        border: 'hsl(var(--border))',
        'border-strong': 'hsl(var(--border-strong))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        ring: 'hsl(var(--ring))',

        // Status do processo — mesmos significados das cores de linha do legado
        quote: 'hsl(var(--status-quote))',
        provisional: 'hsl(var(--status-provisional))',
        final: 'hsl(var(--status-final))',

        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Base 14px — telas de dados densas (o legado usa 16px e força rolagem)
        base: ['0.875rem', { lineHeight: '1.25rem' }],
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 36 95 / 0.04), 0 1px 3px 0 rgb(16 36 95 / 0.06)',
        raised: '0 4px 16px -2px rgb(16 36 95 / 0.10)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'slide-up': 'slide-up .22s cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
