// ========== TEMPLATES COMPARTILHADOS DO REBANHO ==========
// Cartão de animal usado em "Todos os animais" e no detalhe do lote. Fica num
// módulo próprio para lotes.js e animais.js poderem usar sem importar um ao outro.
import { esc } from './ui.js';
import { ageDays } from './data.js';
import { GESTACAO_DIAS } from './constants.js';

const SIT_CLASS = {
  'Prenha': 'tag-ok', 'Cio': 'tag-cio', 'Anestro': 'tag-bad',
  'Vazia': 'tag-warn', 'Vazia Cloe': 'tag-warn', 'Vazia Clod': 'tag-warn',
};

export const ICON_DOTS = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

const shortDate = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export function sexIcon(sexo) {
  return sexo === 'Macho' ? '<span class="sx sx-m" title="Macho">♂</span>' : '<span class="sx sx-f" title="Fêmea">♀</span>';
}
export function sitTag(sit) {
  if (!sit || sit === 'Não se aplica') return '';
  return `<span class="tag ${SIT_CLASS[sit] || ''}">${esc(sit)}</span>`;
}

// opts.showLote: mostra o lote (fora do detalhe do lote)
// opts.insemIndex: Map nº -> data da última inseminação (ver data.buildInsemIndex)
export function animalRowHtml(a, opts = {}) {
  const meta = [a.raca, a.grauSangue && 'GS ' + a.grauSangue, a.peso !== '' && a.peso != null && a.peso + ' kg', a.leite !== '' && a.leite != null && a.leite + ' L/dia']
    .filter(Boolean).map(esc).join(' · ');
  const repro = [];
  if (a.ultimoParto) repro.push('DEL ' + ageDays(a.ultimoParto) + 'd');
  if (a.sit === 'Prenha' && a.prenhaData) {
    const exp = new Date(a.prenhaData + 'T12:00'); exp.setDate(exp.getDate() + GESTACAO_DIAS);
    repro.push('Prenhe há ' + ageDays(a.prenhaData) + 'd · parto ' + shortDate(exp));
  }
  const ins = opts.insemIndex?.get(a.num);
  if (ins) repro.push('Insem. ' + shortDate(new Date(ins + 'T12:00')));
  return `<div class="ani-card" data-aid="${a.id}" onclick="openFicha('${a.id}')">
  <div class="ani-thumb" data-aid="${a.id}">🐄</div>
  <div class="ani-main">
    <div class="ani-top"><span class="ani-num">#${esc(a.num)}</span><span class="ani-name">${esc(a.nome)}</span>${sexIcon(a.sexo)}</div>
    <div class="ani-tags"><span class="tag">${esc(a.cat)}</span>${sitTag(a.sit)}${opts.showLote ? `<span class="tag tag-lote">${esc(a.loteName || '')}</span>` : ''}</div>
    ${meta ? `<div class="ani-meta">${meta}</div>` : ''}${repro.length ? `<div class="ani-meta ani-repro">${repro.join(' · ')}</div>` : ''}
  </div>
  <button class="ani-more" onclick="event.stopPropagation();openAnimalActions('${a.id}')" aria-label="Ações do animal">${ICON_DOTS}</button>
</div>`;
}

export function emptyStateHtml(text, cta) {
  return `<div class="empty-card"><div class="empty-ico">🐄</div><p>${esc(text)}</p>${cta ? `<button class="btn btn-primary btn-sm" onclick="${cta.onclick}">${esc(cta.label)}</button>` : ''}</div>`;
}
