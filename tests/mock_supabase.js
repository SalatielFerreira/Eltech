// Supabase FALSO em memória, só para os testes automatizados do FARM.
// Os testes trocam https://esm.sh/@supabase/supabase-js por este arquivo (page.route).
//
// Parâmetros pela URL da página:
//   ?n=60          nº de animais no rebanho de exemplo
//   ?hist=2        pesagens por animal (para testar a paginação: n=400&hist=6 => 2.400 linhas)
//   ?oldschema=1   simula banco SEM as migrações v4.2/v4.4 (sem colunas novas, sem lixeira,
//                  sem funções RPC) — o app deve continuar funcionando
//   ?maxrows=1000  limite de linhas por consulta (igual ao padrão do Supabase)
//   ?empty=1       conta nova, sem nenhum dado
const params = new URLSearchParams(location.search);
const N = params.get('empty') === '1' ? 0 : parseInt(params.get('n') || '60', 10);
const HIST = parseInt(params.get('hist') || '2', 10);
const OLD_SCHEMA = params.get('oldschema') === '1';
const MAX_ROWS = parseInt(params.get('maxrows') || '1000', 10);
const UID = 'user-teste';
let seq = 0;
const uuid = () => 'id-' + (++seq).toString(36) + '-' + Math.random().toString(36).slice(2, 7);
const nowIso = () => new Date().toISOString();

// Colunas que só existem depois das migrações
const NEW_ANIMAL_COLS = ['brinco', 'registro', 'pelagem', 'obs', 'data_compra', 'valor_compra', 'vendedor', 'mae_id', 'pai_id', 'deleted_at'];
const TRASH_TABLES = ['lotes', 'animais', 'inseminacao_planilhas', 'medicacoes', 'alimentacoes'];
const missingCol = (table, col) => OLD_SCHEMA && ((table === 'animais' && NEW_ANIMAL_COLS.includes(col)) || (col === 'deleted_at' && TRASH_TABLES.includes(table)));

function rnd(arr, i) { return arr[i % arr.length]; }
function isoDaysAgo(d) { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); }

