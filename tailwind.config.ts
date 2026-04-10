import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Stitch / Material 3 design tokens
        primary: "#00003c",
        "on-primary": "#ffffff",
        "primary-container": "#000080",
        "on-primary-container": "#777eea",
        "primary-fixed": "#e0e0ff",
        "primary-fixed-dim": "#bfc2ff",

        secondary: "#575e72",
        "on-secondary": "#ffffff",
        "secondary-container": "#d9dff6",
        "on-secondary-container": "#5b6276",
        "secondary-fixed": "#dbe2f9",
        "secondary-fixed-dim": "#bfc6dd",

        tertiary: "#140800",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#321d00",
        "on-tertiary-container": "#be7a00",
        "tertiary-fixed": "#ffddb7",
        "tertiary-fixed-dim": "#ffb95c",

        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",

        success: "#2e7d32",
        warning: "#f59e0b",

        background: "#f8f9fa",
        "on-background": "#191c1d",
        surface: "#f8f9fa",
        "surface-bright": "#f8f9fa",
        "surface-dim": "#d9dadb",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f3f4f5",
        "surface-container": "#edeeef",
        "surface-container-high": "#e7e8e9",
        "surface-container-highest": "#e1e3e4",
        "on-surface": "#191c1d",
        "on-surface-variant": "#464653",

        outline: "#767684",
        "outline-variant": "#c6c5d5",

        "inverse-surface": "#2e3132",
        "inverse-on-surface": "#f0f1f2",
        "inverse-primary": "#bfc2ff",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      fontFamily: {
        headline: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 12px 32px rgba(0,0,60,0.05)",
        fab: "0 8px 24px rgba(255,185,92,0.4)",
      },
      keyframes: {
        "slide-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translate(-50%, -10px)" },
          to: { opacity: "1", transform: "translate(-50%, 0)" },
        },
      },
      animation: {
        "slide-in": "slide-in 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
