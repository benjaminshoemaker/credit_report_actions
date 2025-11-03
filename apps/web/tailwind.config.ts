import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0f172a',
          muted: '#111c34'
        },
        surface: {
          DEFAULT: '#15213c',
          muted: '#1e2a47'
        },
        primary: {
          DEFAULT: '#10B981',
          foreground: '#0f172a'
        },
        accent: {
          DEFAULT: '#38bdf8'
        },
        danger: {
          DEFAULT: '#f87171'
        }
      }
    }
  },
  plugins: []
};

export default config;
