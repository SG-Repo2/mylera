module.exports = {
  content: {
    files: [
      "./app/**/*.{js,jsx,ts,tsx}",
      "./src/**/*.{js,jsx,ts,tsx}",
    ],
  },
  theme: {
    extend: {
      colors: {
        primary: "#20B2AA",
        secondary: "#9B59B6",
        background: "#f9f9f9",
        text: {
          primary: "#2C3E50",
          secondary: "#7F8C8D",
          light: "#FFFFFF"
        },
        status: {
          success: "#2ECC71",
          warning: "#F1C40F",
          error: "#E74C3C"
        }
      },
    },
  },
};