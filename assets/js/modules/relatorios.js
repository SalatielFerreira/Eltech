// ========== RELATÓRIOS (CSV / HTML) ==========
import { state } from '../state.js';
import { esc, toast, registerPageEnter } from './ui.js';
import { loteCmp, sortByNum, ageMonths, ageDays, getInsemDate } from './data.js';

export function populateReportSources() {
  const container = document.getElementById('reportSourceChecks');
  container.innerHTML = '';
  const selAllBtn = document.getElementById('btnSelAllSources');
  if (selAllBtn) selAllBtn.textContent = 'Selecionar todos';
  [...state.db.lotes].sort(loteCmp).forEach(l => {
    container.innerHTML += `<label class="report-check"><input type="checkbox" value="lote:${l.id}"><span>Rebanho — ${esc(l.name)} (${l.animals.length})</span></label>`;
  });
  if (state.db.medDirect.length) container.innerHTML += `<label class="report-check"><input type="checkbox" value="medicacao"><span>Medicação (${state.db.medDirect.length})</span></label>`;
  if (state.db.aliDirect.length) container.innerHTML += `<label class="report-check"><input type="checkbox" value="alimentacao"><span>Alimentação (${state.db.aliDirect.length})</span></label>`;
  [...state.db.inseminacao].sort(loteCmp).forEach(p => {
    container.innerHTML += `<label class="report-check"><input type="checkbox" value="inseminacao:${p.id}"><span>Insem. — ${esc(p.name)} (${p.animals.length})</span></label>`;
  });
}
export function toggleAllReportSources() {
  const boxes = [...document.querySelectorAll('#reportSourceChecks input[type=checkbox]')];
  if (!boxes.length) return;
  const allChecked = boxes.every(b => b.checked);
  boxes.forEach(b => b.checked = !allChecked);
  const btn = document.getElementById('btnSelAllSources');
  if (btn) btn.textContent = allChecked ? 'Selecionar todos' : 'Desmarcar todos';
}

