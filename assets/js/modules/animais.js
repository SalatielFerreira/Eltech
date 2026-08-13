// ========== FORMULÁRIO, FICHA E CRUD DO ANIMAL ==========
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, closeModal, requireOnline, registerModalSetup } from './ui.js';
import { dbInsert, dbUpdate, dbDelete, trimHistory, getAllAnimals, sortByNum, ageMonths, getAnimalById } from './data.js';
import { animalRowHtml } from './animalRow.js';
import { populateLoteSelect, renderLoteAnimals, renderLotes } from './lotes.js';
import { resetAnimalPhoto, setAnimalPhotoUI, uploadAnimalPhoto, deleteAnimalPhoto, getAnimalPhotoUrl, hydrateThumbs } from './fotos.js';
import { SIT_OPTIONS, CATEGORIAS_MACHO, CATEGORIAS_FEMEA, GESTACAO_DIAS } from './constants.js';
import { drawLineChart } from './charts.js';

// ---------- Regras do formulário (visibilidade de campos por sexo/categoria/situação) ----------
export function onSexoChange() {
  const sexo = document.getElementById('animalSexo').value;
  const catSel = document.getElementById('animalCat');
  catSel.innerHTML = '';
  (sexo === 'Macho' ? CATEGORIAS_MACHO : CATEGORIAS_FEMEA).forEach(o => { catSel.innerHTML += `<option value="${o}">${o}</option>`; });
  onCatChange();
}
export function onCatChange() {
  const sexo = document.getElementById('animalSexo').value;
  const cat = document.getElementById('animalCat').value;
  const sitSel = document.getElementById('animalSit');
  if (sexo === 'Macho' || cat === 'Bezerra') {
    sitSel.innerHTML = '<option value="Não se aplica">Não se aplica</option>';
    sitSel.disabled = true;
  } else {
    const cur = sitSel.value;
    sitSel.innerHTML = '';
    SIT_OPTIONS.forEach(o => { sitSel.innerHTML += `<option value="${o}">${o}</option>`; });
    if (cur && SIT_OPTIONS.includes(cur)) sitSel.value = cur;
    sitSel.disabled = false;
  }
  onSitChange();
}
export function onSitChange() { updateFieldVisibility(); }
export function updateFieldVisibility() {
  const sexo = document.getElementById('animalSexo').value;
  const cat = document.getElementById('animalCat').value;
  const sit = document.getElementById('animalSit').value;
  const hideLeite = (sexo === 'Macho' || cat === 'Bezerro' || cat === 'Bezerra' || sit === 'Anestro');
  document.getElementById('leiteGroup').style.display = hideLeite ? 'none' : 'block';
  if (hideLeite) document.getElementById('animalLeite').value = '';
  const showParto = (sexo === 'Fêmea' && (cat === 'Novilha' || cat === 'Vaca seca' || cat === 'Vaca em lactação') &&
    (sit === 'Vazia' || sit === 'Prenha' || sit === 'Vazia Cloe' || sit === 'Vazia Clod' || sit === 'Cio'));
  document.getElementById('partoGroup').style.display = showParto ? 'block' : 'none';
  if (!showParto) document.getElementById('animalUltimoParto').value = '';
  const showPrenha = (sit === 'Prenha');
  document.getElementById('prenhaGroup').style.display = showPrenha ? 'block' : 'none';
  if (!showPrenha) { document.getElementById('animalPrenhaData').value = ''; document.getElementById('animalPrenhaDias').value = ''; }
}
export function initAnimalForm() { onSexoChange(); onOrigemChange(); resetAnimalPhoto(); }
export function onOrigemChange() {
  const origem = document.getElementById('animalOrigem').value;
  document.getElementById('paiMaeNascido').classList.toggle('hidden', origem !== 'Nascido');
  document.getElementById('paiMaeComprado').classList.toggle('hidden', origem !== 'Comprado');
  if (origem === 'Nascido') populateMaePaiSelects();
}
export function populateMaePaiSelects() {
  const all = getAllAnimals();
  const maeSel = document.getElementById('animalMaeSelect');
  const paiSel = document.getElementById('animalPaiSelect');
  const prevMae = maeSel.value, prevPai = paiSel.value;
  maeSel.innerHTML = '<option value="">Selecione...</option>';
  paiSel.innerHTML = '<option value="">Selecione...</option>';
  sortByNum(all.filter(a => a.sexo === 'Fêmea')).forEach(a => { maeSel.innerHTML += `<option value="${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)}</option>`; });
  const pais = new Set();
  sortByNum(all.filter(a => a.sexo === 'Macho')).forEach(a => { paiSel.innerHTML += `<option value="${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)}</option>`; pais.add(a.nome); });
  state.db.inseminacao.forEach(p => p.animals.forEach(a => {
    if (a.touro && !pais.has(a.touro)) { paiSel.innerHTML += `<option value="${esc(a.touro)}">🧬 ${esc(a.touro)} (insem.)</option>`; pais.add(a.touro); }
  }));
  (state.db.touros || []).forEach(t => {
    if (t.nome && !pais.has(t.nome)) { paiSel.innerHTML += `<option value="${esc(t.nome)}">🐂 ${esc(t.nome)}</option>`; pais.add(t.nome); }
  });
  if (prevMae) maeSel.value = prevMae;
  if (prevPai) paiSel.value = prevPai;
}

