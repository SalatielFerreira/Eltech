/* ============================================================
   ELTECH - Service Worker
   Estratégia: Network-first para os arquivos do próprio app-shell
   (HTML/CSS/JS) — sempre busca a versão mais nova quando há
   internet, com cache como fallback offline. O app em si (dados)
   agora depende do Supabase: chamadas para *.supabase.co NUNCA
   passam pelo cache, são sempre rede direta (dado sempre fresco;
   sem internet, o app avisa e bloqueia edição — não há modo
   offline de dados nesta versão).
   ------------------------------------------------------------
   AO PUBLICAR UMA NOVA VERSÃO: basta incrementar VERSION abaixo.
   Isso troca o nome do cache, força a atualização e dispara o
   aviso "Nova versão disponível" para quem já tem o app aberto.
   (Mantenha igual em main.js -> APP_VERSION e em version.json)
   ============================================================ */
const VERSION = '4.1.0';
const CACHE = 'eltech-v' + VERSION;

// Caminhos RELATIVOS (./) para funcionar no GitHub Pages/Vercel em qualquer subpasta.
// Note: config.js NÃO entra aqui (é gerado no deploy / preenchido localmente, cada
// ambiente tem o seu; não faz sentido supor que existe um igual para todo mundo).
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/js/main.js',
  './assets/js/state.js',
  './assets/js/supabaseClient.js',
  './assets/js/modules/ui.js',
  './assets/js/modules/charts.js',
  './assets/js/modules/constants.js',
  './assets/js/modules/data.js',
  './assets/js/modules/animalRow.js',
  './assets/js/modules/auth.js',
  './assets/js/modules/profile.js',
  './assets/js/modules/fotos.js',
  './assets/js/modules/lotes.js',
  './assets/js/modules/animais.js',
  './assets/js/modules/rebanho.js',
  './assets/js/modules/baixas.js',
  './assets/js/modules/touros.js',
  './assets/js/modules/inseminacao.js',
  './assets/js/modules/medicacao.js',
  './assets/js/modules/alimentacao.js',
  './assets/js/modules/dashboard.js',
  './assets/js/modules/relatorios.js',
  './assets/js/modules/help.js',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/fundo.png',
  'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap',
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

  // Supabase (banco, auth, storage): sempre rede, nunca cache — dados têm que
  // vir sempre atualizados, e a esta altura só o app-shell é feito para offline.
  if (url.hostname.endsWith('.supabase.co')) return;

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
