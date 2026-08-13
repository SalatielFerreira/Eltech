// ========== MEDICAÇÃO (lote inteiro ou animais individuais) ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, registerPageEnter, registerAnimalSelectProvider, registerModalSetup, registerModalTeardown } from './ui.js';
import { dbInsert, dbInsertMany, dbUpdate, dbDelete, dbDeleteWhere, getAllAnimals, sortByNum, loteCmp, resolveAid } from './data.js';

registerAnimalSelectProvider('med', () => sortByNum(getAllAnimals().slice()));

export function setMedMode(mode) {
  state.medMode = mode;
  document.getElementById('medModeLote').classList.toggle('active', mode === 'lote');
  document.getElementById('medModeIndiv').classList.toggle('active', mode === 'individual');
  document.getElementById('medLoteSection').classList.toggle('hidden', mode !== 'lote');
  document.getElementById('medIndivSection').classList.toggle('hidden', mode !== 'individual');
}
export function populateMedLoteSelect() {
  const sel = document.getElementById('medLoteSelect');
  sel.innerHTML = '<option value="">Selecione o lote...</option>';
  [...state.db.lotes].sort(loteCmp).forEach(l => { sel.innerHTML += `<option value="${l.id}">${esc(l.name)} (${l.animals.length})</option>`; });
}
export function populateMedSelect() {
  const sel = document.getElementById('medAnimalSelect');
  sel.innerHTML = '<option value="">Selecione o animal...</option>';
  sortByNum(getAllAnimals().slice()).forEach(a => { sel.innerHTML += `<option value="${esc(a.num)}|${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)} (${esc(a.loteName)})</option>`; });
}
export function loadMedLoteAnimals() {
  const lid = document.getElementById('medLoteSelect').value;
  const container = document.getElementById('medLoteAnimals');
  if (!lid) { container.innerHTML = ''; state.tempMedAnimals = []; return; }
  const l = state.db.lotes.find(x => x.id === lid);
  if (!l) return;
  state.tempMedAnimals = l.animals.map(a => ({ num: a.num, nome: a.nome, included: true }));
  renderMedLoteList();
}
export function renderMedLoteList() {
  document.getElementById('medLoteAnimals').innerHTML = state.tempMedAnimals.map((a, i) =>
    `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;margin-bottom:4px;background:${a.included ? 'rgba(78,232,152,0.1)' : 'rgba(255,87,87,0.08)'}"><label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex:1;font-size:.8rem;color:${a.included ? 'var(--g300)' : 'var(--danger)'}"><input type="checkbox" ${a.included ? 'checked' : ''} onchange="toggleMedAnimalIncluded(${i},this.checked)" style="accent-color:var(--g500)">#${esc(a.num)} ${esc(a.nome)}</label></div>`).join('');
}
export function toggleMedAnimalIncluded(i, checked) { state.tempMedAnimals[i].included = checked; renderMedLoteList(); }
export function addMedAnimalIndiv() {
  const sel = document.getElementById('medAnimalSelect');
  if (!sel.value) return;
  const [num, nome] = sel.value.split('|');
  if (state.tempMedAnimals.find(a => a.num === num)) return toast('Já adicionado', 'info');
  state.tempMedAnimals.push({ num, nome, included: true });
  renderMedIndivList();
  sel.selectedIndex = 0;
}
export function renderMedIndivList() {
  document.getElementById('medSelectedAnimals').innerHTML = state.tempMedAnimals.map((a, i) =>
    `<span class="badge badge-cat" style="cursor:pointer;padding:5px 12px" onclick="removeMedIndivAnimal(${i})">#${esc(a.num)} ${esc(a.nome)} ✕</span>`).join('');
}
export function removeMedIndivAnimal(i) { state.tempMedAnimals.splice(i, 1); renderMedIndivList(); }

