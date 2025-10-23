/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        enosys: {
          bg: 'var(--enosys-bg)',
          card: 'var(--enosys-card)',
          subcard: 'var(--enosys-subcard)',
          text: 'var(--enosys-text)',
          subtext: 'var(--enosys-subtext)',
          accentGreen: 'var(--enosys-accent-green)',
          accentRed: 'var(--enosys-accent-red)',
          accentBlue: 'var(--enosys-accent-blue)',
          inactive: 'var(--enosys-inactive)',
          border: 'var(--enosys-border)',
          hover: 'var(--enosys-hover)',
          rowSeparator: 'var(--enosys-row-separator)',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        xl: '12px',
      },
    },
  },
  plugins: [],
}
