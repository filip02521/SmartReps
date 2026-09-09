/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// NOTE: Do NOT call self.skipWaiting() in the install handler.
// With registerType: 'prompt', the SW must wait in the "waiting" state until
// the user clicks "Refresh now". The updateSW() function from virtual:pwa-register
// sends a SKIP_WAITING message (handled below) which activates the SW and reloads.
// Calling skipWaiting() in install would activate the SW immediately, firing
// controllerchange before updateSW() can listen for it — the page never reloads.

// HTML navigations: network-first so deploys never serve stale index.html + missing chunks.
// Only cache status 200 — opaque (status 0) responses can be blank/cross-origin pages.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'sr-navigations',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 7 * 24 * 3600 }),
    ],
  }),
)

// Runtime cache for hashed JS/CSS chunks (lazy routes, vendor splits).
// Vite emits content-hashed filenames (e.g. Progress-a1b2c3.js). When a deploy
// ships new chunks, the OLD active SW's precache only has the OLD hashes. Without
// a runtime cache, going offline after a deploy breaks lazy routes — the new
// chunk isn't in any cache. StaleWhileRevalidate caches chunks as they're fetched
// online so they survive offline, and serves stale instantly while updating in
// the background. This eliminates the version-skew window between index.html
// (NetworkFirst) and JS chunks (precache-only).
registerRoute(
  ({ request }) =>
    request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'sr-chunks',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 }),
    ],
  }),
)

// Runtime cache for exercise demo videos (MP4).
// Videos are static assets (~300KB-8MB each) — CacheFirst is ideal:
// fetch from cache instantly, only hit network on first load.
// 41 videos × ~700KB avg ≈ 28MB total, capped at 60 entries.
registerRoute(
  ({ request }) => request.destination === 'video',
  new CacheFirst({
    cacheName: 'sr-exercise-videos',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 90 * 24 * 3600 }),
    ],
  }),
)

clientsClaim()

self.addEventListener('message', (event) => {
  // Origin check — accept only SKIP_WAITING from the same origin (our own app).
  if (event.origin && event.origin !== self.origin) return
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('push', (event) => {
  // SW has no access to i18n — use language-neutral fallback.
  // Server should send localized title/body in the push payload.
  let title = 'SmartReps'
  let body = '🏋️'
  let url = '/'
  let program: string | undefined
  try {
    const data = event.data?.json() as
      | { title?: string; body?: string; url?: string; program?: string }
      | undefined
    if (data?.title) title = data.title
    if (data?.body) body = data.body
    if (data?.url) url = data.url
    if (data?.program) program = data.program
  } catch {
    const text = event.data?.text()
    if (text) body = text
  }

  // Validate URL — only allow relative paths or same-origin URLs to prevent
  // phishing attacks via compromised push server.
  let targetUrl = '/'
  try {
    if (url.startsWith('/') && !url.startsWith('//')) {
      targetUrl = url
    } else {
      const parsed = new URL(url, self.location.origin)
      if (parsed.origin === self.location.origin) {
        targetUrl = parsed.pathname + parsed.search
      }
    }
  } catch {
    // Invalid URL — fall back to root
  }

  if (program && !targetUrl.includes('program=')) {
    const sep = targetUrl.includes('?') ? '&' : '?'
    targetUrl = `${targetUrl}${sep}program=${encodeURIComponent(program)}`
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/brand/notification-icon.png',
      badge: '/brand/favicon-48.png',
      data: { url: targetUrl, program },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | undefined
  const rawTarget = data?.url ?? '/'
  // Validate target — only same-origin or relative URLs
  let target = '/'
  try {
    if (rawTarget.startsWith('/') && !rawTarget.startsWith('//')) {
      target = rawTarget
    } else {
      const parsed = new URL(rawTarget, self.location.origin)
      if (parsed.origin === self.location.origin) {
        target = parsed.pathname + parsed.search
      }
    }
  } catch {
    // Invalid — fall back to root
  }
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) await (client as WindowClient).navigate(target)
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})

// Handle push subscription rotation — browser may change the endpoint.
// Re-subscribe and upsert the new endpoint to Supabase.
// SW nie ma dostępu do import.meta.env — czytamy VAPID public key z Cache API,
// gdzie klient zapisuje go po udanej subskrypcji (cacheVapidPublicKey w web-push.ts).
const VAPID_CACHE_NAME = 'sr-vapid'
const VAPID_CACHE_URL = '/__vapid_public_key__'

async function readVapidPublicKeyFromCache(): Promise<string | null> {
  try {
    const cache = await caches.open(VAPID_CACHE_NAME)
    const response = await cache.match(new Request(VAPID_CACHE_URL))
    if (!response || !response.ok) return null
    const text = await response.text()
    return text.trim() || null
  } catch {
    return null
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const registration = self.registration
      const oldSubscription = await registration.pushManager.getSubscription()
      if (oldSubscription) {
        await oldSubscription.unsubscribe()
      }
      // Re-subscribe — wymaga VAPID applicationServerKey.
      // Czytamy z Cache API (klient zapisuje po subskrypcji).
      const vapid = await readVapidPublicKeyFromCache()
      if (!vapid) {
        // Brak VAPID key w cache — nie możemy re-subskrybować.
        // Klient zapisze key przy najbliższej subskrypcji.
        return
      }
      try {
        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
        })
        // Notify all clients that the subscription changed so they can upsert
        const clients = await self.clients.matchAll({ includeUncontrolled: true })
        for (const client of clients) {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            endpoint: newSubscription.endpoint,
          })
        }
      } catch {
        // Re-subscription failed — user may have revoked permission
      }
    })(),
  )
})
