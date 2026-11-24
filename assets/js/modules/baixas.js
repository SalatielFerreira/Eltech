// ========== BAIXAS (venda / morte) ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, refresh, openActionSheet, skeletonHtml } from './ui.js';
import { dbInsert, dbDelete, getAnimalById, todayISO, fmtDateBR, dbWriteAnimal, rpcOr, mapBaixaRow } from './data.js';
import { ICON_DOTS, emptyStateHtml } from './animalRow.js';
import { updateFilterBadge } from './lotes.js';

const brl = v => 'R$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function openBaixa(aid) {
  const a = getAnimalById(aid);
  if (!a) return;
  state.baixaAid = aid;
  document.getElementById('baixaAnimalName').textContent = '#' + a.num + ' ' + a.nome;
  document.getElementById('baixaData').value = todayISO();
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
  if (data > todayISO()) return toast('A data da baixa não pode ser futura', 'error');
  const valor = state.baixaTipo === 'venda' ? (document.getElementById('baixaValor').value || '') : '';
  const obs = document.getElementById('baixaObs').value.trim();

  await safeRun(async () => {
    let animal = null, loteName = '', lote = null;
    state.db.lotes.forEach(l => {
      const f = l.animals.find(x => x.id === state.baixaAid);
      if (f) { animal = f; loteName = l.name; lote = l; }
    });
    if (!animal) throw new Error('Animal não encontrado');

    // Grava a baixa e remove o animal numa transação só (dar_baixa); sem a função, em 2 passos.
    const row = await rpcOr('dar_baixa', {
      p_animal_id: animal.id, p_tipo: state.baixaTipo, p_data: data, p_valor: valor === '' ? null : valor,
      p_obs: obs, p_lote_name: loteName, p_snapshot: animal,
    }, async () => {
      const r = await dbInsert('baixas', {
        num: animal.num, nome: animal.nome, sexo: animal.sexo, cat: animal.cat,
        tipo: state.baixaTipo, data, valor: valor === '' ? null : valor, obs, lote_name: loteName,
        animal_snapshot: animal,
      });
      // Remove o animal de verdade (cascata cuida de pesagens/leiteHist e desvincula insem/med/ali).
      await dbDelete('animais', animal.id);
      return r;
    });
    // Só tira da memória depois que o banco confirmou (se falhar no meio, a tela não mente).
    lote.animals = lote.animals.filter(x => x.id !== animal.id);

    state.db.baixas.unshift({
      ...animal, baixaRowId: row.id,
      baixa: { tipo: state.baixaTipo, data, valor, obs, loteName, at: new Date(row.created_at).getTime() },
    });
    state.baixaAid = null;
    state.baixaTipo = null;
    closeModal('baixaModal');
    closeModal('fichaModal');
    refresh('rebanho');
  }, 'Baixa registrada!');
}

