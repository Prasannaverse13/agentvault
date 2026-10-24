import type { Config } from "tailwindcss";

// Wise-inspired tokens: Forest Ink carries weight, Lime Voltage is the single
// action accent, Fog/Linen Mist are the soft surfaces on a white canvas.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#163300",
        lime: "#9fe870",
        spruce: "#054d28",
        mist: "#e2f6d5",
        fog: "#e8ebe6",
        obsidian: "#0e0f0c",
        charcoal: "#454745",
        slate: "#6a6c6a",
        pebble: "#868685",
        paper: "#ffffff",
        line: "#dfe3dc",
        signal: "#0b4c72",
        // Status roles (product need, kept out of brand surfaces).
        good: "#054d28",
        warn: "#a05a00",
        danger: "#cb272f",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        card: "10px",
        panel: "16px",
        large: "28px",
      },
      boxShadow: {
        subtle: "rgba(14, 15, 12, 0.12) 0px 0px 0px 1px",
        lg: "rgba(0, 0, 0, 0.08) 0px 6px 20px 0px",
        xl: "rgba(0, 0, 0, 0.15) 0px 10px 32px 0px, rgba(0, 0, 0, 0.04) 0px 40px 40px 0px",
      },
      maxWidth: {
        page: "1200px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
