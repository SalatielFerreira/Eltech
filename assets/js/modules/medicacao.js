// ========== MEDICAÇÃO (lote inteiro ou animais individuais) ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, registerPageEnter, registerAnimalSelectProvider, registerModalSetup, registerModalTeardown, openActionSheet, act, skeletonHtml } from './ui.js';
import { dbInsert, dbInsertMany, dbUpdate, softDelete, dbDeleteWhere, getAllAnimals, sortByNum, loteCmp, resolveAid, todayISO, toLocalISO, fmtDateBR, rpcOr } from './data.js';
import { bumpTrash } from './lixeira.js';
import { ICON_DOTS, emptyStateHtml } from './animalRow.js';

const $ = id => document.getElementById(id);
const TIPO_ICON = { 'Vacina': ['💉', 'pv-info'], 'Vermífugo': ['🪱', 'pv-gold'], 'Tratamento': ['💊', 'pv-bad'] };
let medFilter = 'all';

registerAnimalSelectProvider('med', () => sortByNum(getAllAnimals().slice()));

// ---------- Situação de cada registro ----------
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return toLocalISO(d); };
export function medReleaseDates(r) {
  const base = r.dataFim || r.dataIni;
  if (!base) return { leite: '', carne: '' };
  return {
    leite: r.carenciaLeite ? addDays(base, parseInt(r.carenciaLeite, 10) || 0) : '',
    carne: r.carenciaCarne ? addDays(base, parseInt(r.carenciaCarne, 10) || 0) : '',
  };
}
function medStatus(r) {
  const t = todayISO();
  if (!r.dataIni) return { k: 'semdata', label: 'Sem data', cls: '' };
  if (r.dataIni > t) return { k: 'agendada', label: 'Agendada', cls: 'tag-venda' };
  if (!r.dataFim || r.dataFim >= t) return { k: 'andamento', label: 'Em andamento', cls: 'tag-ok' };
  const lib = medReleaseDates(r);
  if ((lib.leite && lib.leite >= t) || (lib.carne && lib.carne >= t)) return { k: 'carencia', label: 'Em carência', cls: 'tag-bad' };
  return { k: 'encerrada', label: 'Encerrada', cls: '' };
}
const daysUntil = iso => Math.round((new Date(iso + 'T12:00') - new Date(todayISO() + 'T12:00')) / 864e5);

// ---------- Lista ----------
export function setMedFilter(v) {
  medFilter = v;
  $('medFilter').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  renderMedDirect();
}

function renderMedKpis(all) {
  const st = all.map(r => ({ r, s: medStatus(r) }));
  const andamento = st.filter(x => x.s.k === 'andamento');
  const carencia = st.filter(x => {
    const lib = medReleaseDates(x.r), t = todayISO();
    return (lib.leite && lib.leite >= t) || (lib.carne && lib.carne >= t);
  });
  const animais = new Set(andamento.flatMap(x => (x.r.animais || []).map(a => a.num)));
  const kpi = (v, l, cls = '') => `<div class="kpi${cls}"><div class="kpi-val">${v}</div><div class="kpi-lbl">${l}</div></div>`;
  $('medKpis').innerHTML = kpi(andamento.length, 'Em andamento') + kpi(carencia.length, 'Em carência', carencia.length ? ' kpi-bad' : '') + kpi(animais.size, 'Animais tratados') + kpi(all.length, 'Registros');
  $('medSub').textContent = all.length ? `${all.length} registro(s) de medicação` : 'Vacinas, vermífugos e tratamentos';
}

