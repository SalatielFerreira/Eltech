// ========== FORMULÁRIO, FICHA E CRUD DO ANIMAL ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, registerModalSetup, registerModalTeardown, renderListChunked, openActionSheet, refresh } from './ui.js';
import { dbInsert, dbUpdate, dbDelete, trimHistory, getAllAnimals, sortByNum, ageMonths, ageDays, getAnimalById, matchAnimal, todayISO, toLocalISO, fmtDateBR, buildInsemIndex, dbWriteAnimal } from './data.js';
import { animalRowHtml, emptyStateHtml, sexIcon, sitTag } from './animalRow.js';
import { populateLoteSelect, updateFilterBadge } from './lotes.js';
import { resetAnimalPhoto, setAnimalPhotoUI, uploadAnimalPhoto, deleteAnimalPhoto, getAnimalPhotoUrl, hydrateThumbs } from './fotos.js';
import { SIT_OPTIONS, CATEGORIAS_MACHO, CATEGORIAS_FEMEA, GESTACAO_DIAS } from './constants.js';
import { drawLineChart } from './charts.js';
import { openBaixa } from './baixas.js';

const $ = id => document.getElementById(id);
const val = id => ($(id)?.value || '').trim();
const optionsHtml = list => list.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');

// ---------- Regras do formulário (visibilidade de campos por sexo/categoria/situação) ----------
export function onSexoChange() {
  const sexo = $('animalSexo').value;
  const catSel = $('animalCat');
  const prev = catSel.value;
  const cats = sexo === 'Macho' ? CATEGORIAS_MACHO : CATEGORIAS_FEMEA;
  catSel.innerHTML = optionsHtml(cats);
  if (cats.includes(prev)) catSel.value = prev;
  syncSegments();
  onCatChange();
}
export function onCatChange() {
  const sexo = $('animalSexo').value;
  const cat = $('animalCat').value;
  const sitSel = $('animalSit');
  if (sexo === 'Macho' || cat === 'Bezerra') {
    sitSel.innerHTML = '<option value="Não se aplica">Não se aplica</option>';
    sitSel.disabled = true;
  } else {
    const cur = sitSel.value;
    sitSel.innerHTML = optionsHtml(SIT_OPTIONS);
    if (cur && SIT_OPTIONS.includes(cur)) sitSel.value = cur;
    sitSel.disabled = false;
  }
  onSitChange();
}
export function onSitChange() { updateFieldVisibility(); updateAnimalHints(); }
export function updateFieldVisibility() {
  const sexo = $('animalSexo').value;
  const cat = $('animalCat').value;
  const sit = $('animalSit').value;
  const hideLeite = (sexo === 'Macho' || cat === 'Bezerro' || cat === 'Bezerra' || cat === 'Novilha' || sit === 'Anestro');
  $('leiteGroup').style.display = hideLeite ? 'none' : 'block';
  if (hideLeite) $('animalLeite').value = '';
  const showParto = (sexo === 'Fêmea' && (cat === 'Novilha' || cat === 'Vaca seca' || cat === 'Vaca em lactação') &&
    (sit === 'Vazia' || sit === 'Prenha' || sit === 'Vazia Cloe' || sit === 'Vazia Clod' || sit === 'Cio'));
  $('partoGroup').style.display = showParto ? 'block' : 'none';
  if (!showParto) $('animalUltimoParto').value = '';
  const showPrenha = (sit === 'Prenha');
  $('prenhaGroup').style.display = showPrenha ? 'block' : 'none';
  if (!showPrenha) { $('animalPrenhaData').value = ''; $('animalPrenhaDias').value = ''; }
}
export function onOrigemChange() {
  const origem = $('animalOrigem').value;
  $('paiMaeNascido').classList.toggle('hidden', origem !== 'Nascido');
  $('paiMaeComprado').classList.toggle('hidden', origem !== 'Comprado');
  if (origem === 'Nascido') populateMaePaiSelects();
  syncSegments();
}
export function setAnimalSexo(v) { $('animalSexo').value = v; onSexoChange(); }
export function setAnimalOrigem(v) { $('animalOrigem').value = v; onOrigemChange(); }
function syncSegments() {
  [['segSexo', 'animalSexo'], ['segOrigem', 'animalOrigem']].forEach(([seg, sel]) => {
    const v = $(sel)?.value;
    $(seg)?.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  });
}