function seed() {
  const db = { profiles: [{ id: UID, name: 'Salatiel', avatar_path: null }], lotes: [], animais: [], animal_pesagens: [], animal_leite_hist: [],
    touros: [], inseminacao_planilhas: [], inseminacao_registros: [], medicacoes: [], medicacao_medicamentos: [], medicacao_animais: [],
    alimentacoes: [], alimentacao_dietas: [], alimentacao_animais: [], baixas: [] };
  const del = row => { if (!OLD_SCHEMA) row.deleted_at = null; return row; };
  if (!N) return db;
  const loteNames = ['Lactação 1', 'Lactação 2', 'Secas', 'Novilhas', 'Bezerreiro', 'Maternidade'];
  loteNames.forEach((name, i) => db.lotes.push(del({ id: uuid(), owner_id: UID, name, ordem: null, created_at: new Date(Date.now() - i * 864e5).toISOString() })));
  const nomes = ['Mimosa', 'Estrela', 'Boneca', 'Pintada', 'Malhada', 'Princesa', 'Jabuticaba', 'Serena', 'Formosa', 'Cigana', 'Faceira', 'Brisa'];
  const racas = ['Girolando', 'Holandesa', 'Jersey', 'Gir', 'Girolando', 'Girolando'];
  for (let i = 0; i < N; i++) {
    const lote = db.lotes[i % db.lotes.length];
    const macho = i % 9 === 0;
    const cat = macho ? rnd(['Bezerro', 'Garrote', 'Touro'], i) : (lote.name.startsWith('Lact') ? 'Vaca em lactação' : lote.name === 'Secas' ? 'Vaca seca' : lote.name === 'Novilhas' ? 'Novilha' : lote.name === 'Bezerreiro' ? 'Bezerra' : 'Vaca em lactação');
    const sit = (macho || cat === 'Bezerra') ? 'Não se aplica' : rnd(['Prenha', 'Vazia', 'Cio', 'Prenha', 'Vazia Cloe'], i);
    const a = { id: uuid(), owner_id: UID, lote_id: lote.id, num: String(100 + i), nome: rnd(nomes, i) + (i >= nomes.length ? ' ' + Math.floor(i / nomes.length) : ''),
      origem: i % 3 ? 'Nascido' : 'Comprado', tipo_prenhez: 'Inseminada', data_nasc: isoDaysAgo(400 + (i * 37) % 2000), sexo: macho ? 'Macho' : 'Fêmea', cat, sit,
      raca: rnd(racas, i), grau_sangue: rnd(['1/2', '5/8', '3/4', 'PO'], i), nome_mae: '', nome_pai: 'Trovão', peso: 380 + (i * 7) % 200,
      leite: cat === 'Vaca em lactação' ? 12 + (i * 3) % 20 : null, ultimo_parto: cat === 'Vaca em lactação' ? isoDaysAgo(30 + (i * 11) % 250) : null,
      prenha_data: sit === 'Prenha' ? isoDaysAgo(20 + (i * 13) % 250) : null, photo_path: i % 4 === 0 ? `${UID}/x${i}.jpg` : null, created_at: new Date(Date.now() - (N - i) * 1000).toISOString(), updated_at: nowIso() };
    if (!OLD_SCHEMA) NEW_ANIMAL_COLS.forEach(c => { a[c] = null; });
    // genealogia: a partir do 13º animal, a mãe é uma fêmea 12 posições antes
    const mae = db.animais[i - 12];
    if (mae && mae.sexo === 'Fêmea') { a.nome_mae = mae.nome; if (!OLD_SCHEMA) a.mae_id = mae.id; }
    db.animais.push(a);
    for (let h = 0; h < HIST; h++) db.animal_pesagens.push({ id: uuid(), owner_id: UID, animal_id: a.id, peso: a.peso - 10 * (HIST - h), data: isoDaysAgo(5 + 30 * (HIST - 1 - h)), created_at: nowIso() });
  }
  db.touros.push({ id: uuid(), owner_id: UID, nome: 'Trovão', raca: 'Gir', grau_sangue: 'PO', registro: 'BR 1234', created_at: nowIso() });
  const pl = del({ id: uuid(), owner_id: UID, name: 'Inseminações Novembro', created_at: nowIso() });
  db.inseminacao_planilhas.push(pl);
  db.animais.slice(0, Math.min(15, N)).forEach((a, i) => { if (a.sexo === 'Fêmea') db.inseminacao_registros.push({ id: uuid(), owner_id: UID, planilha_id: pl.id, animal_id: a.id, num: a.num, nome: a.nome, data: isoDaysAgo(10 + i * 5), tempo: '5 min', touro: 'Trovão', muco: 'Bom', obs: '', parecer: null, parecer_data: null, created_at: nowIso() }); });
  const med = del({ id: uuid(), owner_id: UID, data_ini: isoDaysAgo(2), data_fim: isoDaysAgo(-3), tipo: 'Tratamento', carencia_leite: 5, carencia_carne: 30, created_at: nowIso() });
  db.medicacoes.push(med);
  db.medicacao_medicamentos.push({ id: uuid(), owner_id: UID, medicacao_id: med.id, nome: 'Oxitetraciclina', dose: '20ml' });
  db.animais.slice(0, 3).forEach(a => db.medicacao_animais.push({ id: uuid(), owner_id: UID, medicacao_id: med.id, animal_id: a.id, num: a.num, nome: a.nome }));
  const ali = del({ id: uuid(), owner_id: UID, nome_dieta: 'Dieta lactação', num_animais: 10, custo_total: 87.5, created_at: nowIso() });
  db.alimentacoes.push(ali);
  db.alimentacao_dietas.push({ id: uuid(), owner_id: UID, alimentacao_id: ali.id, tipo: 'Silagem', valor_kg: 0.35, kg: 25 });
  db.animais.slice(0, 10).forEach(a => db.alimentacao_animais.push({ id: uuid(), owner_id: UID, alimentacao_id: ali.id, animal_id: a.id, num: a.num, nome: a.nome }));
  db.baixas.push({ id: uuid(), owner_id: UID, num: '999', nome: 'Velha', sexo: 'Fêmea', cat: 'Vaca seca', tipo: 'venda', data: isoDaysAgo(15), valor: 4500, obs: 'Vendida ao vizinho', lote_name: 'Secas',
    animal_snapshot: { id: 'old', num: '999', nome: 'Velha', sexo: 'Fêmea', cat: 'Vaca seca', sit: 'Vazia', raca: 'Gir', pesagens: [], leiteHist: [] }, created_at: nowIso() });
  db.baixas.push({ id: uuid(), owner_id: UID, num: '998', nome: 'Pretinha', sexo: 'Fêmea', cat: 'Bezerra', tipo: 'morte', data: isoDaysAgo(40), valor: null, obs: 'Tristeza parasitária', lote_name: 'Bezerreiro',
    animal_snapshot: { id: 'old2', num: '998', nome: 'Pretinha', sexo: 'Fêmea', cat: 'Bezerra', sit: 'Não se aplica', pesagens: [], leiteHist: [] }, created_at: nowIso() });
  return db;
}
const DB = window.__MOCKDB = seed();
window.__MOCKLOG = [];