export function renderMedDirect() {
  const container = $('medDirectList');
  if (!state.loaded) { $('medKpis').innerHTML = ''; container.innerHTML = skeletonHtml(3); return; }
  const all = state.db.medDirect;
  renderMedKpis(all);
  const q = ($('searchMedicacao')?.value || '').toLowerCase().trim();
  let items = all.filter(r => {
    const k = medStatus(r).k;
    if (medFilter === 'ativas' && !['andamento', 'carencia', 'agendada'].includes(k)) return false;
    if (medFilter === 'encerradas' && !['encerrada', 'semdata'].includes(k)) return false;
    if (q) {
      const hay = [...(r.animais || []).flatMap(x => [x.num, x.nome]), ...(r.medicamentos || []).map(m => m.nome), r.tipo].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => (b.dataIni || '').localeCompare(a.dataIni || ''));
  if (!items.length) {
    container.innerHTML = all.length ? emptyStateHtml('Nenhuma medicação com esse filtro.')
      : emptyStateHtml('Nenhuma medicação registrada.', { label: 'Registrar medicação', action: ['openNewMed'] });
    return;
  }
  const t = todayISO();
  container.innerHTML = items.map(r => {
    const [ico, cls] = TIPO_ICON[r.tipo] || ['💊', 'pv-bad'];
    const st = medStatus(r);
    const meds = (r.medicamentos || []).map(m => `<b>${esc(m.nome)}</b>${m.dose ? ' ' + esc(m.dose) : ''}`).join(' · ');
    const periodo = r.dataIni ? fmtDateBR(r.dataIni) + (r.dataFim && r.dataFim !== r.dataIni ? ' → ' + fmtDateBR(r.dataFim) : '') : 'Sem data';
    const lib = medReleaseDates(r);
    const car = [['🥛 Leite', lib.leite], ['🥩 Carne', lib.carne]].filter(([, d]) => d).map(([l, d]) => {
      const on = d >= t, dd = daysUntil(d);
      return `<span class="car-chip${on ? ' on' : ''}">${l} ${on ? `liberado em ${fmtDateBR(d).slice(0, 5)}${dd > 0 ? ` (faltam ${dd}d)` : ' (hoje)'}` : 'liberado'}</span>`;
    }).join('');
    const animais = r.animais || [];
    const chips = animais.slice(0, 6).map(x => `<span class="tag tag-lote">#${esc(x.num)} ${esc(x.nome)}</span>`).join('') + (animais.length > 6 ? `<span class="tag">+${animais.length - 6}</span>` : '');
    return `<div class="ani-card med-card" data-click="[&quot;openMedActions&quot;,&quot;${r.id}&quot;]">
  <div class="rec-ico ${cls}">${ico}</div>
  <div class="ani-main">
    <div class="ani-top"><span class="ani-name">${esc(r.tipo || 'Medicação')}</span><span class="tag ${st.cls}">${st.label}</span></div>
    ${meds ? `<div class="med-names">${meds}</div>` : ''}
    <div class="ani-meta">📅 ${periodo} · ${animais.length} animal(is)</div>
    ${car ? `<div class="car-chips">${car}</div>` : ''}
    <div class="ani-tags">${chips}</div>
  </div>
  <button class="ani-more" data-click="[&quot;openMedActions&quot;,&quot;${r.id}&quot;]" aria-label="Ações">${ICON_DOTS}</button>
</div>`;
  }).join('');
}

export function openMedActions(id) {
  const r = state.db.medDirect.find(x => x.id === id);
  if (!r) return;
  openActionSheet({
    title: r.tipo || 'Medicação',
    sub: (r.medicamentos || []).map(m => m.nome).join(', '),
    actions: [
      { label: 'Editar', icon: '✏️', fn: () => editMedDirect(id) },
      { label: 'Repetir (nova aplicação hoje)', icon: '🔁', tone: 'info', fn: () => repeatMed(id) },
      { label: 'Excluir', icon: '🗑️', tone: 'danger', fn: () => delMedDirect(id) },
    ],
  });
}

// ---------- Formulário ----------
export function setMedTipo(v) {
  $('medTipo').value = v;
  $('segMedTipo').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
}
export function setMedMode(mode) {
  state.medMode = mode;
  $('medModeLote').classList.toggle('active', mode === 'lote');
  $('medModeIndiv').classList.toggle('active', mode === 'individual');
  $('medLoteSection').classList.toggle('hidden', mode !== 'lote');
  $('medIndivSection').classList.toggle('hidden', mode !== 'individual');
  // A lista com todos os animais só é montada quando o modo individual é usado (abre a janela mais rápido).
  if (mode === 'individual' && $('medAnimalSelect').options.length <= 1) populateMedSelect();
}
export function populateMedLoteSelect() {
  $('medLoteSelect').innerHTML = '<option value="">Selecione o lote...</option>' + [...state.db.lotes].sort(loteCmp).map(l => `<option value="${l.id}">${esc(l.name)} (${l.animals.length})</option>`).join('');
}
export function populateMedSelect() {
  $('medAnimalSelect').innerHTML = '<option value="">Selecione o animal...</option>' + sortByNum(getAllAnimals().slice()).map(a => `<option value="${esc(a.num)}|${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)} (${esc(a.loteName)})</option>`).join('');
}
export function loadMedLoteAnimals() {
  const lid = $('medLoteSelect').value;
  const l = state.db.lotes.find(x => x.id === lid);
  state.tempMedAnimals = l ? sortByNum(l.animals.map(a => ({ num: a.num, nome: a.nome, included: true }))) : [];
  renderMedLoteList();
}
export function renderMedLoteList() {
  const list = state.tempMedAnimals;
  const n = list.filter(a => a.included).length;
  $('medLoteAnimals').innerHTML = list.length ? `<div class="check-head"><span>${n} de ${list.length} selecionado(s)</span><button type="button" class="link-btn" data-click="[&quot;toggleAllMedLote&quot;]">${n === list.length ? 'Desmarcar todos' : 'Marcar todos'}</button></div>` +
    list.map((a, i) => `<label class="check-row${a.included ? ' on' : ''}"><input type="checkbox" ${a.included ? 'checked' : ''} data-change="[&quot;toggleMedAnimalIncluded&quot;,${i},&quot;$checked&quot;]"><span class="check-box"></span><span>#${esc(a.num)} ${esc(a.nome)}</span></label>`).join('') : '';
}
export function toggleAllMedLote() {
  const all = state.tempMedAnimals.every(a => a.included);
  state.tempMedAnimals.forEach(a => { a.included = !all; });
  renderMedLoteList();
}
export function toggleMedAnimalIncluded(i, checked) { state.tempMedAnimals[i].included = checked; renderMedLoteList(); }
export function addMedAnimalIndiv() {
  const sel = $('medAnimalSelect');
  if (!sel.value) return;
  const [num, nome] = sel.value.split('|');
  if (state.tempMedAnimals.find(a => a.num === num)) toast('Já adicionado', 'info');
  else state.tempMedAnimals.push({ num, nome, included: true });
  renderMedIndivList();
  sel.selectedIndex = 0;
}
export function renderMedIndivList() {
  const n = state.tempMedAnimals.length;
  $('medSelectedAnimals').innerHTML = state.tempMedAnimals.map((a, i) =>
    `<button type="button" class="pick-chip" data-click="[&quot;removeMedIndivAnimal&quot;,${i}]">#${esc(a.num)} ${esc(a.nome)}<span>✕</span></button>`).join('') + (n ? `<span class="pick-count">${n} animal(is)</span>` : '');
}
export function removeMedIndivAnimal(i) { state.tempMedAnimals.splice(i, 1); renderMedIndivList(); }

const medRowHtml = (m = {}, removable = true) => `<div class="med-row"><input class="form-input medNomeInput" placeholder="Medicamento" aria-label="Medicamento" value="${esc(m.nome || '')}"><input class="form-input medDoseInput" placeholder="Dose" aria-label="Dose" value="${esc(m.dose || '')}">${removable ? '<button type="button" class="row-del" data-click="[&quot;removeParent&quot;,&quot;$this&quot;]" aria-label="Remover medicamento">✕</button>' : ''}</div>`;
export function addMedRow() {
  $('medMedicamentos').insertAdjacentHTML('beforeend', medRowHtml());
  const inputs = $('medMedicamentos').querySelectorAll('.medNomeInput');
  inputs[inputs.length - 1]?.focus();
}
function getMedRows() {
  return [...document.querySelectorAll('#medMedicamentos .med-row')].map(r => ({
    nome: r.querySelector('.medNomeInput').value.trim(), dose: r.querySelector('.medDoseInput').value.trim(),
  })).filter(m => m.nome);
}
function setMedRows(meds) {
  const list = meds && meds.length ? meds : [{}];
  $('medMedicamentos').innerHTML = list.map((m, i) => medRowHtml(m, i > 0)).join('');
}

export function updateMedCarHint() {
  const r = { dataIni: $('medDataIni').value, dataFim: $('medDataFim').value, carenciaLeite: $('medCarLeite').value, carenciaCarne: $('medCarCarne').value };
  const lib = medReleaseDates(r);
  const parts = [];
  if (lib.leite) parts.push(`🥛 leite liberado em <b>${fmtDateBR(lib.leite)}</b>`);
  if (lib.carne) parts.push(`🥩 carne liberada em <b>${fmtDateBR(lib.carne)}</b>`);
  const el = $('medCarHint');
  el.innerHTML = parts.join(' · ') || (r.dataIni ? '' : 'Informe o início para calcular a liberação.');
}

function fillMedForm(r, asNew) {
  setMedMode('individual');
  state.tempMedAnimals = (r.animais || []).map(x => ({ num: x.num, nome: x.nome, included: true }));
  renderMedIndivList();
  populateMedSelect();
  $('medDataIni').value = asNew ? todayISO() : (r.dataIni || '');
  $('medDataFim').value = asNew ? '' : (r.dataFim || '');
  setMedTipo(r.tipo || 'Vacina');
  $('medCarLeite').value = r.carenciaLeite || '';
  $('medCarCarne').value = r.carenciaCarne || '';
  setMedRows(r.medicamentos);
  updateMedCarHint();
}
export function openNewMed() {
  state.editAniId = null;
  openModal('medAnimalModal');
}
export function editMedDirect(id) {
  const r = state.db.medDirect.find(x => x.id === id);
  if (!r) return;
  state.editAniId = id;
  fillMedForm(r, false);
  $('medAnimalModalTitle').textContent = 'Editar medicação';
  openModal('medAnimalModal');
}
export function repeatMed(id) {
  const r = state.db.medDirect.find(x => x.id === id);
  if (!r) return;
  state.editAniId = null;
  state.medRepeat = true;
  fillMedForm(r, true);
  $('medAnimalModalTitle').textContent = 'Repetir medicação';
  openModal('medAnimalModal');
}

export async function saveMedAnimal() {
  if (!requireOnline()) return;
  let animalsToSave = state.medMode === 'lote' ? state.tempMedAnimals.filter(a => a.included) : state.tempMedAnimals.filter(a => a.included !== false);
  if (!animalsToSave.length && state.medMode !== 'lote') {
    const sel = $('medAnimalSelect');
    if (sel.value) { const [num, nome] = sel.value.split('|'); animalsToSave = [{ num, nome }]; }
  }
  if (!animalsToSave.length) return toast('Escolha ao menos um animal', 'error');
  const meds = getMedRows();
  if (!meds.length) return toast('Informe ao menos um medicamento', 'error');
  const ini = $('medDataIni').value || null, fim = $('medDataFim').value || null;
  if (ini && fim && fim < ini) return toast('A data final não pode ser antes do início', 'error');

  const base = {
    data_ini: ini, data_fim: fim, tipo: $('medTipo').value,
    carencia_leite: $('medCarLeite').value || null, carencia_carne: $('medCarCarne').value || null,
  };
  const animaisRows = animalsToSave.map(a => ({ num: a.num, nome: a.nome, animal_id: resolveAid(a.num) || null }));
  await safeRun(async () => {
    // Tudo numa transação no banco (salvar_medicacao); sem a função, cai no caminho antigo.
    const medicacaoId = await rpcOr('salvar_medicacao', { p_id: state.editAniId || null, p_dados: base, p_medicamentos: meds, p_animais: animaisRows }, async () => {
      let id = state.editAniId;
      if (id) {
        await dbUpdate('medicacoes', id, base);
        await dbDeleteWhere('medicacao_medicamentos', 'medicacao_id', id);
        await dbDeleteWhere('medicacao_animais', 'medicacao_id', id);
      } else {
        id = (await dbInsert('medicacoes', base)).id;
      }
      await dbInsertMany('medicacao_medicamentos', meds.map(m => ({ medicacao_id: id, nome: m.nome, dose: m.dose || null })));
      await dbInsertMany('medicacao_animais', animaisRows.map(a => ({ medicacao_id: id, ...a })));
      return id;
    });
    const entry = {
      id: medicacaoId, dataIni: ini || '', dataFim: fim || '', tipo: base.tipo,
      carenciaLeite: base.carencia_leite || '', carenciaCarne: base.carencia_carne || '',
      medicamentos: meds, animais: animalsToSave.map(a => ({ num: a.num, nome: a.nome, aid: resolveAid(a.num) || '' })),
    };
    const idx = state.db.medDirect.findIndex(x => x.id === medicacaoId);
    if (idx >= 0) state.db.medDirect[idx] = entry; else state.db.medDirect.unshift(entry);
    closeModal('medAnimalModal');
    renderMedDirect();
  }, 'Medicação salva!');
}

export async function delMedDirect(id) {
  const ok = await showConfirm('Excluir este registro de medicação?' + (state.caps.trash ? ' Ele fica 30 dias na lixeira.' : ''), '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    const r = await softDelete('medicacoes', id);
    if (r === 'trash') bumpTrash();
    state.db.medDirect = state.db.medDirect.filter(x => x.id !== id);
    renderMedDirect();
    toast(r === 'trash' ? 'Medicação movida para a lixeira' : 'Medicação excluída');
  }).catch(() => {});
}

registerModalSetup('medAnimalModal', () => {
  populateMedLoteSelect();
  $('medAnimalSelect').innerHTML = '<option value="">Selecione o animal...</option>';
  if (state.medMode === 'individual') populateMedSelect();
  if (!state.editAniId && !state.medRepeat) {
    // Novo registro
    $('medAnimalModalTitle').textContent = 'Nova medicação';
    state.tempMedAnimals = [];
    setMedMode('lote');
    setMedTipo('Vacina');
    setMedRows([]);
    renderMedLoteList();
    renderMedIndivList();
    $('medDataIni').value = todayISO();
    updateMedCarHint();
  }
  state.medRepeat = false;
});
registerModalTeardown('medAnimalModal', () => {
  $('medLoteAnimals').innerHTML = '';
  $('medSelectedAnimals').innerHTML = '';
  $('medCarHint').innerHTML = '';
});

registerPageEnter('pageMedicacao', renderMedDirect);
