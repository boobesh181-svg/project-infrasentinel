module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "Segoe UI", "sans-serif"],
        body: ["IBM Plex Sans", "Segoe UI", "sans-serif"]
      },
      colors: {
        ink: "#0f1b2d",
        navy: "#12315b",
        slate: "#64748b",
        mist: "#f2f5f9",
        cloud: "#e6edf5",
        accent: "#1f4b8f",
        graphite: "#0b1220",
        obsidian: "#0f172a"
      },
      boxShadow: {
        panel: "0 12px 32px rgba(15, 27, 45, 0.08)",
        soft: "0 6px 18px rgba(15, 27, 45, 0.06)",
        panelDeep: "0 32px 100px rgba(2, 6, 23, 0.7)"
      }
    }
  },
  plugins: []
};
