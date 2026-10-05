/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { darkColors, tokens } from './src/theme/tokens.ts'

const APP_NAME = 'Alimentation'

/** Browser/status bar colour per theme, from the design tokens. */
function themeColorMeta(): Plugin {
  return {
    name: 'theme-color-meta',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { name: 'theme-color', media: '(prefers-color-scheme: light)', content: tokens.color.ground },
        injectTo: 'head',
      },
      {
        tag: 'meta',
        attrs: { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: darkColors.ground },
        injectTo: 'head',
      },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    themeColorMeta(),
    // Installable app: manifest + a service worker that precaches the app shell.
    // API calls always go to the network (data must be fresh; offline = "Chargement impossible").
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: tokens.color.ground,
        theme_color: tokens.color.ground,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Scanner engine (~1 MB), fetched the first time the camera opens.
            urlPattern: ({ url }) => url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: { cacheName: 'scanner-wasm', expiration: { maxEntries: 2 } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
