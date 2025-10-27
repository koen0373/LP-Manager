/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        liqui: {
          // Brand
          navy: '#0D0F13',       // achtergrond / body (antraciet - matches water background)
          ink:  '#0F1324',       // kaarten
          mist: '#B9C7DA',       // tagline / icoontjes / divider
          aqua: '#75C4FF',       // interactieve highlight
          // States
          succ: '#2ECC71',
          warn: '#F4B740',
          err:  '#FF6B6B',
          // Legacy (keep for backwards compat during migration)
          deep: '#0B1A4A',
          ocean: '#8EB5D8',
          night: '#0D0F13',
          white: '#FFFFFF',
          success: '#3FC57D',
          card: '#15171D',
          grid: '#1C2028',
        },
        // Legacy aliases for backwards compatibility
        'liqui-bg': 'var(--liqui-bg)',
        'liqui-card': 'var(--liqui-card)',
        'liqui-border': 'var(--liqui-border)',
        'liqui-text': 'var(--liqui-text)',
        'liqui-subtext': 'var(--liqui-subtext)',
        'liqui-hover': 'var(--liqui-hover)',
        'liqui-subcard': 'var(--liqui-subcard)',
        'enosys-bg': 'var(--liqui-bg)',
        'enosys-card': 'var(--liqui-card)',
        'enosys-border': 'var(--liqui-border)',
        'enosys-text': 'var(--liqui-text)',
        'enosys-subtext': 'var(--liqui-subtext)',
        'enosys-hover': 'var(--liqui-hover)',
        'enosys-subcard': 'var(--liqui-subcard)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
        brand: ['Quicksand', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Inter', 'sans-serif'],
        ui: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Quicksand', 'sans-serif'],
      },
      fontWeight: {
        'normal': '400',
        'bold': '700',
      },
      ringColor: ({ theme }) => ({
        DEFAULT: theme('colors.liqui.aqua'),
      }),
      keyframes: {
        'pulse-green': {
          '0%, 100%': {
            boxShadow: '0 0 8px rgba(0, 198, 107, 0.4), 0 0 16px rgba(0, 198, 107, 0.2)',
          },
          '50%': {
            boxShadow: '0 0 16px rgba(0, 198, 107, 0.8), 0 0 24px rgba(0, 198, 107, 0.4), 0 0 32px rgba(0, 198, 107, 0.2)',
          },
        },
        'glow-orange': {
          '0%, 100%': {
            boxShadow: '0 0 8px rgba(255, 165, 0, 0.4), 0 0 12px rgba(255, 165, 0, 0.3)',
          },
          '50%': {
            boxShadow: '0 0 12px rgba(255, 165, 0, 0.6), 0 0 20px rgba(255, 165, 0, 0.4)',
          },
        },
      },
      animation: {
        'pulse-green': 'pulse-green 2s ease-in-out infinite',
        'glow-orange': 'glow-orange 3s ease-in-out infinite',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.tnum': { fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }
      });
    }
  ],
}