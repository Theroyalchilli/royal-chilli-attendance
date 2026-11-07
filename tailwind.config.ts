import type { Config } from "tailwindcss";

// Matches royal-chilli-pos's cream + red theme:
//   --background: 48 100% 96%  → #FFFBEB
//   --primary:    5 76% 55%    → #E34435
//   --border:     40 15% 85%   → #E4DFD3
//   --foreground: 20 14% 11%   → #201B18
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "rgb(var(--brand-page) / <alpha-value>)",
        ink: "#201B18",
        line: "rgb(var(--brand-line) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--brand-main) / <alpha-value>)",
          dark: "rgb(var(--brand-deep) / <alpha-value>)",
          on: "rgb(var(--brand-on) / <alpha-value>)",
          accent: "rgb(var(--brand-accent) / <alpha-value>)",
          "on-accent": "rgb(var(--brand-on-accent) / <alpha-value>)",
          tint: "rgb(var(--brand-tint) / <alpha-value>)",
          cream: "rgb(var(--brand-cream) / <alpha-value>)",
          wash: "rgb(var(--brand-wash) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
