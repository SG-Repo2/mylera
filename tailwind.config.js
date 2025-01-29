/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('./nativewind-config.js')],
  content: {
    files: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  },
  theme: {
    extend: {
      colors: {
        primary: '#A2D5F2',    // Light blue (brand primary)
        secondary: '#183E9F',  // Dark blue (brand secondary)
        accent: '#F7A072',     // Coral
        'metric-red': '#FF6B6B', // Heart Rate card
        'metric-green': '#10B981', // Steps card
        'metric-purple': '#9333EA', // Calories card
        'metric-blue': '#3B82F6', // Distance card
        'soft-green': '#C3E8AC',
        'soft-cream': '#F5E8C7',
      },
      fontFamily: {
        'primary': ['Norwester', 'sans-serif'],
        'secondary': ['Proxima Nova', 'sans-serif'],
      }
    },
  },
  plugins: [],
};