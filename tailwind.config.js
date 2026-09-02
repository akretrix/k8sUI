/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF4FF',
          100: '#DCE7FE',
          200: '#B8D0FC',
          300: '#8FB4FA',
          400: '#60A5FA',
          500: '#326CE5', // Primary Core K8s Inspired
          600: '#2557C7',
          700: '#1D44A5',
          800: '#143175',
          900: '#0E214F',
          950: '#060E22',
        },
        canvas: {
          base: '#0B0F17', // Deep Obsidian
          surface: '#111827', // Slate 900
          card: '#111827',
          elevated: '#1F2937', // Slate 800
          subdued: '#1F2937',
          border: '#1F2937',
        },
        background: '#0B0F17',
        surface: {
          DEFAULT: '#111827',
          elevated: '#1F2937',
          hover: '#374151',
          subdued: '#1F2937',
        },
        border: {
          DEFAULT: '#1F2937',
          subtle: '#1F2937',
          strong: '#374151',
        },
        semantic: {
          healthy: '#10B981',
          'healthy-pulse': '#34D399',
          warning: '#F59E0B',
          critical: '#EF4444',
          pending: '#6366F1',
        },
        env: {
          prod: '#EF4444',
          'prod-bg': '#450A0A',
          staging: '#F59E0B',
          'staging-bg': '#451A03',
          dev: '#10B981',
          'dev-bg': '#022C22',
          local: '#326CE5',
          'local-bg': '#0E214F',
        },
        status: {
          running: '#10B981',
          pending: '#6366F1',
          failed: '#EF4444',
          warning: '#F59E0B',
          completed: '#94A3B8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
