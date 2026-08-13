// ========== LOTES ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, registerModalSetup } from './ui.js';
import { dbInsert, dbUpdate, dbDelete, loteCmp, sortByNum } from './data.js';
import { animalRowHtml } from './animalRow.js';
import { hydrateThumbs } from './fotos.js';

export function populateLoteSelect(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Selecione...</option>';
  [...state.db.lotes].sort(loteCmp).forEach(l => {
    sel.innerHTML += `<option value="${l.id}">${esc(l.name)} (${l.animals.length})</option>`;
  });
  if (prev) sel.value = prev;
}

export async function saveLote() {
  if (!requireOnline()) return;
  const name = document.getElementById('loteNome').value.trim();
  if (!name) return toast('Digite o nome do lote', 'error');
  await safeRun(async () => {
    if (state.editLoteId) {
      await dbUpdate('lotes', state.editLoteId, { name });
      const l = state.db.lotes.find(x => x.id === state.editLoteId);
      if (l) l.name = name;
    } else {
      const row = await dbInsert('lotes', { name });
      state.db.lotes.push({ id: row.id, name: row.name, ordem: row.ordem, createdAt: new Date(row.created_at).getTime(), animals: [] });
    }
    closeModal('loteModal');
    renderLotes();
  }, 'Lote salvo!');
}

export function editLoteFromCard(id) {
  const l = state.db.lotes.find(x => x.id === id);
  if (!l) return;
  state.editLoteId = id;
  document.getElementById('loteNome').value = l.name;
  document.getElementById('loteModalTitle').textContent = 'Editar Lote';
  openModal('loteModal');
}

export async function delLote(id) {
  const ok = await showConfirm('Excluir este lote e todos os animais?', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('lotes', id);
    state.db.lotes = state.db.lotes.filter(x => x.id !== id);
    renderLotes();
  }, 'Lote excluído');
}

export function renderLotes() {
  const container = document.getElementById('lotesList');
  const hasOrdem = state.db.lotes.some(l => typeof l.ordem === 'number');
  const sorted = [...state.db.lotes].sort((a, b) => {
    if (hasOrdem) {
      const ao = typeof a.ordem === 'number' ? a.ordem : -1e9, bo = typeof b.ordem === 'number' ? b.ordem : -1e9;
      if (ao !== bo) return ao - bo;
    }
    return loteCmp(a, b);
  });
  const q = (document.getElementById('searchLotesFolder')?.value || '').toLowerCase().trim();
  const cnt = document.getElementById('cntLotes');
  if (cnt) cnt.textContent = state.db.lotes.length;
  const shown = q ? sorted.filter(l => (l.name || '').toLowerCase().includes(q)) : sorted;
  container.innerHTML = shown.length ? shown.map(l => `<div class="card glass2 anim-fade" data-lote-id="${l.id}" onclick="openLoteDetail('${l.id}')" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div><div class="card-title">${esc(l.name)}</div><div class="card-sub">${l.animals.length} animal(is)</div></div>
      <div class="lote-move">
        <button onclick="event.stopPropagation();moveLote('${l.id}',-1)" title="Subir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg></button>
        <button onclick="event.stopPropagation();moveLote('${l.id}',1)" title="Descer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg></button>
      </div>
    </div>
    <div class="card-actions">
      <button class="edit-btn" onclick="event.stopPropagation();editLoteFromCard('${l.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>
      <button class="del-btn" onclick="event.stopPropagation();delLote('${l.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Excluir</button>
    </div>
  </div>`).join('') : '<div class="empty-state"><p>Nenhum lote criado.</p></div>';
}

export function openLoteDetail(id) {
  state.currentLoteId = id;
  document.getElementById('lotesView').classList.add('hidden');
  document.getElementById('loteDetail').classList.remove('hidden');
  const l = state.db.lotes.find(x => x.id === id);
  document.getElementById('loteDetailTitle').textContent = l.name;
  if (document.getElementById('searchLote')) document.getElementById('searchLote').value = '';
  renderLoteAnimals();
}
export function backToLotes() {
  document.getElementById('loteDetail').classList.add('hidden');
  document.getElementById('lotesView').classList.remove('hidden');
  renderLotes();
}
export function toggleLoteFilter() {
  document.getElementById('loteFilterBar').classList.toggle('hidden');
}

export function renderLoteAnimals() {
  const l = state.db.lotes.find(x => x.id === state.currentLoteId);
  if (!l) return;
  let animals = [...l.animals];
  const q = (document.getElementById('searchLote')?.value || '').toLowerCase().trim();
  if (q) animals = animals.filter(a => (a.num || '').toLowerCase().includes(q) || (a.nome || '').toLowerCase().includes(q));
  const fs = document.getElementById('filterSexo')?.value || '';
  const fc = document.getElementById('filterCat')?.value || '';
  const fst = document.getElementById('filterSit')?.value || '';
  if (fs) animals = animals.filter(a => a.sexo === fs);
  if (fc) animals = animals.filter(a => a.cat === fc);
  if (fst) animals = animals.filter(a => a.sit === fst);
  sortByNum(animals);
  const container = document.getElementById('loteAnimals');
  if (!animals.length) {
    container.innerHTML = `<div class="empty-state"><p>${q || fs || fc || fst ? 'Nenhum resultado.' : 'Nenhum animal neste lote.'}</p></div>`;
    return;
  }
  container.innerHTML = animals.map(a => animalRowHtml(a)).join('');
  hydrateThumbs();
}

// ---------- Reordenar (setas + arrastar) ----------
async function persistOrdem(sortedLotes) {
  await Promise.all(sortedLotes.map((l, i) => {
    l.ordem = i;
    return dbUpdate('lotes', l.id, { ordem: i });
  }));
}

export async function moveLote(id, dir) {
  const hasOrdem = state.db.lotes.some(l => typeof l.ordem === 'number');
  const arr = [...state.db.lotes].sort((a, b) => {
    if (hasOrdem) {
      const ao = typeof a.ordem === 'number' ? a.ordem : -1e9, bo = typeof b.ordem === 'number' ? b.ordem : -1e9;
      if (ao !== bo) return ao - bo;
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  const i = arr.findIndex(l => l.id === id);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  await safeRun(() => persistOrdem(arr).then(renderLotes));
}

registerModalSetup('loteModal', () => {
  if (!state.editLoteId) document.getElementById('loteModalTitle').textContent = 'Novo Lote';
});

