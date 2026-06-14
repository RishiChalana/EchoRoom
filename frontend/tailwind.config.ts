import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        er: {
          bg:             "var(--er-bg)",
          surface:        "var(--er-surface)",
          "surface-2":    "var(--er-surface-2)",
          "surface-3":    "var(--er-surface-3)",
          "surface-4":    "var(--er-surface-4)",
          ink:            "var(--er-ink)",
          "ink-2":        "var(--er-ink-2)",
          "ink-3":        "var(--er-ink-3)",
          "ink-4":        "var(--er-ink-4)",
          border:         "var(--er-border)",
          "border-2":     "var(--er-border-2)",
          blue:           "var(--er-blue)",
          "blue-2":       "var(--er-blue-2)",
          "blue-dim":     "var(--er-blue-dim)",
          "blue-text":    "var(--er-blue-text)",
          amber:          "var(--er-amber)",
          red:            "var(--er-red)",
          green:          "var(--er-green)",
          "dark-bg":      "var(--er-dark-bg)",
          "dark-surface": "var(--er-dark-surface)",
          "dark-ink":     "var(--er-dark-ink)",
          "dark-ink-2":   "var(--er-dark-ink-2)",
          "dark-border":  "var(--er-dark-border)",
          "dark-blue":    "var(--er-dark-blue)",
          "btn-bg":           "var(--er-btn-bg)",
          "btn-text":         "var(--er-btn-text)",
          "btn-ghost-border": "var(--er-btn-ghost-border)",
          "btn-ghost-text":   "var(--er-btn-ghost-text)",
          "red-dim":   "var(--er-red-dim)",
          "amber-dim": "var(--er-amber-dim)",
          "green-dim": "var(--er-green-dim)",
        },
      },
      fontFamily: {
        display: ["var(--font-hanken)", "Hanken Grotesk", "system-ui", "sans-serif"],
        sans:    ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono:    ["var(--font-geist-mono)", "Geist Mono", "monospace"],
        label:   ["var(--font-geist)", "Geist", "system-ui", "sans-serif"],
      },
      maxWidth: {
        container: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
