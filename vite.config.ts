import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
const APP_BASE = process.env.VITE_APP_BASE?.trim() || '/';
export default defineConfig({
  base: APP_BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.svg', 'icons/icon-512.svg'],
      workbox: {
        navigateFallbackDenylist: [/\/login/, /\/register/, /\/subscribe/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              networkTimeoutSeconds: 10,
              cacheName: 'navigation-cache',
            },
          },
        ],
      },
      manifest: {
        name: 'LoopVault',
        short_name: 'LoopVault',
        start_url: APP_BASE,
        scope: APP_BASE,
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' }
        ]
      }
    })
  ]
});
