// ========== ALIMENTAÇÃO (lote inteiro ou animais individuais) ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, registerPageEnter, registerAnimalSelectProvider, registerModalSetup, registerModalTeardown } from './ui.js';
import { dbInsert, dbInsertMany, dbUpdate, dbDelete, dbDeleteWhere, getAllAnimals, sortByNum, loteCmp, resolveAid } from './data.js';

registerAnimalSelectProvider('ali', () => sortByNum(getAllAnimals().slice()));

export function setAliMode(mode) {
  state.aliMode = mode;
  document.getElementById('aliModeLote').classList.toggle('active', mode === 'lote');
  document.getElementById('aliModeIndiv').classList.toggle('active', mode === 'individual');
  document.getElementById('aliLoteSection').classList.toggle('hidden', mode !== 'lote');
  document.getElementById('aliIndivSection').classList.toggle('hidden', mode !== 'individual');
  calcAliCost();
}
export function populateAliLoteSelect() {
  const sel = document.getElementById('aliLoteSelect');
  sel.innerHTML = '<option value="">Selecione o lote...</option>';
  [...state.db.lotes].sort(loteCmp).forEach(l => { sel.innerHTML += `<option value="${l.id}">${esc(l.name)} (${l.animals.length})</option>`; });
}
export function populateAliAnimalSelect2() {
  const sel = document.getElementById('aliAnimalSelect');
  sel.innerHTML = '<option value="">Selecione...</option>';
  sortByNum(getAllAnimals().slice()).forEach(a => { sel.innerHTML += `<option value="${esc(a.num)}|${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)} (${esc(a.loteName)})</option>`; });
}
export function loadAliLoteAnimals() {
  const lid = document.getElementById('aliLoteSelect').value;
  const container = document.getElementById('aliLoteAnimals');
  if (!lid) { container.innerHTML = ''; calcAliCost(); return; }
  const l = state.db.lotes.find(x => x.id === lid);
  if (!l) return;
  state.tempAliAnimals = l.animals.map(a => ({ num: a.num, nome: a.nome, included: true }));
  renderAliLoteList();
  calcAliCost();
}
export function renderAliLoteList() {
  document.getElementById('aliLoteAnimals').innerHTML = state.tempAliAnimals.map((a, i) =>
    `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;margin-bottom:4px;background:${a.included ? 'rgba(78,232,152,0.1)' : 'rgba(255,87,87,0.08)'}"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1;font-size:.8rem;color:${a.included ? 'var(--g300)' : 'var(--danger)'}"><input type="checkbox" ${a.included ? 'checked' : ''} onchange="toggleAliAnimalIncluded(${i},this.checked)" style="accent-color:var(--g500)">#${esc(a.num)} ${esc(a.nome)}</label></div>`).join('');
}
export function toggleAliAnimalIncluded(i, checked) { state.tempAliAnimals[i].included = checked; renderAliLoteList(); calcAliCost(); }
export function addAliAnimalNew() {
  const sel = document.getElementById('aliAnimalSelect');
  if (!sel.value) return;
  const [num, nome] = sel.value.split('|');
  if (state.tempAliAnimals.find(a => a.num === num)) return toast('Já adicionado', 'info');
  state.tempAliAnimals.push({ num, nome, included: true });
  renderTempAliAnimals();
  sel.selectedIndex = 0;
  calcAliCost();
}
export function renderTempAliAnimals() {
  document.getElementById('aliSelectedAnimals').innerHTML = state.tempAliAnimals.map((a, i) =>
    `<span class="badge badge-cat" style="cursor:pointer;padding:5px 12px" onclick="removeAliAnimal(${i})">#${esc(a.num)} ${esc(a.nome)} ✕</span>`).join('');
}
export function removeAliAnimal(i) { state.tempAliAnimals.splice(i, 1); renderTempAliAnimals(); calcAliCost(); }

