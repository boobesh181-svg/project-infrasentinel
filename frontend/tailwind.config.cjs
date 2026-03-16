module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        ink: "#0f1b2d",
        navy: "#12315b",
        slate: "#64748b",
        mist: "#f2f5f9",
        cloud: "#e6edf5",
        accent: "#1f4b8f"
      },
      boxShadow: {
        panel: "0 12px 32px rgba(15, 27, 45, 0.08)",
        soft: "0 6px 18px rgba(15, 27, 45, 0.06)"
      }
    }
  },
  plugins: []
};
