import type { Config } from "tailwindcss";

// Designtokens tagna direkt ur Stitch-skärmarna (variant "AI Executive",
// den mest genomarbetade av de fem). Sagegrönt, varmt off-white, Syne
// för allt och JetBrains Mono för siffror.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#3f694e",
        "on-primary": "#ffffff",
        "primary-container": "#c0efd0",
        "on-primary-container": "#00210f",
        secondary: "#4f6353",
        "secondary-container": "#d1e8d4",
        "on-secondary-container": "#0c1f13",
        tertiary: "#3a656f",
        "tertiary-container": "#beeaf6",
        "on-tertiary-container": "#001f26",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#410002",
        background: "#fbf9f6",
        "on-background": "#191c1a",
        surface: "#fbf9f6",
        "on-surface": "#191c1a",
        "on-surface-variant": "#404943",
        outline: "#707973",
        "outline-variant": "#bfc9c0",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f5f3f0",
        "surface-container": "#efedea",
        "surface-container-high": "#e9e7e4",
        "surface-container-highest": "#e3e2de",
        // Accentfärger för diagram och kategorier, ur Analytics-skärmen.
        sage: "#8fa08a",
        terracotta: "#d68a73",
        sand: "#d8c29d",
        forest: "#4a6b47",
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "2rem",
        "3xl": "2.5rem",
        full: "9999px",
      },
      fontFamily: {
        sans: ["Syne", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        "headline-lg": ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-sm": ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "mono-data": ["13px", { lineHeight: "1.4", fontWeight: "500" }],
        "label-caps": ["12px", { lineHeight: "1", letterSpacing: "0.05em", fontWeight: "700" }],
      },
      boxShadow: {
        soft: "0 4px 20px -2px rgba(0,0,0,0.05), 0 0 3px rgba(0,0,0,0.02)",
        glow: "0 0 15px rgba(63,105,78,0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
