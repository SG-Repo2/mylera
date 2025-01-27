/** @type {import('tailwindcss').Config} */
module.exports = {
  content: {
    files: [
      "./app/**/*.{js,jsx,ts,tsx}",
      "./src/**/*.{js,jsx,ts,tsx}",
    ],
  },
  presets: [require("./nativewind-config.js")],
  theme: {
    extend: {},
  },
  plugins: [],
};