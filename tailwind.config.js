/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'liqui-bg': 'var(--liqui-bg)',
        'liqui-card': 'var(--liqui-card)',
        'liqui-border': 'var(--liqui-border)',
        'liqui-text': 'var(--liqui-text)',
        'liqui-subtext': 'var(--liqui-subtext)',
        'liqui-hover': 'var(--liqui-hover)',
        'liqui-subcard': 'var(--liqui-subcard)',
        // Legacy aliases for backwards compatibility
        'enosys-bg': 'var(--liqui-bg)',
        'enosys-card': 'var(--liqui-card)',
        'enosys-border': 'var(--liqui-border)',
        'enosys-text': 'var(--liqui-text)',
        'enosys-subtext': 'var(--liqui-subtext)',
        'enosys-hover': 'var(--liqui-hover)',
        'enosys-subcard': 'var(--liqui-subcard)',
      },
      fontFamily: {
        'sans': ['Quicksand', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'mono': ['ui-monospace', 'SFMono-Regular', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
      },
      fontWeight: {
        'normal': '400',
        'bold': '700',
      },
    },
  },
  plugins: [],
}