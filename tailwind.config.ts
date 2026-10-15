import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "IBM Plex Sans Arabic",
          "Noto Sans Arabic",
          "Cairo",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Tahoma",
          "Arial",
          "sans-serif",
        ],
      },
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
        // Brand tokens — deep navy ink, emerald trust, warm gold accent.
        brand: {
          50: "#eefbf4",
          100: "#d6f5e3",
          200: "#b0eacc",
          300: "#7cd9ad",
          400: "#46c189",
          500: "#1fa86e",
          600: "#128758",
          700: "#0f6b48",
          800: "#10553b",
          900: "#0e4632",
          950: "#06281d",
        },
        ink: {
          50: "#f4f6fb",
          100: "#e7ebf5",
          200: "#c9d3ea",
          300: "#a3b2d8",
          400: "#7b8cc2",
          500: "#5d6cab",
          600: "#495590",
          700: "#3d4675",
          800: "#343b60",
          900: "#1b2340",
          950: "#0d1226",
        },
        gold: {
          50: "#fdf9ed",
          100: "#faf0cf",
          200: "#f4df9e",
          300: "#edc863",
          400: "#e7b23a",
          500: "#dd9a20",
          600: "#c47a18",
          700: "#a35a17",
          800: "#854719",
          900: "#6e3b18",
          950: "#3f1e0a",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 10px)",
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(13 18 38 / 0.04), 0 4px 16px -4px rgb(13 18 38 / 0.08)",
        card: "0 1px 3px 0 rgb(13 18 38 / 0.06), 0 10px 30px -12px rgb(13 18 38 / 0.14)",
        lift: "0 2px 6px 0 rgb(13 18 38 / 0.06), 0 18px 44px -14px rgb(13 18 38 / 0.22)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.28s ease-out both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [animate],
};

export default config;
