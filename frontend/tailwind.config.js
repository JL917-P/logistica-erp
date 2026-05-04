/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e5e9ff',
          200: '#d1d9ff',
          300: '#a8b8ff',
          400: '#7d8fff',
          500: '#5a6cff',
          600: '#4c5ef6',
          700: '#3d4ae8',
          800: '#343db5',
          900: '#2f348f',
        },
      },
    },
  },
  plugins: [],
}
