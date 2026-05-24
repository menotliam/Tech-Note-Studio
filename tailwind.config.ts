import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        surface: "hsl(var(--surface))",
        panel: "hsl(var(--panel))",
        "panel-strong": "hsl(var(--panel-strong))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Arial", "sans-serif"],
        mono: ["var(--font-mono)", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
