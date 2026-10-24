import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Browser calls /api/... on the Vite server; Vite forwards them to Express, so no CORS setup is needed.
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
