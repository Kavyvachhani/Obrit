/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        orbit: {
          bg: "#090d16",
          panel: "rgba(13, 20, 36, 0.85)",
          border: "rgba(56, 189, 248, 0.15)",
          cyan: "#38bdf8",
          purple: "#a855f7",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
        },
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(56, 189, 248, 0.4)",
        "glow-purple": "0 0 25px -5px rgba(168, 85, 247, 0.4)",
        "glow-emerald": "0 0 25px -5px rgba(16, 185, 129, 0.4)",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
