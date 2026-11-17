// ========== ACESSO A DADOS (Supabase) ==========
// Duas responsabilidades:
// 1) Helpers genéricos de CRUD (dbInsert/dbUpdate/dbDelete/dbInsertMany)
//    reaproveitados por todos os módulos de domínio.
// 2) loadAllData(): busca tudo do usuário logado e remonta em memória
//    (state.db) o MESMO formato aninhado que o app usava antes com
//    localStorage — assim as funções de render (feitas noutra migração,
//    ver módulos lotes/animais/inseminacao/...) continuam lendo
//    `state.db.lotes[].animals[]` etc. sem precisar ser reescritas.
import { supabase } from '../supabaseClient.js';
import { state } from '../state.js';

// ---------- CRUD genérico ----------
export async function dbInsert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}
export async function dbInsertMany(table, rows) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) throw error;
  return data;
}
export async function dbUpdate(table, id, patch) {
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function dbDelete(table, id) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
export async function dbDeleteWhere(table, column, value) {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) throw error;
}
// Mantém só os `keep` registros mais recentes de um histórico (pesagens/leite).
export async function trimHistory(table, animalId, keep) {
  const { data, error } = await supabase.from(table).select('id').eq('animal_id', animalId).order('data', { ascending: true });
  if (error) throw error;
  if (data.length > keep) {
    const toRemove = data.slice(0, data.length - keep).map(r => r.id);
    const { error: delErr } = await supabase.from(table).delete().in('id', toRemove);
    if (delErr) throw delErr;
  }
}

