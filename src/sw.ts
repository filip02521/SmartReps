/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Activate new SW immediately on install — prevents stale chunk cache
// after deploys. Without this, users get stuck on old SW serving removed chunks.
self.addEventListener('install', () => {
  self.skipWaiting()
})

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

clientsClaim()

self.addEventListener('message', (event) => {
  // Origin check — accept only SKIP_WAITING from the same origin (our own app).
  if (event.origin && event.origin !== self.origin) return
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('push', (event) => {
  let title = 'SmartReps'
  let body = 'SmartReps — Time to train'
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
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const registration = self.registration
      const oldSubscription = await registration.pushManager.getSubscription()
      if (oldSubscription) {
        await oldSubscription.unsubscribe()
      }
      // Re-subscribe — the app will upsert the new subscription on next sync
      // via the web-push module. We just ensure a new subscription exists.
      try {
        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
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