// ---------- Salvar (criar/editar) ----------
function readAnimalForm() {
  const origem = document.getElementById('animalOrigem').value;
  let nomeMae = '', nomePai = '', tipoPrenhez = '';
  if (origem === 'Nascido') {
    nomeMae = document.getElementById('animalMaeSelect').value || '';
    nomePai = document.getElementById('animalPaiSelect').value || '';
    tipoPrenhez = document.getElementById('animalTipoPrenhez').value || '';
  } else {
    nomeMae = document.getElementById('animalNomeMae').value.trim();
    nomePai = document.getElementById('animalNomePai').value.trim();
  }
  let prenhaData = document.getElementById('animalPrenhaData').value || '';
  const prenhaDias = document.getElementById('animalPrenhaDias').value || '';
  if (!prenhaData && prenhaDias) {
    const dias = parseInt(prenhaDias, 10);
    if (!isNaN(dias)) { const d = new Date(); d.setDate(d.getDate() - dias); prenhaData = d.toISOString().split('T')[0]; }
  }
  return {
    num: document.getElementById('animalNum').value.trim(),
    nome: document.getElementById('animalNome').value.trim(),
    loteId: document.getElementById('animalLote').value,
    origem, tipoPrenhez, nomeMae, nomePai,
    dataNasc: document.getElementById('animalDataNasc').value || '',
    sexo: document.getElementById('animalSexo').value,
    cat: document.getElementById('animalCat').value,
    sit: document.getElementById('animalSit').value,
    raca: document.getElementById('animalRaca').value || '',
    grauSangue: document.getElementById('animalGrauSangue').value || '',
    peso: document.getElementById('animalPeso').value || '',
    leite: document.getElementById('animalLeite').value || '',
    ultimoParto: document.getElementById('animalUltimoParto').value || '',
    prenhaData,
  };
}
function toRow(d) {
  return {
    lote_id: d.loteId, num: d.num, nome: d.nome, origem: d.origem, tipo_prenhez: d.tipoPrenhez,
    data_nasc: d.dataNasc || null, sexo: d.sexo, cat: d.cat, sit: d.sit, raca: d.raca, grau_sangue: d.grauSangue,
    nome_mae: d.nomeMae, nome_pai: d.nomePai, peso: d.peso === '' ? null : d.peso, leite: d.leite === '' ? null : d.leite,
    ultimo_parto: d.ultimoParto || null, prenha_data: d.prenhaData || null,
  };
}