// ---------- Helpers de leitura reaproveitados pelos módulos de domínio ----------
export function getAllAnimals() {
  const all = [];
  state.db.lotes.forEach(l => l.animals.forEach(a => all.push({ ...a, loteId: l.id, loteName: l.name })));
  return all;
}
export function sortByNum(arr) {
  return arr.sort((a, b) => String(a.num || '').localeCompare(String(b.num || ''), 'pt', { numeric: true, sensitivity: 'base' }));
}
export function loteCmp(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), 'pt', { numeric: true, sensitivity: 'base' });
}
export function ageMonths(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00');
  const now = new Date();
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m--;
  return m < 0 ? 0 : m;
}
export function ageDays(dateStr) {
  if (!dateStr) return '';
  return Math.floor((Date.now() - new Date(dateStr + 'T12:00').getTime()) / 86400000);
}
// Data de hoje (ou de `date`) no fuso LOCAL, formato AAAA-MM-DD. Não usar
// toISOString() para isso: ele converte para UTC e, depois das 21h no Brasil,
// devolveria a data de amanhã.
export function toLocalISO(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const todayISO = () => toLocalISO(new Date());
export const fmtDateBR = s => (s ? new Date(s + 'T12:00').toLocaleDateString('pt-BR') : '');

// Índice nº do animal -> data (AAAA-MM-DD) da inseminação mais recente. Montado uma vez
// por renderização de lista, em vez de varrer todas as planilhas para cada animal.
export function buildInsemIndex() {
  const idx = new Map();
  state.db.inseminacao.forEach(p => p.animals.forEach(a => {
    if (a.data && (!idx.has(a.num) || a.data > idx.get(a.num))) idx.set(a.num, a.data);
  }));
  return idx;
}
export function getInsemDate(num, index) {
  const d = (index || buildInsemIndex()).get(num) || '';
  return fmtDateBR(d);
}
export function resolveAid(num) {
  const a = getAllAnimals().find(x => String(x.num) === String(num));
  return a ? a.id : '';
}
export function matchAnimal(entryNum, entryAid, animal) {
  return (entryAid && entryAid === animal.id) || String(entryNum) === String(animal.num);
}
export function getAnimalById(aid) {
  let r = null;
  state.db.lotes.forEach(l => {
    const f = l.animals.find(x => x.id === aid);
    if (f) r = { ...f, loteName: l.name, loteId: l.id };
  });
  return r;
}

// ---------- Mapeadores linha (snake_case) -> objeto em memória (camelCase) ----------
function mapAnimalRow(row) {
  return {
    id: row.id, num: row.num, nome: row.nome, origem: row.origem || '',
    tipoPrenhez: row.tipo_prenhez || '', dataNasc: row.data_nasc || '',
    sexo: row.sexo, cat: row.cat, sit: row.sit || '', raca: row.raca || '',
    grauSangue: row.grau_sangue || '', nomeMae: row.nome_mae || '', nomePai: row.nome_pai || '',
    peso: row.peso ?? '', leite: row.leite ?? '', ultimoParto: row.ultimo_parto || '',
    prenhaData: row.prenha_data || '', photoPath: row.photo_path || '',
    brinco: row.brinco || '', registro: row.registro || '', pelagem: row.pelagem || '', obs: row.obs || '',
    dataCompra: row.data_compra || '', valorCompra: row.valor_compra ?? '', vendedor: row.vendedor || '',
    pesagens: [], leiteHist: [],
  };
}

// ---------- Gravação de animal tolerante a banco ainda não atualizado ----------
// As colunas abaixo foram adicionadas na v4.2.0 (supabase/migrations/20261117_animais_campos_extras.sql).
// Se o banco ainda não recebeu a migração, o Supabase recusa a gravação por coluna
// inexistente; nesse caso gravamos o animal sem esses campos (o cadastro continua
// funcionando) e avisamos quem chamou via `extrasIgnored`.
export const ANIMAL_EXTRA_COLS = ['brinco', 'registro', 'pelagem', 'obs', 'data_compra', 'valor_compra', 'vendedor'];
function isMissingColumnError(err) {
  return !!err && (err.code === 'PGRST204' || err.code === '42703' || /column/i.test(err.message || '') && /(schema cache|does not exist)/i.test(err.message || ''));
}
export async function dbWriteAnimal(id, row) {
  try {
    const data = id ? await dbUpdate('animais', id, row) : await dbInsert('animais', row);
    return { data, extrasIgnored: false };
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    const slim = { ...row };
    ANIMAL_EXTRA_COLS.forEach(c => delete slim[c]);
    const data = id ? await dbUpdate('animais', id, slim) : await dbInsert('animais', slim);
    return { data, extrasIgnored: true };
  }
}

const groupBy = (rows, key) => {
  const m = new Map();
  rows.forEach(r => { const k = r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return m;
};
function mapInsemRow(row) {
  return {
    id: row.id, aid: row.animal_id || '', num: row.num, nome: row.nome, data: row.data || '',
    tempo: row.tempo || '', touro: row.touro || '', muco: row.muco || '', obs: row.obs || '',
    parecer: row.parecer || '', parecerData: row.parecer_data || '',
  };
}

// ---------- Hidratação completa após login ----------
export async function loadAllData() {
  const uid = state.session.user.id;
  const [
    profileRes, lotesRes, animaisRes, pesagensRes, leiteRes, tourosRes,
    planilhasRes, insemRegsRes, medicacoesRes, medMedsRes, medAnimaisRes,
    alimentacoesRes, aliDietasRes, aliAnimaisRes, baixasRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    supabase.from('lotes').select('*').order('created_at'),
    supabase.from('animais').select('*'),
    supabase.from('animal_pesagens').select('*').order('data'),
    supabase.from('animal_leite_hist').select('*').order('data'),
    supabase.from('touros').select('*').order('nome'),
    supabase.from('inseminacao_planilhas').select('*').order('created_at', { ascending: false }),
    supabase.from('inseminacao_registros').select('*'),
    supabase.from('medicacoes').select('*'),
    supabase.from('medicacao_medicamentos').select('*'),
    supabase.from('medicacao_animais').select('*'),
    supabase.from('alimentacoes').select('*').order('created_at', { ascending: false }),
    supabase.from('alimentacao_dietas').select('*'),
    supabase.from('alimentacao_animais').select('*'),
    supabase.from('baixas').select('*').order('created_at', { ascending: false }),
  ]);
  for (const res of [profileRes, lotesRes, animaisRes, pesagensRes, leiteRes, tourosRes,
    planilhasRes, insemRegsRes, medicacoesRes, medMedsRes, medAnimaisRes,
    alimentacoesRes, aliDietasRes, aliAnimaisRes, baixasRes]) {
    if (res.error) throw res.error;
  }

  // Agrupa as tabelas-filhas uma vez (Map) em vez de filtrar a tabela inteira para cada registro.
  const pesagensBy = groupBy(pesagensRes.data, 'animal_id');
  const leiteBy = groupBy(leiteRes.data, 'animal_id');
  const insemBy = groupBy(insemRegsRes.data, 'planilha_id');
  const medMedsBy = groupBy(medMedsRes.data, 'medicacao_id');
  const medAnimaisBy = groupBy(medAnimaisRes.data, 'medicacao_id');
  const aliDietasBy = groupBy(aliDietasRes.data, 'alimentacao_id');
  const aliAnimaisBy = groupBy(aliAnimaisRes.data, 'alimentacao_id');

  const animaisByLote = {};
  animaisRes.data.forEach(row => {
    const animal = mapAnimalRow(row);
    animal.pesagens = (pesagensBy.get(row.id) || []).map(p => ({ peso: p.peso, data: p.data }));
    animal.leiteHist = (leiteBy.get(row.id) || []).map(l => ({ leite: l.leite, data: l.data }));
    (animaisByLote[row.lote_id] ||= []).push(animal);
  });

  const lotes = lotesRes.data.map(l => ({
    id: l.id, name: l.name, ordem: l.ordem, createdAt: new Date(l.created_at).getTime(),
    animals: animaisByLote[l.id] || [],
  }));

  const inseminacao = planilhasRes.data.map(p => ({
    id: p.id, name: p.name, createdAt: new Date(p.created_at).getTime(),
    animals: (insemBy.get(p.id) || []).map(mapInsemRow),
  }));

  const medDirect = medicacoesRes.data.map(m => ({
    id: m.id, dataIni: m.data_ini || '', dataFim: m.data_fim || '', tipo: m.tipo || '',
    carenciaLeite: m.carencia_leite ?? '', carenciaCarne: m.carencia_carne ?? '',
    medicamentos: (medMedsBy.get(m.id) || []).map(x => ({ nome: x.nome, dose: x.dose || '' })),
    animais: (medAnimaisBy.get(m.id) || []).map(x => ({ num: x.num, nome: x.nome, aid: x.animal_id || '' })),
  }));

  const aliDirect = alimentacoesRes.data.map(a => ({
    id: a.id, createdAt: new Date(a.created_at).getTime(), nomeDieta: a.nome_dieta || '',
    numAnimais: a.num_animais || 0, custoTotal: a.custo_total || 0,
    dietas: (aliDietasBy.get(a.id) || []).map(x => ({ tipo: x.tipo, valorKg: x.valor_kg ?? '', kg: x.kg ?? '' })),
    animais: (aliAnimaisBy.get(a.id) || []).map(x => ({ num: x.num, nome: x.nome, aid: x.animal_id || '' })),
  }));

  const touros = tourosRes.data.map(t => ({ id: t.id, nome: t.nome, raca: t.raca || '', grauSangue: t.grau_sangue || '', registro: t.registro || '' }));

  const baixas = baixasRes.data.map(b => ({
    ...b.animal_snapshot,
    baixaRowId: b.id,
    baixa: { tipo: b.tipo, data: b.data, valor: b.valor ?? '', obs: b.obs || '', loteName: b.lote_name || '', at: new Date(b.created_at).getTime() },
  }));

  state.db = {
    lotes, inseminacao, medDirect, aliDirect, touros, baixas,
    user: { id: uid, name: profileRes.data?.name || 'Usuário', avatarPath: profileRes.data?.avatar_path || '' },
  };
  return state.db;
}
