import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'icon.svg'],
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        name: 'あっちむいて包囲',
        short_name: '包囲',
        description: '指差しと包囲の読み合いで出口を目指す、1人用カジュアル・パズルゲーム。',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f7eec1',
        theme_color: '#53482b',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