export function populateMaePaiSelects() {
  const all = getAllAnimals().filter(a => a.id !== state.editAniId);
  const maeSel = $('animalMaeSelect');
  const paiSel = $('animalPaiSelect');
  const prevMae = maeSel.value, prevPai = paiSel.value;
  maeSel.innerHTML = '<option value="">Selecione</option>' + sortByNum(all.filter(a => a.sexo === 'Fêmea'))
    .map(a => `<option value="${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)}</option>`).join('');
  const pais = new Set();
  const paiOpts = ['<option value="">Selecione</option>'];
  sortByNum(all.filter(a => a.sexo === 'Macho')).forEach(a => { paiOpts.push(`<option value="${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)}</option>`); pais.add(a.nome); });
  (state.db.touros || []).forEach(t => { if (t.nome && !pais.has(t.nome)) { paiOpts.push(`<option value="${esc(t.nome)}">🐂 ${esc(t.nome)} (touro)</option>`); pais.add(t.nome); } });
  state.db.inseminacao.forEach(p => p.animals.forEach(a => {
    if (a.touro && !pais.has(a.touro)) { paiOpts.push(`<option value="${esc(a.touro)}">🧬 ${esc(a.touro)} (sêmen)</option>`); pais.add(a.touro); }
  }));
  paiSel.innerHTML = paiOpts.join('');
  if (prevMae) maeSel.value = prevMae;
  if (prevPai) paiSel.value = prevPai;
}

// ---------- Dicas calculadas (idade, DEL, prenhez, nº sugerido) ----------
export function formatAge(dateStr) {
  const days = ageDays(dateStr);
  if (days === '' || days < 0) return '';
  if (days < 60) return days + (days === 1 ? ' dia' : ' dias');
  const m = ageMonths(dateStr);
  if (m < 24) return m + ' meses';
  const y = Math.floor(m / 12), r = m % 12;
  return y + ' anos' + (r ? ' e ' + r + (r === 1 ? ' mês' : ' meses') : '');
}
function suggestNextNum() {
  const nums = [...getAllAnimals(), ...(state.db.baixas || [])].map(a => String(a.num || '').trim()).filter(n => /^\d+$/.test(n));
  if (!nums.length) return '1';
  const max = nums.reduce((m, n) => (Number(n) > Number(m) ? n : m), nums[0]);
  const next = String(Number(max) + 1);
  return max.length > next.length && max.startsWith('0') ? next.padStart(max.length, '0') : next;
}
function findNumOwner(num) {
  const n = String(num).trim().toLowerCase();
  return getAllAnimals().find(a => a.id !== state.editAniId && String(a.num).trim().toLowerCase() === n);
}
function prenhaDateFromForm() {
  let d = $('animalPrenhaData').value || '';
  const dias = parseInt($('animalPrenhaDias').value, 10);
  if (!d && !isNaN(dias)) { const x = new Date(); x.setDate(x.getDate() - dias); d = toLocalISO(x); }
  return d;
}
const hint = (id, html, tone = '') => { const el = $(id); if (el) { el.innerHTML = html; el.className = 'field-hint' + (tone ? ' hint-' + tone : ''); } };

export function updateAnimalHints() {
  const today = todayISO();
  // Nº: sugestão (novo animal) ou aviso de duplicado
  const num = val('animalNum');
  if (num) {
    const owner = findNumOwner(num);
    hint('numHint', owner ? `Nº já usado por ${esc(owner.nome)} (lote ${esc(owner.loteName)})` : '', owner ? 'bad' : '');
  } else if (!state.editAniId) {
    hint('numHint', `Sugestão: <button type="button" class="chip-link" onclick="useSuggestedNum()">${esc(suggestNextNum())}</button>`);
  } else hint('numHint', '');
  // Idade
  const nasc = $('animalDataNasc').value;
  if (!nasc) hint('idadeHint', '');
  else if (nasc > today) hint('idadeHint', 'Data no futuro', 'bad');
  else hint('idadeHint', 'Idade: ' + (formatAge(nasc) || 'recém-nascido'));
  // DEL
  const parto = $('animalUltimoParto').value;
  if (!parto) hint('delHint', '');
  else if (parto > today) hint('delHint', 'Data no futuro', 'bad');
  else { const del = ageDays(parto); hint('delHint', `DEL: ${del} dias em lactação` + (del > 305 ? ' · lactação longa (acima de 305 dias)' : ''), del > 305 ? 'warn' : ''); }
  // Prenhez
  const pd = prenhaDateFromForm();
  if (!pd || $('prenhaGroup').style.display === 'none') hint('prenhaHint', '');
  else if (pd > today) hint('prenhaHint', 'Data no futuro', 'bad');
  else {
    const dias = ageDays(pd);
    const exp = new Date(pd + 'T12:00'); exp.setDate(exp.getDate() + GESTACAO_DIAS);
    const falta = Math.round((exp - new Date()) / 864e5);
    hint('prenhaHint', `Prenhe há ${dias} dias · parto previsto ${exp.toLocaleDateString('pt-BR')}` + (falta >= 0 ? ` (faltam ${falta} dias)` : ' (data já passou)'), dias > 300 ? 'bad' : '');
  }
}
export function useSuggestedNum() {
  $('animalNum').value = suggestNextNum();
  updateAnimalHints();
  $('animalNome')?.focus();
}

