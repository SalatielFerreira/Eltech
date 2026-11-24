// ========== RELATÓRIOS (CSV / HTML) ==========
import { state } from '../state.js';
import { esc, toast, registerPageEnter } from './ui.js';
import { loteCmp, sortByNum, ageMonths, ageDays, getInsemDate, buildAnimalLookup, buildInsemIndex, fmtDateBR, findMae, findPai, getAllAnimals } from './data.js';

// Fontes agrupadas em chips: Rebanho (lotes), Inseminação (planilhas) e Manejo.
export function populateReportSources() {
  const container = document.getElementById('reportSourceChecks');
  const chip = (value, label, count) => `<label class="diet-check"><input type="checkbox" value="${value}"><span>${esc(label)} <em>${count}</em></span></label>`;
  const group = (title, chips) => chips.length ? `<div class="src-group"><div class="src-title">${title}</div><div class="chip-grid">${chips.join('')}</div></div>` : '';
  const lotes = [...state.db.lotes].sort(loteCmp).map(l => chip('lote:' + l.id, l.name, l.animals.length));
  const insem = [...state.db.inseminacao].sort(loteCmp).map(p => chip('inseminacao:' + p.id, p.name, p.animals.length));
  const manejo = [];
  if (state.db.medDirect.length) manejo.push(chip('medicacao', 'Medicação', state.db.medDirect.length));
  if (state.db.aliDirect.length) manejo.push(chip('alimentacao', 'Alimentação', state.db.aliDirect.length));
  container.innerHTML = (group('🐄 Rebanho (lotes)', lotes) + group('🔬 Inseminação (planilhas)', insem) + group('💊 Manejo', manejo)) ||
    '<div class="card-sub">Ainda não há dados para relatório.</div>';
  const selAllBtn = document.getElementById('btnSelAllSources');
  if (selAllBtn) selAllBtn.textContent = 'Selecionar todos';
  updateReportSummary();
}
export function toggleAllReportSources() {
  const boxes = [...document.querySelectorAll('#reportSourceChecks input[type=checkbox]')];
  if (!boxes.length) return;
  const allChecked = boxes.every(b => b.checked);
  boxes.forEach(b => b.checked = !allChecked);
  updateReportSummary();
}
// Resumo ao vivo do que vai sair no relatório.
export function updateReportSummary() {
  const el = document.getElementById('reportSummary');
  if (!el) return;
  const boxes = [...document.querySelectorAll('#reportSourceChecks input[type=checkbox]')];
  const n = boxes.filter(b => b.checked).length;
  const btn = document.getElementById('btnSelAllSources');
  if (btn && boxes.length) btn.textContent = n === boxes.length ? 'Desmarcar todos' : 'Selecionar todos';
  const total = n ? getFiltered().animals.length : 0;
  el.textContent = n ? `${n} fonte(s) · ${total} registro(s) no relatório` : 'Selecione ao menos uma fonte';
  document.querySelectorAll('.dl-btn').forEach(b => b.classList.toggle('disabled', !total));
}
document.getElementById('reportSourceChecks')?.addEventListener('change', updateReportSummary);

