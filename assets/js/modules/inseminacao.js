// ========== INSEMINAÇÃO ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, registerPageEnter, registerAnimalSelectProvider } from './ui.js';
import { dbInsert, dbInsertMany, dbUpdate, dbDelete, getAllAnimals, sortByNum, loteCmp, resolveAid } from './data.js';
import { SIT_OPTIONS } from './constants.js';
import { renderLotes, renderLoteAnimals } from './lotes.js';
import { renderAnimaisFolder } from './animais.js';

function eligibleAnimals() {
  return getAllAnimals().filter(a => a.sexo !== 'Macho' && a.cat !== 'Bezerra' && a.sit !== 'Anestro');
}
registerAnimalSelectProvider('insem', () => sortByNum(eligibleAnimals()));

// ---------- Planilhas ----------
export function renderPlanilhas() {
  const el = document.getElementById('insemPlanilhas');
  const sorted = [...state.db.inseminacao].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  el.innerHTML = sorted.length ? sorted.map(p => {
    const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    return `<div class="card glass2 anim-fade" onclick="openInsemDetail('${p.id}')" style="cursor:pointer"><div class="card-title">${esc(p.name)}</div><div class="card-sub">${p.animals.length} registro(s)${dateStr ? ' · ' + dateStr : ''}</div><div class="card-actions"><button class="edit-btn" onclick="event.stopPropagation();editPlanFromCard('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button><button class="del-btn" onclick="event.stopPropagation();delPlan('${p.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>Excluir</button></div></div>`;
  }).join('') : '<div class="empty-state"><p>Nenhuma planilha criada.</p></div>';
}

export function editPlanFromCard(id) {
  const p = state.db.inseminacao.find(x => x.id === id);
  if (!p) return;
  state.editPlanId = id;
  document.getElementById('planilhaNome').value = p.name;
  document.getElementById('planilhaModalTitle').textContent = 'Editar Planilha';
  openModal('planilhaModal');
}

export async function savePlanilha() {
  if (!requireOnline()) return;
  const name = document.getElementById('planilhaNome').value.trim();
  if (!name) return toast('Digite o nome', 'error');
  await safeRun(async () => {
    if (state.editPlanId) {
      await dbUpdate('inseminacao_planilhas', state.editPlanId, { name });
      const p = state.db.inseminacao.find(x => x.id === state.editPlanId);
      if (p) p.name = name;
    } else {
      const row = await dbInsert('inseminacao_planilhas', { name });
      state.db.inseminacao.push({ id: row.id, name, createdAt: new Date(row.created_at).getTime(), animals: [] });
    }
    closeModal('planilhaModal');
    state.editPlanId = null;
    renderPlanilhas();
  }, 'Planilha salva!');
}

export async function delPlan(id) {
  const ok = await showConfirm('Excluir esta planilha?', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('inseminacao_planilhas', id);
    state.db.inseminacao = state.db.inseminacao.filter(x => x.id !== id);
    renderPlanilhas();
  }, 'Excluída');
}

export function openInsemDetail(id) {
  state.currentPlanId = id;
  document.getElementById('insemList').classList.add('hidden');
  document.getElementById('insemDetail').classList.remove('hidden');
  const p = state.db.inseminacao.find(x => x.id === id);
  document.getElementById('insemDetailTitle').textContent = p.name;
  if (document.getElementById('searchInseminacao')) document.getElementById('searchInseminacao').value = '';
  renderAnimals();
}
export function backToList() {
  document.getElementById('insemDetail').classList.add('hidden');
  document.getElementById('insemList').classList.remove('hidden');
  renderPlanilhas();
}

