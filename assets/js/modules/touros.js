// ========== TOUROS ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, requireOnline } from './ui.js';
import { dbInsert, dbUpdate, dbDelete } from './data.js';

export function populateTouroOptions() {
  const dl = document.getElementById('touroOptions');
  if (!dl) return;
  dl.innerHTML = (state.db.touros || []).map(t => `<option value="${esc(t.nome)}">`).join('');
}

export function openTouros() {
  state.editTouroId = null;
  ['touroNome', 'touroRaca', 'touroGS', 'touroRegistro'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  renderTouros();
  openModal('tourosModal');
}

export function renderTouros() {
  const c = document.getElementById('tourosList');
  if (!c) return;
  const list = state.db.touros || [];
  if (!list.length) { c.innerHTML = '<div class="empty-state" style="padding:20px"><p>Nenhum touro cadastrado.</p></div>'; return; }
  c.innerHTML = list.map(t => `<div class="animal-row"><div class="animal-info"><div><span class="name-text" style="font-weight:700">🐂 ${esc(t.nome)}</span></div><div class="detail">${[t.raca ? 'Raça: ' + esc(t.raca) : '', t.grauSangue ? 'GS: ' + esc(t.grauSangue) : '', t.registro ? 'Reg: ' + esc(t.registro) : ''].filter(Boolean).join(' · ') || '—'}</div></div><div class="animal-actions"><button class="edit-btn" style="background:var(--green);color:#fff" onclick="editTouro('${t.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="del-btn" onclick="delTouro('${t.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></div></div>`).join('');
}

export async function saveTouro() {
  if (!requireOnline()) return;
  const nome = document.getElementById('touroNome').value.trim();
  if (!nome) return toast('Digite o nome do touro', 'error');
  const raca = document.getElementById('touroRaca').value.trim();
  const grauSangue = document.getElementById('touroGS').value.trim();
  const registro = document.getElementById('touroRegistro').value.trim();
  await safeRun(async () => {
    if (state.editTouroId) {
      await dbUpdate('touros', state.editTouroId, { nome, raca, grau_sangue: grauSangue, registro });
      const t = state.db.touros.find(x => x.id === state.editTouroId);
      if (t) Object.assign(t, { nome, raca, grauSangue, registro });
      state.editTouroId = null;
    } else {
      const row = await dbInsert('touros', { nome, raca, grau_sangue: grauSangue, registro });
      state.db.touros.push({ id: row.id, nome, raca, grauSangue, registro });
    }
    ['touroNome', 'touroRaca', 'touroGS', 'touroRegistro'].forEach(id => { document.getElementById(id).value = ''; });
    renderTouros();
    populateTouroOptions();
  }, 'Touro salvo!');
}

export function editTouro(id) {
  const t = (state.db.touros || []).find(x => x.id === id);
  if (!t) return;
  state.editTouroId = id;
  document.getElementById('touroNome').value = t.nome || '';
  document.getElementById('touroRaca').value = t.raca || '';
  document.getElementById('touroGS').value = t.grauSangue || '';
  document.getElementById('touroRegistro').value = t.registro || '';
}

export async function delTouro(id) {
  const ok = await showConfirm('Excluir este touro?', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('touros', id);
    state.db.touros = (state.db.touros || []).filter(x => x.id !== id);
    renderTouros();
    populateTouroOptions();
  }, 'Touro excluído');
}
