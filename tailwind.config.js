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
        background: '#0f1215',
        surface: {
          DEFAULT: '#161b1f',
          muted: '#121619',
          elevated: '#1e2429',
          border: '#2a3239',
          hover: '#252d33'
        },
        accent: {
          DEFAULT: '#22c55e',
          hover: '#16a34a',
          dark: '#15803d',
          subtle: '#22c55e1a'
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
      }
    },
  },
  plugins: [],
}
