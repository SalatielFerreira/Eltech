// ========== HOME (painel do sítio, gráfico, alertas) ==========
import { state } from '../state.js';
import { esc, registerPageEnter } from './ui.js';
import { getAllAnimals } from './data.js';
import { drawPie } from './charts.js';
import { GESTACAO_DIAS } from './constants.js';

export function setChartFilter(f, btn) {
  state.chartFilter = f;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderHome();
}

export function renderHome() {
  const all = getAllAnimals();
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  document.getElementById('statGrid').innerHTML = `<div style="grid-column:1/-1;margin-bottom:4px"><p style="font-size:1rem;font-weight:700;color:var(--brown)">${greet}, ${esc(state.db.user.name || 'Usuário')}!</p><p style="font-size:.75rem;color:var(--brown);margin-top:2px">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><div class="stat-card glass2 anim-fade"><div class="stat-icon">🐄</div><div class="stat-val">${all.length}</div><div class="stat-lbl">Total Animais</div></div><div class="stat-card glass2 anim-fade anim-d1"><div class="stat-icon">📋</div><div class="stat-val">${state.db.lotes.length}</div><div class="stat-lbl">Lotes</div></div>`;

  const today = new Date().toISOString().split('T')[0];
  const counts = {};
  const medNums = new Set();
  state.db.medDirect.forEach(rec => {
    if (!rec.dataFim || rec.dataFim >= today) (rec.animais || []).forEach(a => { if (a.num) medNums.add(a.num); });
  });
  const insemNums = new Set();
  state.db.inseminacao.forEach(p => p.animals.forEach(a => insemNums.add(a.num)));

  if (state.chartFilter === 'lote') {
    state.db.lotes.forEach(l => { if (l.animals.length) counts[l.name] = l.animals.length; });
  } else if (state.chartFilter === 'medicado') {
    let mc = 0, nm = 0;
    all.forEach(a => { if (medNums.has(a.num)) mc++; else nm++; });
    if (mc) counts['Em medicação'] = mc;
    if (nm) counts['Sem medicação'] = nm;
  } else if (state.chartFilter === 'inseminado') {
    let ic = 0, ni = 0;
    all.forEach(a => { if (insemNums.has(a.num)) ic++; else ni++; });
    if (ic) counts['Inseminado'] = ic;
    if (ni) counts['Não inseminado'] = ni;
  } else if (state.chartFilter === 'origem') {
    all.forEach(a => { const k = a.origem || 'Não informado'; counts[k] = (counts[k] || 0) + 1; });
  } else {
    all.forEach(a => {
      let k = '';
      if (state.chartFilter === 'categoria') k = a.cat;
      else if (state.chartFilter === 'sexo') k = a.sexo;
      else if (state.chartFilter === 'situacao') k = a.sit;
      else k = a.raca || 'N/A';
      counts[k] = (counts[k] || 0) + 1;
    });
  }
  drawPie('pieChart', 'chartLegend', counts);
  renderHomeAlerts();
  renderFarmPanel();
}

