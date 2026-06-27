const CACHE = 'raxo-v1'
const STATIC = [
  '/',
  '/index.html',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network first, fallback to cache
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('supabase')) return // nunca cachear API

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, clone))
        return res
      })
      .catch(() => caches.match(e.request))
  )
})

// ── Push notifications ──────────────────────────────────────
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data?.json() ?? {} } catch { data = { title: 'Raxo', body: e.data?.text() ?? '' } }

  e.waitUntil(
    self.registration.showNotification(data.title ?? 'Raxo', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,                 // agrupa notificações do mesmo tipo
      data: { url: data.url ?? '/' },
      vibrate: [100, 50, 100],
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((cs) => {
      const url = e.notification.data?.url ?? '/'
      const existing = cs.find((c) => c.url.includes(url))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})

// Se a subscription expirar/mudar, o navegador dispara este evento.
// Idealmente reenviar pro backend — tratado no client (usePushSubscription).
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(
    self.registration.pushManager.subscribe(e.oldSubscription?.options)
      .catch(() => {})
  )
})