export function onDietChange2() {
  const checks = document.querySelectorAll('#dietaChecks input[type=checkbox]');
  const container = document.getElementById('dietDetailFields');
  container.innerHTML = '';
  checks.forEach(cb => {
    if (cb.checked) {
      container.innerHTML += `<div class="diet-qtd" style="flex-direction:column;gap:6px;padding:12px 14px"><div class="diet-label" style="min-width:auto;margin-bottom:4px">${cb.value}</div><div class="flex-row"><div class="form-group" style="margin-bottom:0"><label style="font-size:.65rem">Valor/kg (R$)</label><input class="form-input" id="dietVal_${cb.value}" type="number" step="0.01" placeholder="R$/kg" style="padding:9px 12px;font-size:.82rem" oninput="calcAliCost()"></div><div class="form-group" style="margin-bottom:0"><label style="font-size:.65rem">Consumo/animal (kg)</label><input class="form-input" id="dietKg_${cb.value}" type="number" step="0.1" placeholder="kg/animal" style="padding:9px 12px;font-size:.82rem" oninput="calcAliCost()"></div></div></div>`;
    }
  });
  calcAliCost();
}
export function calcAliCost() {
  const checks = document.querySelectorAll('#dietaChecks input[type=checkbox]:checked');
  const numAni = state.tempAliAnimals.filter(a => a.included !== false).length;
  let totalCost = 0;
  const preview = document.getElementById('aliCostPreview');
  let lines = '';
  checks.forEach(cb => {
    const val = parseFloat(document.getElementById('dietVal_' + cb.value)?.value || 0);
    const kg = parseFloat(document.getElementById('dietKg_' + cb.value)?.value || 0);
    const cost = val * kg * numAni;
    totalCost += cost;
    if (val || kg) lines += `<div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text2);padding:2px 0"><span>${cb.value}: ${kg}kg × ${numAni} anim. × R$${val.toFixed(2)}</span><span>R$ ${cost.toFixed(2)}</span></div>`;
  });
  if (lines || numAni) preview.innerHTML = `<div class="glass3" style="border-radius:var(--rx);padding:12px;margin-top:4px"><div style="font-size:.72rem;color:var(--text3);margin-bottom:6px">${numAni} animal(is)</div>${lines}<div style="display:flex;justify-content:space-between;font-size:.9rem;font-weight:700;color:var(--g400);border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;margin-top:6px"><span>Custo Total</span><span>R$ ${totalCost.toFixed(2)}</span></div></div>`;
  else preview.innerHTML = '';
}
function getSelectedDiets2() {
  const diets = [];
  document.querySelectorAll('#dietaChecks input[type=checkbox]:checked').forEach(cb => {
    const valEl = document.getElementById('dietVal_' + cb.value);
    const kgEl = document.getElementById('dietKg_' + cb.value);
    diets.push({ tipo: cb.value, valorKg: valEl ? valEl.value : '', kg: kgEl ? kgEl.value : '' });
  });
  return diets;
}

export async function saveAliDirect() {
  if (!requireOnline()) return;
  const dietas = getSelectedDiets2();
  if (!dietas.length) return toast('Selecione ao menos um tipo de dieta', 'error');
  const animais = state.tempAliAnimals.filter(a => a.included !== false).map(a => ({ num: a.num, nome: a.nome }));
  if (!animais.length) return toast('Adicione ao menos um animal', 'error');
  const nomeDieta = document.getElementById('aliNomeDieta').value.trim() || 'Sem título';
  let totalCost = 0;
  dietas.forEach(d => { totalCost += parseFloat(d.valorKg || 0) * parseFloat(d.kg || 0) * animais.length; });

  await safeRun(async () => {
    let alimentacaoId = state.editAniId;
    const base = { nome_dieta: nomeDieta, num_animais: animais.length, custo_total: totalCost };
    if (alimentacaoId) {
      await dbUpdate('alimentacoes', alimentacaoId, base);
      await dbDeleteWhere('alimentacao_dietas', 'alimentacao_id', alimentacaoId);
      await dbDeleteWhere('alimentacao_animais', 'alimentacao_id', alimentacaoId);
    } else {
      const row = await dbInsert('alimentacoes', base);
      alimentacaoId = row.id;
    }
    await dbInsertMany('alimentacao_dietas', dietas.map(d => ({ alimentacao_id: alimentacaoId, tipo: d.tipo, valor_kg: d.valorKg || null, kg: d.kg || null })));
    await dbInsertMany('alimentacao_animais', animais.map(a => ({ alimentacao_id: alimentacaoId, num: a.num, nome: a.nome, animal_id: resolveAid(a.num) || null })));

    const entry = {
      id: alimentacaoId, createdAt: Date.now(), nomeDieta, numAnimais: animais.length, custoTotal: totalCost,
      dietas, animais: animais.map(a => ({ num: a.num, nome: a.nome, aid: resolveAid(a.num) || '' })),
    };
    const idx = state.db.aliDirect.findIndex(x => x.id === alimentacaoId);
    if (idx >= 0) state.db.aliDirect[idx] = { ...state.db.aliDirect[idx], ...entry }; else state.db.aliDirect.unshift(entry);

    state.tempAliAnimals = [];
    closeModal('aliAnimalModal');
    renderAliDirect();
  }, 'Alimentação salva!');
}

