import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    // Vite 8 s'appuie sur Rolldown : manualChunks doit être une fonction,
    // la forme objet de Rollup n'est plus acceptée.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/leaflet")) return "leaflet";
          if (id.includes("node_modules/motion")) return "motion";
          if (id.includes("node_modules/react")) return "react";
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Europa-Park · Plan de route",
        short_name: "Plan de route",
        description: "Optimiseur de parcours Europa-Park avec Green Card et VirtualLine",
        theme_color: "#0B0F17",
        background_color: "#0B0F17",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-z.]*arcgisonline\.com\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "tiles-sat", expiration: { maxEntries: 900, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          {
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: { cacheName: "tiles-osm", expiration: { maxEntries: 900, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          }
        ]
      }
    })
  ]
});
