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
        cream: "#FFFBEB",
        ink: "#201B18",
        line: "#E4DFD3",
        brand: {
          DEFAULT: "#E34435",
          dark: "#C82D1D",
        },
      },
    },
  },
  plugins: [],
};

export default config;
