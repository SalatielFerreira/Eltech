// Versão do FARM — ÚNICO lugar para atualizar ao publicar uma nova versão.
// Lida pelo app (index.html carrega este arquivo antes do main.js) e pelo service worker
// (sw.js -> importScripts), que troca o cache e avisa "Nova versão disponível".
self.FARM_VERSION = '4.4.0';
