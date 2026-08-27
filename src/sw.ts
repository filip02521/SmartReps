/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()

try {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      denylist: [/^\/api\//],
    }),
  )
} catch {
  // createHandlerBoundToURL may fail in some preview contexts
}

self.addEventListener('push', (event) => {
  let title = 'SmartReps'
  let body = 'Czas na trening — sprawdź swój plan na dziś.'
  try {
    const data = event.data?.json() as { title?: string; body?: string } | undefined
    if (data?.title) title = data.title
    if (data?.body) body = data.body
  } catch {
    const text = event.data?.text()
    if (text) body = text
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/brand/notification-icon.png',
      badge: '/brand/favicon-48.png',
      data: { url: '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string } | undefined)?.url ?? '/'
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

self.skipWaiting()
