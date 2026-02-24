import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api/polymarket": {
        target: "https://gamma-api.polymarket.com",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/polymarket/, ""),
      },
    },
  },
});
