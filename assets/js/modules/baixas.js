// ========== BAIXAS (venda / morte) ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline } from './ui.js';
import { dbInsert, dbDelete, getAnimalById } from './data.js';

export function openBaixa(aid) {
  const a = getAnimalById(aid);
  if (!a) return;
  state.baixaAid = aid;
  document.getElementById('baixaAnimalName').textContent = '#' + a.num + ' ' + a.nome;
  document.getElementById('baixaData').value = new Date().toISOString().split('T')[0];
  document.getElementById('baixaValor').value = '';
  document.getElementById('baixaObs').value = '';
  setBaixaTipo('venda');
  openModal('baixaModal');
}
export function setBaixaTipo(t) {
  state.baixaTipo = t;
  document.getElementById('baixaTipoVenda')?.classList.toggle('active', t === 'venda');
  document.getElementById('baixaTipoMorte')?.classList.toggle('active', t === 'morte');
  const g = document.getElementById('baixaValorGroup');
  if (g) g.style.display = t === 'venda' ? 'block' : 'none';
}

export async function confirmBaixa() {
  if (!requireOnline()) return;
  if (!state.baixaAid || !state.baixaTipo) return toast('Escolha Venda ou Morte', 'error');
  const data = document.getElementById('baixaData').value;
  if (!data) return toast('Informe a data', 'error');
  const valor = state.baixaTipo === 'venda' ? (document.getElementById('baixaValor').value || '') : '';
  const obs = document.getElementById('baixaObs').value.trim();

  await safeRun(async () => {
    let animal = null, loteName = '';
    state.db.lotes.forEach(l => {
      const idx = l.animals.findIndex(x => x.id === state.baixaAid);
      if (idx !== -1) { animal = l.animals.splice(idx, 1)[0]; loteName = l.name; }
    });
    if (!animal) throw new Error('Animal não encontrado');

    const row = await dbInsert('baixas', {
      num: animal.num, nome: animal.nome, sexo: animal.sexo, cat: animal.cat,
      tipo: state.baixaTipo, data, valor: valor === '' ? null : valor, obs, lote_name: loteName,
      animal_snapshot: animal,
    });
    // Remove o animal de verdade (cascata cuida de pesagens/leiteHist e desvincula insem/med/ali).
    await dbDelete('animais', animal.id);

    state.db.baixas.unshift({
      ...animal, baixaRowId: row.id,
      baixa: { tipo: state.baixaTipo, data, valor, obs, loteName, at: new Date(row.created_at).getTime() },
    });
    state.baixaAid = null;
    state.baixaTipo = null;
    closeModal('baixaModal');
    import('./rebanho.js').then(m => m.renderRebanho());
  }, 'Baixa registrada!');
}

export function renderBaixas() {
  const c = document.getElementById('baixasList');
  const cnt = document.getElementById('cntBaixas');
  const list = state.db.baixas || [];
  if (cnt) cnt.textContent = list.length;
  if (!c) return;
  const q = (document.getElementById('searchBaixas')?.value || '').toLowerCase().trim();
  const tf = document.getElementById('fBaixaTipo')?.value || '';
  const fs = document.getElementById('fBaixaSexo')?.value || '';
  const fc = document.getElementById('fBaixaCat')?.value || '';
  let items = list.filter(b => {
    if (q && !((b.num || '').toLowerCase().includes(q) || (b.nome || '').toLowerCase().includes(q))) return false;
    if (tf && b.baixa?.tipo !== tf) return false;
    if (fs && b.sexo !== fs) return false;
    if (fc && b.cat !== fc) return false;
    return true;
  });
  items.sort((x, y) => (y.baixa?.at || 0) - (x.baixa?.at || 0));
  if (!items.length) { c.innerHTML = '<div class="empty-state" style="padding:24px"><p>Nenhuma baixa registrada.</p></div>'; return; }
  c.innerHTML = items.map(b => {
    const bx = b.baixa || {};
    const fmt = bx.data ? new Date(bx.data + 'T12:00').toLocaleDateString('pt-BR') : '';
    const tipo = bx.tipo === 'venda' ? '💰 Venda' : '⚰️ Morte';
    const extra = [fmt, (bx.tipo === 'venda' && bx.valor) ? ('R$ ' + esc(bx.valor)) : '', bx.loteName ? ('Lote: ' + esc(bx.loteName)) : ''].filter(Boolean).join(' · ');
    return `<div class="animal-row" style="flex-direction:column;align-items:stretch"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div class="animal-info"><div><span class="num">#${esc(b.num)}</span><span class="name-text">${esc(b.nome)}</span></div><div class="badges" style="margin-top:4px"><span class="badge ${bx.tipo === 'venda' ? 'badge-cat' : 'badge-sit'}">${tipo}</span></div>${extra ? ('<div class="detail">' + extra + '</div>') : ''}${bx.obs ? ('<div class="detail" style="font-style:italic">' + esc(bx.obs) + '</div>') : ''}</div><div class="animal-actions"><button class="edit-btn" style="background:var(--green);color:#fff" onclick="restaurarBaixa('${b.baixaRowId}')" title="Restaurar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v6h6"/><path d="M3.5 9a9 9 0 11-.5 5"/></svg></button><button class="del-btn" onclick="delBaixa('${b.baixaRowId}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></div></div></div>`;
  }).join('');
}

export async function restaurarBaixa(baixaRowId) {
  const b = (state.db.baixas || []).find(x => x.baixaRowId === baixaRowId);
  if (!b) return;
  const ok = await showConfirm('Restaurar este animal para o rebanho?', '↩️');
  if (!ok) return;
  await safeRun(async () => {
    let lote = state.db.lotes.find(l => l.name === b.baixa?.loteName) || state.db.lotes[0];
    if (!lote) {
      const row = await dbInsert('lotes', { name: 'Geral' });
      lote = { id: row.id, name: row.name, ordem: row.ordem, createdAt: new Date(row.created_at).getTime(), animals: [] };
      state.db.lotes.push(lote);
    }
    const { baixaRowId: _drop, baixa: _drop2, ...animalData } = b;
    const insertRow = await dbInsert('animais', {
      lote_id: lote.id, num: animalData.num, nome: animalData.nome, origem: animalData.origem || null,
      tipo_prenhez: animalData.tipoPrenhez || null, data_nasc: animalData.dataNasc || null, sexo: animalData.sexo,
      cat: animalData.cat, sit: animalData.sit || null, raca: animalData.raca || null, grau_sangue: animalData.grauSangue || null,
      nome_mae: animalData.nomeMae || null, nome_pai: animalData.nomePai || null, peso: animalData.peso || null,
      leite: animalData.leite || null, ultimo_parto: animalData.ultimoParto || null, prenha_data: animalData.prenhaData || null,
      photo_path: animalData.photoPath || null,
    });
    lote.animals.push({ ...animalData, id: insertRow.id, pesagens: animalData.pesagens || [], leiteHist: animalData.leiteHist || [] });
    await dbDelete('baixas', baixaRowId);
    state.db.baixas = state.db.baixas.filter(x => x.baixaRowId !== baixaRowId);
    import('./rebanho.js').then(m => m.renderRebanho());
  }, 'Animal restaurado!');
}

export async function delBaixa(baixaRowId) {
  const ok = await showConfirm('Excluir esta baixa definitivamente?', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('baixas', baixaRowId);
    state.db.baixas = (state.db.baixas || []).filter(x => x.baixaRowId !== baixaRowId);
    renderBaixas();
  }, 'Baixa excluída');
}
