import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * ALDI SÜD Design System (UI.md §5, ARCHITECTURE §7).
 * Primary: Blue #001E5E, Accent: Orange #F37D1E (aldi-sued.de / brand).
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "aldi-blue": "#001E5E",
        "aldi-blue-light": "#E8EDF5",
        "aldi-orange": "#F37D1E",
        "aldi-text": "#1A1A2E",
        "aldi-text-secondary": "#4A5568",
        "aldi-muted": "#6B7280",
        "aldi-muted-light": "#E5E7EB",
        "aldi-bg": "#F7F8FA",
        "aldi-error": "#E11921",
        "aldi-success": "#27AE60",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "category": ["0.75rem", { lineHeight: "1.25", letterSpacing: "0.05em" }],
      },
      transitionDuration: {
        "ui": "200",
        "ui-slow": "280",
      },
      minHeight: {
        "touch": "44px",
      },
      minWidth: {
        "touch": "44px",
      },
      keyframes: {
        "fade-in-down": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "tile-exit": {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.85)" },
        },
        "tile-enter": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in-down 200ms ease-out",
        "tile-exit": "tile-exit 300ms ease-in forwards",
        "tile-enter": "tile-enter 200ms ease-out",
      },
    },
  },
  plugins: [
    plugin(function ({ addVariant }) {
      addVariant("pointer-fine", "@media (pointer: fine)");
      addVariant("pointer-coarse", "@media (pointer: coarse)");
    }),
  ],
};

export default config;
