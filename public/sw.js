// Service Worker - Corpus Prime PWA
// Estratégia: Cache-First para assets estáticos, Network-First para dados dinâmicos
// FIX: Navegação SPA — todos os requests de navegação retornam index.html

const CACHE_NAME = 'corpus-prime-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
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

// Fetch: Lógica de roteamento SPA + Cache strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignora requisições para APIs externas (Supabase) — sempre tenta rede primeiro
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
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

  // 2. FIX 404 Android Chrome: Requisições de navegação (refresh, deep-link)
  //    → retorna sempre index.html para o React Router lidar com o roteamento
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Se a rede retornar OK, cacheia index.html e retorna
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', cloned));
            return response;
          }
          // Em caso de erro de rede (404 do servidor), retorna o index.html cacheado
          return caches.match('/index.html');
        })
        .catch(() => {
          // Offline: sempre retorna index.html para manter o app funcionando
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 3. Cache-First para assets estáticos (JS, CSS, imagens, fontes)
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
        // Fallback offline para assets não encontrados
        return new Response('', { status: 408 });
      });
    })
  );
});
