/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#020617",
        obsidian: "#0f172a",
        steel: "#1e293b",
        signal: {
          50: "#ecfeff",
          100: "#cffafe",
          200: "#a5f3fc",
          300: "#67e8f9",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2"
        },
        trust: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981"
        },
        alert: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316"
        },
        danger: {
          50: "#fff1f2",
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185",
          500: "#f43f5e"
        },
        slate: {
          950: "#020617"
        }
      },
      boxShadow: {
        panel: "0 18px 44px rgba(2, 6, 23, 0.35)",
        panelStrong: "0 28px 80px rgba(2, 6, 23, 0.55)",
        halo: "0 0 0 1px rgba(34, 211, 238, 0.12), 0 18px 60px rgba(34, 211, 238, 0.12)",
        soft: "0 6px 18px rgba(15, 23, 42, 0.18)"
      }
    }
  },
  plugins: []
};
