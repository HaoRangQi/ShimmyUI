import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070a0f",
          900: "#0b111b",
          850: "#101827",
          800: "#152033",
        },
        signal: {
          green: "#23c483",
          cyan: "#12b7d8",
          amber: "#f2b84b",
          red: "#ef5f68",
        },
      },
      boxShadow: {
        glow: "0 1px 2px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.14)",
        material: "0 1px 2px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
