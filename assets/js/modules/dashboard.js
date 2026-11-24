// ========== INÍCIO (saudação, atalhos, painel da fazenda, alertas, gráfico) ==========
import { state } from '../state.js';
import { esc, toast, registerPageEnter, openModal, goPage, callAction, act, skeletonHtml } from './ui.js';
import { getAllAnimals, todayISO, fmtDateBR, buildAnimalLookup } from './data.js';
import { drawPie, COLORS } from './charts.js';
import { GESTACAO_DIAS } from './constants.js';

let alertsExpanded = false;
const ALERTS_VISIBLE = 5;

export function setChartFilter(f, btn) {
  state.chartFilter = f;
  document.querySelectorAll('#chartFilters .chip').forEach(c => c.classList.toggle('active', c === btn));
  renderChart();
}

// Atalhos da tela inicial: levam à página certa e já abrem o formulário.
export function quickAction(kind) {
  const map = { animal: ['pageRebanho', 'openNewAnimal'], insem: ['pageInseminacao', 'openInsemAnimalDirect'], med: ['pageMedicacao', 'openNewMed'], ali: ['pageAlimentacao', 'openNewAli'] };
  const [page, fn] = map[kind] || [];
  if (!page) return;
  goPage(page);
  state.ready.then(() => callAction(fn)); // formulários precisam dos dados completos
}

export function toggleAlerts() { alertsExpanded = !alertsExpanded; renderHomeAlerts(); }

export function renderHome() {
  if (!state.db) return;
  renderHero();
  renderFarmPanel();
  renderHomeAlerts();
  renderChart();
}

// ---------- Saudação ----------
function renderHero() {
  const all = getAllAnimals();
  const h = new Date().getHours();
  const [greet, icon] = h < 12 ? ['Bom dia', '☀️'] : h < 18 ? ['Boa tarde', '🌤️'] : ['Boa noite', '🌙'];
  const leite = all.filter(a => a.cat === 'Vaca em lactação').reduce((s, a) => s + (parseFloat(a.leite) || 0), 0);
  const d0 = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const date = d0.charAt(0).toUpperCase() + d0.slice(1);
  document.getElementById('homeHero').innerHTML = `
    <div class="hero-top">
      <div><div class="hero-greet">${greet},</div><div class="hero-name">${esc(state.db.user.name || 'Usuário')}</div><div class="hero-date">${date}</div></div>
      <div class="hero-icon">${icon}</div>
    </div>
    <div class="hero-stats">
      <div><b>${all.length}</b><span>animais</span></div>
      <div><b>${state.db.lotes.length}</b><span>lotes</span></div>
      <div><b>${leite.toFixed(0)}<small> L</small></b><span>leite/dia</span></div>
    </div>`;
}

// ---------- Painel da fazenda ----------
export function renderFarmPanel() {
  const c = document.getElementById('farmPanel');
  if (!c) return;
  const all = getAllAnimals();
  if (!all.length) {
    c.innerHTML = `<div class="empty-card"><div class="empty-ico">🐄</div><p>Bem-vindo ao FARM! Comece criando um lote e cadastrando seus animais.</p><button class="btn btn-primary btn-sm" data-click="[&quot;quickAction&quot;,&quot;animal&quot;]">Cadastrar primeiro animal</button></div>`;
    return;
  }
  const lact = all.filter(a => a.cat === 'Vaca em lactação');
  const leiteMedio = lact.length ? lact.reduce((s, a) => s + (parseFloat(a.leite) || 0), 0) / lact.length : 0;
  const femAptas = all.filter(a => a.sexo === 'Fêmea' && a.cat !== 'Bezerra');
  const prenhas = femAptas.filter(a => a.sit === 'Prenha').length;
  const taxa = femAptas.length ? Math.round(prenhas / femAptas.length * 100) : 0;
  const custoAli = state.db.aliDirect.reduce((s, r) => s + parseFloat(r.custoTotal || 0), 0);
  const t = todayISO();
  const emTrat = state.db.medDirect.filter(r => r.dataIni && r.dataIni <= t && (!r.dataFim || r.dataFim >= t)).length;
  // Anel da taxa de prenhez (SVG)
  const R = 26, C = 2 * Math.PI * R, off = C * (1 - taxa / 100);
  const ring = `<svg class="ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" class="ring-bg"/><circle cx="32" cy="32" r="${R}" class="ring-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>`;
  const tile = (ico, val, lbl, extra = '') => `<div class="ptile${extra}"><span class="ptile-ico">${ico}</span><div class="ptile-val">${val}</div><div class="ptile-lbl">${lbl}</div></div>`;
  c.innerHTML = `<div class="panel-card">
    <div class="card-head"><h3>Painel da fazenda</h3></div>
    <div class="panel-grid">
      <div class="ptile ptile-ring"><div class="ring-wrap">${ring}<b class="ring-val">${taxa}%</b></div><div class="ring-info"><div class="ring-title">Taxa de prenhez</div><div class="ring-sub">${prenhas} prenha(s) de ${femAptas.length} fêmeas aptas</div></div></div>
      ${tile('🥛', lact.length, 'em lactação')}
      ${tile('📊', leiteMedio.toFixed(1) + '<small> L</small>', 'média por vaca')}
      ${tile('💊', emTrat, 'em tratamento', emTrat ? ' ptile-warn' : '')}
      ${tile('🌾', 'R$ ' + custoAli.toLocaleString('pt-BR', { maximumFractionDigits: 0 }), 'custo de ração')}
    </div></div>`;
}

