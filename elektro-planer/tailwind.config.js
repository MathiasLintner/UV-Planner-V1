/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'phase-l1': '#8B4513',
        'phase-l2': '#000000',
        'phase-l3': '#808080',
        'neutral': '#3B82F6',
        'pe': '#22C55E',
        'hutschiene': '#C0C0C0',
      },
    },
  },
  plugins: [],
}
