// ========== ALIMENTAÇÃO (lote inteiro ou animais individuais) ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, registerPageEnter, registerAnimalSelectProvider, registerModalSetup, registerModalTeardown, openActionSheet, act, skeletonHtml } from './ui.js';
import { dbInsert, dbInsertMany, dbUpdate, softDelete, dbDeleteWhere, getAllAnimals, sortByNum, loteCmp, resolveAid, rpcOr } from './data.js';
import { bumpTrash } from './lixeira.js';
import { ICON_DOTS, emptyStateHtml } from './animalRow.js';
import { COLORS } from './charts.js';

const $ = id => document.getElementById(id);
const brl = v => 'R$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v, d = 2) => (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const DIET_ICON = { 'Pasto': '🌱', 'Silagem': '🌽', 'Ração': '🥣', 'Concentrado': '🌾', 'Sal mineral': '🧂', 'Farelo': '🫘', 'Cevada': '🍺', 'Fubá': '🌽' };

registerAnimalSelectProvider('ali', () => sortByNum(getAllAnimals().slice()));

// ---------- Lista + indicadores ----------
export function renderAliDirect() {
  if (!state.loaded) { $('aliKpis').innerHTML = ''; $('aliBreakdown').innerHTML = ''; $('aliDirectList').innerHTML = skeletonHtml(3); return; }
  const items = [...state.db.aliDirect].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const total = items.reduce((s, a) => s + parseFloat(a.custoTotal || 0), 0);
  const cabecas = items.reduce((s, a) => s + (a.numAnimais || 0), 0);
  const unicos = new Set(items.flatMap(a => (a.animais || []).map(x => x.num))).size;
  const kpi = (v, l) => `<div class="kpi"><div class="kpi-val">${v}</div><div class="kpi-lbl">${l}</div></div>`;
  $('aliKpis').innerHTML = items.length ? kpi(brl(total).replace(',00', ''), 'Custo total') + kpi(cabecas ? brl(total / cabecas) : '—', 'Por animal') + kpi(items.length, 'Registros') + kpi(unicos, 'Animais') : '';
  $('aliSub').textContent = items.length ? `${items.length} registro(s) · ${brl(total)}` : 'Dietas e custo de alimentação';

  // Custo por ingrediente (onde está indo o dinheiro)
  const porIng = {};
  items.forEach(a => (a.dietas || []).forEach(d => {
    porIng[d.tipo] = (porIng[d.tipo] || 0) + (parseFloat(d.valorKg) || 0) * (parseFloat(d.kg) || 0) * (a.numAnimais || 0);
  }));
  const ing = Object.entries(porIng).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const ingTotal = ing.reduce((s, [, v]) => s + v, 0);
  $('aliBreakdown').innerHTML = ing.length ? `<div class="comp-card" style="margin-bottom:14px"><div class="comp-title">Custo por ingrediente</div>` +
    ing.map(([k, v], i) => `<div class="comp-row"><span class="comp-lbl">${DIET_ICON[k] || '•'} ${esc(k)}</span><span class="comp-bar"><span style="width:${Math.max(4, v / ing[0][1] * 100)}%;background:${COLORS[i % COLORS.length]}"></span></span><span class="comp-val">${brl(v).replace(',00', '')}<small>${Math.round(v / ingTotal * 100)}%</small></span></div>`).join('') + `</div>` : '';

  $('aliListLabel').classList.toggle('hidden', !items.length);
  const container = $('aliDirectList');
  if (!items.length) { container.innerHTML = emptyStateHtml('Nenhuma alimentação registrada.', { label: 'Registrar alimentação', action: ['openNewAli'] }); return; }
  container.innerHTML = items.map(a => {
    const data = a.createdAt ? new Date(a.createdAt).toLocaleDateString('pt-BR') : '';
    const ingr = (a.dietas || []).map(d => `<span class="tag">${DIET_ICON[d.tipo] || ''} ${esc(d.tipo)}${d.kg ? ` · ${esc(d.kg)} kg` : ''}${d.valorKg ? ` × R$ ${num(d.valorKg)}` : ''}</span>`).join('');
    const animais = a.animais || [];
    const chips = animais.slice(0, 6).map(x => `<span class="tag tag-lote">#${esc(x.num)}</span>`).join('') + (animais.length > 6 ? `<span class="tag">+${animais.length - 6}</span>` : '');
    const porAnimal = a.numAnimais ? brl(parseFloat(a.custoTotal || 0) / a.numAnimais) : '';
    return `<div class="ani-card ali-card" data-click="[&quot;openAliActions&quot;,&quot;${a.id}&quot;]">
  <div class="rec-ico pv-gold">🌾</div>
  <div class="ani-main">
    <div class="ani-top"><span class="ani-name">${esc(a.nomeDieta || 'Dieta')}</span></div>
    <div class="ani-meta">${data ? '📅 ' + data + ' · ' : ''}${a.numAnimais || 0} animal(is)${porAnimal ? ' · ' + porAnimal + '/animal' : ''}</div>
    <div class="ani-tags">${ingr}</div>
    <div class="ani-tags">${chips}</div>
  </div>
  <div class="ali-side"><div class="ali-cost">${brl(a.custoTotal)}</div><button class="ani-more" data-click="[&quot;openAliActions&quot;,&quot;${a.id}&quot;]" aria-label="Ações">${ICON_DOTS}</button></div>
</div>`;
  }).join('');
}

