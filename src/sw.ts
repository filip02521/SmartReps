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

// HTML navigations: network-first so deploys never serve stale index.html + missing chunks.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'sr-navigations',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
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

  let targetUrl = url
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
  const target = data?.url ?? '/'
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
