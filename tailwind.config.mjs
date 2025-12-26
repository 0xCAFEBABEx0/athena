import tailwindcssAnimate from 'tailwindcss-animate'
import typography from '@tailwindcss/typography'
import daisyui from 'daisyui'

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  plugins: [tailwindcssAnimate, typography, daisyui],
  daisyui: {
    themes: [
      {
        light: {
          primary: 'hsl(222.2 47.4% 11.2%)',
          'primary-content': 'hsl(210 40% 98%)',
          secondary: 'hsl(210 40% 96.1%)',
          'secondary-content': 'hsl(222.2 47.4% 11.2%)',
          accent: 'hsl(210 40% 96.1%)',
          'accent-content': 'hsl(222.2 47.4% 11.2%)',
          neutral: 'hsl(222.2 84% 4.9%)',
          'neutral-content': 'hsl(210 40% 98%)',
          'base-100': 'hsl(0 0% 100%)',
          'base-200': 'hsl(240 5% 96%)',
          'base-300': 'hsl(240 6% 80%)',
          info: 'hsl(196 52% 74%)',
          success: 'hsl(196 52% 74%)',
          warning: 'hsl(34 89% 85%)',
          error: 'hsl(0 84.2% 60.2%)',
          '--rounded-btn': '0.2rem',
          '--rounded-badge': '0.2rem',
          '--rounded-box': '0.4rem',
        },
        dark: {
          primary: 'hsl(210 40% 98%)',
          'primary-content': 'hsl(222.2 47.4% 11.2%)',
          secondary: 'hsl(217.2 32.6% 17.5%)',
          'secondary-content': 'hsl(210 40% 98%)',
          accent: 'hsl(217.2 32.6% 17.5%)',
          'accent-content': 'hsl(210 40% 98%)',
          neutral: 'hsl(210 40% 98%)',
          'neutral-content': 'hsl(222.2 47.4% 11.2%)',
          'base-100': 'hsl(0 0% 0%)',
          'base-200': 'hsl(0 0% 4%)',
          'base-300': 'hsl(217.2 32.6% 17.5%)',
          info: 'hsl(196 100% 14%)',
          success: 'hsl(196 100% 14%)',
          warning: 'hsl(34 51% 25%)',
          error: 'hsl(0 62.8% 30.6%)',
          '--rounded-btn': '0.2rem',
          '--rounded-badge': '0.2rem',
          '--rounded-box': '0.4rem',
        },
      },
    ],
    darkTheme: 'dark',
    base: true,
    styled: true,
    utils: true,
    prefix: '',
    logs: true,
    themeRoot: ':root',
  },
  prefix: '',
  safelist: [
    'lg:col-span-4',
    'lg:col-span-6',
    'lg:col-span-8',
    'lg:col-span-12',
    'border-border',
    'bg-card',
    'border-error',
    'bg-error/30',
    'border-success',
    'bg-success/30',
    'border-warning',
    'bg-warning/30',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        '2xl': '2rem',
        DEFAULT: '1rem',
        lg: '2rem',
        md: '2rem',
        sm: '1rem',
        xl: '2rem',
      },
      screens: {
        '2xl': '86rem',
        lg: '64rem',
        md: '48rem',
        sm: '40rem',
        xl: '80rem',
      },
    },
    extend: {
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        background: 'hsl(var(--background))',
        border: 'hsla(var(--border))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        foreground: 'hsl(var(--foreground))',
        input: 'hsl(var(--input))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        ring: 'hsl(var(--ring))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        success: 'hsl(var(--success))',
        error: 'hsl(var(--error))',
        warning: 'hsl(var(--warning))',
      },
      fontFamily: {
        mono: ['var(--font-geist-mono)'],
        sans: ['var(--font-geist-sans)'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      typography: () => ({
        DEFAULT: {
          css: [
            {
              '--tw-prose-body': 'var(--text)',
              '--tw-prose-headings': 'var(--text)',
              h1: {
                fontWeight: 'normal',
                marginBottom: '0.25em',
              },
            },
          ],
        },
        base: {
          css: [
            {
              h1: {
                fontSize: '2.5rem',
              },
              h2: {
                fontSize: '1.25rem',
                fontWeight: 600,
              },
            },
          ],
        },
        md: {
          css: [
            {
              h1: {
                fontSize: '3.5rem',
              },
              h2: {
                fontSize: '1.5rem',
              },
            },
          ],
        },
      }),
    },
  },
}

export default config
