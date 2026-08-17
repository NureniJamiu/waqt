/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0d1117",
        surface: {
          DEFAULT: "#161b22",
          hover: "#21262d",
          border: "#30363d",
        },
        primary: {
          DEFAULT: "#10b981", // Emerald accent
          hover: "#059669",
          light: "#34d399",
        },
        accent: {
          gold: "#f59e0b",
          purple: "#8b5cf6",
          danger: "#ef4444",
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
      }
    },
  },
  plugins: [],
}
