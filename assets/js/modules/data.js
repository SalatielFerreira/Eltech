// ========== ACESSO A DADOS (Supabase) ==========
// Responsabilidades:
// 1) Helpers genéricos de CRUD reaproveitados pelos módulos de domínio.
// 2) fetchAll(): leitura PAGINADA — o Supabase devolve no máximo 1.000 linhas por
//    consulta; sem paginar, históricos grandes sumiam em silêncio.
// 3) loadAllData(): carrega em DUAS FASES. A fase 1 (perfil, lotes, animais, touros)
//    libera o app na hora; a fase 2 (históricos, inseminação, medicação, alimentação,
//    baixas) chega em segundo plano e a tela atual é redesenhada quando termina.
// 4) Lixeira (deleted_at) e funções atômicas do Postgres (RPC), sempre com plano B
//    para bancos que ainda não receberam a migração da v4.4.0.
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

// ---------- Leitura paginada ----------
const PAGE = 1000;
// Busca TODAS as linhas da tabela. A 1ª página pede a contagem exata; as seguintes
// continuam até alcançá-la — assim funciona mesmo que o limite do servidor seja outro.
export async function fetchAll(table, { order = 'id', ascending = true, notDeleted = false, eq } = {}) {
  const out = [];
  let total = null;
  for (let from = 0; ;) {
    let q = supabase.from(table).select('*', from === 0 ? { count: 'exact' } : undefined);
    if (eq) q = q.eq(eq[0], eq[1]);
    if (notDeleted && state.caps.trash) q = q.is('deleted_at', null);
    q = q.order(order, { ascending });
    if (order !== 'id') q = q.order('id', { ascending: true }); // ordem estável entre páginas
    const { data, error, count } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    if (from === 0) total = count;
    out.push(...data);
    from += data.length; // avança pelo que veio: o servidor pode limitar a menos de 1.000
    if (!data.length || (total != null ? out.length >= total : data.length < PAGE)) break;
  }
  return out;
}

// ---------- Recursos do banco (migrações aplicadas?) ----------
// Descobre se o banco já tem a coluna deleted_at (lixeira). Sem ela, exclusões continuam
// definitivas como antes.
export async function detectCaps() {
  const { error } = await supabase.from('animais').select('deleted_at').limit(1);
  state.caps.trash = !error;
}
function isMissingFunctionError(e) {
  return !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(e.message || ''));
}
// Chama uma função do Postgres (gravação atômica). Se o banco ainda não tem a função,
// usa o caminho antigo (várias chamadas) e lembra disso até recarregar o app.
export async function rpcOr(fn, params, fallback) {
  if (state.caps.rpc !== false) {
    const { data, error } = await supabase.rpc(fn, params);
    if (!error) return data;
    if (!isMissingFunctionError(error)) throw friendlyError(error);
    state.caps.rpc = false;
  }
  return fallback();
}
export function friendlyError(err) {
  if (err?.code === '23505') return new Error('Já existe um animal com esse nº no rebanho');
  return err;
}

