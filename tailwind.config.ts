import type { Config } from "tailwindcss";

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
        "aldi-orange": "#F37D1E",
        "aldi-text": "#333333",
        "aldi-muted": "#6B7280",
        "aldi-muted-light": "#E5E7EB",
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
    },
  },
  plugins: [],
};

export default config;
