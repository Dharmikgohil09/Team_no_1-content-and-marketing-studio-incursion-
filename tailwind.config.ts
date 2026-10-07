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
        acm: {
          50:  '#eef4ff',
          100: '#d9e8ff',
          200: '#bbd4ff',
          300: '#8eb8ff',
          400: '#5f90ff',
          500: '#3b67fd',
          600: '#2248f2',
          700: '#1a35de',
          800: '#1c2db4',
          900: '#1d2c8e',
          950: '#151c57',
        },
        surface: {
          900: '#0f111a',
          800: '#161925',
          700: '#1e2235',
          600: '#262b42',
          500: '#2e3450',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
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
        'glow-acm': '0 0 24px rgba(59, 103, 253, 0.35)',
        'card': '0 4px 24px rgba(0,0,0,0.35)',
        'card-hover': '0 8px 40px rgba(0,0,0,0.5)',
      }
    },
  },
  plugins: [],
}
