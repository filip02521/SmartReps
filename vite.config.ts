/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
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
        'brand/app-icon-maskable.svg',
        'brand/logo-mark.svg',
        'brand/apple-touch-icon.png',
        'brand/notification-icon.png',
      ],
      manifest: {
        id: '/',
        name: 'SmartReps',
        short_name: 'SmartReps',
        description: 'Plan and track your workouts at home and in the gym — built-in programs and custom plans. Works offline.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        theme_color: '#6366F1',
        background_color: '#09090B',
        display: 'standalone',
        categories: ['health', 'fitness', 'lifestyle'],
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/brand/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Workout',
            short_name: 'Workout',
            url: '/',
            icons: [{ src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Progress',
            short_name: 'Progress',
            url: '/progress',
            icons: [{ src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      injectManifest: {
        // Keep hashed assets precached; index.html must stay network-first (see sw.ts).
        globPatterns: ['**/*.{js,css,svg,png,woff2,wav}'],
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
    rollupOptions: {
      output: {
        // Force recharts into a single chunk to avoid Rolldown circular-dependency
        // bug (Vite 8 / Rolldown) where recharts zIndex constants are undefined
        // at module evaluation time. See: recharts/recharts#7376
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/es-toolkit')) {
            return 'recharts'
          }
          // Force React + JSX runtime into a dedicated chunk to avoid Rolldown
          // circular-dependency bug where CJS interop helpers (e.g. the jsx
          // factory wrapper) are re-exported through shared component chunks
          // and called before the exporting chunk has finished evaluating.
          // Symptoms: "r is not a function" at module init time in production.
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react/jsx-runtime') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }
          // Lucide icons — same circular-dep issue: icon factory functions
          // are re-exported through shared chunks and called at module init.
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide'
          }
        },
      },
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/sync.ts',
        'src/lib/custom-sync.ts',
        'src/lib/auth-sync.ts',
        'src/lib/achievements/**/*.ts',
      ],
      thresholds: {
        // Current baseline — prevents regressions without blocking CI.
        // Raise as tests improve.
        statements: 25,
        branches: 20,
        functions: 20,
        lines: 25,
      },
    },
  },
})
