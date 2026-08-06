import type { Config } from "tailwindcss";

// Designtokens tagna direkt ur Stitch-skärmarna (variant "AI Executive",
// den mest genomarbetade av de fem). Sagegrönt, varmt off-white, Syne
// för allt och JetBrains Mono för siffror.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Färgerna bor i src/index.css som RGB-kanaler, en uppsättning per hus
      // (standalone / essensia / linnartistry). <alpha-value> gör att
      // opacitetsmodifierare som bg-primary/90 fortsätter fungera.
      // Standalone-värdena ÄR Piches ursprungliga hex, oförändrade.
      colors: {
        primary: "rgb(var(--c-primary) / <alpha-value>)",
        "on-primary": "rgb(var(--c-on-primary) / <alpha-value>)",
        "primary-container": "rgb(var(--c-primary-container) / <alpha-value>)",
        "on-primary-container": "rgb(var(--c-on-primary-container) / <alpha-value>)",
        secondary: "rgb(var(--c-secondary) / <alpha-value>)",
        "secondary-container": "rgb(var(--c-secondary-container) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--c-on-secondary-container) / <alpha-value>)",
        tertiary: "rgb(var(--c-tertiary) / <alpha-value>)",
        "tertiary-container": "rgb(var(--c-tertiary-container) / <alpha-value>)",
        "on-tertiary-container": "rgb(var(--c-on-tertiary-container) / <alpha-value>)",
        error: "rgb(var(--c-error) / <alpha-value>)",
        "on-error": "rgb(var(--c-on-error) / <alpha-value>)",
        "error-container": "rgb(var(--c-error-container) / <alpha-value>)",
        "on-error-container": "rgb(var(--c-on-error-container) / <alpha-value>)",
        background: "rgb(var(--c-background) / <alpha-value>)",
        "on-background": "rgb(var(--c-on-background) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "on-surface": "rgb(var(--c-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--c-on-surface-variant) / <alpha-value>)",
        outline: "rgb(var(--c-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--c-outline-variant) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--c-surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "rgb(var(--c-surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--c-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--c-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--c-surface-container-highest) / <alpha-value>)",
        // Accentfärger för diagram och kategorier, ur Analytics-skärmen.
        sage: "rgb(var(--c-sage) / <alpha-value>)",
        terracotta: "rgb(var(--c-terracotta) / <alpha-value>)",
        sand: "rgb(var(--c-sand) / <alpha-value>)",
        forest: "rgb(var(--c-forest) / <alpha-value>)",
        // Textfärgen under ett eget namn. Korten använder hover:border-ink/25
        // för att markera att raden går att klicka på, och utan den här raden
        // finns klassen inte och hovern gör ingenting alls. Pekar på samma
        // variabel som on-surface, så alla tre husen har den redan.
        ink: "rgb(var(--c-on-surface) / <alpha-value>)",
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
        // Brödtexten byter font med huset (Syne / DM Sans / Quicksand).
        // Siffrorna gör det aldrig — tabeller och belopp ska ligga i kolumn.
        sans: "var(--font-sans)",
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
        // Neutral svart skugga, alltså samma i alla tre husen.
        soft: "0 4px 20px -2px rgba(0,0,0,0.05), 0 0 3px rgba(0,0,0,0.02)",
      },
    },
  },
  plugins: [],
} satisfies Config;