export function openAliActions(id) {
  const a = state.db.aliDirect.find(x => x.id === id);
  if (!a) return;
  openActionSheet({
    title: a.nomeDieta || 'Dieta', sub: `${a.numAnimais || 0} animal(is) · ${brl(a.custoTotal)}`,
    actions: [
      { label: 'Editar', icon: '✏️', fn: () => editAliDirect(id) },
      { label: 'Repetir (novo registro igual)', icon: '🔁', tone: 'info', fn: () => editAliDirect(id, true) },
      { label: 'Excluir', icon: '🗑️', tone: 'danger', fn: () => delAliDirect(id) },
    ],
  });
}

// ---------- Formulário ----------
export function setAliMode(mode) {
  state.aliMode = mode;
  $('aliModeLote').classList.toggle('active', mode === 'lote');
  $('aliModeIndiv').classList.toggle('active', mode === 'individual');
  $('aliLoteSection').classList.toggle('hidden', mode !== 'lote');
  $('aliIndivSection').classList.toggle('hidden', mode !== 'individual');
  if (mode === 'individual' && $('aliAnimalSelect').options.length <= 1) populateAliAnimalSelect2();
  calcAliCost();
}
export function populateAliLoteSelect() {
  $('aliLoteSelect').innerHTML = '<option value="">Selecione o lote...</option>' + [...state.db.lotes].sort(loteCmp).map(l => `<option value="${l.id}">${esc(l.name)} (${l.animals.length})</option>`).join('');
}
export function populateAliAnimalSelect2() {
  $('aliAnimalSelect').innerHTML = '<option value="">Selecione...</option>' + sortByNum(getAllAnimals().slice()).map(a => `<option value="${esc(a.num)}|${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)} (${esc(a.loteName)})</option>`).join('');
}
export function loadAliLoteAnimals() {
  const l = state.db.lotes.find(x => x.id === $('aliLoteSelect').value);
  state.tempAliAnimals = l ? sortByNum(l.animals.map(a => ({ num: a.num, nome: a.nome, included: true }))) : [];
  renderAliLoteList();
  calcAliCost();
}
export function renderAliLoteList() {
  const list = state.tempAliAnimals;
  const n = list.filter(a => a.included).length;
  $('aliLoteAnimals').innerHTML = list.length ? `<div class="check-head"><span>${n} de ${list.length} selecionado(s)</span><button type="button" class="link-btn" data-click="[&quot;toggleAllAliLote&quot;]">${n === list.length ? 'Desmarcar todos' : 'Marcar todos'}</button></div>` +
    list.map((a, i) => `<label class="check-row${a.included ? ' on' : ''}"><input type="checkbox" ${a.included ? 'checked' : ''} data-change="[&quot;toggleAliAnimalIncluded&quot;,${i},&quot;$checked&quot;]"><span class="check-box"></span><span>#${esc(a.num)} ${esc(a.nome)}</span></label>`).join('') : '';
}
export function toggleAllAliLote() {
  const all = state.tempAliAnimals.every(a => a.included);
  state.tempAliAnimals.forEach(a => { a.included = !all; });
  renderAliLoteList(); calcAliCost();
}
export function toggleAliAnimalIncluded(i, checked) { state.tempAliAnimals[i].included = checked; renderAliLoteList(); calcAliCost(); }
export function addAliAnimalNew() {
  const sel = $('aliAnimalSelect');
  if (!sel.value) return;
  const [num, nome] = sel.value.split('|');
  if (state.tempAliAnimals.find(a => a.num === num)) toast('Já adicionado', 'info');
  else state.tempAliAnimals.push({ num, nome, included: true });
  renderTempAliAnimals();
  sel.selectedIndex = 0;
  calcAliCost();
}
export function renderTempAliAnimals() {
  const n = state.tempAliAnimals.length;
  $('aliSelectedAnimals').innerHTML = state.tempAliAnimals.map((a, i) =>
    `<button type="button" class="pick-chip" data-click="[&quot;removeAliAnimal&quot;,${i}]">#${esc(a.num)} ${esc(a.nome)}<span>✕</span></button>`).join('') + (n ? `<span class="pick-count">${n} animal(is)</span>` : '');
}
export function removeAliAnimal(i) { state.tempAliAnimals.splice(i, 1); renderTempAliAnimals(); calcAliCost(); }

