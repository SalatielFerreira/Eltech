// ========== TOUROS / SÊMEN ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, requireOnline, openActionSheet } from './ui.js';
import { dbInsert, dbUpdate, dbDelete } from './data.js';
import { ICON_DOTS } from './animalRow.js';

const $ = id => document.getElementById(id);
const FIELDS = ['touroNome', 'touroRaca', 'touroGS', 'touroRegistro'];

export function populateTouroOptions() {
  const dl = $('touroOptions');
  if (!dl) return;
  dl.innerHTML = (state.db.touros || []).map(t => `<option value="${esc(t.nome)}">`).join('');
}

function resetTouroForm() {
  state.editTouroId = null;
  FIELDS.forEach(id => { const e = $(id); if (e) e.value = ''; });
  $('touroFormTitle').textContent = 'Cadastrar touro';
  $('touroSaveBtn').textContent = 'Adicionar touro';
  $('touroCancelEdit').classList.add('hidden');
}
export function cancelTouroEdit() { resetTouroForm(); }

export function openTouros() {
  resetTouroForm();
  renderTouros();
  openModal('tourosModal');
}

// Quantas inseminações usaram cada touro (mostrado no cartão).
function usoPorTouro() {
  const m = {};
  state.db.inseminacao.forEach(p => p.animals.forEach(r => { if (r.touro) m[r.touro] = (m[r.touro] || 0) + 1; }));
  return m;
}

export function renderTouros() {
  const c = $('tourosList');
  if (!c) return;
  const list = [...(state.db.touros || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt'));
  $('tourosCount').textContent = `Cadastrados (${list.length})`;
  if (!list.length) { c.innerHTML = '<div class="empty-card"><div class="empty-ico">🐂</div><p>Nenhum touro cadastrado ainda.</p></div>'; return; }
  const uso = usoPorTouro();
  c.innerHTML = list.map(t => {
    const meta = [t.raca, t.grauSangue && 'GS ' + t.grauSangue, t.registro && 'Reg. ' + t.registro].filter(Boolean).map(esc).join(' · ');
    return `<div class="ani-card" data-click="[&quot;openTouroActions&quot;,&quot;${t.id}&quot;]">
  <div class="rec-ico pv-gold">🐂</div>
  <div class="ani-main"><div class="ani-top"><span class="ani-name">${esc(t.nome)}</span></div>
    ${meta ? `<div class="ani-meta">${meta}</div>` : ''}
    <div class="ani-tags"><span class="tag">${uso[t.nome] || 0} inseminação(ões)</span></div></div>
  <button class="ani-more" data-click="[&quot;openTouroActions&quot;,&quot;${t.id}&quot;]" aria-label="Ações">${ICON_DOTS}</button>
</div>`;
  }).join('');
}

export function openTouroActions(id) {
  const t = (state.db.touros || []).find(x => x.id === id);
  if (!t) return;
  openActionSheet({
    title: '🐂 ' + t.nome, sub: [t.raca, t.registro].filter(Boolean).join(' · '),
    actions: [
      { label: 'Editar touro', icon: '✏️', fn: () => editTouro(id) },
      { label: 'Excluir touro', icon: '🗑️', tone: 'danger', fn: () => delTouro(id) },
    ],
  });
}

export async function saveTouro() {
  if (!requireOnline()) return;
  const nome = $('touroNome').value.trim();
  if (!nome) return toast('Digite o nome do touro', 'error');
  const dup = (state.db.touros || []).find(t => t.nome.trim().toLowerCase() === nome.toLowerCase() && t.id !== state.editTouroId);
  if (dup) return toast('Já existe um touro com esse nome', 'error');
  const raca = $('touroRaca').value.trim();
  const grauSangue = $('touroGS').value.trim();
  const registro = $('touroRegistro').value.trim();
  await safeRun(async () => {
    if (state.editTouroId) {
      await dbUpdate('touros', state.editTouroId, { nome, raca, grau_sangue: grauSangue, registro });
      const t = state.db.touros.find(x => x.id === state.editTouroId);
      if (t) Object.assign(t, { nome, raca, grauSangue, registro });
    } else {
      const row = await dbInsert('touros', { nome, raca, grau_sangue: grauSangue, registro });
      state.db.touros.push({ id: row.id, nome, raca, grauSangue, registro });
    }
    resetTouroForm();
    renderTouros();
    populateTouroOptions();
  }, 'Touro salvo!');
}

export function editTouro(id) {
  const t = (state.db.touros || []).find(x => x.id === id);
  if (!t) return;
  state.editTouroId = id;
  $('touroNome').value = t.nome || '';
  $('touroRaca').value = t.raca || '';
  $('touroGS').value = t.grauSangue || '';
  $('touroRegistro').value = t.registro || '';
  $('touroFormTitle').textContent = 'Editar touro';
  $('touroSaveBtn').textContent = 'Salvar alterações';
  $('touroCancelEdit').classList.remove('hidden');
  $('tourosModal').querySelector('.modal').scrollTop = 0;
  $('touroNome').focus();
}

export async function delTouro(id) {
  const ok = await showConfirm('Excluir este touro? As inseminações já registradas não mudam.', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('touros', id);
    state.db.touros = (state.db.touros || []).filter(x => x.id !== id);
    if (state.editTouroId === id) resetTouroForm();
    renderTouros();
    populateTouroOptions();
  }, 'Touro excluído');
}