// ---------- Registros de uma planilha ----------
export function renderAnimals() {
  const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
  if (!p) return;
  const container = document.getElementById('insemAnimals');
  let animals = [...p.animals];
  const q = (document.getElementById('searchInseminacao')?.value || '').toLowerCase().trim();
  if (q) animals = animals.filter(a => (a.num || '').toLowerCase().includes(q) || (a.nome || '').toLowerCase().includes(q));
  sortByNum(animals);
  if (!animals.length) { container.innerHTML = `<div class="empty-state"><p>${q ? 'Nenhum resultado.' : 'Nenhum registro.'}</p></div>`; return; }
  container.innerHTML = animals.map(a => {
    const details = [];
    if (a.data) details.push('Data: ' + new Date(a.data + 'T12:00').toLocaleDateString('pt-BR'));
    if (a.touro) details.push('Touro: ' + esc(a.touro));
    const badges = [];
    if (a.parecer) badges.push(`<span class="badge" style="background:var(--yellow);color:#fff">Parecer: ${esc(a.parecer)}</span>`);
    if (a.muco) badges.push(`<span class="badge badge-muco">Muco: ${esc(a.muco)}</span>`);
    if (a.tempo) badges.push(`<span class="badge badge-cat">${esc(a.tempo)}</span>`);
    return `<div class="animal-row"><div class="animal-info"><div><span class="num">#${esc(a.num)}</span><span class="name-text">${esc(a.nome)}</span></div>${details.length ? `<div class="detail">${details.join(' · ')}</div>` : ''}${badges.length ? `<div class="badges">${badges.join('')}</div>` : ''}${a.obs ? `<div class="detail" style="font-style:italic;margin-top:3px">${esc(a.obs)}</div>` : ''}</div><div class="animal-actions"><button class="edit-btn" style="background:var(--yellow);color:#fff" onclick="openParecer('${a.id}')" title="Parecer (situação)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></button><button class="edit-btn" onclick="editInsemAnimal('${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="del-btn" onclick="delInsemAnimal('${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button></div></div>`;
  }).join('');
}

export function populateInsemSelect() {
  const sel = document.getElementById('insemAnimalSelect');
  sel.innerHTML = '<option value="">Selecione o animal...</option>';
  sortByNum(eligibleAnimals()).forEach(a => { sel.innerHTML += `<option value="${esc(a.num)}|${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)}</option>`; });
}
export function populateInsemPlanSelect() {
  const sel = document.getElementById('insemPlanSelect');
  const prev = sel.value;
  sel.innerHTML = '<option value="">Selecione a planilha...</option>';
  [...state.db.inseminacao].sort(loteCmp).forEach(p => { sel.innerHTML += `<option value="${p.id}">${esc(p.name)}</option>`; });
  if (prev) sel.value = prev;
}
export function openInsemAnimalDirect() {
  state.editAniId = null;
  state.tempInsemAnimals = [];
  populateInsemPlanSelect();
  populateInsemSelect();
  document.getElementById('insemAnimalModalTitle').textContent = 'Adicionar Inseminação';
  openModal('insemAnimalModal');
}
export function openInsemAnimalForPlan() {
  state.editAniId = null;
  state.tempInsemAnimals = [];
  populateInsemPlanSelect();
  populateInsemSelect();
  document.getElementById('insemPlanSelect').value = state.currentPlanId || '';
  document.getElementById('insemAnimalModalTitle').textContent = 'Adicionar Inseminação';
  openModal('insemAnimalModal');
}
export function addInsemAnimal() {
  const sel = document.getElementById('insemAnimalSelect');
  if (!sel.value) return;
  const [num, nome] = sel.value.split('|');
  if (state.tempInsemAnimals.find(a => a.num === num)) return toast('Já adicionado', 'info');
  state.tempInsemAnimals.push({ num, nome });
  renderTempInsemAnimals();
  sel.selectedIndex = 0;
}
export function renderTempInsemAnimals() {
  document.getElementById('insemSelectedAnimals').innerHTML = state.tempInsemAnimals.map((a, i) =>
    `<span class="badge badge-cat" style="cursor:pointer;padding:5px 12px" onclick="removeTempInsemAnimal(${i})">#${esc(a.num)} ${esc(a.nome)} ✕</span>`).join('');
}
export function removeTempInsemAnimal(i) { state.tempInsemAnimals.splice(i, 1); renderTempInsemAnimals(); }