// ---------- Leitura e validação ----------
function readAnimalForm() {
  const origem = $('animalOrigem').value;
  const nascido = origem === 'Nascido';
  return {
    num: val('animalNum'), nome: val('animalNome'), loteId: $('animalLote').value,
    origem,
    tipoPrenhez: nascido ? ($('animalTipoPrenhez').value || '') : '',
    nomeMae: nascido ? ($('animalMaeSelect').value || '') : val('animalNomeMae'),
    nomePai: nascido ? ($('animalPaiSelect').value || '') : val('animalNomePai'),
    dataNasc: $('animalDataNasc').value || '',
    sexo: $('animalSexo').value, cat: $('animalCat').value, sit: $('animalSit').value,
    raca: $('animalRaca').value || '', grauSangue: val('animalGrauSangue'), pelagem: val('animalPelagem'),
    brinco: val('animalBrinco'), registro: val('animalRegistro'), obs: val('animalObs'),
    peso: $('animalPeso').value || '', leite: $('animalLeite').value || '',
    ultimoParto: $('animalUltimoParto').value || '', prenhaData: prenhaDateFromForm(),
    dataCompra: nascido ? '' : ($('animalDataCompra').value || ''),
    valorCompra: nascido ? '' : ($('animalValorCompra').value || ''),
    vendedor: nascido ? '' : val('animalVendedor'),
  };
}

function validateAnimal(d) {
  const errs = [];
  const today = todayISO();
  const add = (id, msg) => errs.push({ id, msg });
  if (!d.num) add('animalNum', 'Informe o nº do animal');
  else { const owner = findNumOwner(d.num); if (owner) add('animalNum', `Nº ${d.num} já pertence a ${owner.nome} (lote ${owner.loteName})`); }
  if (!d.nome) add('animalNome', 'Informe o nome do animal');
  if (!d.loteId) add('animalLote', 'Escolha o lote');
  if (d.dataNasc && d.dataNasc > today) add('animalDataNasc', 'A data de nascimento não pode ser futura');
  if (d.ultimoParto) {
    if (d.ultimoParto > today) add('animalUltimoParto', 'A data do parto não pode ser futura');
    else if (d.dataNasc && d.ultimoParto <= d.dataNasc) add('animalUltimoParto', 'O parto precisa ser depois do nascimento');
  }
  if (d.sit === 'Prenha' && d.prenhaData) {
    if (d.prenhaData > today) add('animalPrenhaData', 'O início da prenhez não pode ser futuro');
    else if (ageDays(d.prenhaData) > 300) add('animalPrenhaData', 'Prenhez acima de 300 dias — confira a data');
  }
  if (d.peso !== '' && (Number(d.peso) <= 0 || Number(d.peso) > 2000)) add('animalPeso', 'Peso deve ficar entre 0 e 2.000 kg');
  if (d.leite !== '' && (Number(d.leite) < 0 || Number(d.leite) > 100)) add('animalLeite', 'Produção deve ficar entre 0 e 100 L/dia');
  if (d.dataCompra) {
    if (d.dataCompra > today) add('animalDataCompra', 'A data da compra não pode ser futura');
    else if (d.dataNasc && d.dataCompra < d.dataNasc) add('animalDataCompra', 'A compra não pode ser antes do nascimento');
  }
  if (d.valorCompra !== '' && Number(d.valorCompra) < 0) add('animalValorCompra', 'Valor inválido');
  if (d.nomeMae && d.nomeMae === d.nome && d.origem === 'Nascido') add('animalMaeSelect', 'O animal não pode ser a própria mãe');
  return errs;
}
function markInvalid(id, msg) {
  const g = $(id)?.closest('.form-group');
  if (!g) return;
  g.classList.add('invalid');
  let e = g.querySelector('.field-err');
  if (!e) { e = document.createElement('div'); e.className = 'field-err'; g.appendChild(e); }
  e.textContent = msg;
}
function clearInvalid(scope = $('animalModal')) {
  scope?.querySelectorAll('.form-group.invalid').forEach(g => { g.classList.remove('invalid'); g.querySelector('.field-err')?.remove(); });
}
$('animalModal')?.addEventListener('input', e => { const g = e.target.closest?.('.form-group.invalid'); if (g) clearInvalid(g.parentElement); });