// ---------- Alertas (medicação, carência, reprodução) ----------
export function getAlerts() {
  const alerts = [];
  const today = new Date(); today.setHours(12, 0, 0, 0); // meio-dia: mesma base das datas (T12:00)
  const todayTs = today.getTime();
  const fmt = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return d; };
  const dleft = d => Math.round((d.getTime() - todayTs) / 86400000);
  const all = getAllAnimals();

  state.db.medDirect.forEach(rec => {
    const animais = rec.animais || [];
    const nomes = animais.slice(0, 6).map(a => '#' + esc(a.num)).join(', ') + (animais.length > 6 ? ` +${animais.length - 6}` : '');
    const base = rec.dataFim || rec.dataIni;
    if (rec.dataIni) {
      const ini = new Date(rec.dataIni + 'T12:00').getTime();
      const fim = rec.dataFim ? new Date(rec.dataFim + 'T12:00').getTime() : null;
      if (todayTs >= ini && (fim === null || todayTs <= fim)) alerts.push({ kind: 'med', pri: 3, icon: '💊', tone: 'info', title: esc(rec.tipo || 'Medicação') + ' em andamento', detail: nomes + (rec.dataFim ? ' · até ' + fmt(new Date(rec.dataFim + 'T12:00')) : ''), page: 'pageMedicacao' });
    }
    if (base && rec.carenciaLeite) {
      const end = addDays(base, parseInt(rec.carenciaLeite, 10) || 0), dd = dleft(end);
      if (dd >= 0) alerts.push({ kind: 'car', pri: 1, icon: '🥛', tone: 'bad', title: 'Não vender o leite', detail: nomes + ' · liberado ' + fmt(end) + (dd === 0 ? ' (hoje)' : ` (faltam ${dd}d)`), page: 'pageMedicacao' });
    }
    if (base && rec.carenciaCarne) {
      const end = addDays(base, parseInt(rec.carenciaCarne, 10) || 0), dd = dleft(end);
      if (dd >= 0) alerts.push({ kind: 'car', pri: 2, icon: '🥩', tone: 'bad', title: 'Não abater', detail: nomes + ' · liberado ' + fmt(end) + (dd === 0 ? ' (hoje)' : ` (faltam ${dd}d)`), page: 'pageMedicacao' });
    }
  });

  // Última inseminação de cada animal, identificado pelo ID (nº só para registros antigos).
  const lk = buildAnimalLookup();
  const lastInsem = {};
  state.db.inseminacao.forEach(p => p.animals.forEach(r => {
    const key = lk.idOf(r.aid, r.num) || '#' + r.num;
    if (r.data && (!lastInsem[key] || r.data > lastInsem[key].data)) lastInsem[key] = { data: r.data, nome: r.nome, num: r.num, parecer: r.parecer };
  }));
  all.forEach(a => {
    if (a.sit !== 'Prenha') return;
    const base = a.prenhaData || (lastInsem[a.id] && lastInsem[a.id].data);
    if (!base) return;
    const exp = addDays(base, GESTACAO_DIAS), dd = dleft(exp);
    if (dd <= 15 && dd >= -20) alerts.push({ kind: 'repro', pri: 1, icon: '🐄', tone: 'warn', title: dd < 0 ? 'Parto pode ter passado' : 'Parto próximo', detail: `#${esc(a.num)} ${esc(a.nome)} · ${fmt(exp)}` + (dd >= 0 ? ` (em ${dd}d)` : ` (${-dd}d atrás)`), aid: a.id });
    if (dd <= 65 && dd >= 50 && a.cat !== 'Vaca seca') alerts.push({ kind: 'repro', pri: 2, icon: '🌾', tone: 'info', title: 'Hora de secar a vaca', detail: `#${esc(a.num)} ${esc(a.nome)} · parto em ${dd}d — secar ~60d antes`, aid: a.id });
  });
  Object.keys(lastInsem).forEach(key => {
    const a = lk.byId.get(key);
    const li = lastInsem[key];
    const since = Math.round((todayTs - new Date(li.data + 'T12:00').getTime()) / 86400000);
    if (since >= 28 && since <= 60 && !li.parecer && (!a || a.sit !== 'Prenha')) alerts.push({ kind: 'repro', pri: 3, icon: '🔬', tone: 'gold', title: 'Fazer diagnóstico de prenhez', detail: `#${esc(li.num)} ${esc(li.nome)} · inseminada há ${since}d`, aid: a?.id, page: a ? null : 'pageInseminacao' });
  });
  return alerts.sort((x, y) => x.pri - y.pri);
}

