import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      includeAssets: [
        'brand/favicon.svg',
        'brand/favicon-32.png',
        'brand/favicon-48.png',
        'brand/app-icon.svg',
        'brand/logo-mark.svg',
        'brand/apple-touch-icon.png',
        'brand/notification-icon.png',
      ],
      manifest: {
        id: '/',
        name: 'SmartReps',
        short_name: 'SmartReps',
        description: 'Inteligentne śledzenie treningu pompek i podciągania',
        lang: 'pl',
        start_url: '/',
        theme_color: '#6366F1',
        background_color: '#09090B',
        display: 'standalone',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/brand/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Trening',
            short_name: 'Trening',
            url: '/',
            icons: [{ src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Postępy',
            short_name: 'Postępy',
            url: '/progress',
            icons: [{ src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      injectManifest: {
        // Keep hashed assets precached; index.html must stay network-first (see sw.ts).
        globPatterns: ['**/*.{js,css,svg,png,woff2}'],
        globIgnores: ['**/index.html'],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version ?? '1.0.0'),
  },
  server: {
    // Bind IPv4+IPv6 so both http://localhost:5173 and http://127.0.0.1:5173 work
    host: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
