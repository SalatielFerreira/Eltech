// ========== LOTES ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, registerModalSetup, renderListChunked, openActionSheet, refresh, ensureBackBuffer } from './ui.js';
import { dbInsert, dbUpdate, dbDelete, loteCmp, sortByNum, buildInsemIndex } from './data.js';
import { animalRowHtml, emptyStateHtml, ICON_DOTS } from './animalRow.js';
import { hydrateThumbs } from './fotos.js';

export function populateLoteSelect(selId, placeholder = 'Selecione...') {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = `<option value="">${esc(placeholder)}</option>` +
    [...state.db.lotes].sort(loteCmp).map(l => `<option value="${l.id}">${esc(l.name)} (${l.animals.length})</option>`).join('');
  if (prev) sel.value = prev;
}

export async function saveLote() {
  if (!requireOnline()) return;
  const name = document.getElementById('loteNome').value.trim();
  if (!name) return toast('Digite o nome do lote', 'error');
  const dup = state.db.lotes.find(l => l.name.trim().toLowerCase() === name.toLowerCase() && l.id !== state.editLoteId);
  if (dup) return toast('Já existe um lote com esse nome', 'error');
  await safeRun(async () => {
    if (state.editLoteId) {
      await dbUpdate('lotes', state.editLoteId, { name });
      const l = state.db.lotes.find(x => x.id === state.editLoteId);
      if (l) l.name = name;
      if (state.currentLoteId === state.editLoteId) document.getElementById('loteDetailTitle').textContent = name;
    } else {
      const row = await dbInsert('lotes', { name });
      state.db.lotes.push({ id: row.id, name: row.name, ordem: row.ordem, createdAt: new Date(row.created_at).getTime(), animals: [] });
    }
    closeModal('loteModal');
    refresh('rebanho');
  }, 'Lote salvo!');
}

export function editLoteFromCard(id) {
  const l = state.db.lotes.find(x => x.id === id);
  if (!l) return;
  state.editLoteId = id;
  document.getElementById('loteNome').value = l.name;
  document.getElementById('loteModalTitle').textContent = 'Renomear lote';
  openModal('loteModal');
}

export async function delLote(id) {
  const l = state.db.lotes.find(x => x.id === id);
  if (!l) return;
  const msg = l.animals.length
    ? `Excluir o lote "${l.name}" e os ${l.animals.length} animal(is) dentro dele? Esta ação não pode ser desfeita.`
    : `Excluir o lote "${l.name}"?`;
  const ok = await showConfirm(msg, '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('lotes', id);
    state.db.lotes = state.db.lotes.filter(x => x.id !== id);
    if (state.currentLoteId === id) backToLotes();
    refresh('rebanho');
  }, 'Lote excluído');
}

function sortedLotes() {
  const hasOrdem = state.db.lotes.some(l => typeof l.ordem === 'number');
  return [...state.db.lotes].sort((a, b) => {
    if (hasOrdem) {
      const ao = typeof a.ordem === 'number' ? a.ordem : -1e9, bo = typeof b.ordem === 'number' ? b.ordem : -1e9;
      if (ao !== bo) return ao - bo;
    }
    return loteCmp(a, b);
  });
}

function loteStats(l) {
  const f = l.animals.filter(a => a.sexo === 'Fêmea').length;
  const lact = l.animals.filter(a => a.cat === 'Vaca em lactação');
  const leite = lact.reduce((s, a) => s + (parseFloat(a.leite) || 0), 0);
  const prenhas = l.animals.filter(a => a.sit === 'Prenha').length;
  return { total: l.animals.length, f, m: l.animals.length - f, lact: lact.length, leite, prenhas };
}