export async function saveAnimalToLote() {
  if (!requireOnline()) return;
  const d = readAnimalForm();
  if (!d.num || !d.nome) return toast('Preencha nº e nome', 'error');
  if (!d.loteId) return toast('Selecione um lote', 'error');
  const targetLote = state.db.lotes.find(x => x.id === d.loteId);
  if (!state.editAniId && targetLote?.animals.some(x => x.num === d.num)) return toast('Nº ' + d.num + ' já existe neste lote', 'error');

  await safeRun(async () => {
    let savedAid;
    if (state.editAniId) {
      savedAid = state.editAniId;
      const oldAnimal = getAllAnimals().find(a => a.id === state.editAniId);
      await dbUpdate('animais', savedAid, toRow(d));
      if (d.peso && d.peso !== oldAnimal.peso) {
        await dbInsert('animal_pesagens', { animal_id: savedAid, peso: d.peso, data: new Date().toISOString().split('T')[0] });
        await trimHistory('animal_pesagens', savedAid, 5);
      }
      if (d.leite && d.leite !== oldAnimal.leite) {
        await dbInsert('animal_leite_hist', { animal_id: savedAid, leite: d.leite, data: new Date().toISOString().split('T')[0] });
        await trimHistory('animal_leite_hist', savedAid, 20);
      }
      // Move de lote localmente se mudou; refaz o objeto local a partir da linha salva.
      let animalObj = null;
      state.db.lotes.forEach(l => {
        const idx = l.animals.findIndex(x => x.id === savedAid);
        if (idx !== -1) { animalObj = l.animals[idx]; l.animals.splice(idx, 1); }
      });
      Object.assign(animalObj, {
        num: d.num, nome: d.nome, origem: d.origem, tipoPrenhez: d.tipoPrenhez, dataNasc: d.dataNasc,
        sexo: d.sexo, cat: d.cat, sit: d.sit, raca: d.raca, grauSangue: d.grauSangue, nomeMae: d.nomeMae,
        nomePai: d.nomePai, peso: d.peso, leite: d.leite, ultimoParto: d.ultimoParto, prenhaData: d.prenhaData,
      });
      targetLote.animals.push(animalObj);
    } else {
      const row = await dbInsert('animais', toRow(d));
      savedAid = row.id;
      const animalObj = {
        id: row.id, num: d.num, nome: d.nome, origem: d.origem, tipoPrenhez: d.tipoPrenhez, dataNasc: d.dataNasc,
        sexo: d.sexo, cat: d.cat, sit: d.sit, raca: d.raca, grauSangue: d.grauSangue, nomeMae: d.nomeMae,
        nomePai: d.nomePai, peso: d.peso, leite: d.leite, ultimoParto: d.ultimoParto, prenhaData: d.prenhaData,
        photoPath: '', pesagens: [], leiteHist: [],
      };
      if (d.peso) { await dbInsert('animal_pesagens', { animal_id: savedAid, peso: d.peso, data: new Date().toISOString().split('T')[0] }); animalObj.pesagens = [{ peso: d.peso, data: new Date().toISOString().split('T')[0] }]; }
      if (d.leite) { await dbInsert('animal_leite_hist', { animal_id: savedAid, leite: d.leite, data: new Date().toISOString().split('T')[0] }); animalObj.leiteHist = [{ leite: d.leite, data: new Date().toISOString().split('T')[0] }]; }
      targetLote.animals.push(animalObj);

      // Nasceu na propriedade: atualiza a mãe (último parto, categoria, encerra a prenhez).
      if (d.origem === 'Nascido' && d.nomeMae && d.dataNasc) {
        const mae = getAllAnimals().find(a => a.nome === d.nomeMae && a.sexo === 'Fêmea');
        if (mae) {
          const patch = { ultimo_parto: d.dataNasc, cat: 'Vaca em lactação', prenha_data: null };
          if (mae.sit === 'Prenha') patch.sit = 'Vazia';
          await dbUpdate('animais', mae.id, patch);
          state.db.lotes.forEach(l => l.animals.forEach(a => {
            if (a.id === mae.id) { a.ultimoParto = d.dataNasc; a.cat = 'Vaca em lactação'; if (a.sit === 'Prenha') a.sit = 'Vazia'; a.prenhaData = ''; }
          }));
        }
      }
    }
    if (state.tempAnimalPhoto !== undefined) {
      if (state.tempAnimalPhoto) await uploadAnimalPhoto(savedAid, state.tempAnimalPhoto);
      else await deleteAnimalPhoto(savedAid);
      const a = getAllAnimals().find(x => x.id === savedAid);
      if (a) a.photoPath = state.tempAnimalPhoto ? `${state.session.user.id}/${savedAid}.jpg` : '';
    }
    closeModal('animalModal');
    if (state.currentLoteId) renderLoteAnimals();
    renderLotes();
    renderAnimaisFolder();
  }, 'Animal salvo!');
}

