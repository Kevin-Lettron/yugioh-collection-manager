import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'YuGiOh Collection Manager',
        short_name: 'YGO Collection',
        description: 'Gère ta collection Yu-Gi-Oh, construis tes decks et partage avec la communauté.',
        theme_color: '#0b0906',
        background_color: '#0b0906',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'fr',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          // NOTE: /api/* is intentionally NOT cached. API responses can contain
          // user-private data (profile, decks, tokens). A shared-device user
          // could otherwise read the previous user's data from the SW cache.
          // NetworkOnly = always hit the network, never cache.
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/images\.ygoprodeck\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ygoprodeck-images',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/db\.ygoprodeck\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ygoprodeck-api',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Service worker DÉSACTIVÉ en développement.
      //
      // Il était actif, et c'est une source d'ennuis difficile à diagnostiquer :
      // le worker précache l'application et **survit aux redémarrages du serveur
      // de dev**. On se retrouve à déboguer un ancien bundle servi depuis le
      // cache du navigateur pendant que le code sur disque, lui, est correct.
      //
      // Le worker reste évidemment actif en production (`npm run build`), où
      // c'est tout son intérêt : c'est ce qui rend le site utilisable hors ligne.
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['.devtunnels.ms', '.ngrok-free.app', '.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