// Linhas de quantidade por ingrediente. Ao marcar/desmarcar um ingrediente, os valores já
// digitados nos outros são preservados (antes eram apagados).
const dietRow = tipo => document.querySelector(`#dietDetailFields .diet-row[data-tipo="${CSS.escape(tipo)}"]`);
export function onDietChange2() {
  const keep = {};
  document.querySelectorAll('#dietDetailFields .diet-row').forEach(r => { keep[r.dataset.tipo] = { v: r.querySelector('.d-val').value, k: r.querySelector('.d-kg').value }; });
  const checked = [...document.querySelectorAll('#dietaChecks input[type=checkbox]:checked')].map(cb => cb.value);
  $('dietDetailFields').innerHTML = checked.length ? `<div class="diet-head"><span>Ingrediente</span><span>R$/kg</span><span>kg/animal</span></div>` + checked.map(t => `<div class="diet-row" data-tipo="${esc(t)}">
    <div class="diet-name">${DIET_ICON[t] || '•'} ${esc(t)}</div>
    <input class="form-input d-val" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" aria-label="Valor por kg de ${esc(t)}" value="${esc(keep[t]?.v || '')}" data-input="[&quot;calcAliCost&quot;]">
    <input class="form-input d-kg" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0" aria-label="Kg por animal de ${esc(t)}" value="${esc(keep[t]?.k || '')}" data-input="[&quot;calcAliCost&quot;]">
  </div>`).join('') : '';
  calcAliCost();
}
function getSelectedDiets2() {
  return [...document.querySelectorAll('#dietaChecks input[type=checkbox]:checked')].map(cb => {
    const r = dietRow(cb.value);
    return { tipo: cb.value, valorKg: r?.querySelector('.d-val').value || '', kg: r?.querySelector('.d-kg').value || '' };
  });
}
export function calcAliCost() {
  const preview = $('aliCostPreview');
  if (!preview) return;
  const dietas = getSelectedDiets2();
  const numAni = state.tempAliAnimals.filter(a => a.included !== false).length;
  let total = 0, kgDia = 0;
  const lines = dietas.map(d => {
    const v = parseFloat(d.valorKg) || 0, kg = parseFloat(d.kg) || 0, cost = v * kg * numAni;
    total += cost; kgDia += kg * numAni;
    return (v || kg) ? `<div class="cost-line"><span>${esc(d.tipo)} · ${num(kg, 1)} kg × ${numAni} × R$ ${num(v)}</span><b>${brl(cost)}</b></div>` : '';
  }).join('');
  if (!dietas.length && !numAni) { preview.innerHTML = ''; return; }
  preview.innerHTML = `<div class="cost-card">
    <div class="cost-top"><div><small>Custo total</small><div class="cost-big">${brl(total)}</div></div><div class="cost-side"><span>${numAni} animal(is)</span><span>${numAni ? brl(total / numAni) + '/animal' : '—'}</span><span>${num(kgDia, 1)} kg no total</span></div></div>
    ${lines}
  </div>`;
}

export function openNewAli() {
  state.editAniId = null;
  openModal('aliAnimalModal');
}
export function editAliDirect(id, asNew = false) {
  const a = state.db.aliDirect.find(x => x.id === id);
  if (!a) return;
  state.editAniId = asNew ? null : id;
  state.aliPrefilled = true;
  $('aliNomeDieta').value = a.nomeDieta || '';
  document.querySelectorAll('#dietaChecks input[type=checkbox]').forEach(cb => { cb.checked = (a.dietas || []).some(d => d.tipo === cb.value); });
  $('dietDetailFields').innerHTML = '';
  onDietChange2();
  (a.dietas || []).forEach(d => {
    const r = dietRow(d.tipo);
    if (r) { r.querySelector('.d-val').value = d.valorKg || ''; r.querySelector('.d-kg').value = d.kg || ''; }
  });
  setAliMode('individual');
  state.tempAliAnimals = (a.animais || []).map(x => ({ ...x, included: true }));
  renderTempAliAnimals();
  $('aliAnimalModalTitle').textContent = asNew ? 'Repetir alimentação' : 'Editar alimentação';
  openModal('aliAnimalModal');
  calcAliCost();
}

