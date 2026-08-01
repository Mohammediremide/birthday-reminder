/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Inter", "sans-serif"],
      },
      colors: {
        ledger: {
          bg: "#16302B", // deep ledger-green background
          surface: "#1E3F38", // slightly lighter panel
          card: "#FBF6EC", // parchment card
          ink: "#1F2A24", // near-black text on parchment
          line: "#2E5850", // hairline dividers on dark surfaces
        },
        amber: {
          DEFAULT: "#E8A33D",
          soft: "#F3C97C",
        },
        rose: {
          DEFAULT: "#C4694F",
        },
      },
    },
  },
  plugins: [],
};
