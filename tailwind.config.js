// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
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
        'soft-green': '#C3E8AC', // Soft green
        'soft-cream': '#F5E8C7', // Soft cream
      }
    },
  },
  plugins: [],
};