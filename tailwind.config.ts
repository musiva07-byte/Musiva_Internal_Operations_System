import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        musiva: {
          ivory: "hsl(var(--brand-ivory-hsl) / <alpha-value>)",
          porcelain: "hsl(var(--brand-card-hsl) / <alpha-value>)",
          champagne: "hsl(var(--brand-champagne-hsl) / <alpha-value>)",
          gold: "hsl(var(--brand-mauve-hsl) / <alpha-value>)",
          rose: "hsl(var(--brand-metallic-soft-hsl) / <alpha-value>)",
          plum: "hsl(var(--brand-rose-deep-hsl) / <alpha-value>)",
          ink: "hsl(var(--brand-text-hsl) / <alpha-value>)",
          sage: "hsl(var(--status-success-hsl) / <alpha-value>)",
          muted: "hsl(var(--brand-text-muted-hsl) / <alpha-value>)",
          border: "hsl(var(--brand-border-hsl) / <alpha-value>)",
          warning: "hsl(var(--status-warning-hsl) / <alpha-value>)",
          "warning-foreground": "hsl(var(--status-warning-foreground-hsl) / <alpha-value>)",
          danger: "hsl(var(--status-danger-hsl) / <alpha-value>)",
          info: "hsl(var(--status-info-hsl) / <alpha-value>)",
          pink: "hsl(var(--brand-mauve-hsl) / <alpha-value>)",
          mauve: "hsl(var(--brand-mauve-hsl) / <alpha-value>)",
          "mauve-dark": "hsl(var(--brand-mauve-dark-hsl) / <alpha-value>)",
          "mauve-soft": "hsl(var(--brand-mauve-soft-hsl) / <alpha-value>)",
          blush: "hsl(var(--brand-blush-hsl) / <alpha-value>)",
          "rose-gold": "hsl(var(--brand-rose-gold-hsl) / <alpha-value>)",
          sidebar: "hsl(var(--brand-sidebar-hsl) / <alpha-value>)",
          "sidebar-active": "hsl(var(--brand-sidebar-active-hsl) / <alpha-value>)",
          "sidebar-active-text": "hsl(var(--brand-sidebar-active-text-hsl) / <alpha-value>)",
          "card-secondary": "hsl(var(--brand-card-secondary-hsl) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
      },
      boxShadow: {
        soft: "0 16px 48px rgba(90, 53, 59, 0.08)",
      },
    },
  },
  plugins: [forms],
};

export default config;