export function addMedRow() {
  document.getElementById('medMedicamentos').innerHTML +=
    `<div class="flex-row med-row" style="margin-bottom:8px"><div class="form-group" style="margin-bottom:0;flex:2"><input class="form-input medNomeInput" placeholder="Nome"></div><div class="form-group" style="margin-bottom:0;flex:1"><input class="form-input medDoseInput" placeholder="Dose"></div><button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:4px;align-self:flex-end;margin-bottom:4px;font-size:1.2rem">✕</button></div>`;
}
function getMedRows() {
  const rows = [];
  document.querySelectorAll('#medMedicamentos .med-row').forEach(r => {
    const nome = r.querySelector('.medNomeInput').value.trim();
    const dose = r.querySelector('.medDoseInput').value.trim();
    if (nome) rows.push({ nome, dose });
  });
  return rows;
}
function setMedRows(meds) {
  const container = document.getElementById('medMedicamentos');
  container.innerHTML = '';
  (meds || []).forEach((m, i) => {
    container.innerHTML += `<div class="flex-row med-row" style="margin-bottom:8px"><div class="form-group" style="margin-bottom:0;flex:2">${i === 0 ? '<label style="font-size:.65rem">Medicamento</label>' : ''}<input class="form-input medNomeInput" placeholder="Nome" value="${esc(m.nome || '')}"></div><div class="form-group" style="margin-bottom:0;flex:1">${i === 0 ? '<label style="font-size:.65rem">Dosagem</label>' : ''}<input class="form-input medDoseInput" placeholder="Dose" value="${esc(m.dose || '')}"></div>${i > 0 ? '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--danger);cursor:pointer;padding:4px;align-self:flex-end;margin-bottom:4px;font-size:1.2rem">✕</button>' : ''}</div>`;
  });
  if (!meds || !meds.length) container.innerHTML = `<div class="flex-row med-row" style="margin-bottom:8px"><div class="form-group" style="margin-bottom:0;flex:2"><label style="font-size:.65rem">Medicamento</label><input class="form-input medNomeInput" placeholder="Nome"></div><div class="form-group" style="margin-bottom:0;flex:1"><label style="font-size:.65rem">Dosagem</label><input class="form-input medDoseInput" placeholder="Dose"></div></div>`;
}

export async function saveMedAnimal() {
  if (!requireOnline()) return;
  let animalsToSave = [];
  if (state.medMode === 'lote') {
    animalsToSave = state.tempMedAnimals.filter(a => a.included);
  } else {
    animalsToSave = state.tempMedAnimals.filter(a => a.included !== false);
    if (!animalsToSave.length) {
      const sel = document.getElementById('medAnimalSelect');
      if (sel.value) { const [num, nome] = sel.value.split('|'); animalsToSave = [{ num, nome }]; }
    }
  }
  if (!animalsToSave.length) return toast('Adicione ao menos um animal', 'error');
  const meds = getMedRows();
  if (!meds.length) return toast('Adicione ao menos um medicamento', 'error');

  const base = {
    data_ini: document.getElementById('medDataIni').value || null,
    data_fim: document.getElementById('medDataFim').value || null,
    tipo: document.getElementById('medTipo').value,
    carencia_leite: document.getElementById('medCarLeite').value || null,
    carencia_carne: document.getElementById('medCarCarne').value || null,
  };

  await safeRun(async () => {
    let medicacaoId = state.editAniId;
    if (medicacaoId) {
      await dbUpdate('medicacoes', medicacaoId, base);
      await dbDeleteWhere('medicacao_medicamentos', 'medicacao_id', medicacaoId);
      await dbDeleteWhere('medicacao_animais', 'medicacao_id', medicacaoId);
    } else {
      const row = await dbInsert('medicacoes', base);
      medicacaoId = row.id;
    }
    if (meds.length) await dbInsertMany('medicacao_medicamentos', meds.map(m => ({ medicacao_id: medicacaoId, nome: m.nome, dose: m.dose || null })));
    await dbInsertMany('medicacao_animais', animalsToSave.map(a => ({ medicacao_id: medicacaoId, num: a.num, nome: a.nome, animal_id: resolveAid(a.num) || null })));

    const entry = {
      id: medicacaoId, dataIni: document.getElementById('medDataIni').value || '', dataFim: document.getElementById('medDataFim').value || '',
      tipo: base.tipo, carenciaLeite: base.carencia_leite || '', carenciaCarne: base.carencia_carne || '',
      medicamentos: meds, animais: animalsToSave.map(a => ({ num: a.num, nome: a.nome, aid: resolveAid(a.num) || '' })),
    };
    const idx = state.db.medDirect.findIndex(x => x.id === medicacaoId);
    if (idx >= 0) state.db.medDirect[idx] = entry; else state.db.medDirect.unshift(entry);

    closeModal('medAnimalModal');
    renderMedDirect();
  }, 'Medicação salva!');
}