export function renderAliDirect() {
  const container = document.getElementById('aliDirectList');
  const costGrid = document.getElementById('aliCostGrid');
  const items = [...state.db.aliDirect].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  let totalGeral = 0;
  items.forEach(a => totalGeral += parseFloat(a.custoTotal || 0));
  costGrid.innerHTML = items.length ? `<div class="cost-box glass3"><div class="val">R$ ${totalGeral.toFixed(2)}</div><div class="lbl">Custo Total</div></div><div class="cost-box glass3"><div class="val">${items.length}</div><div class="lbl">Dietas</div></div>` : '';
  if (!items.length) { container.innerHTML = '<div class="empty-state"><p>Nenhuma alimentação registrada.</p></div>'; return; }
  container.innerHTML = items.map(a => {
    const dietBadges = (a.dietas || []).map(d => `<span class="badge badge-cat" style="margin:2px">${esc(d.tipo)}: ${d.kg || 0}kg × R$${parseFloat(d.valorKg || 0).toFixed(2)}</span>`).join('');
    const animalBadges = (a.animais || []).map(x => `<span class="badge badge-m" style="margin:1px">#${esc(x.num)} ${esc(x.nome)}</span>`).join('');
    return `<div class="animal-row" style="flex-direction:column;align-items:stretch"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--g400);font-size:.9rem">${esc(a.nomeDieta || 'Dieta')}</div><div class="detail">${a.numAnimais || 0} animais · R$ ${parseFloat(a.custoTotal || 0).toFixed(2)}</div></div><div class="animal-actions"><button class="edit-btn" onclick="editAliDirect('${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="del-btn" onclick="delAliDirect('${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></div></div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${dietBadges}</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${animalBadges}</div></div>`;
  }).join('');
}

export function editAliDirect(aid) {
  const a = state.db.aliDirect.find(x => x.id === aid);
  if (!a) return;
  state.editAniId = aid;
  document.getElementById('aliNomeDieta').value = a.nomeDieta || '';
  document.querySelectorAll('#dietaChecks input[type=checkbox]').forEach(cb => cb.checked = false);
  a.dietas.forEach(d => { const cb = document.querySelector('#dietaChecks input[value="' + d.tipo + '"]'); if (cb) cb.checked = true; });
  onDietChange2();
  a.dietas.forEach(d => {
    const ve = document.getElementById('dietVal_' + d.tipo); if (ve) ve.value = d.valorKg || '';
    const ke = document.getElementById('dietKg_' + d.tipo); if (ke) ke.value = d.kg || '';
  });
  setAliMode('individual');
  state.tempAliAnimals = (a.animais || []).map(x => ({ ...x, included: true }));
  renderTempAliAnimals();
  populateAliAnimalSelect2();
  calcAliCost();
  document.getElementById('aliAnimalModalTitle').textContent = 'Editar Alimentação';
  openModal('aliAnimalModal');
}
export async function delAliDirect(aid) {
  const ok = await showConfirm('Excluir?', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('alimentacoes', aid);
    state.db.aliDirect = state.db.aliDirect.filter(x => x.id !== aid);
    renderAliDirect();
  }, 'Excluído');
}

registerModalSetup('aliAnimalModal', () => {
  populateAliLoteSelect();
  populateAliAnimalSelect2();
  if (!state.editAniId) { state.aliMode = 'lote'; setAliMode('lote'); }
});
registerModalTeardown('aliAnimalModal', () => {
  const as = document.getElementById('aliSelectedAnimals'); if (as) as.innerHTML = '';
  document.querySelectorAll('#dietaChecks input[type=checkbox]').forEach(cb => cb.checked = false);
  const df = document.getElementById('dietDetailFields'); if (df) df.innerHTML = '';
  const cp = document.getElementById('aliCostPreview'); if (cp) cp.innerHTML = '';
  const la = document.getElementById('aliLoteAnimals'); if (la) la.innerHTML = '';
});

registerPageEnter('pageAlimentacao', renderAliDirect);