function getFiltered() {
  const checks = document.querySelectorAll('#reportSourceChecks input[type=checkbox]:checked');
  if (!checks.length) return { animals: [] };
  let allAnimals = [];
  const cf = document.getElementById('reportFilterCat').value;
  const sf = document.getElementById('reportFilterSex').value;
  const stf = document.getElementById('reportFilterSit').value;
  const insemF = document.getElementById('reportFilterInsem').value;
  const insemNums = new Set();
  state.db.inseminacao.forEach(p => p.animals.forEach(a => insemNums.add(a.num)));
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
        if (insemF === 'sim') items = items.filter(a => insemNums.has(a.num));
        else if (insemF === 'nao') items = items.filter(a => !insemNums.has(a.num));
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
const FIELD_MAP = { num: 'Nº', nome: 'Nome', sexo: 'Sexo', cat: 'Cat.', sit: 'Sit.', raca: 'Raça', peso: 'Peso', leite: 'Leite', idade: 'Idade', origem: 'Origem', tipoPrenhez: 'Tipo Prenhez', pais: 'Mãe/Pai', pesagem: 'Pesagens', ultimoParto: 'Últ. Parto', prenha: 'Dias Prenha', insem: 'Últ. Insem.', lote: 'Lote' };

function fieldValue(f, a) {
  switch (f) {
    case 'num': return a.num; case 'nome': return a.nome; case 'sexo': return a.sexo; case 'cat': return a.cat;
    case 'sit': return a.sit; case 'raca': return a.raca; case 'peso': return a.peso || ''; case 'leite': return a.leite || '';
    case 'idade': return ageMonths(a.dataNasc) || ''; case 'origem': return a.origem || ''; case 'tipoPrenhez': return a.tipoPrenhez || '';
    case 'pais': return (a.nomeMae || '') + '/' + (a.nomePai || '');
    case 'pesagem': return (a.pesagens || []).map(p => p.peso + 'kg(' + p.data + ')').join('; ');
    case 'ultimoParto': return a.ultimoParto ? new Date(a.ultimoParto + 'T12:00').toLocaleDateString('pt-BR') : '';
    case 'prenha': return a.prenhaData ? ageDays(a.prenhaData) + ' dias' : '';
    case 'insem': return getInsemDate(a.num) || ''; case 'lote': return a.loteName || '';
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
    link.download = `ELTECH_${ds.replace(/\//g, '-')}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast('Excel baixado!');
    return;
  }

  // HTML (estilo relatório imprimível)
  let tables = '';
  groups.forEach(g => {
    let rows = '';
    if (g.type === 'rebanho') {
      rows = '<tr class="hdr">' + fields.map(f => `<th>${esc(FIELD_MAP[f] || f)}</th>`).join('') + '</tr>';
      rows += g.items.map((a, i) => `<tr class="${i % 2 ? 'alt' : ''}">` + fields.map(f => `<td>${esc(fieldValue(f, a)) || '—'}</td>`).join('') + '</tr>').join('');
    } else if (g.type === 'inseminacao') {
      rows = '<tr class="hdr"><th>Nº</th><th>Nome</th><th>Data</th><th>Tempo</th><th>Touro</th><th>Muco</th><th>Obs</th></tr>' +
        g.items.map((a, i) => `<tr class="${i % 2 ? 'alt' : ''}"><td>${esc(a.num)}</td><td>${esc(a.nome)}</td><td>${esc(a.data)}</td><td>${esc(a.tempo)}</td><td>${esc(a.touro)}</td><td>${esc(a.muco)}</td><td>${esc(a.obs || '')}</td></tr>`).join('');
    } else if (g.type === 'medicacao') {
      rows = '<tr class="hdr"><th>Animais</th><th>Tipo</th><th>Medicamentos</th><th>Início</th><th>Fim</th></tr>';
      rows += g.items.map((a, i) => {
        const animaisRow = a.animais || [];
        const anStr = animaisRow.map(x => '#' + x.num + ' ' + x.nome).join(', ');
        const meds = (a.medicamentos || []).map(m => m.nome + (m.dose ? ' (' + m.dose + ')' : '')).join(', ') || '—';
        return `<tr class="${i % 2 ? 'alt' : ''}"><td>${esc(anStr)}</td><td>${esc(a.tipo || '—')}</td><td>${esc(meds)}</td><td>${esc(a.dataIni || '—')}</td><td>${esc(a.dataFim || '—')}</td></tr>`;
      }).join('');
    } else if (g.type === 'alimentacao') {
      let aliT = 0;
      rows = '<tr class="hdr"><th>Dietas</th><th>Animais</th><th>Qtd</th><th>Custo</th></tr>' + g.items.map((a, i) => {
        const dt = (a.dietas || []).map(d => `${d.tipo}: ${d.kg || 0}kg/an × R$${parseFloat(d.valorKg || 0).toFixed(2)}`).join('<br>');
        aliT += parseFloat(a.custoTotal || 0);
        return `<tr class="${i % 2 ? 'alt' : ''}"><td>${dt}</td><td style="font-size:10px">${esc((a.animais || []).map(x => '#' + x.num).join(', '))}</td><td>${a.numAnimais || 0}</td><td><strong>R$ ${parseFloat(a.custoTotal || 0).toFixed(2)}</strong></td></tr>`;
      }).join('');
      rows += `<tr style="background:#86693f;color:#fff;font-weight:700"><td colspan="3" style="text-align:right;border:none;padding:12px">TOTAL</td><td style="border:none;padding:12px">R$ ${aliT.toFixed(2)}</td></tr>`;
    }
    tables += `<h2 style="color:#86693f;font-size:16px;margin:24px 0 8px;border-bottom:2px solid #86693f;padding-bottom:6px">${esc(g.planilha)}</h2><table>${rows}</table><p style="font-size:11px;color:#999;margin-top:4px">${g.items.length} registro(s)</p>`;
  });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ELTECH</title><style>*{margin:0;box-sizing:border-box}body{font-family:Segoe UI,sans-serif;padding:40px 24px;color:#1a1a1a;background:#fff}.hd{text-align:center;margin-bottom:24px}.hd h1{color:#86693f;font-size:28px;letter-spacing:3px}.hd p{color:#666;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}th,td{padding:9px 10px;text-align:left;border-bottom:1px solid #e5e5e5}.hdr th{background:linear-gradient(135deg,#86693f,#a98e5f);color:#fff;font-weight:600;border:none;font-size:11px}.alt td{background:#f3ecda}.ft{text-align:center;margin-top:30px;padding-top:14px;border-top:2px solid #86693f;color:#666;font-size:11px}</style></head><body><div class="hd"><h1>ELTECH</h1><p>Relatório · ${ds} às ${ts}</p></div>${tables}<div class="ft">Total: ${animals.length} registro(s) · Gerado por ELTECH</div></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ELTECH_${ds.replace(/\//g, '-')}.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  toast('Relatório baixado!');
}

registerPageEnter('pageRelatorios', populateReportSources);