const nul = v => (v === '' || v == null ? null : v);
function toRow(d) {
  return {
    lote_id: d.loteId, num: d.num, nome: d.nome, origem: d.origem, tipo_prenhez: d.tipoPrenhez,
    data_nasc: nul(d.dataNasc), sexo: d.sexo, cat: d.cat, sit: d.sit, raca: d.raca, grau_sangue: d.grauSangue,
    nome_mae: d.nomeMae, nome_pai: d.nomePai, peso: nul(d.peso), leite: nul(d.leite),
    ultimo_parto: nul(d.ultimoParto), prenha_data: nul(d.prenhaData),
    brinco: nul(d.brinco), registro: nul(d.registro), pelagem: nul(d.pelagem), obs: nul(d.obs),
    data_compra: nul(d.dataCompra), valor_compra: nul(d.valorCompra), vendedor: nul(d.vendedor),
  };
}
const FIELDS = ['num', 'nome', 'origem', 'tipoPrenhez', 'dataNasc', 'sexo', 'cat', 'sit', 'raca', 'grauSangue', 'nomeMae', 'nomePai', 'peso', 'leite',
  'ultimoParto', 'prenhaData', 'brinco', 'registro', 'pelagem', 'obs', 'dataCompra', 'valorCompra', 'vendedor'];
const pick = d => Object.fromEntries(FIELDS.map(k => [k, d[k]]));

// ---------- Salvar (criar/editar) ----------
let saving = false;
function setSaving(on) {
  saving = on;
  document.querySelectorAll('#animalModal .form-actions .btn').forEach(b => { b.disabled = on; });
}

async function registrarHistorico(animalObj, d, old) {
  const hoje = todayISO();
  if (d.peso !== '' && Number(d.peso) !== Number(old?.peso)) {
    await dbInsert('animal_pesagens', { animal_id: animalObj.id, peso: d.peso, data: hoje });
    animalObj.pesagens = [...(animalObj.pesagens || []), { peso: d.peso, data: hoje }].slice(-5);
    if (old) await trimHistory('animal_pesagens', animalObj.id, 5);
  }
  if (d.leite !== '' && Number(d.leite) !== Number(old?.leite)) {
    await dbInsert('animal_leite_hist', { animal_id: animalObj.id, leite: d.leite, data: hoje });
    animalObj.leiteHist = [...(animalObj.leiteHist || []), { leite: d.leite, data: hoje }].slice(-20);
    if (old) await trimHistory('animal_leite_hist', animalObj.id, 20);
  }
}

export async function saveAnimalToLote(addAnother = false) {
  if (saving || !requireOnline()) return;
  const d = readAnimalForm();
  clearInvalid();
  const errs = validateAnimal(d);
  if (errs.length) {
    errs.forEach(e => markInvalid(e.id, e.msg));
    $(errs[0].id)?.closest('.form-group')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    toast(errs.length > 1 ? `${errs[0].msg} (+${errs.length - 1} campo(s) a corrigir)` : errs[0].msg, 'error');
    return;
  }
  const targetLote = state.db.lotes.find(x => x.id === d.loteId);
  const editing = !!state.editAniId;
  setSaving(true);
  try {
    await safeRun(async () => {
      let animalObj, extrasIgnored;
      if (editing) {
        const old = getAllAnimals().find(a => a.id === state.editAniId);
        ({ extrasIgnored } = await dbWriteAnimal(state.editAniId, toRow(d)));
        // Move de lote em memória se mudou; mantém o mesmo objeto (fotos/históricos).
        state.db.lotes.forEach(l => {
          const idx = l.animals.findIndex(x => x.id === state.editAniId);
          if (idx !== -1) { animalObj = l.animals[idx]; l.animals.splice(idx, 1); }
        });
        Object.assign(animalObj, pick(d));
        targetLote.animals.push(animalObj);
        await registrarHistorico(animalObj, d, old);
      } else {
        const res = await dbWriteAnimal(null, toRow(d));
        extrasIgnored = res.extrasIgnored;
        animalObj = { id: res.data.id, ...pick(d), photoPath: '', pesagens: [], leiteHist: [] };
        targetLote.animals.push(animalObj);
        await registrarHistorico(animalObj, d, null);
        await atualizarMaeAposNascimento(d);
      }
      if (state.tempAnimalPhoto !== undefined) {
        if (state.tempAnimalPhoto) animalObj.photoPath = await uploadAnimalPhoto(animalObj.id, state.tempAnimalPhoto);
        else { await deleteAnimalPhoto(animalObj.id); animalObj.photoPath = ''; }
      }
      if (extrasIgnored) toast('Animal salvo, mas brinco/registro/pelagem/obs/compra não foram gravados: o banco precisa da atualização (veja o README).', 'info');
      else toast(addAnother ? `#${d.num} salvo! Pronto para o próximo.` : 'Animal salvo!');
      if (addAnother && !editing) prepareAnotherAnimal(d);
      else closeModal('animalModal');
      refresh('rebanho');
    });
  } catch { /* erro já exibido pelo safeRun */ } finally {
    setSaving(false);
  }
}

