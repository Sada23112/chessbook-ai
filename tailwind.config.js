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
        background: '#312e2b',
        surface: {
          DEFAULT: '#272522',
          muted: '#21201d',
          elevated: '#21201d',
          card: '#262421',
          border: '#3d3a34',
          hover: '#383531',
        },
        accent: {
          DEFAULT: '#81b64c',
          hover: '#95c95d',
          dark: '#588c32',
          subtle: '#81b64c20',
        },
        chess: {
          brilliant: '#1baca6',
          great: '#5c8bb0',
          best: '#81b64c',
          excellent: '#81b64c',
          good: '#96bc4b',
          book: '#d5a47d',
          inaccuracy: '#f0c15c',
          mistake: '#e58f2a',
          blunder: '#ca3431',
          missedWin: '#db4542',
          forced: '#96bc4b',
        },
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
