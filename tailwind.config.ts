import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#EFE8D8",
          dim: "#E5DCC6",
          dark: "#201C16",
          darkdim: "#2A251D",
        },
        ink: {
          DEFAULT: "rgb(var(--text-rgb) / <alpha-value>)",
          soft: "rgb(var(--text-soft-rgb) / <alpha-value>)",
          light: "#EDE6D6",
        },
        sepia: {
          DEFAULT: "#3A4A6B",
          light: "#5E7099",
        },
        sage: {
          DEFAULT: "#7A8B6F",
          light: "#A9B89E",
        },
        rose: {
          DEFAULT: "#B5695A",
        },
        brass: {
          DEFAULT: "#B08D57",
          light: "#CBAE80",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        serif: ["var(--font-editor)", "Georgia", "serif"],
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        grain: "url('/grain.svg')",
      },
      keyframes: {
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        blink: "blink 1s steps(1) infinite",
        fadeIn: "fadeIn 0.25s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;