// Nasceu na propriedade e é recente: atualiza a mãe (último parto, categoria, encerra a prenhez).
async function atualizarMaeAposNascimento(d) {
  if (d.origem !== 'Nascido' || !d.nomeMae || !d.dataNasc || ageDays(d.dataNasc) > 300) return;
  const mae = getAllAnimals().find(a => a.nome === d.nomeMae && a.sexo === 'Fêmea');
  if (!mae || (mae.ultimoParto && mae.ultimoParto >= d.dataNasc)) return;
  const patch = { ultimo_parto: d.dataNasc, cat: 'Vaca em lactação', prenha_data: null };
  if (mae.sit === 'Prenha') patch.sit = 'Vazia';
  await dbUpdate('animais', mae.id, patch);
  state.db.lotes.forEach(l => l.animals.forEach(a => {
    if (a.id === mae.id) { a.ultimoParto = d.dataNasc; a.cat = 'Vaca em lactação'; if (a.sit === 'Prenha') a.sit = 'Vazia'; a.prenhaData = ''; }
  }));
}

// ---------- Abrir formulário ----------
let formPrepared = false;
function prepareNewAnimalForm(loteId) {
  state.editAniId = null;
  formPrepared = true;
  $('animalModalTitle').textContent = 'Adicionar animal';
  $('btnSaveAnother').classList.remove('hidden');
  populateLoteSelect('animalLote');
  $('animalLote').value = loteId || (state.db.lotes.length === 1 ? state.db.lotes[0].id : '');
  onSexoChange();
  onOrigemChange();
  resetAnimalPhoto();
  updateAnimalHints();
}
function prepareAnotherAnimal(prev) {
  // Mantém o que costuma se repetir num cadastro em sequência; limpa o resto.
  const keep = { lote: prev.loteId, sexo: prev.sexo, cat: prev.cat, origem: prev.origem, raca: prev.raca };
  const modal = $('animalModal');
  modal.querySelectorAll('input:not([type=file]),textarea').forEach(el => { el.value = ''; });
  modal.querySelectorAll('select').forEach(el => { el.selectedIndex = 0; });
  clearInvalid();
  $('animalSexo').value = keep.sexo;
  $('animalOrigem').value = keep.origem;
  prepareNewAnimalForm(keep.lote);
  if (keep.cat) { $('animalCat').value = keep.cat; onCatChange(); }
  $('animalRaca').value = keep.raca;
  modal.querySelector('.modal').scrollTop = 0;
  $('animalNum').focus();
}
export function openNewAnimal(loteId = '') {
  if (!state.db.lotes.length) {
    toast('Crie um lote antes de cadastrar animais', 'info');
    openModal('loteModal');
    return;
  }
  prepareNewAnimalForm(loteId);
  openModal('animalModal');
}
export function openAnimalForLote() { openNewAnimal(state.currentLoteId || ''); }

export async function editAnimalInLote(aid) {
  const a = getAnimalById(aid);
  if (!a) return;
  state.editAniId = aid;
  formPrepared = true;
  populateLoteSelect('animalLote');
  const set = (id, v) => { const el = $(id); if (el) el.value = v ?? ''; };
  set('animalNum', a.num); set('animalNome', a.nome);
  set('animalBrinco', a.brinco); set('animalRegistro', a.registro);
  set('animalOrigem', a.origem || 'Nascido');
  onOrigemChange();
  if ((a.origem || 'Nascido') === 'Nascido') {
    set('animalTipoPrenhez', a.tipoPrenhez || 'Natural');
    set('animalMaeSelect', a.nomeMae); set('animalPaiSelect', a.nomePai);
  } else {
    set('animalNomeMae', a.nomeMae); set('animalNomePai', a.nomePai);
    set('animalDataCompra', a.dataCompra); set('animalValorCompra', a.valorCompra); set('animalVendedor', a.vendedor);
  }
  set('animalDataNasc', a.dataNasc);
  set('animalLote', a.loteId);
  set('animalSexo', a.sexo);
  onSexoChange();
  set('animalCat', a.cat);
  onCatChange();
  if (!$('animalSit').disabled) set('animalSit', a.sit);
  updateFieldVisibility();
  set('animalRaca', a.raca); set('animalGrauSangue', a.grauSangue); set('animalPelagem', a.pelagem);
  set('animalPeso', a.peso); set('animalLeite', a.leite);
  set('animalUltimoParto', a.ultimoParto); set('animalPrenhaData', a.prenhaData); set('animalPrenhaDias', '');
  set('animalObs', a.obs);
  $('animalModalTitle').textContent = `Editar #${a.num} ${a.nome}`;
  $('btnSaveAnother').classList.add('hidden');
  state.tempAnimalPhoto = undefined;
  const photoInput = $('animalPhotoInput');
  if (photoInput) photoInput.value = '';
  setAnimalPhotoUI(null);
  updateAnimalHints();
  openModal('animalModal');
  setAnimalPhotoUI(await getAnimalPhotoUrl(a));
}

