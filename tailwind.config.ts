import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#c1272d", // Royal Chilli red
          dark: "#8f1d22",
        },
      },
    },
  },
  plugins: [],
};

export default config;
