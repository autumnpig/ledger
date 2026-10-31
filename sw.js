const CACHE = 'ledger-v4'
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

function isEncData(url) {
  try {
    const u = new URL(url)
    return u.pathname.includes('/data/') || u.pathname.endsWith('ledger.enc.json')
  } catch {
    return false
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return

  // Encrypted ledger: network-first, never cache
  if (isEncData(req.url)) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } })),
    )
    return
  }

  // App shell: cache-first with network update
  e.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          const copy = res.clone()
          if (res.ok && req.url.startsWith(self.location.origin) && !isEncData(req.url)) {
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || fetched
    }),
  )
})