export async function delAnimalFromLote(aid) {
  const a = getAnimalById(aid);
  if (!a) return;
  const ok = await showConfirm(`Excluir #${a.num} ${a.nome} definitivamente? Para venda ou morte, prefira "Dar baixa" (mantém o histórico).`, '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('animais', aid);
    await deleteAnimalPhoto(aid).catch(() => {});
    state.db.lotes.forEach(l => { l.animals = l.animals.filter(x => x.id !== aid); });
    closeModal('fichaModal');
    refresh('rebanho');
  }, 'Animal excluído');
}

export function openAnimalActions(aid) {
  const a = getAnimalById(aid);
  if (!a) return;
  openActionSheet({
    title: `#${a.num} ${a.nome}`,
    sub: [a.cat, a.loteName && 'Lote ' + a.loteName].filter(Boolean).join(' · '),
    actions: [
      { label: 'Ver ficha completa', icon: '📋', fn: () => openFicha(aid) },
      { label: 'Editar dados', icon: '✏️', fn: () => editAnimalInLote(aid) },
      { label: 'Dar baixa (venda ou morte)', icon: '📦', tone: 'info', fn: () => openBaixa(aid) },
      { label: 'Excluir animal', icon: '🗑️', tone: 'danger', fn: () => delAnimalFromLote(aid) },
    ],
  });
}

// ---------- Lista "Todos os animais" ----------
const SORTS = {
  num: arr => sortByNum(arr),
  nome: arr => arr.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt', { sensitivity: 'base' })),
  leite: arr => arr.sort((a, b) => (parseFloat(b.leite) || 0) - (parseFloat(a.leite) || 0)),
  novos: arr => arr.sort((a, b) => (b.dataNasc || '').localeCompare(a.dataNasc || '')),
  velhos: arr => arr.sort((a, b) => (a.dataNasc || '9999').localeCompare(b.dataNasc || '9999')),
};
export function clearAnimalFilters() {
  ['fAnSexo', 'fAnCat', 'fAnSit', 'fAnLote'].forEach(id => { const el = $(id); if (el) el.value = ''; });
  $('fAnSort').value = 'num';
  renderAnimaisFolder();
}
export function renderAnimaisFolder() {
  const c = $('animaisList');
  if (!c) return;
  const all = getAllAnimals();
  populateLoteSelect('fAnLote', 'Todos');
  const q = val('searchAnimais').toLowerCase();
  const fs = $('fAnSexo')?.value || '', fc = $('fAnCat')?.value || '', fst = $('fAnSit')?.value || '', fl = $('fAnLote')?.value || '';
  const animals = all.filter(a => {
    if (q && ![a.num, a.nome, a.brinco].some(v => (v || '').toLowerCase().includes(q))) return false;
    if (fs && a.sexo !== fs) return false;
    if (fc && a.cat !== fc) return false;
    if (fst && (a.sit || 'Não se aplica') !== fst) return false;
    if (fl && a.loteId !== fl) return false;
    return true;
  });
  (SORTS[$('fAnSort')?.value] || SORTS.num)(animals);
  updateFilterBadge('btnFilterAnimais', ['fAnSexo', 'fAnCat', 'fAnSit', 'fAnLote']);
  const filtered = q || fs || fc || fst || fl;
  $('animaisSub').textContent = filtered ? `Mostrando ${animals.length} de ${all.length}` : `${all.length} animal(is)`;
  if (!animals.length) {
    c.innerHTML = all.length ? emptyStateHtml('Nenhum animal encontrado com esses filtros.')
      : emptyStateHtml('Nenhum animal cadastrado ainda.', { label: 'Cadastrar primeiro animal', onclick: 'openNewAnimal()' });
    return;
  }
  const insemIndex = buildInsemIndex();
  renderListChunked(c, animals, a => animalRowHtml(a, { showLote: true, insemIndex }), { after: hydrateThumbs });
}