export async function saveAliDirect() {
  if (!requireOnline()) return;
  const dietas = getSelectedDiets2();
  if (!dietas.length) return toast('Escolha ao menos um ingrediente', 'error');
  const animais = state.tempAliAnimals.filter(a => a.included !== false).map(a => ({ num: a.num, nome: a.nome }));
  if (!animais.length) return toast('Escolha ao menos um animal', 'error');
  const nomeDieta = $('aliNomeDieta').value.trim() || 'Sem título';
  let totalCost = 0;
  dietas.forEach(d => { totalCost += (parseFloat(d.valorKg) || 0) * (parseFloat(d.kg) || 0) * animais.length; });

  const base = { nome_dieta: nomeDieta, num_animais: animais.length, custo_total: totalCost };
  const dietRows = dietas.map(d => ({ tipo: d.tipo, valor_kg: d.valorKg || null, kg: d.kg || null }));
  const aniRows = animais.map(a => ({ num: a.num, nome: a.nome, animal_id: resolveAid(a.num) || null }));
  await safeRun(async () => {
    const editId = state.editAniId;
    // Tudo numa transação no banco (salvar_alimentacao); sem a função, cai no caminho antigo.
    const alimentacaoId = await rpcOr('salvar_alimentacao', { p_id: editId || null, p_dados: base, p_dietas: dietRows, p_animais: aniRows }, async () => {
      let id = editId;
      if (id) {
        await dbUpdate('alimentacoes', id, base);
        await dbDeleteWhere('alimentacao_dietas', 'alimentacao_id', id);
        await dbDeleteWhere('alimentacao_animais', 'alimentacao_id', id);
      } else {
        id = (await dbInsert('alimentacoes', base)).id;
      }
      await dbInsertMany('alimentacao_dietas', dietRows.map(d => ({ alimentacao_id: id, ...d })));
      await dbInsertMany('alimentacao_animais', aniRows.map(a => ({ alimentacao_id: id, ...a })));
      return id;
    });
    const createdAt = (editId && state.db.aliDirect.find(x => x.id === editId)?.createdAt) || Date.now();
    const entry = {
      id: alimentacaoId, createdAt, nomeDieta, numAnimais: animais.length, custoTotal: totalCost,
      dietas, animais: animais.map(a => ({ num: a.num, nome: a.nome, aid: resolveAid(a.num) || '' })),
    };
    const idx = state.db.aliDirect.findIndex(x => x.id === alimentacaoId);
    if (idx >= 0) state.db.aliDirect[idx] = entry; else state.db.aliDirect.unshift(entry);
    state.tempAliAnimals = [];
    closeModal('aliAnimalModal');
    renderAliDirect();
  }, 'Alimentação salva!');
}

export async function delAliDirect(id) {
  const ok = await showConfirm('Excluir este registro de alimentação?' + (state.caps.trash ? ' Ele fica 30 dias na lixeira.' : ''), '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    const r = await softDelete('alimentacoes', id);
    if (r === 'trash') bumpTrash();
    state.db.aliDirect = state.db.aliDirect.filter(x => x.id !== id);
    renderAliDirect();
    toast(r === 'trash' ? 'Alimentação movida para a lixeira' : 'Alimentação excluída');
  }).catch(() => {});
}

registerModalSetup('aliAnimalModal', () => {
  populateAliLoteSelect();
  $('aliAnimalSelect').innerHTML = '<option value="">Selecione...</option>';
  if (state.aliMode === 'individual') populateAliAnimalSelect2();
  if (!state.aliPrefilled) {
    $('aliAnimalModalTitle').textContent = 'Nova alimentação';
    state.tempAliAnimals = [];
    setAliMode('lote');
    renderAliLoteList();
    renderTempAliAnimals();
  }
  state.aliPrefilled = false;
  calcAliCost();
});
registerModalTeardown('aliAnimalModal', () => {
  $('aliSelectedAnimals').innerHTML = '';
  document.querySelectorAll('#dietaChecks input[type=checkbox]').forEach(cb => { cb.checked = false; });
  $('dietDetailFields').innerHTML = '';
  $('aliCostPreview').innerHTML = '';
  $('aliLoteAnimals').innerHTML = '';
});

registerPageEnter('pageAlimentacao', renderAliDirect);
