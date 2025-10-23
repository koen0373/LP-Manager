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
        'enosys-bg': 'var(--enosys-bg)',
        'enosys-card': 'var(--enosys-card)',
        'enosys-border': 'var(--enosys-border)',
        'enosys-text': 'var(--enosys-text)',
        'enosys-subtext': 'var(--enosys-subtext)',
        'enosys-primary': 'var(--enosys-primary)',
        'enosys-blue': 'var(--enosys-blue)',
        'enosys-blueHover': 'var(--enosys-blueHover)',
        'enosys-subcard': 'var(--enosys-subcard)',
        'enosys-row-separator': 'var(--enosys-row-separator)',
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