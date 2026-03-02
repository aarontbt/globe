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
      "/api/yahoo": {
        target: "https://query2.finance.yahoo.com",
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/api\/yahoo/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://finance.yahoo.com/",
        },
      },
      "/api/rss/cna": {
        target: "https://www.channelnewsasia.com",
        changeOrigin: true,
        rewrite: () => "/rss/8395986",
      },
      "/api/rss/bbc": {
        target: "https://feeds.bbci.co.uk",
        changeOrigin: true,
        rewrite: () => "/news/business/rss.xml",
      },
      "/api/adsb": {
        target: "https://opendata.adsb.fi",
        changeOrigin: true,
        rewrite: () => "/api/v2/all",
      },
      "/api/celestrak": {
        target: "https://celestrak.org",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/celestrak/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
          "Accept": "text/plain",
        },
      },
      "/api/stooq": {
        target: "https://stooq.com",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/stooq/, ""),
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      },
    },
  },
});