const CASCADE = {
  lotes: [['animais', 'lote_id']],
  animais: [['animal_pesagens', 'animal_id'], ['animal_leite_hist', 'animal_id']],
  inseminacao_planilhas: [['inseminacao_registros', 'planilha_id']],
  medicacoes: [['medicacao_medicamentos', 'medicacao_id'], ['medicacao_animais', 'medicacao_id']],
  alimentacoes: [['alimentacao_dietas', 'alimentacao_id'], ['alimentacao_animais', 'alimentacao_id']],
};
function cascadeDelete(table, ids) {
  (CASCADE[table] || []).forEach(([child, col]) => {
    const gone = DB[child].filter(r => ids.includes(r[col])).map(r => r.id);
    DB[child] = DB[child].filter(r => !ids.includes(r[col]));
    cascadeDelete(child, gone);
  });
  if (table === 'animais' && !OLD_SCHEMA) DB.animais.forEach(a => { if (ids.includes(a.mae_id)) a.mae_id = null; if (ids.includes(a.pai_id)) a.pai_id = null; });
}
const clone = o => JSON.parse(JSON.stringify(o));
const delay = () => new Promise(r => setTimeout(r, 12));
const err = (code, message) => ({ data: null, error: { code, message }, count: null });

// Regra de nº único por usuário entre animais fora da lixeira (só no banco migrado).
function uniqueViolation(row, selfId) {
  if (OLD_SCHEMA || row.num == null) return false;
  return DB.animais.some(a => a.id !== selfId && a.deleted_at == null && String(a.num) === String(row.num));
}