// ---------- Lixeira ----------
export const TRASH_DAYS = 30;
// Move para a lixeira (ou apaga de vez, se o banco não tem lixeira). Devolve 'trash' ou 'deleted'.
export async function softDelete(table, id) {
  if (!state.caps.trash) { await dbDelete(table, id); return 'deleted'; }
  const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  return 'trash';
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

// ---------- Identificação do animal nos registros ----------
// Registros de inseminação/medicação/alimentação guardam o id do animal (animal_id) e,
// por compatibilidade com dados antigos, o nº. O id tem prioridade; o nº é só plano B.
export function buildAnimalLookup() {
  const byId = new Map(), byNum = new Map();
  state.db.lotes.forEach(l => l.animals.forEach(a => { byId.set(a.id, a); if (!byNum.has(String(a.num))) byNum.set(String(a.num), a); }));
  return { byId, byNum, idOf: (aid, num) => (aid && byId.has(aid) ? aid : byNum.get(String(num))?.id || '') };
}
// Índice id do animal -> data (AAAA-MM-DD) da inseminação mais recente.
export function buildInsemIndex(lookup = buildAnimalLookup()) {
  const idx = new Map();
  state.db.inseminacao.forEach(p => p.animals.forEach(r => {
    const id = lookup.idOf(r.aid, r.num);
    if (id && r.data && (!idx.has(id) || r.data > idx.get(id))) idx.set(id, r.data);
  }));
  return idx;
}
export function getInsemDate(animal, index) {
  return fmtDateBR((index || buildInsemIndex()).get(animal.id) || '');
}
export function resolveAid(num) {
  return buildAnimalLookup().byNum.get(String(num))?.id || '';
}
export function matchAnimal(entryNum, entryAid, animal) {
  if (entryAid) return entryAid === animal.id;
  return String(entryNum) === String(animal.num);
}
export function getAnimalById(aid) {
  for (const l of state.db.lotes) {
    const f = l.animals.find(x => x.id === aid);
    if (f) return { ...f, loteName: l.name, loteId: l.id };
  }
  return null;
}
// Mãe/pai: pelo id quando existe (v4.4+), senão pelo nome (cadastros antigos).
export function findMae(a, all = getAllAnimals()) {
  return (a.maeId && all.find(x => x.id === a.maeId)) || (a.nomeMae ? all.find(x => x.nome === a.nomeMae && x.sexo === 'Fêmea') : null) || null;
}
export function findPai(a, all = getAllAnimals()) {
  return (a.paiId && all.find(x => x.id === a.paiId)) || (a.nomePai ? all.find(x => x.nome === a.nomePai && x.sexo === 'Macho') : null) || null;
}
export function findFilhos(a, all = getAllAnimals()) {
  return all.filter(x => x.id !== a.id && (
    (x.maeId ? x.maeId === a.id : (a.nome && x.nomeMae === a.nome)) ||
    (x.paiId ? x.paiId === a.id : (a.nome && x.nomePai === a.nome))));
}

// ---------- Mapeadores linha (snake_case) -> objeto em memória (camelCase) ----------
function mapAnimalRow(row) {
  return {
    id: row.id, num: row.num, nome: row.nome, origem: row.origem || '',
    tipoPrenhez: row.tipo_prenhez || '', dataNasc: row.data_nasc || '',
    sexo: row.sexo, cat: row.cat, sit: row.sit || '', raca: row.raca || '',
    grauSangue: row.grau_sangue || '', nomeMae: row.nome_mae || '', nomePai: row.nome_pai || '',
    maeId: row.mae_id || '', paiId: row.pai_id || '',
    peso: row.peso ?? '', leite: row.leite ?? '', ultimoParto: row.ultimo_parto || '',
    prenhaData: row.prenha_data || '', photoPath: row.photo_path || '',
    brinco: row.brinco || '', registro: row.registro || '', pelagem: row.pelagem || '', obs: row.obs || '',
    dataCompra: row.data_compra || '', valorCompra: row.valor_compra ?? '', vendedor: row.vendedor || '',
    pesagens: [], leiteHist: [],
  };
}

// ---------- Gravação de animal tolerante a banco ainda não atualizado ----------
// Colunas criadas por migrações (v4.2: campos extras; v4.4: mae_id/pai_id). Se o banco
// ainda não tem alguma, o Supabase recusa a gravação; removemos SÓ a coluna que faltou
// e tentamos de novo — o cadastro continua funcionando e quem chamou é avisado.
export const ANIMAL_EXTRA_COLS = ['brinco', 'registro', 'pelagem', 'obs', 'data_compra', 'valor_compra', 'vendedor', 'mae_id', 'pai_id'];
function isMissingColumnError(err) {
  return !!err && (err.code === 'PGRST204' || err.code === '42703' || (/column/i.test(err.message || '') && /(schema cache|does not exist)/i.test(err.message || '')));
}
export async function dbWriteAnimal(id, row) {
  const r = { ...row };
  const ignored = [];
  for (let i = 0; i <= ANIMAL_EXTRA_COLS.length; i++) {
    try {
      const data = id ? await dbUpdate('animais', id, r) : await dbInsert('animais', r);
      return { data, extrasIgnored: ignored.some(c => !['mae_id', 'pai_id'].includes(c)), ignored };
    } catch (err) {
      if (!isMissingColumnError(err)) throw friendlyError(err);
      const col = (/'([a-z_]+)' column/i.exec(err.message || '') || /column "?([a-z_]+)"?/i.exec(err.message || ''))?.[1];
      if (col && col in r) { delete r[col]; ignored.push(col); }
      else { ANIMAL_EXTRA_COLS.forEach(c => { if (c in r) { delete r[c]; ignored.push(c); } }); }
    }
  }
  throw new Error('Não foi possível salvar o animal');
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
export function mapBaixaRow(b) {
  return {
    ...b.animal_snapshot,
    baixaRowId: b.id,
    baixa: { tipo: b.tipo, data: b.data, valor: b.valor ?? '', obs: b.obs || '', loteName: b.lote_name || '', at: new Date(b.created_at).getTime() },
  };
}

// ---------- Carregamento em duas fases ----------
// Devolve quando a FASE 1 termina (app já pode ser exibido). `state.ready` é uma Promise
// resolvida ao fim da fase 2; gravações esperam por ela (ver ui.safeRun) para não haver
// conflito entre o que chega do banco e o que o usuário acabou de salvar.
export async function loadAllData() {
  const uid = state.session.user.id;
  state.loaded = false;
  let resolveReady;
  state.ready = new Promise(r => { resolveReady = r; });
  await detectCaps();

  const [profileRes, lotesRows, animaisRows, tourosRows] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    fetchAll('lotes', { order: 'created_at', notDeleted: true }),
    fetchAll('animais', { order: 'created_at', notDeleted: true }),
    fetchAll('touros', { order: 'nome' }),
  ]);
  if (profileRes.error && profileRes.error.code !== 'PGRST116') throw profileRes.error;

  const animaisByLote = {};
  const animalById = new Map();
  animaisRows.forEach(row => {
    const animal = mapAnimalRow(row);
    animalById.set(row.id, animal);
    (animaisByLote[row.lote_id] ||= []).push(animal);
  });
  const lotes = lotesRows.map(l => ({
    id: l.id, name: l.name, ordem: l.ordem, createdAt: new Date(l.created_at).getTime(),
    animals: animaisByLote[l.id] || [],
  }));
  state.db = {
    lotes, inseminacao: [], medDirect: [], aliDirect: [], baixas: [],
    touros: tourosRows.map(t => ({ id: t.id, nome: t.nome, raca: t.raca || '', grauSangue: t.grau_sangue || '', registro: t.registro || '' })),
    user: { id: uid, name: profileRes.data?.name || 'Usuário', avatarPath: profileRes.data?.avatar_path || '' },
  };

  const phase2 = (async () => {
    try {
      const [pesagens, leite, planilhas, insemRegs, medicacoes, medMeds, medAnimais, alimentacoes, aliDietas, aliAnimais, baixasRows] = await Promise.all([
        fetchAll('animal_pesagens', { order: 'data' }),
        fetchAll('animal_leite_hist', { order: 'data' }),
        fetchAll('inseminacao_planilhas', { order: 'created_at', ascending: false, notDeleted: true }),
        fetchAll('inseminacao_registros'),
        fetchAll('medicacoes', { notDeleted: true }),
        fetchAll('medicacao_medicamentos'),
        fetchAll('medicacao_animais'),
        fetchAll('alimentacoes', { order: 'created_at', ascending: false, notDeleted: true }),
        fetchAll('alimentacao_dietas'),
        fetchAll('alimentacao_animais'),
        fetchAll('baixas', { order: 'created_at', ascending: false }),
      ]);
      // Agrupa as tabelas-filhas uma vez (Map) em vez de filtrar a tabela inteira para cada registro.
      groupBy(pesagens, 'animal_id').forEach((rows, aid) => { const a = animalById.get(aid); if (a) a.pesagens = rows.map(p => ({ peso: p.peso, data: p.data })); });
      groupBy(leite, 'animal_id').forEach((rows, aid) => { const a = animalById.get(aid); if (a) a.leiteHist = rows.map(l => ({ leite: l.leite, data: l.data })); });
      const insemBy = groupBy(insemRegs, 'planilha_id');
      const medMedsBy = groupBy(medMeds, 'medicacao_id');
      const medAnimaisBy = groupBy(medAnimais, 'medicacao_id');
      const aliDietasBy = groupBy(aliDietas, 'alimentacao_id');
      const aliAnimaisBy = groupBy(aliAnimais, 'alimentacao_id');
      Object.assign(state.db, {
        inseminacao: planilhas.map(p => ({ id: p.id, name: p.name, createdAt: new Date(p.created_at).getTime(), animals: (insemBy.get(p.id) || []).map(mapInsemRow) })),
        medDirect: medicacoes.map(m => ({
          id: m.id, dataIni: m.data_ini || '', dataFim: m.data_fim || '', tipo: m.tipo || '',
          carenciaLeite: m.carencia_leite ?? '', carenciaCarne: m.carencia_carne ?? '',
          medicamentos: (medMedsBy.get(m.id) || []).map(x => ({ nome: x.nome, dose: x.dose || '' })),
          animais: (medAnimaisBy.get(m.id) || []).map(x => ({ num: x.num, nome: x.nome, aid: x.animal_id || '' })),
        })),
        aliDirect: alimentacoes.map(a => ({
          id: a.id, createdAt: new Date(a.created_at).getTime(), nomeDieta: a.nome_dieta || '',
          numAnimais: a.num_animais || 0, custoTotal: a.custo_total || 0,
          dietas: (aliDietasBy.get(a.id) || []).map(x => ({ tipo: x.tipo, valorKg: x.valor_kg ?? '', kg: x.kg ?? '' })),
          animais: (aliAnimaisBy.get(a.id) || []).map(x => ({ num: x.num, nome: x.nome, aid: x.animal_id || '' })),
        })),
        baixas: baixasRows.map(mapBaixaRow),
      });
      state.loadError = null;
    } catch (err) {
      console.error(err);
      state.loadError = err;
    } finally {
      state.loaded = true;
      resolveReady();
    }
  })();
  return { phase2 };
}
