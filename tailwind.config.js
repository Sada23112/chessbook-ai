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
        background: '#0b0f14',
        surface: {
          DEFAULT: '#111720',
          muted: '#0e1319',
          elevated: '#18202c',
          border: '#212d3d',
          hover: '#1e2a38'
        },
        accent: {
          DEFAULT: '#22c55e',
          hover: '#16a34a',
          dark: '#15803d',
          subtle: '#22c55e18'
        },
        chess: {
          best: '#22c55e',
          excellent: '#84cc16',
          good: '#a3e635',
          inaccuracy: '#eab308',
          mistake: '#f97316',
          blunder: '#ef4444',
          missedWin: '#ec4899',
          forced: '#06b6d4',
          book: '#8b5cf6'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