class Query {
  constructor(t) { this.t = t; this.op = 'select'; this.filters = []; this.isSingle = false; this.ords = []; this.cols = '*'; this.rng = null; this.lim = null; this.wantCount = false; }
  select(cols = '*', opts) { if (this.op === 'select') this.cols = cols; if (opts?.count) this.wantCount = true; return this; }
  insert(rows) { this.op = 'insert'; this.payload = rows; return this; }
  update(p) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push([c, r => String(r[c]) === String(v)]); return this; }
  in(c, vs) { this.filters.push([c, r => vs.includes(r[c])]); return this; }
  is(c, v) { this.filters.push([c, r => (v === null ? r[c] == null : r[c] === v)]); return this; }
  not(c, op, v) { this.filters.push([c, r => (op === 'is' && v === null ? r[c] != null : String(r[c]) !== String(v))]); return this; }
  lt(c, v) { this.filters.push([c, r => r[c] != null && r[c] < v]); return this; }
  order(c, o) { this.ords.push([c, o?.ascending !== false]); return this; }
  range(a, b) { this.rng = [a, b]; return this; }
  limit(n) { this.lim = n; return this; }
  single() { this.isSingle = true; return this; }
  then(res, rej) { return delay().then(() => this.exec()).then(res, rej); }
  exec() {
    window.__MOCKLOG.push(this.op + ' ' + this.t);
    const rows = DB[this.t];
    if (!rows) return err('42P01', 'tabela inexistente ' + this.t);
    for (const [c] of this.filters) if (missingCol(this.t, c)) return err('42703', `column ${this.t}.${c} does not exist`);
    if (this.op === 'select' && this.cols !== '*') for (const c of this.cols.split(',').map(x => x.trim())) if (missingCol(this.t, c)) return err('42703', `column ${this.t}.${c} does not exist`);
    const match = r => this.filters.every(([, f]) => f(r));
    let out;
    if (this.op === 'select') {
      out = rows.filter(match);
      if (this.ords.length) out = [...out].sort((a, b) => { for (const [c, asc] of this.ords) { const x = String(a[c] ?? ''), y = String(b[c] ?? ''); if (x !== y) return (x < y ? -1 : 1) * (asc ? 1 : -1); } return 0; });
      const count = out.length;
      if (this.rng) out = out.slice(this.rng[0], this.rng[1] + 1);
      if (this.lim != null) out = out.slice(0, this.lim);
      out = out.slice(0, MAX_ROWS); // limite do servidor, como no Supabase real
      if (this.cols !== '*') { const cs = this.cols.split(',').map(x => x.trim()); out = out.map(r => Object.fromEntries(cs.map(c => [c, r[c]]))); }
      out = clone(out);
      if (this.isSingle) return out[0] ? { data: out[0], error: null } : err('PGRST116', 'nenhuma linha');
      return { data: out, error: null, count: this.wantCount ? count : null };
    }
    if (this.op === 'insert') {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const r of list) {
        const bad = Object.keys(r).find(k => missingCol(this.t, k));
        if (bad) return err('PGRST204', `Could not find the '${bad}' column of '${this.t}' in the schema cache`);
        if (this.t === 'animais' && uniqueViolation(r, null)) return err('23505', 'duplicate key value violates unique constraint "uq_animais_owner_num"');
      }
      out = list.map(r => {
        const row = { id: uuid(), owner_id: UID, created_at: nowIso(), ...r };
        if (TRASH_TABLES.includes(this.t) && !OLD_SCHEMA && !('deleted_at' in row)) row.deleted_at = null;
        if (this.t === 'animais' && !OLD_SCHEMA) NEW_ANIMAL_COLS.forEach(c => { if (!(c in row)) row[c] = null; });
        return row;
      });
      rows.push(...out);
    } else if (this.op === 'update') {
      const bad = Object.keys(this.payload).find(k => missingCol(this.t, k));
      if (bad) return err('PGRST204', `Could not find the '${bad}' column of '${this.t}' in the schema cache`);
      out = rows.filter(match);
      if (this.t === 'animais') {
        for (const r of out) {
          const next = { ...r, ...this.payload };
          if (next.deleted_at == null && ('num' in this.payload || 'deleted_at' in this.payload) && uniqueViolation(next, r.id)) return err('23505', 'duplicate key value violates unique constraint "uq_animais_owner_num"');
        }
      }
      out.forEach(r => Object.assign(r, this.payload));
    } else if (this.op === 'delete') {
      out = rows.filter(match);
      const ids = out.map(r => r.id);
      DB[this.t] = rows.filter(r => !match(r));
      cascadeDelete(this.t, ids);
    }
    out = clone(out);
    if (this.isSingle) return out[0] ? { data: out[0], error: null } : err('PGRST116', 'nenhuma linha');
    return { data: out, error: null };
  }
}

