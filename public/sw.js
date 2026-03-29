// Service Worker - Corpus Prime PWA
// Estratégia: Cache-First para assets estáticos, Network-First para dados dinâmicos

const CACHE_NAME = 'corpus-prime-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/corpus_logo.png',
  '/assets/corpus_isologo.png',
  '/manifest.json',
];

// Install: pré-cacheia assets críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch: Cache-First para assets, Network-First para API Supabase
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições para APIs externas (Supabase) — sempre tenta rede primeiro
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        });
      })
    );
    return;
  }

  // Cache-First para assets estáticos (JS, CSS, imagens)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cacheia somente respostas válidas de GET
        if (request.method === 'GET' && response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        }
        return response;
      }).catch(() => {
        // Offline fallback para navegação
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
