// ========== ORQUESTRAÇÃO DA ABA "REBANHO" ==========
// Liga lotes.js + animais.js + baixas.js às 3 pastas da tela Rebanho
// (Todos os Animais / Lotes / Baixas). Fica num módulo à parte porque
// é o único ponto que precisa conhecer os três ao mesmo tempo.
import { registerPageEnter, ensureBackBuffer } from './ui.js';
import { renderLotes } from './lotes.js';
import { renderAnimaisFolder } from './animais.js';
import { renderBaixas } from './baixas.js';

const VIEWS = ['rebanhoHome', 'animaisView', 'lotesView', 'loteDetail', 'baixasView'];

export function renderRebanho() {
  renderLotes();
  renderAnimaisFolder();
  renderBaixas();
}

export function openRebanhoView(v) {
  VIEWS.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  const map = { animais: 'animaisView', lotes: 'lotesView', baixas: 'baixasView' };
  document.getElementById(map[v])?.classList.remove('hidden');
  if (v === 'animais') renderAnimaisFolder();
  else if (v === 'lotes') renderLotes();
  else if (v === 'baixas') renderBaixas();
  ensureBackBuffer();
}

export function backToRebanhoHome() {
  VIEWS.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('rebanhoHome')?.classList.remove('hidden');
}

registerPageEnter('pageRebanho', () => {
  VIEWS.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('rebanhoHome')?.classList.remove('hidden');
  renderRebanho();
});