// ---------- Funções do banco (RPC) — mesmas regras da migração v4.4 ----------
const RPC = {
  salvar_medicacao({ p_id, p_dados, p_medicamentos, p_animais }) {
    let id = p_id;
    const dados = { data_ini: p_dados.data_ini || null, data_fim: p_dados.data_fim || null, tipo: p_dados.tipo, carencia_leite: p_dados.carencia_leite ?? null, carencia_carne: p_dados.carencia_carne ?? null };
    if (!id) { id = uuid(); DB.medicacoes.push({ id, owner_id: UID, created_at: nowIso(), deleted_at: null, ...dados }); }
    else {
      const m = DB.medicacoes.find(x => x.id === id); if (!m) throw new Error('Medicação não encontrada');
      Object.assign(m, dados);
      DB.medicacao_medicamentos = DB.medicacao_medicamentos.filter(x => x.medicacao_id !== id);
      DB.medicacao_animais = DB.medicacao_animais.filter(x => x.medicacao_id !== id);
    }
    p_medicamentos.forEach(x => DB.medicacao_medicamentos.push({ id: uuid(), owner_id: UID, medicacao_id: id, nome: x.nome, dose: x.dose || null }));
    p_animais.forEach(x => DB.medicacao_animais.push({ id: uuid(), owner_id: UID, medicacao_id: id, num: x.num, nome: x.nome, animal_id: x.animal_id || null }));
    return id;
  },
  salvar_alimentacao({ p_id, p_dados, p_dietas, p_animais }) {
    let id = p_id;
    if (!id) { id = uuid(); DB.alimentacoes.push({ id, owner_id: UID, created_at: nowIso(), deleted_at: null, ...p_dados }); }
    else {
      const a = DB.alimentacoes.find(x => x.id === id); if (!a) throw new Error('Alimentação não encontrada');
      Object.assign(a, p_dados);
      DB.alimentacao_dietas = DB.alimentacao_dietas.filter(x => x.alimentacao_id !== id);
      DB.alimentacao_animais = DB.alimentacao_animais.filter(x => x.alimentacao_id !== id);
    }
    p_dietas.forEach(x => DB.alimentacao_dietas.push({ id: uuid(), owner_id: UID, alimentacao_id: id, tipo: x.tipo, valor_kg: x.valor_kg, kg: x.kg }));
    p_animais.forEach(x => DB.alimentacao_animais.push({ id: uuid(), owner_id: UID, alimentacao_id: id, num: x.num, nome: x.nome, animal_id: x.animal_id || null }));
    return id;
  },
  dar_baixa({ p_animal_id, p_tipo, p_data, p_valor, p_obs, p_lote_name, p_snapshot }) {
    if (!DB.animais.some(a => a.id === p_animal_id)) throw new Error('Animal não encontrado');
    const row = { id: uuid(), owner_id: UID, num: p_snapshot.num, nome: p_snapshot.nome, sexo: p_snapshot.sexo, cat: p_snapshot.cat, tipo: p_tipo, data: p_data, valor: p_valor, obs: p_obs, lote_name: p_lote_name, animal_snapshot: p_snapshot, created_at: nowIso() };
    DB.baixas.push(row);
    DB.animais = DB.animais.filter(a => a.id !== p_animal_id);
    cascadeDelete('animais', [p_animal_id]);
    return row;
  },
  restaurar_baixa({ p_baixa_id, p_animal }) {
    if (uniqueViolation(p_animal, null)) throw Object.assign(new Error('duplicate'), { code: '23505' });
    const id = uuid();
    DB.animais.push({ ...Object.fromEntries(NEW_ANIMAL_COLS.map(c => [c, null])), ...p_animal, id, owner_id: UID, created_at: nowIso(), deleted_at: null });
    DB.baixas = DB.baixas.filter(b => b.id !== p_baixa_id);
    return id;
  },
  lote_para_lixeira({ p_lote_id }) {
    const agora = nowIso();
    DB.lotes.forEach(l => { if (l.id === p_lote_id && l.deleted_at == null) l.deleted_at = agora; });
    DB.animais.forEach(a => { if (a.lote_id === p_lote_id && a.deleted_at == null) a.deleted_at = agora; });
    return null;
  },
  restaurar_lote({ p_lote_id }) {
    const l = DB.lotes.find(x => x.id === p_lote_id); const quando = l?.deleted_at;
    if (l) l.deleted_at = null;
    DB.animais.forEach(a => { if (a.lote_id === p_lote_id && a.deleted_at === quando) a.deleted_at = null; });
    return null;
  },
};

const PHOTO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#8a6d45"/><circle cx="40" cy="38" r="18" fill="#f1e4cc"/></svg>');

export function createClient() {
  return {
    from: t => new Query(t),
    rpc: async (name, args) => {
      await delay();
      window.__MOCKLOG.push('rpc ' + name);
      if (OLD_SCHEMA || !RPC[name]) return err('PGRST202', `Could not find the function public.${name} in the schema cache`);
      try { return { data: clone(RPC[name](clone(args)) ?? null), error: null }; } catch (e) { return err(e.code || 'P0001', e.message); }
    },
    auth: {
      getSession: async () => ({ data: { session: { user: { id: UID, email: 'teste@farm.local' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        upload: async () => { await delay(); return { error: null }; },
        remove: async paths => { window.__MOCKLOG.push('storage.remove ' + paths.length); return { error: null }; },
        createSignedUrl: async () => { window.__MOCKLOG.push('signedUrl'); await delay(); return { data: { signedUrl: PHOTO }, error: null }; },
        createSignedUrls: async paths => { window.__MOCKLOG.push('signedUrls x' + paths.length); await delay(); return { data: paths.map(p => ({ path: p, signedUrl: PHOTO, error: null })), error: null }; },
      }),
    },
  };
}