export function renderLotes() {
  const container = document.getElementById('lotesList');
  if (!container) return;
  const all = sortedLotes();
  const q = (document.getElementById('searchLotesFolder')?.value || '').toLowerCase().trim();
  const shown = q ? all.filter(l => (l.name || '').toLowerCase().includes(q)) : all;
  const totalAnimais = state.db.lotes.reduce((s, l) => s + l.animals.length, 0);
  const sub = document.getElementById('lotesSub');
  if (sub) sub.textContent = `${all.length} lote(s) · ${totalAnimais} animal(is)`;
  if (!shown.length) {
    container.innerHTML = q ? emptyStateHtml('Nenhum lote encontrado.') : emptyStateHtml('Nenhum lote criado ainda.', { label: 'Criar primeiro lote', onclick: "openModal('loteModal')" });
    return;
  }
  container.innerHTML = shown.map((l, i) => {
    const s = loteStats(l);
    const pctF = s.total ? Math.round(s.f / s.total * 100) : 0;
    const meta = [`${s.total} animal(is)`, s.total ? `♀ ${s.f} · ♂ ${s.m}` : '', s.lact ? `${s.lact} em lactação · ${s.leite.toFixed(0)} L/dia` : '', s.prenhas ? `${s.prenhas} prenha(s)` : '']
      .filter(Boolean).join(' · ');
    return `<div class="lote-card" data-lote-id="${l.id}" onclick="openLoteDetail('${l.id}')">
  <div class="lote-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>
  <div class="lote-main">
    <div class="lote-name">${esc(l.name)}</div>
    <div class="lote-meta">${meta}</div>
    ${s.total ? `<div class="sexbar" title="Fêmeas ${pctF}%"><span style="width:${pctF}%"></span></div>` : ''}
  </div>
  ${q ? '' : `<div class="lote-move">
    <button onclick="event.stopPropagation();moveLote('${l.id}',-1)" title="Subir" aria-label="Subir lote" ${i === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg></button>
    <button onclick="event.stopPropagation();moveLote('${l.id}',1)" title="Descer" aria-label="Descer lote" ${i === shown.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg></button>
  </div>`}
  <button class="ani-more" onclick="event.stopPropagation();openLoteActions('${l.id}')" aria-label="Opções do lote">${ICON_DOTS}</button>
</div>`;
  }).join('');
}

export function openLoteActions(id = state.currentLoteId) {
  const l = state.db.lotes.find(x => x.id === id);
  if (!l) return;
  openActionSheet({
    title: l.name,
    sub: `${l.animals.length} animal(is)`,
    actions: [
      ...(state.currentLoteId === id && !document.getElementById('loteDetail').classList.contains('hidden') ? [] :
        [{ label: 'Abrir lote', icon: '📂', fn: () => openLoteDetail(id) }]),
      { label: 'Adicionar animal neste lote', icon: '➕', fn: () => { state.currentLoteId = id; window.openAnimalForLote(); } },
      { label: 'Renomear lote', icon: '✏️', fn: () => editLoteFromCard(id) },
      { label: 'Excluir lote', icon: '🗑️', tone: 'danger', fn: () => delLote(id) },
    ],
  });
}

export function openLoteDetail(id) {
  const l = state.db.lotes.find(x => x.id === id);
  if (!l) return;
  state.currentLoteId = id;
  document.getElementById('lotesView').classList.add('hidden');
  document.getElementById('loteDetail').classList.remove('hidden');
  document.getElementById('loteDetailTitle').textContent = l.name;
  const search = document.getElementById('searchLote');
  if (search) search.value = '';
  document.querySelector('.page-content').scrollTop = 0;
  renderLoteAnimals();
  ensureBackBuffer();
}
export function backToLotes() {
  document.getElementById('loteDetail').classList.add('hidden');
  document.getElementById('lotesView').classList.remove('hidden');
  state.currentLoteId = null;
  renderLotes();
}
export function toggleLoteFilter() {
  document.getElementById('loteFilterBar').classList.toggle('hidden');
}
export function clearLoteFilters() {
  ['filterSexo', 'filterCat', 'filterSit'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderLoteAnimals();
}

// Atualiza o "badge" com a quantidade de filtros ativos no botão de filtro.
export function updateFilterBadge(btnId, selectIds) {
  const n = selectIds.filter(id => document.getElementById(id)?.value).length;
  const badge = document.querySelector(`#${btnId} .fbadge`);
  if (!badge) return;
  badge.textContent = n;
  badge.classList.toggle('hidden', !n);
}

export function renderLoteAnimals() {
  const l = state.db.lotes.find(x => x.id === state.currentLoteId);
  const container = document.getElementById('loteAnimals');
  if (!l || !container) return;
  const s = loteStats(l);
  document.getElementById('loteDetailSub').textContent = `${s.total} animal(is)`;
  const chips = [
    ['Fêmeas', s.f], ['Machos', s.m], ['Em lactação', s.lact], ['Leite/dia', s.leite.toFixed(0) + ' L'], ['Prenhas', s.prenhas],
  ];
  document.getElementById('loteDetailStats').innerHTML = s.total ? chips.map(([k, v]) => `<div class="stat-chip"><b>${v}</b><span>${k}</span></div>`).join('') : '';

  let animals = [...l.animals];
  const q = (document.getElementById('searchLote')?.value || '').toLowerCase().trim();
  if (q) animals = animals.filter(a => [a.num, a.nome, a.brinco].some(v => (v || '').toLowerCase().includes(q)));
  const fs = document.getElementById('filterSexo')?.value || '';
  const fc = document.getElementById('filterCat')?.value || '';
  const fst = document.getElementById('filterSit')?.value || '';
  if (fs) animals = animals.filter(a => a.sexo === fs);
  if (fc) animals = animals.filter(a => a.cat === fc);
  if (fst) animals = animals.filter(a => (a.sit || 'Não se aplica') === fst);
  updateFilterBadge('btnFilterLote', ['filterSexo', 'filterCat', 'filterSit']);
  sortByNum(animals);
  if (!animals.length) {
    container.innerHTML = (q || fs || fc || fst) ? emptyStateHtml('Nenhum animal encontrado com esses filtros.')
      : emptyStateHtml('Nenhum animal neste lote.', { label: 'Adicionar animal', onclick: 'openAnimalForLote()' });
    return;
  }
  const insemIndex = buildInsemIndex();
  renderListChunked(container, animals, a => animalRowHtml({ ...a, loteName: l.name }, { insemIndex }), { after: hydrateThumbs });
}

// ---------- Reordenar (setas) ----------
async function persistOrdem(list) {
  // Grava só os lotes cuja posição realmente mudou.
  const changed = list.map((l, i) => ({ l, i })).filter(({ l, i }) => l.ordem !== i);
  await Promise.all(changed.map(({ l, i }) => dbUpdate('lotes', l.id, { ordem: i }).then(() => { l.ordem = i; })));
}

export async function moveLote(id, dir) {
  const arr = sortedLotes();
  const i = arr.findIndex(l => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  await safeRun(() => persistOrdem(arr).then(renderLotes));
}

registerModalSetup('loteModal', () => {
  if (!state.editLoteId) document.getElementById('loteModalTitle').textContent = 'Novo Lote';
  setTimeout(() => document.getElementById('loteNome')?.focus(), 250);
});
