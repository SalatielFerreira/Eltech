/* ============================================================
   ELTECH - Service Worker
   Estratégia: Network-first para arquivos do próprio site
   (sempre traz a versão mais nova quando há internet) e
   cache como fallback quando estiver offline.
   ------------------------------------------------------------
   AO PUBLICAR UMA NOVA VERSÃO: basta incrementar VERSION abaixo.
   Isso troca o nome do cache, força a atualização e dispara o
   aviso "Nova versão disponível" para quem já tem o app aberto.
   (Mantenha igual em app.js -> APP_VERSION e em version.json)
   ============================================================ */
const VERSION = '3.4.0';
const CACHE = 'eltech-v' + VERSION;

// Caminhos RELATIVOS (./) para funcionar no GitHub Pages em qualquer subpasta.
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/fundo.png',
  'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap'
];

// Instala: pré-carrega os arquivos essenciais no cache da nova versão.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

// Ativa: remove caches de versões antigas e assume o controle.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Recebe o aviso do app para ativar a nova versão imediatamente.
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Fetch: network-first (mesma origem) com fallback para cache offline.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // Arquivos do próprio app: sempre tenta a rede primeiro.
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(cached => cached || caches.match('./index.html'))
        )
    );
  } else {
    // Recursos externos (ex.: fontes do Google): cache-first.
    e.respondWith(
      caches.match(req).then(cached =>
        cached || fetch(req).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(cache => cache.put(req, clone));
          }
          return res;
        }).catch(() => cached)
      )
    );
  }
});
