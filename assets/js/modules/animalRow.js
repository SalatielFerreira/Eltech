// ========== TEMPLATE COMPARTILHADO: linha de animal em lista ==========
// Usado por lotes.js (dentro de um lote), animais.js (lista geral e busca).
// Fica isolado num módulo próprio só para lotes.js e animais.js poderem
// importar um do outro sem criar dependência circular entre eles.
import { esc } from './ui.js';
import { getInsemDate, ageDays } from './data.js';

export function animalDetailsHtml(a) {
  const insem = getInsemDate(a.num);
  const parto = a.ultimoParto ? ageDays(a.ultimoParto) + ' dias' : '';
  const prenha = a.prenhaData ? ageDays(a.prenhaData) + ' dias de prenhez' : '';
  const d1 = [];
  if (a.raca) d1.push('Raça: ' + esc(a.raca));
  if (a.grauSangue) d1.push('GS: ' + esc(a.grauSangue));
  if (a.peso) d1.push('Peso: ' + esc(a.peso) + 'kg');
  if (a.leite) d1.push('Leite: ' + esc(a.leite) + 'L/dia');
  if (a.nomeMae) d1.push('Mãe: ' + esc(a.nomeMae));
  if (a.nomePai) d1.push('Pai: ' + esc(a.nomePai));
  const d2 = [];
  if (insem) d2.push('Insem: ' + insem);
  if (parto) d2.push('DEL: ' + parto);
  if (prenha) d2.push(prenha);
  return (d1.length ? `<div class="detail">${d1.join(' · ')}</div>` : '') +
    (d2.length ? `<div class="detail">${d2.join(' · ')}</div>` : '');
}

// opts.showLote: inclui um badge com o nome do lote (usado fora do detalhe do lote)
export function animalRowHtml(a, opts = {}) {
  const loteBadge = opts.showLote ? `<span class="badge badge-cat">${esc(a.loteName || '')}</span>` : '';
  return `<div class="animal-row"><div class="ani-thumb" data-aid="${a.id}" onclick="openFicha('${a.id}')">🐄</div>
    <div class="animal-info" style="cursor:pointer" onclick="openFicha('${a.id}')">
      <div><span class="num">#${esc(a.num)}</span><span class="name-text">${esc(a.nome)}</span></div>
      <div class="badges">${loteBadge}<span class="badge ${a.sexo === 'Macho' ? 'badge-m' : 'badge-f'}">${esc(a.sexo)}</span><span class="badge badge-cat">${esc(a.cat)}</span><span class="badge badge-sit">${esc(a.sit)}</span></div>
      ${animalDetailsHtml(a)}
    </div>
    <div class="animal-actions">
      <button class="edit-btn" style="background:var(--info);color:#fff" onclick="openBaixa('${a.id}')" title="Dar baixa (venda/morte)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 21h14"/></svg></button>
      <button class="edit-btn" onclick="editAnimalInLote('${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
      <button class="del-btn" onclick="delAnimalFromLote('${a.id}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>
    </div>
  </div>`;
}