export function renderHomeAlerts() {
  const c = document.getElementById('homeAlerts');
  if (!c) return;
  if (!state.loaded) { c.innerHTML = `<div class="alerts-card"><div class="card-head"><h3>Alertas</h3></div>${skeletonHtml(2)}</div>`; return; }
  const alerts = getAlerts();
  if (!alerts.length) {
    c.innerHTML = getAllAnimals().length ? `<div class="alerts-card alerts-ok"><span class="al-ico">✅</span><div><b>Tudo em dia</b><small>Nenhum alerta de carência, parto ou diagnóstico.</small></div></div>` : '';
    return;
  }
  const counts = { car: 0, repro: 0, med: 0 };
  alerts.forEach(a => counts[a.kind]++);
  const shown = alertsExpanded ? alerts : alerts.slice(0, ALERTS_VISIBLE);
  const item = a => {
    const click = a.aid ? act('openFicha', a.aid) : a.page ? act('goPage', a.page) : '';
    return `<div class="al-item al-${a.tone}" ${click}><span class="al-ico">${a.icon}</span><div class="al-txt"><b>${a.title}</b><small>${a.detail}</small></div>${click ? '<svg class="al-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' : ''}</div>`;
  };
  c.innerHTML = `<div class="alerts-card">
    <div class="card-head"><h3>Alertas <span class="count-pill">${alerts.length}</span></h3></div>
    <div class="al-summary">${counts.car ? `<span class="al-sum al-bad">${counts.car} carência</span>` : ''}${counts.repro ? `<span class="al-sum al-warn">${counts.repro} reprodução</span>` : ''}${counts.med ? `<span class="al-sum al-info">${counts.med} tratamento</span>` : ''}</div>
    ${shown.map(item).join('')}
    ${alerts.length > ALERTS_VISIBLE ? `<button class="link-btn al-more" data-click="[&quot;toggleAlerts&quot;]">${alertsExpanded ? 'Mostrar menos' : `Ver todos os ${alerts.length} alertas`}</button>` : ''}
  </div>`;
}

// ---------- Gráfico do rebanho ----------
const CHART_LABEL = { categoria: 'por categoria', sexo: 'por sexo', situacao: 'por situação', raca: 'por raça', lote: 'por lote', medicado: 'medicados', inseminado: 'inseminados', origem: 'por origem' };
function renderChart() {
  const all = getAllAnimals();
  const today = todayISO();
  const counts = {};
  const f = state.chartFilter;
  if (f === 'lote') state.db.lotes.forEach(l => { if (l.animals.length) counts[l.name] = l.animals.length; });
  else if (f === 'medicado') {
    const medNums = new Set();
    state.db.medDirect.forEach(rec => { if (!rec.dataFim || rec.dataFim >= today) (rec.animais || []).forEach(a => { if (a.num) medNums.add(a.num); }); });
    let mc = 0; all.forEach(a => { if (medNums.has(a.num)) mc++; });
    if (mc) counts['Em medicação'] = mc;
    if (all.length - mc) counts['Sem medicação'] = all.length - mc;
  } else if (f === 'inseminado') {
    const insemNums = new Set();
    state.db.inseminacao.forEach(p => p.animals.forEach(a => insemNums.add(a.num)));
    let ic = 0; all.forEach(a => { if (insemNums.has(a.num)) ic++; });
    if (ic) counts['Inseminado'] = ic;
    if (all.length - ic) counts['Não inseminado'] = all.length - ic;
  } else {
    const key = { categoria: a => a.cat, sexo: a => a.sexo, situacao: a => a.sit || 'Não se aplica', raca: a => a.raca || 'Não informada', origem: a => a.origem || 'Não informada' }[f] || (a => a.cat);
    all.forEach(a => { const k = key(a); counts[k] = (counts[k] || 0) + 1; });
  }
  // Ordena do maior para o menor para o gráfico e a legenda ficarem legíveis
  const sorted = Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
  drawPie('pieChart', null, sorted);
  const total = Object.values(sorted).reduce((s, v) => s + v, 0);
  document.getElementById('chartSub').textContent = total ? `${total} animais ${CHART_LABEL[f] || ''}` : '';
  document.getElementById('chartLegend').innerHTML = Object.entries(sorted).map(([k, v], i) =>
    `<div class="lg-row"><span class="lg-dot" style="background:${COLORS[i % COLORS.length]}"></span><span class="lg-lbl">${esc(k)}</span><span class="lg-bar"><span style="width:${(v / total * 100).toFixed(1)}%;background:${COLORS[i % COLORS.length]}"></span></span><span class="lg-val">${v}<small>${Math.round(v / total * 100)}%</small></span></div>`).join('');
}

registerPageEnter('pageHome', renderHome);