export function openAnimalForLote() {
  state.editAniId = null;
  document.getElementById('animalModalTitle').textContent = 'Adicionar Animal';
  initAnimalForm();
  populateLoteSelect('animalLote');
  document.getElementById('animalLote').value = state.currentLoteId || '';
  openModal('animalModal');
}

export async function editAnimalInLote(aid) {
  const a = getAnimalById(aid);
  if (!a) return;
  state.editAniId = aid;
  populateLoteSelect('animalLote');
  document.getElementById('animalNum').value = a.num;
  document.getElementById('animalNome').value = a.nome;
  document.getElementById('animalOrigem').value = a.origem || 'Nascido';
  onOrigemChange();
  if (a.origem === 'Nascido') {
    document.getElementById('animalTipoPrenhez').value = a.tipoPrenhez || 'Natural';
    document.getElementById('animalMaeSelect').value = a.nomeMae || '';
    document.getElementById('animalPaiSelect').value = a.nomePai || '';
  } else {
    document.getElementById('animalNomeMae').value = a.nomeMae || '';
    document.getElementById('animalNomePai').value = a.nomePai || '';
  }
  document.getElementById('animalDataNasc').value = a.dataNasc || '';
  document.getElementById('animalLote').value = a.loteId;
  document.getElementById('animalSexo').value = a.sexo;
  onSexoChange();
  document.getElementById('animalCat').value = a.cat;
  onCatChange();
  document.getElementById('animalSit').value = a.sit;
  updateFieldVisibility();
  document.getElementById('animalRaca').value = a.raca || '';
  document.getElementById('animalGrauSangue').value = a.grauSangue || '';
  document.getElementById('animalPeso').value = a.peso || '';
  document.getElementById('animalLeite').value = a.leite || '';
  document.getElementById('animalUltimoParto').value = a.ultimoParto || '';
  document.getElementById('animalPrenhaData').value = a.prenhaData || '';
  document.getElementById('animalPrenhaDias').value = '';
  document.getElementById('animalModalTitle').textContent = 'Editar Animal';
  state.tempAnimalPhoto = undefined;
  const photoInput = document.getElementById('animalPhotoInput');
  if (photoInput) photoInput.value = '';
  setAnimalPhotoUI(await getAnimalPhotoUrl(a));
  openModal('animalModal');
}

export async function delAnimalFromLote(aid) {
  const ok = await showConfirm('Excluir este animal?', '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await dbDelete('animais', aid);
    await deleteAnimalPhoto(aid).catch(() => {});
    state.db.lotes.forEach(l => { l.animals = l.animals.filter(x => x.id !== aid); });
    renderLoteAnimals();
    renderLotes();
    renderAnimaisFolder();
  }, 'Animal excluído');
}

// ---------- Lista "Todos os Animais" ----------
export function renderAnimaisFolder() {
  const c = document.getElementById('animaisList');
  const cnt = document.getElementById('cntAnimais');
  const all = getAllAnimals();
  if (cnt) cnt.textContent = all.length;
  if (!c) return;
  const q = (document.getElementById('searchAnimais')?.value || '').toLowerCase().trim();
  const fs = document.getElementById('fAnSexo')?.value || '';
  const fc = document.getElementById('fAnCat')?.value || '';
  const fst = document.getElementById('fAnSit')?.value || '';
  let animals = all.filter(a => {
    if (q && !((a.num || '').toLowerCase().includes(q) || (a.nome || '').toLowerCase().includes(q))) return false;
    if (fs && a.sexo !== fs) return false;
    if (fc && a.cat !== fc) return false;
    if (fst && a.sit !== fst) return false;
    return true;
  });
  sortByNum(animals);
  if (!animals.length) { c.innerHTML = '<div class="empty-state" style="padding:24px"><p>Nenhum animal.</p></div>'; return; }
  c.innerHTML = animals.map(a => animalRowHtml(a, { showLote: true })).join('');
  hydrateThumbs();
}