// ---------- Ficha 360° ----------
export async function openFicha(aid) {
  const a = getAnimalById(aid);
  if (!a) return;
  const all = getAllAnimals();
  const fmt = s => fmtDateBR(s) || '—';
  const mae = a.nomeMae ? all.find(x => x.nome === a.nomeMae && x.sexo === 'Fêmea') : null;
  const pai = a.nomePai ? all.find(x => x.nome === a.nomePai) : null;
  const filhos = all.filter(x => x.id !== a.id && a.nome && (x.nomeMae === a.nome || x.nomePai === a.nome));

  const insem = [];
  state.db.inseminacao.forEach(p => p.animals.forEach(x => { if (matchAnimal(x.num, x.aid, a)) insem.push({ plan: p.name, ...x }); }));
  insem.sort((m, n) => (n.data || '').localeCompare(m.data || ''));
  const meds = state.db.medDirect.filter(r => (r.animais || []).some(x => matchAnimal(x.num, x.aid, a)));
  const alis = state.db.aliDirect.filter(r => (r.animais || []).some(x => matchAnimal(x.num, x.aid, a)));
  let feedCost = 0;
  alis.forEach(r => { const n = r.numAnimais || (r.animais || []).length || 1; feedCost += parseFloat(r.custoTotal || 0) / n; });
  const link = (an, txt) => `<span class="ficha-link" onclick="openFicha('${an.id}')">${esc(txt)}</span>`;
  const kv = (k, v) => v ? `<div class="kv"><span>${k}</span><b>${v}</b></div>` : '';
  const sec = (icon, title, body) => `<div class="ficha-sec"><div class="ficha-sec-title"><span>${icon}</span>${title}</div>${body}</div>`;

  let html = `<div class="ficha-hero"><div id="fichaPhoto" class="ficha-photo">🐄</div><div class="ficha-hero-info">
    <div class="ani-top"><span class="ani-num">#${esc(a.num)}</span><span class="ani-name">${esc(a.nome)}</span>${sexIcon(a.sexo)}</div>
    <div class="ani-tags"><span class="tag">${esc(a.cat)}</span>${sitTag(a.sit)}<span class="tag tag-lote">${esc(a.loteName || '—')}</span></div>
    <div class="ani-meta">${[a.dataNasc && formatAge(a.dataNasc), a.raca, a.grauSangue && 'GS ' + a.grauSangue].filter(Boolean).map(esc).join(' · ')}</div>
  </div></div>`;
  html += `<div class="ficha-actions"><button class="btn btn-sm btn-primary" onclick="closeModal('fichaModal');editAnimalInLote('${a.id}')">✏️ Editar</button><button class="btn btn-sm btn-info" onclick="closeModal('fichaModal');openBaixa('${a.id}')">📦 Dar baixa</button></div>`;

  html += sec('🪪', 'Identificação', '<div class="kv-grid">' +
    kv('Nascimento', a.dataNasc ? fmt(a.dataNasc) : '') + kv('Origem', esc(a.origem === 'Nascido' ? 'Nascido na fazenda' : a.origem)) +
    kv('Brinco', esc(a.brinco)) + kv('Registro', esc(a.registro)) + kv('Pelagem', esc(a.pelagem)) +
    kv('Peso', a.peso !== '' && a.peso != null ? esc(a.peso) + ' kg' : '') + kv('Leite', a.leite !== '' && a.leite != null ? esc(a.leite) + ' L/dia' : '') +
    (a.origem === 'Comprado' ? kv('Compra', a.dataCompra ? fmt(a.dataCompra) : '') + kv('Valor pago', a.valorCompra !== '' && a.valorCompra != null ? 'R$ ' + Number(a.valorCompra).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '') + kv('Procedência', esc(a.vendedor)) : '') +
    '</div>' + (a.obs ? `<div class="ficha-obs">${esc(a.obs)}</div>` : ''));

  html += sec('🧬', 'Família', `<div class="kv-grid">${kv('Mãe', mae ? link(mae, a.nomeMae) : esc(a.nomeMae || '—'))}${kv('Pai', pai ? link(pai, a.nomePai) : esc(a.nomePai || '—'))}</div>` +
    `<div class="card-sub" style="margin-top:8px">Filhos (${filhos.length})</div>` +
    (filhos.length ? `<div class="ani-tags">` + filhos.map(f => `<span class="tag tag-click" onclick="openFicha('${f.id}')">#${esc(f.num)} ${esc(f.nome)}</span>`).join('') + `</div>` : ''));

  let repro = '';
  if (a.sit === 'Prenha') {
    const base = a.prenhaData || (insem[0] && insem[0].data);
    if (base) { const exp = new Date(base + 'T12:00'); exp.setDate(exp.getDate() + GESTACAO_DIAS); repro += kv('Parto previsto', `<span style="color:var(--g300)">${exp.toLocaleDateString('pt-BR')}</span>`); }
  }
  if (a.ultimoParto) repro += kv('Último parto', fmt(a.ultimoParto)) + kv('DEL', ageDays(a.ultimoParto) + ' dias');
  repro += kv('Inseminações', String(insem.length));
  html += sec('🐄', 'Reprodução', `<div class="kv-grid">${repro}</div>` +
    insem.map(x => `<div class="card-sub" style="margin-top:5px">• ${fmt(x.data)}${x.touro ? ' · Touro: ' + esc(x.touro) : ''}${x.muco ? ' · Muco: ' + esc(x.muco) : ''}${x.parecer ? ' · ' + esc(x.parecer) : ''}</div>`).join(''));

  html += sec('💊', `Medicações (${meds.length})`, meds.length ? meds.map(r => {
    const ms = Array.isArray(r.medicamentos) ? r.medicamentos.map(m => esc(m.nome) + (m.dose ? ' (' + esc(m.dose) + ')' : '')).join(', ') : '';
    let cd = ''; if (r.carenciaLeite) cd += ' · 🥛' + esc(r.carenciaLeite) + 'd'; if (r.carenciaCarne) cd += ' · 🥩' + esc(r.carenciaCarne) + 'd';
    return `<div class="card-sub" style="margin-bottom:5px">• <strong>${esc(r.tipo || '')}</strong>: ${ms} ${r.dataIni ? '(' + fmt(r.dataIni) + (r.dataFim ? '→' + fmt(r.dataFim) : '') + ')' : ''}${cd}</div>`;
  }).join('') : `<div class="card-sub">Nenhuma.</div>`);

  html += sec('🌾', 'Alimentação e custo', `<div class="kv-grid">${kv('Custo de ração acumulado', `<span style="color:var(--g300)">R$ ${feedCost.toFixed(2)}</span>`)}${kv('Produção atual', a.leite ? esc(a.leite) + ' L/dia' : '—')}</div>`);

  const lh = a.leiteHist || [], ph = a.pesagens || [];
  if (lh.length || ph.length) {
    html += sec('📈', 'Evolução', (lh.length ? `<div class="card-sub">Leite (L/dia)</div><canvas id="fichaLeite" width="300" height="130" style="width:100%;margin-bottom:10px"></canvas>` : '') +
      (ph.length ? `<div class="card-sub">Peso (kg)</div><canvas id="fichaPeso" width="300" height="130" style="width:100%"></canvas>` : ''));
  }

  let ev = [];
  if (a.dataNasc) ev.push({ d: a.dataNasc, t: '🐣 Nascimento' });
  if (a.dataCompra) ev.push({ d: a.dataCompra, t: '🤝 Compra' + (a.vendedor ? ' (' + esc(a.vendedor) + ')' : '') });
  if (a.ultimoParto) ev.push({ d: a.ultimoParto, t: '🐄 Parto' });
  insem.forEach(x => { if (x.data) ev.push({ d: x.data, t: '🔬 Inseminação' + (x.touro ? ' (' + esc(x.touro) + ')' : '') }); });
  ph.forEach(x => { if (x.data) ev.push({ d: x.data, t: '⚖️ Pesagem: ' + esc(x.peso) + 'kg' }); });
  lh.forEach(x => { if (x.data) ev.push({ d: x.data, t: '🥛 Leite: ' + esc(x.leite) + 'L' }); });
  meds.forEach(r => { if (r.dataIni) ev.push({ d: r.dataIni, t: '💊 ' + esc(r.tipo || 'Medicação') }); });
  ev = ev.filter(e => e.d).sort((m, n) => n.d.localeCompare(m.d));
  html += sec('🕒', 'Linha do tempo', ev.length ? ev.map(e => `<div class="card-sub" style="margin-bottom:5px">${fmt(e.d)} — ${e.t}</div>`).join('') : '<div class="card-sub">Sem eventos.</div>');

  $('fichaTitle').textContent = 'Ficha do animal';
  $('fichaContent').innerHTML = html;
  openModal('fichaModal');
  $('fichaModal').querySelector('.modal').scrollTop = 0;
  getAnimalPhotoUrl(a).then(url => {
    const el = $('fichaPhoto');
    if (el && url) { el.textContent = ''; el.style.backgroundImage = `url('${url}')`; }
  });
  if (lh.length) drawLineChart('fichaLeite', lh.map(x => parseFloat(x.leite) || 0), '#1bd171');
  if (ph.length) drawLineChart('fichaPeso', ph.map(x => parseFloat(x.peso) || 0), '#5b9aff');
}

// Abertura por caminhos antigos (openModal('animalModal') direto) continua funcionando.
registerModalSetup('animalModal', () => {
  if (!state.editAniId && !formPrepared) prepareNewAnimalForm(state.currentLoteId || '');
});
registerModalTeardown('animalModal', () => {
  formPrepared = false;
  clearInvalid();
  resetAnimalPhoto();
  setSaving(false);
  $('btnSaveAnother')?.classList.remove('hidden');
});
