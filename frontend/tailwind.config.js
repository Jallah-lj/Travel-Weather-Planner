/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)', forest: '#174b36', moss: '#2f6b4d', cream: 'rgb(var(--cream) / <alpha-value>)', amber: '#dfa34a', slate: 'rgb(var(--slate) / <alpha-value>)'
      },
      fontFamily: { sans: ['Inter', 'Manrope', 'ui-sans-serif', 'system-ui'] },
      opacity: { 4: '.04', 6: '.06', 7: '.07', 8: '.08', 12: '.12', 15: '.15', 18: '.18', 25: '.25', 30: '.30', 38: '.38', 40: '.40', 45: '.45', 50: '.50', 55: '.55', 58: '.58', 60: '.60', 65: '.65', 68: '.68', 75: '.75', 78: '.78', 90: '.90', 95: '.95' },
      boxShadow: { soft: '0 12px 40px rgba(23,34,29,.08)', card: '0 4px 20px rgba(23,34,29,.06)' }
    }
  },
  plugins: []
}