export function renderMedDirect() {
  const container = document.getElementById('medDirectList');
  const q = (document.getElementById('searchMedicacao')?.value || '').toLowerCase().trim();
  let items = [...state.db.medDirect];
  if (q) items = items.filter(a => (a.animais || []).some(x => (x.num || '').toLowerCase().includes(q) || (x.nome || '').toLowerCase().includes(q)));
  if (!items.length) { container.innerHTML = `<div class="empty-state"><p>${q ? 'Nenhum resultado.' : 'Nenhuma medicação registrada.'}</p></div>`; return; }
  container.innerHTML = items.map(a => {
    const animals = a.animais || [];
    const animalBadges = animals.map(x => `<span class="badge badge-cat" style="margin:1px">#${esc(x.num)} ${esc(x.nome)}</span>`).join('');
    const medStr = (a.medicamentos || []).map(m => '<strong>' + esc(m.nome) + '</strong>' + (m.dose ? ' · ' + esc(m.dose) : '')).join('<br>');
    let dateStr = '';
    if (a.dataIni) dateStr += 'De ' + new Date(a.dataIni + 'T12:00').toLocaleDateString('pt-BR');
    if (a.dataFim) dateStr += ' até ' + new Date(a.dataFim + 'T12:00').toLocaleDateString('pt-BR');
    let carStr = '';
    if (a.carenciaLeite) carStr += '🥛 carência ' + esc(a.carenciaLeite) + 'd';
    if (a.carenciaCarne) carStr += (carStr ? ' · ' : '') + '🥩 carência ' + esc(a.carenciaCarne) + 'd';
    return `<div class="animal-row" style="flex-direction:column;align-items:stretch"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div class="animal-info">${a.tipo ? '<div class="badges" style="margin-bottom:4px"><span class="badge badge-muco">' + esc(a.tipo) + '</span></div>' : ''}${medStr ? '<div class="detail">' + medStr + '</div>' : ''}${dateStr ? '<div class="detail">' + dateStr + '</div>' : ''}${carStr ? '<div class="detail">' + carStr + '</div>' : ''}</div><div class="animal-actions"><button class="edit-btn" onclick="editMedDirect('${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="del-btn" onclick="delMedDirect('${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></div></div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${animalBadges}</div></div>`;
  }).join('');
}

export function editMedDirect(aid) {
  const a = state.db.medDirect.find(x => x.id === aid);
  if (!a) return;
  state.editAniId = aid;
  const animals = a.animais || [];
  setMedMode('individual');
  state.tempMedAnimals = animals.map(x => ({ num: x.num, nome: x.nome, included: true }));
  renderMedIndivList();
  populateMedSelect();
  document.getElementById('medDataIni').value = a.dataIni || '';
  document.getElementById('medDataFim').value = a.dataFim || '';
  document.getElementById('medTipo').value = a.tipo || 'Vacina';
  document.getElementById('medCarLeite').value = a.carenciaLeite || '';
  document.getElementById('medCarCarne').value = a.carenciaCarne || '';
  setMedRows(a.medicamentos);
  document.getElementById('medAnimalModalTitle').textContent = 'Editar Medicação';
  openModal('medAnimalModal');
}
export async function delMedDirect(aid) {
  const ok = await showConfirm('Excluir?', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('medicacoes', aid);
    state.db.medDirect = state.db.medDirect.filter(x => x.id !== aid);
    renderMedDirect();
  }, 'Excluído');
}

registerModalSetup('medAnimalModal', () => {
  populateMedLoteSelect();
  populateMedSelect();
  if (!state.editAniId) { state.medMode = 'lote'; setMedMode('lote'); }
});
registerModalTeardown('medAnimalModal', () => {
  const la = document.getElementById('medLoteAnimals'); if (la) la.innerHTML = '';
  const ms = document.getElementById('medSelectedAnimals'); if (ms) ms.innerHTML = '';
});

registerPageEnter('pageMedicacao', renderMedDirect);