function getFiltered() {
  const checks = document.querySelectorAll('#reportSourceChecks input[type=checkbox]:checked');
  if (!checks.length) return { animals: [] };
  let allAnimals = [];
  const cf = document.getElementById('reportFilterCat').value;
  const sf = document.getElementById('reportFilterSex').value;
  const stf = document.getElementById('reportFilterSit').value;
  const insemF = document.getElementById('reportFilterInsem').value;
  const insemIndex = buildInsemIndex(buildAnimalLookup()); // inseminadas, pelo ID do animal
  checks.forEach(cb => {
    const val = cb.value;
    if (val.startsWith('lote:')) {
      const id = val.split(':')[1];
      const l = state.db.lotes.find(x => x.id === id);
      if (l) {
        let items = l.animals.map(a => ({ ...a, loteName: l.name }));
        if (cf) items = items.filter(a => a.cat === cf);
        if (sf) items = items.filter(a => a.sexo === sf);
        if (stf) items = items.filter(a => a.sit === stf);
        if (insemF === 'sim') items = items.filter(a => insemIndex.has(a.id));
        else if (insemF === 'nao') items = items.filter(a => !insemIndex.has(a.id));
        items.forEach(a => allAnimals.push({ ...a, _type: 'rebanho', _planilha: 'Rebanho — ' + l.name }));
      }
    } else if (val === 'medicacao') {
      state.db.medDirect.forEach(a => allAnimals.push({ ...a, _type: 'medicacao', _planilha: 'Medicação' }));
    } else if (val === 'alimentacao') {
      state.db.aliDirect.forEach(a => allAnimals.push({ ...a, _type: 'alimentacao', _planilha: 'Alimentação' }));
    } else if (val.startsWith('inseminacao:')) {
      const id = val.split(':')[1];
      const p = state.db.inseminacao.find(x => x.id === id);
      if (p) p.animals.forEach(a => allAnimals.push({ ...a, _type: 'inseminacao', _planilha: 'Insem. — ' + p.name }));
    }
  });
  return { animals: allAnimals };
}
function getReportFields() {
  const fields = [];
  document.querySelectorAll('#reportFieldChecks input[type=checkbox]:checked').forEach(cb => fields.push(cb.value));
  return fields;
}
function csvEscape(v) {
  const s = String(v == null ? '' : v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const FIELD_MAP = { num: 'Nº', nome: 'Nome', sexo: 'Sexo', cat: 'Cat.', sit: 'Sit.', raca: 'Raça', peso: 'Peso', leite: 'Leite', idade: 'Idade', origem: 'Origem', tipoPrenhez: 'Tipo Prenhez', pais: 'Mãe/Pai', pesagem: 'Pesagens', ultimoParto: 'Últ. Parto', prenha: 'Dias Prenha', insem: 'Últ. Insem.', lote: 'Lote', brinco: 'Brinco', registro: 'Registro', pelagem: 'Pelagem', obs: 'Obs.' };

function fieldValue(f, a) {
  switch (f) {
    case 'num': return a.num; case 'nome': return a.nome; case 'sexo': return a.sexo; case 'cat': return a.cat;
    case 'sit': return a.sit; case 'raca': return a.raca; case 'peso': return a.peso || ''; case 'leite': return a.leite || '';
    case 'idade': return ageMonths(a.dataNasc) || ''; case 'origem': return a.origem || ''; case 'tipoPrenhez': return a.tipoPrenhez || '';
    case 'pais': { const all = getAllAnimals(); return (findMae(a, all)?.nome || a.nomeMae || '') + '/' + (findPai(a, all)?.nome || a.nomePai || ''); }
    case 'pesagem': return (a.pesagens || []).map(p => p.peso + 'kg(' + p.data + ')').join('; ');
    case 'ultimoParto': return a.ultimoParto ? new Date(a.ultimoParto + 'T12:00').toLocaleDateString('pt-BR') : '';
    case 'prenha': return a.prenhaData ? ageDays(a.prenhaData) + ' dias' : '';
    case 'insem': return getInsemDate(a) || ''; case 'lote': return a.loteName || '';
    case 'brinco': return a.brinco || ''; case 'registro': return a.registro || ''; case 'pelagem': return a.pelagem || ''; case 'obs': return a.obs || '';
    default: return '';
  }
}

export function downloadReport(fmt) {
  const result = getFiltered();
  if (!result.animals.length) return toast('Selecione fontes e verifique filtros', 'error');
  const animals = result.animals;
  const now = new Date(), ds = now.toLocaleDateString('pt-BR'), ts = now.toLocaleTimeString('pt-BR');
  const grouped = {};
  animals.forEach(a => { const key = a._type + '|' + a._planilha; if (!grouped[key]) grouped[key] = { type: a._type, planilha: a._planilha, items: [] }; grouped[key].items.push(a); });
  const groups = Object.values(grouped).sort((x, y) => String(x.planilha || '').localeCompare(String(y.planilha || ''), 'pt', { numeric: true, sensitivity: 'base' }));
  groups.forEach(g => sortByNum(g.items));
  const fields = getReportFields();

  if (fmt === 'csv') {
    let csv = '';
    groups.forEach(g => {
      csv += `\n--- ${g.planilha} ---\n`;
      if (g.type === 'rebanho') {
        csv += fields.map(f => FIELD_MAP[f] || f).join(',') + '\n';
        csv += g.items.map(a => fields.map(f => fieldValue(f, a)).map(csvEscape).join(',')).join('\n');
      } else if (g.type === 'inseminacao') {
        csv += 'Numero,Nome,Data,Tempo,Touro,Muco,Obs\n';
        csv += g.items.map(a => [a.num, a.nome, a.data || '', a.tempo || '', a.touro || '', a.muco || '', a.obs || ''].map(csvEscape).join(',')).join('\n');
      } else if (g.type === 'medicacao') {
        csv += 'Numero,Nome,Tipo,Medicamentos,Inicio,Fim\n';
        g.items.forEach(a => {
          const animaisRow = a.animais || [];
          const meds = (a.medicamentos || []).map(m => m.nome + (m.dose ? ' (' + m.dose + ')' : '')).join('; ');
          animaisRow.forEach(an => { csv += [an.num, an.nome, a.tipo || '', meds, a.dataIni || '', a.dataFim || ''].map(csvEscape).join(',') + '\n'; });
        });
      } else if (g.type === 'alimentacao') {
        csv += 'Dietas,Animais,Qtd,Custo\n';
        let aliT = 0;
        csv += g.items.map(a => {
          const dt = (a.dietas || []).map(d => `${d.tipo}:${d.kg || 0}kg@R$${parseFloat(d.valorKg || 0).toFixed(2)}`).join('; ');
          aliT += parseFloat(a.custoTotal || 0);
          return `"${dt}","${(a.animais || []).map(x => x.num + '-' + x.nome).join('; ')}",${a.numAnimais || 0},${parseFloat(a.custoTotal || 0).toFixed(2)}`;
        }).join('\n');
        csv += `\nTOTAL,,, R$ ${aliT.toFixed(2)}`;
      }
      csv += '\n';
    });
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `FARM_${ds.replace(/\//g, '-')}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast('Excel baixado!');
    return;
  }

  // PDF: o relatório é montado numa área de impressão do próprio app e o navegador abre
  // "Imprimir / Salvar como PDF" (funciona no celular, no computador e no app instalado).
  const brl = v => 'R$ ' + (parseFloat(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let tables = '';
  groups.forEach(g => {
    let head = '', body = '', foot = '';
    if (g.type === 'rebanho') {
      head = fields.map(f => `<th>${esc(FIELD_MAP[f] || f)}</th>`).join('');
      body = g.items.map(a => '<tr>' + fields.map(f => `<td>${esc(fieldValue(f, a)) || '—'}</td>`).join('') + '</tr>').join('');
    } else if (g.type === 'inseminacao') {
      head = '<th>Nº</th><th>Nome</th><th>Data</th><th>Touro</th><th>Muco</th><th>Diagnóstico</th><th>Obs.</th>';
      body = g.items.map(a => `<tr><td>${esc(a.num)}</td><td>${esc(a.nome)}</td><td>${esc(fmtDateBR(a.data)) || '—'}</td><td>${esc(a.touro) || '—'}</td><td>${esc(a.muco) || '—'}</td><td>${esc(a.parecer) || 'Aguardando'}</td><td>${esc(a.obs || '')}</td></tr>`).join('');
    } else if (g.type === 'medicacao') {
      head = '<th>Animais</th><th>Tipo</th><th>Medicamentos</th><th>Início</th><th>Fim</th><th>Carência</th>';
      body = g.items.map(a => {
        const anStr = (a.animais || []).map(x => '#' + x.num + ' ' + x.nome).join(', ');
        const meds = (a.medicamentos || []).map(m => m.nome + (m.dose ? ' (' + m.dose + ')' : '')).join(', ') || '—';
        const car = [a.carenciaLeite && `leite ${a.carenciaLeite}d`, a.carenciaCarne && `carne ${a.carenciaCarne}d`].filter(Boolean).join(' · ') || '—';
        return `<tr><td>${esc(anStr)}</td><td>${esc(a.tipo || '—')}</td><td>${esc(meds)}</td><td>${esc(fmtDateBR(a.dataIni)) || '—'}</td><td>${esc(fmtDateBR(a.dataFim)) || '—'}</td><td>${esc(car)}</td></tr>`;
      }).join('');
    } else if (g.type === 'alimentacao') {
      let aliT = 0;
      head = '<th>Dieta</th><th>Ingredientes</th><th>Animais</th><th>Qtd</th><th>Custo</th>';
      body = g.items.map(a => {
        const dt = (a.dietas || []).map(d => `${esc(d.tipo)}: ${esc(d.kg || 0)} kg/animal × ${brl(d.valorKg)}`).join('<br>');
        aliT += parseFloat(a.custoTotal || 0);
        return `<tr><td>${esc(a.nomeDieta || '—')}</td><td>${dt}</td><td class="small">${esc((a.animais || []).map(x => '#' + x.num).join(', '))}</td><td>${a.numAnimais || 0}</td><td><b>${brl(a.custoTotal)}</b></td></tr>`;
      }).join('');
      foot = `<tfoot><tr><td colspan="4">Total</td><td>${brl(aliT)}</td></tr></tfoot>`;
    }
    tables += `<section class="pr-group"><h2>${esc(g.planilha)} <small>${g.items.length} registro(s)</small></h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></section>`;
  });
  const area = document.getElementById('printArea');
  area.innerHTML = `<header class="pr-head"><div><h1>FARM</h1><p>Relatório do rebanho</p></div><div class="pr-meta"><b>${esc(state.db.user.name || '')}</b><span>${ds} às ${ts}</span><span>${animals.length} registro(s)</span></div></header>${tables}<footer class="pr-foot">Gerado pelo FARM · ${ds}</footer>`;
  const oldTitle = document.title;
  document.title = `FARM_${ds.replace(/\//g, '-')}`; // vira o nome sugerido do arquivo PDF
  document.body.classList.add('printing');
  const cleanup = () => { document.body.classList.remove('printing'); area.innerHTML = ''; document.title = oldTitle; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  toast('Escolha "Salvar como PDF" na janela de impressão', 'info');
  setTimeout(() => { window.print(); if (!('onafterprint' in window)) setTimeout(cleanup, 1000); }, 50);
}

registerPageEnter('pageRelatorios', populateReportSources);