export function clearBaixaFilters() {
  ['fBaixaTipo', 'fBaixaSexo', 'fBaixaCat'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderBaixas();
}

export function renderBaixas() {
  const c = document.getElementById('baixasList');
  const list = state.db.baixas || [];
  if (!c) return;
  if (!state.loaded) { c.innerHTML = skeletonHtml(2); return; }
  const vendas = list.filter(b => b.baixa?.tipo === 'venda');
  const mortes = list.length - vendas.length;
  const totalVendas = vendas.reduce((s, b) => s + (parseFloat(b.baixa?.valor) || 0), 0);
  const sub = document.getElementById('baixasSub');
  if (sub) sub.textContent = `${list.length} registro(s)`;
  const sum = document.getElementById('baixaSummary');
  if (sum) sum.innerHTML = list.length ? `<div class="stat-chip"><b>${vendas.length}</b><span>Vendas</span></div><div class="stat-chip"><b>${brl(totalVendas)}</b><span>Total vendido</span></div><div class="stat-chip stat-chip-bad"><b>${mortes}</b><span>Mortes</span></div>` : '';

  const q = (document.getElementById('searchBaixas')?.value || '').toLowerCase().trim();
  const tf = document.getElementById('fBaixaTipo')?.value || '';
  const fs = document.getElementById('fBaixaSexo')?.value || '';
  const fc = document.getElementById('fBaixaCat')?.value || '';
  updateFilterBadge('btnFilterBaixas', ['fBaixaTipo', 'fBaixaSexo', 'fBaixaCat']);
  const items = list.filter(b => {
    if (q && !((b.num || '').toLowerCase().includes(q) || (b.nome || '').toLowerCase().includes(q))) return false;
    if (tf && b.baixa?.tipo !== tf) return false;
    if (fs && b.sexo !== fs) return false;
    if (fc && b.cat !== fc) return false;
    return true;
  }).sort((x, y) => (y.baixa?.data || '').localeCompare(x.baixa?.data || '') || (y.baixa?.at || 0) - (x.baixa?.at || 0));
  if (!items.length) { c.innerHTML = emptyStateHtml(list.length ? 'Nenhuma baixa encontrada com esses filtros.' : 'Nenhuma baixa registrada.'); return; }
  c.innerHTML = items.map(b => {
    const bx = b.baixa || {};
    const venda = bx.tipo === 'venda';
    const meta = [fmtDateBR(bx.data), venda && bx.valor ? brl(bx.valor) : '', bx.loteName ? 'Lote ' + esc(bx.loteName) : ''].filter(Boolean).join(' · ');
    return `<div class="baixa-card ${venda ? 'is-venda' : 'is-morte'}">
  <div class="baixa-ico">${venda ? '💰' : '✝'}</div>
  <div class="ani-main">
    <div class="ani-top"><span class="ani-num">#${esc(b.num)}</span><span class="ani-name">${esc(b.nome)}</span></div>
    <div class="ani-tags"><span class="tag ${venda ? 'tag-venda' : 'tag-bad'}">${venda ? 'Venda' : 'Morte'}</span>${b.cat ? `<span class="tag">${esc(b.cat)}</span>` : ''}</div>
    ${meta ? `<div class="ani-meta">${meta}</div>` : ''}${bx.obs ? `<div class="ani-meta ani-obs">“${esc(bx.obs)}”</div>` : ''}
  </div>
  <button class="ani-more" data-click="[&quot;openBaixaActions&quot;,&quot;${b.baixaRowId}&quot;]" aria-label="Ações da baixa">${ICON_DOTS}</button>
</div>`;
  }).join('');
}

export function openBaixaActions(baixaRowId) {
  const b = (state.db.baixas || []).find(x => x.baixaRowId === baixaRowId);
  if (!b) return;
  openActionSheet({
    title: `#${b.num} ${b.nome}`,
    sub: (b.baixa?.tipo === 'venda' ? 'Venda' : 'Morte') + (b.baixa?.data ? ' em ' + fmtDateBR(b.baixa.data) : ''),
    actions: [
      { label: 'Restaurar para o rebanho', icon: '↩️', fn: () => restaurarBaixa(baixaRowId) },
      { label: 'Excluir registro de baixa', icon: '🗑️', tone: 'danger', fn: () => delBaixa(baixaRowId) },
    ],
  });
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
    const row = {
      lote_id: lote.id, num: animalData.num, nome: animalData.nome, origem: animalData.origem || null,
      tipo_prenhez: animalData.tipoPrenhez || null, data_nasc: animalData.dataNasc || null, sexo: animalData.sexo,
      cat: animalData.cat, sit: animalData.sit || null, raca: animalData.raca || null, grau_sangue: animalData.grauSangue || null,
      nome_mae: animalData.nomeMae || null, nome_pai: animalData.nomePai || null, peso: animalData.peso || null,
      leite: animalData.leite || null, ultimo_parto: animalData.ultimoParto || null, prenha_data: animalData.prenhaData || null,
      photo_path: animalData.photoPath || null,
      brinco: animalData.brinco || null, registro: animalData.registro || null, pelagem: animalData.pelagem || null, obs: animalData.obs || null,
      data_compra: animalData.dataCompra || null, valor_compra: animalData.valorCompra || null, vendedor: animalData.vendedor || null,
      mae_id: animalData.maeId || null, pai_id: animalData.paiId || null,
    };
    // Volta o animal e apaga a baixa numa transação só (restaurar_baixa); sem a função, em 2 passos.
    const newId = await rpcOr('restaurar_baixa', { p_baixa_id: baixaRowId, p_animal: row }, async () => {
      const { data: insertRow } = await dbWriteAnimal(null, row);
      await dbDelete('baixas', baixaRowId);
      return insertRow.id;
    });
    lote.animals.push({ ...animalData, id: newId, pesagens: animalData.pesagens || [], leiteHist: animalData.leiteHist || [] });
    state.db.baixas = state.db.baixas.filter(x => x.baixaRowId !== baixaRowId);
    refresh('rebanho');
  }, 'Animal restaurado!');
}

export async function delBaixa(baixaRowId) {
  const ok = await showConfirm('Excluir este registro de baixa definitivamente?', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('baixas', baixaRowId);
    state.db.baixas = (state.db.baixas || []).filter(x => x.baixaRowId !== baixaRowId);
    refresh('rebanho');
  }, 'Baixa excluída');
}
