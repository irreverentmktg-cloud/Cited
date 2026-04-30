/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0a',
        rich: '#2a2a2a',
        mid: '#6b6b6b',
        silver: '#b0b0b0',
        line: '#e5e5e5',
        offwhite: '#f5f5f5',
        score: {
          critical: '#ef4444',
          warning: '#f59e0b',
          good: '#22c55e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      boxShadow: {
        card: '0 0 0 1px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        chrome:
          'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.06)',
        ringSoft: '0 0 0 1px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.04)',
      },
      backgroundImage: {
        chrome: 'linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%)',
        'chrome-text':
          'linear-gradient(180deg, #6b6b6b 0%, #2a2a2a 50%, #6b6b6b 100%)',
        'chrome-shimmer':
          'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0) 100%)',
      },
      keyframes: {
        'chrome-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'chrome-shimmer': 'chrome-shimmer 2.4s linear infinite',
        'count-up': 'count-up 600ms ease-out both',
        'fade-up': 'fade-up 400ms ease-out both',
        'pulse-soft': 'pulse-soft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