// ---------- Alertas (medicação, carência, reprodução) ----------
export function getAlerts() {
  const alerts = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();
  const fmt = d => d.toLocaleDateString('pt-BR');
  const addDays = (s, n) => { const d = new Date(s + 'T12:00'); d.setDate(d.getDate() + n); return d; };
  const dleft = d => Math.round((d.getTime() - todayTs) / 86400000);

  state.db.medDirect.forEach(rec => {
    const animais = rec.animais || [];
    const nomes = animais.map(a => '#' + esc(a.num)).join(', ');
    const base = rec.dataFim || rec.dataIni;
    if (rec.dataIni) {
      const ini = new Date(rec.dataIni + 'T12:00').getTime();
      const fim = rec.dataFim ? new Date(rec.dataFim + 'T12:00').getTime() : null;
      if (todayTs >= ini && (fim === null || todayTs <= fim)) alerts.push({ icon: '💊', color: 'var(--info)', title: esc(rec.tipo || 'Medicação') + ' em andamento', detail: nomes + (rec.dataFim ? ' · até ' + fmt(new Date(rec.dataFim + 'T12:00')) : '') });
    }
    if (base && rec.carenciaLeite) {
      const end = addDays(base, parseInt(rec.carenciaLeite, 10) || 0);
      const dd = dleft(end);
      if (dd >= 0) alerts.push({ icon: '🥛', color: 'var(--danger)', title: 'NÃO vender leite', detail: nomes + ' · liberado ' + fmt(end) + (dd === 0 ? ' (hoje)' : ' (faltam ' + dd + 'd)') });
    }
    if (base && rec.carenciaCarne) {
      const end = addDays(base, parseInt(rec.carenciaCarne, 10) || 0);
      const dd = dleft(end);
      if (dd >= 0) alerts.push({ icon: '🥩', color: 'var(--danger)', title: 'NÃO abater (carne)', detail: nomes + ' · liberado ' + fmt(end) + (dd === 0 ? ' (hoje)' : ' (faltam ' + dd + 'd)') });
    }
  });

  const lastInsem = {};
  state.db.inseminacao.forEach(p => p.animals.forEach(a => { if (a.data && (!lastInsem[a.num] || a.data > lastInsem[a.num].data)) lastInsem[a.num] = { data: a.data, nome: a.nome }; }));
  const byNum = {};
  getAllAnimals().forEach(a => { byNum[a.num] = a; });
  getAllAnimals().forEach(a => {
    if (a.sit === 'Prenha') {
      const base = a.prenhaData || (lastInsem[a.num] && lastInsem[a.num].data);
      if (base) {
        const exp = addDays(base, GESTACAO_DIAS);
        const dd = dleft(exp);
        if (dd <= 15 && dd >= -20) alerts.push({ icon: '🐄', color: 'var(--warn)', title: dd < 0 ? 'Parto pode ter passado' : 'Parto próximo', detail: '#' + esc(a.num) + ' ' + esc(a.nome) + ' · ' + fmt(exp) + (dd >= 0 ? ' (em ' + dd + 'd)' : ' (' + (-dd) + 'd atrás)') });
        if (dd <= 65 && dd >= 50 && a.cat !== 'Vaca seca') alerts.push({ icon: '🌾', color: 'var(--info)', title: 'Hora de secar a vaca', detail: '#' + esc(a.num) + ' ' + esc(a.nome) + ' · parto em ' + dd + 'd (' + fmt(exp) + ') — secar ~60d antes' });
      }
    }
  });
  Object.keys(lastInsem).forEach(num => {
    const a = byNum[num];
    const since = Math.round((todayTs - new Date(lastInsem[num].data + 'T12:00').getTime()) / 86400000);
    if (since >= 28 && since <= 60 && (!a || a.sit !== 'Prenha')) alerts.push({ icon: '🔬', color: 'var(--accent2)', title: 'Diagnóstico de prenhez', detail: '#' + esc(num) + ' ' + esc(lastInsem[num].nome) + ' · inseminada há ' + since + 'd' });
  });
  return alerts;
}

export function renderHomeAlerts() {
  const c = document.getElementById('homeAlerts');
  if (!c) return;
  const alerts = getAlerts();
  if (!alerts.length) { c.innerHTML = ''; return; }
  c.innerHTML = `<div class="chart-container glass" style="margin-bottom:16px;padding:16px 18px"><div class="med-section-title"><span class="icon">🔔</span>Alertas (${alerts.length})</div>` +
    alerts.map(al => `<div class="med-alert-card glass3" style="border-left-color:${al.color}"><div class="med-animal">${al.icon} ${esc(al.title)}</div><div class="med-detail">${al.detail}</div></div>`).join('') + `</div>`;
}

// ---------- Painel do sítio ----------
export function renderFarmPanel() {
  const c = document.getElementById('farmPanel');
  if (!c) return;
  const all = getAllAnimals();
  const lact = all.filter(a => a.cat === 'Vaca em lactação');
  const leiteTotal = lact.reduce((s, a) => s + (parseFloat(a.leite) || 0), 0);
  const femAptas = all.filter(a => a.sexo === 'Fêmea' && a.cat !== 'Bezerra');
  const prenhas = femAptas.filter(a => a.sit === 'Prenha').length;
  const taxa = femAptas.length ? Math.round(prenhas / femAptas.length * 100) : 0;
  const custoAli = state.db.aliDirect.reduce((s, r) => s + parseFloat(r.custoTotal || 0), 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const ts = t.getTime();
  const emTrat = state.db.medDirect.filter(r => {
    if (!r.dataIni) return false;
    const ini = new Date(r.dataIni + 'T12:00').getTime();
    const fim = r.dataFim ? new Date(r.dataFim + 'T12:00').getTime() : null;
    return ts >= ini && (fim === null || ts <= fim);
  }).length;
  if (!all.length) { c.innerHTML = ''; return; }
  const box = (val, lbl) => `<div class="cost-box glass3"><div class="val">${val}</div><div class="lbl">${lbl}</div></div>`;
  c.innerHTML = `<div class="chart-container glass" style="margin-bottom:16px;padding:16px 18px"><div class="med-section-title">Painel do Sítio</div><div class="cost-grid">` +
    box(leiteTotal.toFixed(0) + 'L', 'Leite/dia') + box(lact.length, 'Em lactação') + box(taxa + '%', 'Taxa prenhez') +
    box(prenhas, 'Prenhas') + box('R$ ' + custoAli.toFixed(0), 'Custo ração') + box(emTrat, 'Em tratamento') + `</div></div>`;
}

registerPageEnter('pageHome', renderHome);
