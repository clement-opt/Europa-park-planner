import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Marqueur de version, affiché dans les réglages.
 *
 * Le service worker sert la version précédente tant que l'app n'a pas été
 * réellement fermée, et sur un téléphone rien ne distingue les deux : on a perdu
 * des allers-retours à corriger un défaut déjà corrigé, faute de pouvoir dire quelle
 * version tournait. Vercel expose le commit dans VERCEL_GIT_COMMIT_SHA.
 */
const BUILD = [
  new Date().toISOString().slice(0, 16).replace("T", " "),
  (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7)
].join(" · ");

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
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
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Plan de route · Europa-Park",
        // Le nom court est celui affiché sous l'icône sur l'écran d'accueil :
        // au-delà de 12 caractères, Android et iOS le tronquent.
        short_name: "Plan de route",
        description: "Optimiseur de parcours Europa-Park avec Green Card et VirtualLine",
        theme_color: "#1F5C8B",
        background_color: "#1F5C8B",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml" }
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
