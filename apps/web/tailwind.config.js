/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: '#f4f0e6',
        ink: '#0b1a33',
        ocean: '#1b3158',
        steel: '#2f578c',
        surf: '#acc6e9',
        coral: '#ff4b31',
        mint: '#5acda7',
        gold: '#f2a43a',
        purple: '#9f72ff',
        foam: '#d6f0e8',
      },
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
