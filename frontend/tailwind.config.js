/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        navy: {
          950: "#071224",
          900: "#0B1736",
          800: "#122047",
          700: "#1A2D5C",
          600: "#243A73",
        },
        brand: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
        },
        canvas: "#F3F6FB",
      },
      boxShadow: {
        card: "0 8px 24px rgba(15, 35, 82, 0.06)",
        soft: "0 4px 14px rgba(15, 35, 82, 0.05)",
      },
      borderRadius: {
        xl2: "1.15rem",
      },
    },
  },
  plugins: [],
};
