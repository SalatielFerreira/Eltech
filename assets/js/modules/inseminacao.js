// ========== INSEMINAÇÃO ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, registerPageEnter, registerModalSetup, registerModalTeardown, registerAnimalSelectProvider, refresh, openActionSheet, ensureBackBuffer, callAction, skeletonHtml } from './ui.js';
import { dbInsert, dbInsertMany, dbUpdate, dbDelete, softDelete, getAllAnimals, sortByNum, loteCmp, resolveAid, todayISO, fmtDateBR, ageDays } from './data.js';
import { bumpTrash } from './lixeira.js';
import { SIT_OPTIONS } from './constants.js';
import { ICON_DOTS, emptyStateHtml, sitTag } from './animalRow.js';

const $ = id => document.getElementById(id);
const ICON_FLASK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 001.3 2.2h12.4a1.5 1.5 0 001.3-2.2L14 9.5V3"/><path d="M7 15h10"/></svg>';
const PARECER_INFO = {
  'Prenha': { icon: '✅', cls: 'pv-ok', desc: 'Confirmada' },
  'Vazia': { icon: '⭕', cls: 'pv-warn', desc: 'Não emprenhou' },
  'Vazia Cloe': { icon: '🟡', cls: 'pv-warn', desc: 'Vazia (Cloe)' },
  'Vazia Clod': { icon: '🟠', cls: 'pv-warn', desc: 'Vazia (Clod)' },
  'Cio': { icon: '💗', cls: 'pv-cio', desc: 'Voltou ao cio' },
  'Anestro': { icon: '⛔', cls: 'pv-bad', desc: 'Sem ciclo' },
};
let insemFilter = 'all';

function eligibleAnimals() {
  return getAllAnimals().filter(a => a.sexo !== 'Macho' && a.cat !== 'Bezerra' && a.sit !== 'Anestro');
}
registerAnimalSelectProvider('insem', () => sortByNum(eligibleAnimals()));

function planStats(p) {
  const total = p.animals.length;
  const prenhas = p.animals.filter(r => r.parecer === 'Prenha').length;
  const vazias = p.animals.filter(r => r.parecer && r.parecer !== 'Prenha').length;
  return { total, prenhas, vazias, aguardando: total - prenhas - vazias };
}

// ---------- Lista de planilhas + indicadores ----------
function renderInsemKpis() {
  const recs = state.db.inseminacao.flatMap(p => p.animals);
  const ult30 = recs.filter(r => r.data && ageDays(r.data) >= 0 && ageDays(r.data) <= 30).length;
  const aguard = recs.filter(r => !r.parecer).length;
  const prenhas = recs.filter(r => r.parecer === 'Prenha').length;
  const comParecer = recs.filter(r => r.parecer).length;
  const taxa = comParecer ? Math.round(prenhas / comParecer * 100) + '%' : '—';
  const kpi = (v, l, cls = '') => `<div class="kpi${cls}"><div class="kpi-val">${v}</div><div class="kpi-lbl">${l}</div></div>`;
  $('insemKpis').innerHTML = kpi(ult30, 'Últimos 30 dias') + kpi(aguard, 'Aguardando', aguard ? ' kpi-warn' : '') + kpi(prenhas, 'Prenhas') + kpi(taxa, 'Concepção');
  $('insemSub').textContent = `${state.db.inseminacao.length} planilha(s) · ${recs.length} registro(s)`;
}

export function renderPlanilhas() {
  const el = $('insemPlanilhas');
  if (!state.loaded) { $('insemKpis').innerHTML = ''; el.innerHTML = skeletonHtml(3); return; }
  renderInsemKpis();
  const sorted = [...state.db.inseminacao].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!sorted.length) {
    el.innerHTML = emptyStateHtml('Nenhuma planilha criada. Crie uma planilha (ex.: por mês) para registrar as inseminações.', { label: 'Criar planilha', action: ['openModal', 'planilhaModal'] });
    return;
  }
  el.innerHTML = sorted.map(p => {
    const s = planStats(p);
    const pct = v => (s.total ? (v / s.total * 100).toFixed(1) : 0) + '%';
    const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString('pt-BR') : '';
    return `<div class="plan-card" data-click="[&quot;openInsemDetail&quot;,&quot;${p.id}&quot;]">
  <div class="plan-top">
    <div class="lote-ico ico-gold">${ICON_FLASK}</div>
    <div class="lote-main"><div class="lote-name">${esc(p.name)}</div><div class="lote-meta">${s.total} registro(s)${dateStr ? ' · criada em ' + dateStr : ''}</div></div>
    <button class="ani-more" data-click="[&quot;openPlanActions&quot;,&quot;${p.id}&quot;]" aria-label="Opções da planilha">${ICON_DOTS}</button>
  </div>
  ${s.total ? `<div class="stackbar"><span class="sb-ok" style="width:${pct(s.prenhas)}"></span><span class="sb-bad" style="width:${pct(s.vazias)}"></span><span class="sb-wait" style="width:${pct(s.aguardando)}"></span></div>
  <div class="plan-legend"><span><i class="dot dot-ok"></i>${s.prenhas} prenha(s)</span><span><i class="dot dot-bad"></i>${s.vazias} vazia(s)</span><span><i class="dot dot-wait"></i>${s.aguardando} aguardando</span></div>` : ''}
</div>`;
  }).join('');
}

