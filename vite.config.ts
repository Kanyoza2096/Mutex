// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',

        // Assets to precache that aren't picked up by the glob pattern
        includeAssets: ['icon.svg', 'icon.jpg', 'apple-touch-icon.jpg', 'offline.html'],

        manifest: {
          name: 'Kanyoza Systems Console',
          short_name: 'Kanyoza',
          description:
            'Enterprise AI Command Console — real-time telemetry, social media orchestration, security monitoring, and AI engine management.',
          theme_color: '#0A0E17',
          background_color: '#080C14',
          display: 'standalone',
          orientation: 'any',
          scope: '/',
          start_url: '/',
          icons: [
            {
              // SVG scales to any size — best for modern browsers
              src: 'icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: 'icon.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'any',
            },
            {
              // apple-touch-icon doubles as maskable for Android adaptive icons
              src: 'apple-touch-icon.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'maskable',
            },
          ],
        },

        workbox: {
          // Precache all built assets
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,ico,woff,woff2}'],

          // SPA navigation fallback — lets client-side routes work on hard refresh
          navigateFallback: '/index.html',

          // Don't intercept API calls or SW-related paths with the fallback
          navigateFallbackDenylist: [/^\/api\//, /^\/sw\.js$/, /^\/workbox-/],

          // Remove stale Workbox caches from previous builds automatically
          cleanupOutdatedCaches: true,

          runtimeCaching: [
            {
              // Flask backend API — always try network first, short cache for offline reads
              urlPattern: /\/api\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'kanyoza-api',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 5 * 60, // 5 min stale tolerance
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // External fonts / icon CDN (if any are added later)
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'kanyoza-fonts',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 365 * 24 * 60 * 60,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },

        // Keep dev server behaviour unchanged (no SW in dev)
        devOptions: {
          enabled: false,
        },
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'), // ✅ FIXED: Now points to ./src
      },
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
