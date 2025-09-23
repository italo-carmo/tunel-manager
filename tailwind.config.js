import { heroui } from "@heroui/theme";

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/layouts/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
          dark: {
              extend: "dark",
              colors: {
                  danger: {
                      50: "#6c0909",
                      100: "#830f0f",
                      200: "#a21818",
                      300: "#c22323",
                      400: "#e23131",
                      500: "#ed6262",
                      600: "#f68282",
                      700: "#fcadad",
                      800: "#fdd5d5",
                      900: "#feecec",
                      DEFAULT: "#c22323",
                      foreground: "#ffffff",
                  },
                  foreground: "#ffffff",
                   primary: {
                      50: "#2d963eff",
                      100: "#a0dbabff",
                      200: "#2d963eff",
                      300: "#2d963eff",
                      400: "#5d9b68ff",
                      500: "#2d963eff",
                      600: "#2d963eff",
                      700: "#2d963eff",
                      800: "#fdd5d5",
                      900: "#feecec",
                      DEFAULT: "#2d963eff",
                      foreground: "#ffffff",
                  },
                  focus: "#ffcc29",
              },
          },
          light: {
              extend: "dark",
              colors: {
                  danger: {
                      50: "#6c0909",
                      100: "#830f0f",
                      200: "#a21818",
                      300: "#c22323",
                      400: "#e23131",
                      500: "#c22323",
                      600: "#f68282",
                      700: "#fcadad",
                      800: "#fdd5d5",
                      900: "#feecec",
                      DEFAULT: "#c22323",
                      foreground: "#131313FF",
                  },
                  foreground: "#131313",
                 primary: {
                      50: "#2d963eff",
                      100:  "#a0dbabff",
                      200: "#2d963eff",
                      300: "#2d963eff",
                      400: "#5d9b68ff",
                      500: "#2d963eff",
                      600: "#2d963eff",
                      700: "#2d963eff",
                      800: "#fdd5d5",
                      900: "#feecec",
                      DEFAULT: "#2d963eff",
                      foreground: "#ffffff",
                  },
                  focus: "#f68282",
              },
          },
      },
    }),
  ],
};
