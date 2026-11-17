// ========== ORQUESTRAÇÃO DA ABA "REBANHO" ==========
// Tela inicial do Rebanho (resumo + atalhos) e navegação entre as 3 áreas:
// Todos os animais / Lotes (e detalhe do lote) / Baixas.
// Para manter a troca de telas leve, só a área VISÍVEL é desenhada: entrar no
// Rebanho calcula apenas o resumo; cada lista é montada quando é aberta.
import { state } from '../state.js';
import { esc, registerPageEnter, ensureBackBuffer, registerRefresher } from './ui.js';
import { getAllAnimals } from './data.js';
import { renderLotes, renderLoteAnimals } from './lotes.js';
import { renderAnimaisFolder } from './animais.js';
import { renderBaixas } from './baixas.js';
import { CATEGORIAS_FEMEA, CATEGORIAS_MACHO } from './constants.js';

const VIEWS = ['rebanhoHome', 'animaisView', 'lotesView', 'loteDetail', 'baixasView'];
const isShown = id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); };

export function renderRebanhoHome() {
  const all = getAllAnimals();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('cntAnimais', all.length);
  set('cntLotes', state.db.lotes.length);
  set('cntBaixas', (state.db.baixas || []).length);
  set('rebanhoSub', all.length ? `${all.length} animal(is) em ${state.db.lotes.length} lote(s)` : 'Comece cadastrando seus animais');

  const femeas = all.filter(a => a.sexo === 'Fêmea').length;
  const lact = all.filter(a => a.cat === 'Vaca em lactação');
  const leite = lact.reduce((s, a) => s + (parseFloat(a.leite) || 0), 0);
  const prenhas = all.filter(a => a.sit === 'Prenha').length;
  const kpi = (val, lbl) => `<div class="kpi"><div class="kpi-val">${val}</div><div class="kpi-lbl">${lbl}</div></div>`;
  const kpis = document.getElementById('herdKpis');
  if (kpis) kpis.innerHTML = all.length ? kpi(femeas, 'Fêmeas') + kpi(all.length - femeas, 'Machos') + kpi(lact.length, 'Em lactação') + kpi(prenhas, 'Prenhas') + kpi(leite.toFixed(0) + '<small> L</small>', 'Leite/dia') : '';

  // Composição por categoria (barras horizontais)
  const comp = document.getElementById('herdComposition');
  if (!comp) return;
  if (!all.length) { comp.innerHTML = ''; return; }
  const counts = {};
  all.forEach(a => { counts[a.cat] = (counts[a.cat] || 0) + 1; });
  const order = [...CATEGORIAS_FEMEA, ...CATEGORIAS_MACHO];
  const rows = Object.keys(counts).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const max = Math.max(...Object.values(counts));
  comp.innerHTML = `<div class="comp-card"><div class="comp-title">Composição do rebanho</div>` +
    rows.map(c => `<div class="comp-row"><span class="comp-lbl">${esc(c)}</span><span class="comp-bar"><span style="width:${Math.max(4, counts[c] / max * 100)}%"></span></span><span class="comp-val">${counts[c]}<small>${Math.round(counts[c] / all.length * 100)}%</small></span></div>`).join('') +
    `</div>`;
}

// Redesenha o resumo e SÓ a lista que está aberta (chamado após qualquer alteração de dados).
export function refreshRebanho() {
  if (!state.db) return;
  renderRebanhoHome();
  if (isShown('animaisView')) renderAnimaisFolder();
  if (isShown('lotesView')) renderLotes();
  if (isShown('loteDetail')) renderLoteAnimals();
  if (isShown('baixasView')) renderBaixas();
}
export const renderRebanho = refreshRebanho;
registerRefresher('rebanho', refreshRebanho);

export function openRebanhoView(v) {
  VIEWS.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  const map = { animais: 'animaisView', lotes: 'lotesView', baixas: 'baixasView' };
  document.getElementById(map[v])?.classList.remove('hidden');
  state.currentLoteId = null;
  document.querySelector('.page-content').scrollTop = 0;
  if (v === 'animais') renderAnimaisFolder();
  else if (v === 'lotes') renderLotes();
  else if (v === 'baixas') renderBaixas();
  ensureBackBuffer();
}

export function backToRebanhoHome() {
  VIEWS.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('rebanhoHome')?.classList.remove('hidden');
  state.currentLoteId = null;
  document.querySelector('.page-content').scrollTop = 0;
  renderRebanhoHome();
}

registerPageEnter('pageRebanho', () => {
  VIEWS.forEach(id => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('rebanhoHome')?.classList.remove('hidden');
  state.currentLoteId = null;
  renderRebanhoHome();
});