export function openPlanActions(id = state.currentPlanId) {
  const p = state.db.inseminacao.find(x => x.id === id);
  if (!p) return;
  const inDetail = !$('insemDetail').classList.contains('hidden') && state.currentPlanId === id;
  openActionSheet({
    title: p.name, sub: `${p.animals.length} registro(s)`,
    actions: [
      ...(inDetail ? [] : [{ label: 'Abrir planilha', icon: '📂', fn: () => openInsemDetail(id) }]),
      { label: 'Adicionar inseminação', icon: '➕', fn: () => { state.currentPlanId = id; openInsemAnimalForPlan(); } },
      { label: 'Renomear planilha', icon: '✏️', fn: () => editPlanFromCard(id) },
      { label: 'Excluir planilha', icon: '🗑️', tone: 'danger', fn: () => delPlan(id) },
    ],
  });
}

export function editPlanFromCard(id) {
  const p = state.db.inseminacao.find(x => x.id === id);
  if (!p) return;
  state.editPlanId = id;
  $('planilhaNome').value = p.name;
  $('planilhaModalTitle').textContent = 'Renomear planilha';
  openModal('planilhaModal');
}

export async function savePlanilha() {
  if (!requireOnline()) return;
  const name = $('planilhaNome').value.trim();
  if (!name) return toast('Digite o nome', 'error');
  await safeRun(async () => {
    if (state.editPlanId) {
      await dbUpdate('inseminacao_planilhas', state.editPlanId, { name });
      const p = state.db.inseminacao.find(x => x.id === state.editPlanId);
      if (p) p.name = name;
      if (state.currentPlanId === state.editPlanId) $('insemDetailTitle').textContent = name;
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
  const p = state.db.inseminacao.find(x => x.id === id);
  if (!p) return;
  const fim = state.caps.trash ? ' Ela fica 30 dias na lixeira.' : '';
  const ok = await showConfirm((p.animals.length ? `Excluir a planilha "${p.name}" e os ${p.animals.length} registro(s) dela?` : `Excluir a planilha "${p.name}"?`) + fim, '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    const r = await softDelete('inseminacao_planilhas', id);
    if (r === 'trash') bumpTrash();
    state.db.inseminacao = state.db.inseminacao.filter(x => x.id !== id);
    if (state.currentPlanId === id) backToList();
    else renderPlanilhas();
    toast(r === 'trash' ? 'Planilha movida para a lixeira' : 'Planilha excluída');
  }).catch(() => {});
}

export function openInsemDetail(id) {
  const p = state.db.inseminacao.find(x => x.id === id);
  if (!p) return;
  state.currentPlanId = id;
  $('insemList').classList.add('hidden');
  $('insemDetail').classList.remove('hidden');
  $('insemDetailTitle').textContent = p.name;
  $('searchInseminacao').value = '';
  setInsemFilter('all');
  document.querySelector('.page-content').scrollTop = 0;
  ensureBackBuffer();
}
export function backToList() {
  $('insemDetail').classList.add('hidden');
  $('insemList').classList.remove('hidden');
  state.currentPlanId = null;
  renderPlanilhas();
}

// ---------- Registros de uma planilha ----------
export function setInsemFilter(v) {
  insemFilter = v;
  $('insemFilter').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  renderAnimals();
}

export function renderAnimals() {
  const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
  if (!p) return;
  const s = planStats(p);
  $('insemDetailSub').textContent = `${s.total} registro(s) · ${s.prenhas} prenha(s) · ${s.aguardando} aguardando`;
  const container = $('insemAnimals');
  const q = ($('searchInseminacao')?.value || '').toLowerCase().trim();
  let recs = p.animals.filter(r => {
    if (q && ![r.num, r.nome, r.touro].some(v => (v || '').toLowerCase().includes(q))) return false;
    if (insemFilter === 'aguardando') return !r.parecer;
    if (insemFilter === 'prenha') return r.parecer === 'Prenha';
    if (insemFilter === 'vazia') return r.parecer && r.parecer !== 'Prenha';
    return true;
  });
  sortByNum(recs);
  if (!recs.length) {
    container.innerHTML = p.animals.length ? emptyStateHtml('Nenhum registro com esse filtro.')
      : emptyStateHtml('Nenhuma inseminação nesta planilha.', { label: 'Registrar inseminação', action: ['openInsemAnimalForPlan'] });
    return;
  }
  container.innerHTML = recs.map(r => {
    const dias = r.data ? ageDays(r.data) : '';
    const pronta = !r.parecer && dias !== '' && dias >= 28;
    const info = PARECER_INFO[r.parecer];
    const status = r.parecer ? sitTag(r.parecer) : `<span class="tag ${pronta ? 'tag-warn' : 'tag-wait'}">${pronta ? 'Pronta p/ diagnóstico' : 'Aguardando'}</span>`;
    const meta = [r.data ? fmtDateBR(r.data) + (dias !== '' ? ` (há ${dias}d)` : '') : 'Sem data', r.touro ? 'Touro ' + esc(r.touro) : ''].filter(Boolean).join(' · ');
    return `<div class="ani-card rec-card" data-click="[&quot;openInsemRecActions&quot;,&quot;${r.id}&quot;]">
  <div class="rec-ico ${info ? info.cls : pronta ? 'pv-warn' : 'pv-wait'}">${info ? info.icon : '🔬'}</div>
  <div class="ani-main">
    <div class="ani-top"><span class="ani-num">#${esc(r.num)}</span><span class="ani-name">${esc(r.nome)}</span></div>
    <div class="ani-tags">${status}${r.muco ? `<span class="tag">Muco ${esc(r.muco)}</span>` : ''}${r.tempo ? `<span class="tag">${esc(r.tempo)}</span>` : ''}</div>
    <div class="ani-meta">${meta}</div>
    ${r.obs ? `<div class="ani-meta ani-obs">“${esc(r.obs)}”</div>` : ''}
    ${!r.parecer ? `<button class="pill-btn" data-click="[&quot;openParecer&quot;,&quot;${r.id}&quot;]">Dar diagnóstico</button>` : ''}
  </div>
  <button class="ani-more" data-click="[&quot;openInsemRecActions&quot;,&quot;${r.id}&quot;]" aria-label="Ações">${ICON_DOTS}</button>
</div>`;
  }).join('');
}

export function openInsemRecActions(recId) {
  const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
  const r = p?.animals.find(x => x.id === recId);
  if (!r) return;
  const aid = r.aid || resolveAid(r.num);
  openActionSheet({
    title: `#${r.num} ${r.nome}`,
    sub: r.data ? 'Inseminada em ' + fmtDateBR(r.data) : '',
    actions: [
      { label: r.parecer ? `Alterar diagnóstico (${r.parecer})` : 'Dar diagnóstico', icon: '🩺', fn: () => openParecer(recId) },
      ...(aid ? [{ label: 'Ver ficha do animal', icon: '📋', fn: () => callAction('openFicha', aid) }] : []),
      { label: 'Editar registro', icon: '✏️', fn: () => editInsemAnimal(recId) },
      { label: 'Excluir registro', icon: '🗑️', tone: 'danger', fn: () => delInsemAnimal(recId) },
    ],
  });
}

// ---------- Formulário ----------
export function populateInsemSelect() {
  const sel = $('insemAnimalSelect');
  sel.innerHTML = '<option value="">Selecione o animal...</option>' + sortByNum(eligibleAnimals()).map(a => `<option value="${esc(a.num)}|${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)} (${esc(a.loteName)})</option>`).join('');
}
export function populateInsemPlanSelect() {
  const sel = $('insemPlanSelect');
  const prev = sel.value;
  sel.innerHTML = '<option value="">Selecione a planilha...</option>' + [...state.db.inseminacao].sort(loteCmp).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  if (prev) sel.value = prev;
}
export function setInsemMuco(v) {
  $('insemMuco').value = v;
  $('segMuco').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
}
function prepareInsemForm(planId) {
  if (!state.db.inseminacao.length) {
    toast('Crie uma planilha antes de registrar inseminações', 'info');
    openModal('planilhaModal');
    return false;
  }
  state.editAniId = null;
  state.tempInsemAnimals = [];
  populateInsemPlanSelect();
  populateInsemSelect();
  $('insemPlanSelect').value = planId || (state.db.inseminacao.length === 1 ? state.db.inseminacao[0].id : '');
  $('insemData').value = todayISO();
  setInsemMuco('Bom');
  renderTempInsemAnimals();
  $('insemAnimalModalTitle').textContent = 'Nova inseminação';
  $('insemPickHint').classList.remove('hidden');
  return true;
}
export function openInsemAnimalDirect() { if (prepareInsemForm('')) openModal('insemAnimalModal'); }
export function openInsemAnimalForPlan() { if (prepareInsemForm(state.currentPlanId)) openModal('insemAnimalModal'); }

export function addInsemAnimal() {
  if (state.editAniId) return; // na edição o animal é o próprio valor do select
  const sel = $('insemAnimalSelect');
  if (!sel.value) return;
  const [num, nome] = sel.value.split('|');
  if (!state.tempInsemAnimals.find(a => a.num === num)) state.tempInsemAnimals.push({ num, nome });
  else toast('Já adicionado', 'info');
  renderTempInsemAnimals();
  sel.selectedIndex = 0;
}
export function renderTempInsemAnimals() {
  const n = state.tempInsemAnimals.length;
  $('insemSelectedAnimals').innerHTML = state.tempInsemAnimals.map((a, i) =>
    `<button type="button" class="pick-chip" data-click="[&quot;removeTempInsemAnimal&quot;,${i}]" aria-label="Remover">#${esc(a.num)} ${esc(a.nome)}<span>✕</span></button>`).join('') +
    (n ? `<span class="pick-count">${n} animal(is)</span>` : '');
}
export function removeTempInsemAnimal(i) { state.tempInsemAnimals.splice(i, 1); renderTempInsemAnimals(); }

export async function saveInsemAnimal() {
  if (!requireOnline()) return;
  const planId = $('insemPlanSelect').value;
  if (!planId) return toast('Selecione uma planilha', 'error');
  const p = state.db.inseminacao.find(x => x.id === planId);
  if (!p) return toast('Planilha não encontrada', 'error');
  const editing = state.editAniId;
  const oldPlan = editing ? state.db.inseminacao.find(pl => pl.animals.some(r => r.id === editing)) : null;

  let animalsToSave = [];
  const sel = $('insemAnimalSelect');
  if (editing) {
    const ex = oldPlan?.animals.find(x => x.id === editing);
    if (ex) animalsToSave = [{ num: ex.num, nome: ex.nome }];
    if (sel.value) { const [num, nome] = sel.value.split('|'); animalsToSave = [{ num, nome }]; }
  } else {
    animalsToSave = [...state.tempInsemAnimals];
    if (!animalsToSave.length && sel.value) { const [num, nome] = sel.value.split('|'); animalsToSave = [{ num, nome }]; }
  }
  if (!animalsToSave.length) return toast('Escolha ao menos um animal', 'error');
  const data = $('insemData').value || null;
  if (data && data > todayISO()) return toast('A data da inseminação não pode ser futura', 'error');

  const base = { data, tempo: $('insemTempo').value.trim(), touro: $('insemTouro').value.trim(), muco: $('insemMuco').value, obs: $('insemObs').value.trim() };
  await safeRun(async () => {
    if (editing) {
      const animalId = resolveAid(animalsToSave[0].num) || null;
      await dbUpdate('inseminacao_registros', editing, { planilha_id: planId, num: animalsToSave[0].num, nome: animalsToSave[0].nome, animal_id: animalId, ...base });
      // Move o registro de planilha em memória, se mudou
      const rec = oldPlan?.animals.find(x => x.id === editing);
      if (rec) {
        Object.assign(rec, base, { data: base.data || '', num: animalsToSave[0].num, nome: animalsToSave[0].nome, aid: animalId || '' });
        if (oldPlan !== p) { oldPlan.animals = oldPlan.animals.filter(x => x.id !== editing); p.animals.push(rec); }
      }
    } else {
      const rows = await dbInsertMany('inseminacao_registros', animalsToSave.map(an => ({
        planilha_id: planId, num: an.num, nome: an.nome, animal_id: resolveAid(an.num) || null, ...base,
      })));
      rows.forEach(row => p.animals.push({ id: row.id, aid: row.animal_id || '', num: row.num, nome: row.nome, data: row.data || '', tempo: row.tempo || '', touro: row.touro || '', muco: row.muco || '', obs: row.obs || '', parecer: '', parecerData: '' }));
    }
    state.tempInsemAnimals = [];
    closeModal('insemAnimalModal');
    if (state.currentPlanId) renderAnimals();
    renderPlanilhas();
  }, editing ? 'Registro atualizado!' : animalsToSave.length > 1 ? `${animalsToSave.length} inseminações salvas!` : 'Inseminação salva!');
}

export function editInsemAnimal(recId) {
  const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
  const a = p?.animals.find(x => x.id === recId);
  if (!a) return;
  state.editAniId = recId;
  state.tempInsemAnimals = [];
  populateInsemPlanSelect();
  populateInsemSelect();
  $('insemPlanSelect').value = state.currentPlanId;
  const sel = $('insemAnimalSelect');
  const v = a.num + '|' + a.nome;
  if (![...sel.options].some(o => o.value === v)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">#${esc(a.num)} - ${esc(a.nome)}</option>`);
  sel.value = v;
  $('insemData').value = a.data || '';
  $('insemTempo').value = a.tempo || '';
  $('insemTouro').value = a.touro || '';
  setInsemMuco(a.muco || 'Bom');
  $('insemObs').value = a.obs || '';
  renderTempInsemAnimals();
  $('insemPickHint').classList.add('hidden');
  $('insemAnimalModalTitle').textContent = `Editar #${a.num} ${a.nome}`;
  openModal('insemAnimalModal');
}
export async function delInsemAnimal(recId) {
  const ok = await showConfirm('Excluir este registro de inseminação?', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('inseminacao_registros', recId);
    const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
    if (p) p.animals = p.animals.filter(x => x.id !== recId);
    renderAnimals();
  }, 'Registro excluído');
}

// ---------- Parecer (diagnóstico) ----------
export function openParecer(recId) {
  const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
  const rec = p?.animals.find(x => x.id === recId);
  if (!rec) return;
  state.parecerRecId = recId;
  const dias = rec.data ? ageDays(rec.data) : '';
  $('parecerAnimalName').innerHTML = `<div class="ani-top"><span class="ani-num">#${esc(rec.num)}</span><span class="ani-name">${esc(rec.nome)}</span></div>
    <div class="ani-meta">${rec.data ? `Inseminada em ${fmtDateBR(rec.data)} (há ${dias} dias)` : 'Sem data de inseminação'}${rec.touro ? ' · Touro ' + esc(rec.touro) : ''}</div>`;
  const cur = rec.parecer || '';
  const ordem = ['Prenha', ...SIT_OPTIONS.filter(o => o !== 'Prenha')];
  $('parecerOptions').innerHTML = ordem.map(o => {
    const info = PARECER_INFO[o] || { icon: '•', cls: '', desc: '' };
    return `<button type="button" class="parecer-opt ${info.cls}${o === cur ? ' active' : ''}" data-click="[&quot;setParecer&quot;,&quot;${o}&quot;]"><span class="po-ico">${info.icon}</span><b>${o}</b><small>${info.desc}</small></button>`;
  }).join('');
  openModal('parecerModal');
}
export async function setParecer(sit) {
  if (!requireOnline()) return;
  const p = state.db.inseminacao.find(x => x.id === state.currentPlanId);
  const rec = p?.animals.find(x => x.id === state.parecerRecId);
  if (!rec) return;
  const parecerData = todayISO();
  await safeRun(async () => {
    await dbUpdate('inseminacao_registros', rec.id, { parecer: sit, parecer_data: parecerData });
    rec.parecer = sit;
    rec.parecerData = parecerData;
    const animaisAtualizados = [];
    state.db.lotes.forEach(l => l.animals.forEach(a => {
      if ((rec.aid && a.id === rec.aid) || String(a.num) === String(rec.num)) {
        a.sit = sit;
        a.prenhaData = sit === 'Prenha' ? (rec.data || '') : '';
        animaisAtualizados.push(a);
      }
    }));
    await Promise.all(animaisAtualizados.map(a => dbUpdate('animais', a.id, { sit: a.sit, prenha_data: a.prenhaData || null })));
    closeModal('parecerModal');
    renderAnimals();
    refresh('rebanho');
    toast(animaisAtualizados.length ? 'Diagnóstico salvo: ' + sit : 'Diagnóstico salvo (animal não encontrado no rebanho)');
  });
}

registerModalSetup('insemAnimalModal', () => { if (!$('insemMuco').value) setInsemMuco('Bom'); });
registerModalTeardown('insemAnimalModal', () => {
  $('insemSelectedAnimals').innerHTML = '';
  $('insemPickHint').classList.remove('hidden');
});
registerModalSetup('planilhaModal', () => {
  if (!state.editPlanId) $('planilhaModalTitle').textContent = 'Nova planilha';
  setTimeout(() => $('planilhaNome')?.focus(), 250);
});

registerPageEnter('pageInseminacao', () => {
  $('insemList')?.classList.remove('hidden');
  $('insemDetail')?.classList.add('hidden');
  state.currentPlanId = null;
  renderPlanilhas();
});