export async function saveInsemAnimal() {
  if (!requireOnline()) return;
  const planId = document.getElementById('insemPlanSelect').value;
  if (!planId) return toast('Selecione uma planilha', 'error');
  const p = state.db.inseminacao.find(x => x.id === planId);
  if (!p) return toast('Planilha não encontrada', 'error');

  let animalsToSave = [];
  if (state.editAniId) {
    const ex = p.animals.find(x => x.id === state.editAniId);
    if (ex) animalsToSave = [{ num: ex.num, nome: ex.nome }];
    const sel = document.getElementById('insemAnimalSelect');
    if (sel.value) { const [num, nome] = sel.value.split('|'); animalsToSave = [{ num, nome }]; }
  } else {
    animalsToSave = [...state.tempInsemAnimals];
    if (!animalsToSave.length) {
      const sel = document.getElementById('insemAnimalSelect');
      if (sel.value) { const [num, nome] = sel.value.split('|'); animalsToSave = [{ num, nome }]; }
    }
  }
  if (!animalsToSave.length) return toast('Adicione ao menos um animal', 'error');

  const base = {
    data: document.getElementById('insemData').value || null,
    tempo: document.getElementById('insemTempo').value,
    touro: document.getElementById('insemTouro').value,
    muco: document.getElementById('insemMuco').value,
    obs: document.getElementById('insemObs').value,
  };
  await safeRun(async () => {
    if (state.editAniId) {
      const a = p.animals.find(x => x.id === state.editAniId);
      const animalId = resolveAid(animalsToSave[0].num) || null;
      await dbUpdate('inseminacao_registros', state.editAniId, {
        num: animalsToSave[0].num, nome: animalsToSave[0].nome, animal_id: animalId, ...base,
      });
      if (a) Object.assign(a, base, { num: animalsToSave[0].num, nome: animalsToSave[0].nome, aid: animalId || '' });
    } else {
      const rows = await dbInsertMany('inseminacao_registros', animalsToSave.map(an => ({
        planilha_id: planId, num: an.num, nome: an.nome, animal_id: resolveAid(an.num) || null, ...base,
      })));
      rows.forEach(row => p.animals.push({ id: row.id, aid: row.animal_id || '', num: row.num, nome: row.nome, data: row.data || '', tempo: row.tempo || '', touro: row.touro || '', muco: row.muco || '', obs: row.obs || '', parecer: '', parecerData: '' }));
    }
    state.tempInsemAnimals = [];
    closeModal('insemAnimalModal');
    if (state.currentPlanId === planId) renderAnimals();
    renderPlanilhas();
  }, 'Inseminação salva!');
}

export function editInsemAnimal(aid) {
  const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
  const a = p.animals.find(x => x.id === aid);
  if (!a) return;
  state.editAniId = aid;
  populateInsemPlanSelect();
  populateInsemSelect();
  document.getElementById('insemPlanSelect').value = state.currentPlanId;
  document.getElementById('insemAnimalSelect').value = a.num + '|' + a.nome;
  document.getElementById('insemData').value = a.data;
  document.getElementById('insemTempo').value = a.tempo;
  document.getElementById('insemTouro').value = a.touro;
  document.getElementById('insemMuco').value = a.muco;
  document.getElementById('insemObs').value = a.obs;
  document.getElementById('insemAnimalModalTitle').textContent = 'Editar';
  openModal('insemAnimalModal');
}
export async function delInsemAnimal(aid) {
  const ok = await showConfirm('Excluir?', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('inseminacao_registros', aid);
    const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
    p.animals = p.animals.filter(x => x.id !== aid);
    renderAnimals();
  }, 'Excluído');
}

// ---------- Parecer (diagnóstico) ----------
export function openParecer(recId) {
  const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
  if (!p) return;
  const rec = p.animals.find(x => x.id === recId);
  if (!rec) return;
  state.parecerRecId = recId;
  document.getElementById('parecerAnimalName').textContent = '#' + rec.num + ' ' + rec.nome;
  const cur = rec.parecer || '';
  document.getElementById('parecerOptions').innerHTML = SIT_OPTIONS.map(o =>
    `<button type="button" class="filter-chip${o === cur ? ' active' : ''}" style="flex:1 1 46%;padding:11px" onclick="setParecer('${o}')">${o}</button>`).join('');
  openModal('parecerModal');
}
export async function setParecer(sit) {
  if (!requireOnline()) return;
  const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
  if (!p) return;
  const rec = p.animals.find(x => x.id === state.parecerRecId);
  if (!rec) return;
  const parecerData = new Date().toISOString().split('T')[0];
  await safeRun(async () => {
    await dbUpdate('inseminacao_registros', rec.id, { parecer: sit, parecer_data: parecerData });
    rec.parecer = sit;
    rec.parecerData = parecerData;
    let updated = false;
    const animaisAtualizados = [];
    state.db.lotes.forEach(l => l.animals.forEach(a => {
      if ((rec.aid && a.id === rec.aid) || String(a.num) === String(rec.num)) {
        a.sit = sit;
        a.prenhaData = sit === 'Prenha' ? (rec.data || '') : '';
        updated = true;
        animaisAtualizados.push(a);
      }
    }));
    await Promise.all(animaisAtualizados.map(a => dbUpdate('animais', a.id, { sit: a.sit, prenha_data: a.prenhaData || null })));
    closeModal('parecerModal');
    renderAnimals();
    renderLotes();
    renderAnimaisFolder();
    if (state.currentLoteId) renderLoteAnimals();
    toast(updated ? 'Situação atualizada: ' + sit : 'Parecer salvo (animal não encontrado no rebanho)');
  });
}

registerPageEnter('pageInseminacao', () => {
  document.getElementById('insemList')?.classList.remove('hidden');
  document.getElementById('insemDetail')?.classList.add('hidden');
  renderPlanilhas();
});