// ---------- Ficha 360° ----------
export async function openFicha(aid) {
  const a = getAnimalById(aid);
  if (!a) return;
  const all = getAllAnimals();
  const fmt = s => s ? new Date(s + 'T12:00').toLocaleDateString('pt-BR') : '—';
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
  const link = (an, txt) => `<span style="color:var(--g400);cursor:pointer;text-decoration:underline" onclick="openFicha('${an.id}')">${esc(txt)}</span>`;

  let html = `<div id="fichaPhoto" class="ficha-photo">🐄</div><div class="badges" style="margin-bottom:12px"><span class="badge ${a.sexo === 'Macho' ? 'badge-m' : 'badge-f'}">${esc(a.sexo)}</span><span class="badge badge-cat">${esc(a.cat)}</span><span class="badge badge-sit">${esc(a.sit)}</span>${a.origem ? `<span class="badge badge-muco">${esc(a.origem)}</span>` : ''}</div>`;
  html += `<div class="card glass2" style="margin-bottom:14px"><div class="card-sub">${ageMonths(a.dataNasc) ? ageMonths(a.dataNasc) + ' meses · ' : ''}Lote: ${esc(a.loteName || '—')}${a.raca ? ' · ' + esc(a.raca) : ''}${a.grauSangue ? ' · GS ' + esc(a.grauSangue) : ''}${a.peso ? ' · ' + esc(a.peso) + 'kg' : ''}${a.leite ? ' · ' + esc(a.leite) + 'L/dia' : ''}${a.dataNasc ? ' · Nasc.: ' + fmt(a.dataNasc) : ''}</div></div>`;

  html += `<div class="med-section-title" style="font-size:1rem"><span class="icon">🧬</span>Família</div><div class="card glass3" style="margin-bottom:14px">`;
  html += `<div class="card-sub">Mãe: ${mae ? link(mae, a.nomeMae) : esc(a.nomeMae || '—')}</div>`;
  html += `<div class="card-sub" style="margin-top:4px">Pai: ${pai ? link(pai, a.nomePai) : esc(a.nomePai || '—')}</div>`;
  html += `<div class="card-sub" style="margin-top:8px">Filhos (${filhos.length}):</div>`;
  html += filhos.length ? `<div class="badges" style="margin-top:4px">` + filhos.map(f => `<span class="badge badge-cat" style="cursor:pointer" onclick="openFicha('${f.id}')">#${esc(f.num)} ${esc(f.nome)}</span>`).join('') + `</div>` : `<div class="card-sub">—</div>`;
  html += `</div>`;

  html += `<div class="med-section-title" style="font-size:1rem"><span class="icon" style="background:rgba(255,184,48,0.15)">🐄</span>Reprodução</div><div class="card glass3" style="margin-bottom:14px">`;
  if (a.sit === 'Prenha') {
    const base = a.prenhaData || (insem[0] && insem[0].data);
    if (base) { const exp = new Date(base + 'T12:00'); exp.setDate(exp.getDate() + GESTACAO_DIAS); html += `<div class="card-sub">Parto previsto: <strong style="color:var(--g300)">${exp.toLocaleDateString('pt-BR')}</strong></div>`; }
  }
  if (a.ultimoParto) html += `<div class="card-sub">Último parto: ${fmt(a.ultimoParto)}</div>`;
  html += `<div class="card-sub">Inseminações: ${insem.length}</div>`;
  if (insem.length) html += insem.map(x => `<div class="card-sub" style="margin-top:5px">• ${fmt(x.data)}${x.touro ? ' · Touro: ' + esc(x.touro) : ''}${x.tempo ? ' · ' + esc(x.tempo) : ''}${x.muco ? ' · Muco: ' + esc(x.muco) : ''}</div>`).join('');
  html += `</div>`;

  html += `<div class="med-section-title" style="font-size:1rem"><span class="icon" style="background:rgba(255,87,87,0.12)">💊</span>Medicações (${meds.length})</div><div class="card glass3" style="margin-bottom:14px">`;
  html += meds.length ? meds.map(r => {
    const ms = Array.isArray(r.medicamentos) ? r.medicamentos.map(m => esc(m.nome) + (m.dose ? ' (' + esc(m.dose) + ')' : '')).join(', ') : '';
    let cd = ''; if (r.carenciaLeite) cd += ' · 🥛' + esc(r.carenciaLeite) + 'd'; if (r.carenciaCarne) cd += ' · 🥩' + esc(r.carenciaCarne) + 'd';
    return `<div class="card-sub" style="margin-bottom:5px">• <strong>${esc(r.tipo || '')}</strong>: ${ms} ${r.dataIni ? '(' + fmt(r.dataIni) + (r.dataFim ? '→' + fmt(r.dataFim) : '') + ')' : ''}${cd}</div>`;
  }).join('') : `<div class="card-sub">Nenhuma.</div>`;
  html += `</div>`;

  html += `<div class="med-section-title" style="font-size:1rem"><span class="icon" style="background:rgba(78,232,152,0.12)">🌾</span>Alimentação & Custo</div><div class="card glass3" style="margin-bottom:14px"><div class="card-sub">Custo de ração acumulado: <strong style="color:var(--g400)">R$ ${feedCost.toFixed(2)}</strong></div><div class="card-sub" style="margin-top:4px">Produção atual: ${a.leite ? esc(a.leite) + ' L/dia' : '—'}</div></div>`;

  const lh = a.leiteHist || [], ph = a.pesagens || [];
  if (lh.length || ph.length) {
    html += `<div class="med-section-title" style="font-size:1rem"><span class="icon" style="background:rgba(27,209,113,0.15)">📈</span>Evolução</div>`;
    if (lh.length) html += `<div class="card-sub">Leite (L/dia)</div><canvas id="fichaLeite" width="300" height="130" style="width:100%;margin-bottom:10px"></canvas>`;
    if (ph.length) html += `<div class="card-sub">Peso (kg)</div><canvas id="fichaPeso" width="300" height="130" style="width:100%;margin-bottom:10px"></canvas>`;
  }

  let ev = [];
  if (a.dataNasc) ev.push({ d: a.dataNasc, t: '🐣 Nascimento' });
  if (a.ultimoParto) ev.push({ d: a.ultimoParto, t: '🐄 Parto' });
  insem.forEach(x => { if (x.data) ev.push({ d: x.data, t: '🔬 Inseminação' + (x.touro ? ' (' + esc(x.touro) + ')' : '') }); });
  ph.forEach(x => { if (x.data) ev.push({ d: x.data, t: '⚖️ Pesagem: ' + esc(x.peso) + 'kg' }); });
  lh.forEach(x => { if (x.data) ev.push({ d: x.data, t: '🥛 Leite: ' + esc(x.leite) + 'L' }); });
  meds.forEach(r => { if (r.dataIni) ev.push({ d: r.dataIni, t: '💊 ' + esc(r.tipo || 'Medicação') }); });
  ev = ev.filter(e => e.d).sort((m, n) => n.d.localeCompare(m.d));
  html += `<div class="med-section-title" style="font-size:1rem"><span class="icon" style="background:rgba(91,154,255,0.12)">🕒</span>Linha do tempo</div><div class="card glass3" style="margin-bottom:8px">` +
    (ev.length ? ev.map(e => `<div class="card-sub" style="margin-bottom:5px">${fmt(e.d)} — ${e.t}</div>`).join('') : '<div class="card-sub">Sem eventos.</div>') + `</div>`;

  document.getElementById('fichaTitle').textContent = '#' + a.num + ' ' + a.nome;
  document.getElementById('fichaContent').innerHTML = html;
  openModal('fichaModal');
  getAnimalPhotoUrl(a).then(url => {
    const el = document.getElementById('fichaPhoto');
    if (el && url) { el.textContent = ''; el.style.backgroundImage = `url('${url}')`; }
  });
  if (lh.length) drawLineChart('fichaLeite', lh.map(x => parseFloat(x.leite) || 0), '#1bd171');
  if (ph.length) drawLineChart('fichaPeso', ph.map(x => parseFloat(x.peso) || 0), '#5b9aff');
}

function matchAnimal(entryNum, entryAid, animal) {
  return (entryAid && entryAid === animal.id) || String(entryNum) === String(animal.num);
}

registerModalSetup('animalModal', () => {
  if (!state.editAniId) { document.getElementById('animalModalTitle').textContent = 'Adicionar Animal'; initAnimalForm(); populateLoteSelect('animalLote'); }
});
