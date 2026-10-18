/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg, #F4F1EA)',
        ink: {
          DEFAULT: 'var(--ink, #14201C)',
          hover: 'var(--ink-hover, #24332D)',
        },
        text: 'var(--text, #4B5651)',
        muted: 'var(--muted, #66706A)',
        accent: {
          DEFAULT: '#0F5C4D',
          hover: '#0B473B',
        },
        line: {
          DEFAULT: '#D9D5C7',
          strong: '#C4BFAE',
        },
        'line-strong': '#C4BFAE',
        'hover-surface': '#E9E5D8',
        acm: {
          50:  '#F4F1EA',
          100: '#E9E5D8',
          200: '#D9D5C7',
          300: '#0F5C4D',
          400: '#0F5C4D',
          500: '#0F5C4D',
          600: '#0F5C4D',
          700: '#0B473B',
          800: '#0B473B',
          900: '#14201C',
          950: '#14201C',
        },
        surface: {
          900: 'var(--bg)',
          800: '#FFFFFF',
          700: 'var(--hover-surface)',
          600: 'var(--line)',
          500: 'var(--line-strong)',
        },
      },
      borderColor: {
        DEFAULT: '#D9D5C7',
        line: '#D9D5C7',
        'line-strong': '#C4BFAE',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        heading: ['"Instrument Serif"', 'Georgia', 'serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-acm': '0 2px 12px rgba(15, 92, 77, 0.15)',
        'card': '0 2px 12px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.1)',
      }
    },
  },
  plugins: [],
}
