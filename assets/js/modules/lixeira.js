// ========== LIXEIRA (30 dias para restaurar) ==========
// Lotes, animais, planilhas de inseminação, medicações e alimentações excluídos ganham
// `deleted_at` em vez de sumir. Ficam aqui por 30 dias e depois são apagados de vez
// (purgeOldTrash roda em segundo plano a cada entrada no app).
// Sem a migração v4.4 no banco, a lixeira não existe e as exclusões são definitivas.
import { supabase } from '../supabaseClient.js';
import { state } from '../state.js';
import { esc, toast, safeRun, showConfirm, openModal, act, refreshCurrentPage, refresh } from './ui.js';
import { loadAllData, rpcOr, TRASH_DAYS, fmtDateBR, friendlyError } from './data.js';

const $ = id => document.getElementById(id);
const TYPES = [
  { table: 'lotes', icon: '📁', label: 'Lote', title: r => r.name },
  { table: 'animais', icon: '🐄', label: 'Animal', title: r => `#${r.num} ${r.nome}` },
  { table: 'inseminacao_planilhas', icon: '🔬', label: 'Planilha', title: r => r.name },
  { table: 'medicacoes', icon: '💊', label: 'Medicação', title: r => `${r.tipo || 'Medicação'}${r.data_ini ? ' de ' + fmtDateBR(r.data_ini) : ''}` },
  { table: 'alimentacoes', icon: '🌾', label: 'Alimentação', title: r => r.nome_dieta || 'Dieta' },
];
let items = []; // [{ type, row }]

const daysAgo = iso => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));

async function fetchTrash() {
  const res = await Promise.all(TYPES.map(t => supabase.from(t.table).select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false })));
  items = [];
  res.forEach((r, i) => {
    if (r.error) throw r.error;
    r.data.forEach(row => items.push({ type: TYPES[i], row }));
  });
  // Animais que foram junto com o lote aparecem dentro do lote, não soltos.
  const lotesDel = new Map(items.filter(x => x.type.table === 'lotes').map(x => [x.row.id, x.row.deleted_at]));
  items = items.filter(x => !(x.type.table === 'animais' && lotesDel.get(x.row.lote_id) === x.row.deleted_at));
  items.forEach(x => { if (x.type.table === 'lotes') x.junto = res[1].data.filter(a => a.lote_id === x.row.id && a.deleted_at === x.row.deleted_at).length; });
  items.sort((a, b) => b.row.deleted_at.localeCompare(a.row.deleted_at));
}

function renderTrash() {
  const c = $('lixeiraList');
  $('btnEmptyTrash').classList.toggle('hidden', !items.length);
  updateTrashBadge(items.length);
  if (!items.length) {
    c.innerHTML = '<div class="empty-card"><div class="empty-ico">🗑️</div><p>A lixeira está vazia.</p></div>';
    return;
  }
  c.innerHTML = items.map((x, i) => {
    const ago = daysAgo(x.row.deleted_at), left = Math.max(0, TRASH_DAYS - ago);
    return `<div class="trash-card">
  <div class="rec-ico">${x.type.icon}</div>
  <div class="ani-main">
    <div class="ani-top"><span class="ani-name">${esc(x.type.title(x.row))}</span></div>
    <div class="ani-meta">${x.type.label}${x.junto ? ` · com ${x.junto} animal(is)` : ''} · excluído ${ago === 0 ? 'hoje' : `há ${ago} dia(s)`}</div>
    <div class="trash-left${left <= 5 ? ' soon' : ''}">Apagado de vez em ${left} dia(s)</div>
  </div>
  <div class="trash-acts">
    <button class="btn btn-primary btn-sm" ${act('restoreTrashItem', i)}>Restaurar</button>
    <button class="trash-del" ${act('purgeTrashItem', i)} aria-label="Apagar de vez">✕</button>
  </div>
</div>`;
  }).join('');
}

// Soma itens ao contador (após mover algo para a lixeira) sem consultar o banco.
let badgeCount = 0;
export function bumpTrash(n = 1) { if (state.caps.trash) updateTrashBadge(badgeCount + n); }
export function updateTrashBadge(n) {
  badgeCount = n || 0;
  const b = $('trashCount');
  if (!b) return;
  b.textContent = n || '';
  b.classList.toggle('hidden', !n);
}

export async function openLixeira() {
  openModal('lixeiraModal');
  const c = $('lixeiraList');
  if (!state.caps.trash) {
    $('btnEmptyTrash').classList.add('hidden');
    c.innerHTML = '<div class="empty-card"><div class="empty-ico">🗄️</div><p>A lixeira precisa da atualização do banco (arquivo <b>20261124_v44_integridade_lixeira.sql</b>, veja o README). Até lá, as exclusões são definitivas.</p></div>';
    return;
  }
  c.innerHTML = '<div class="skel-card"><div class="skel skel-ico"></div><div class="skel-lines"><div class="skel skel-l1"></div><div class="skel skel-l2"></div></div></div>';
  try { await fetchTrash(); renderTrash(); } catch (err) { console.error(err); c.innerHTML = `<div class="empty-card"><p>${esc(err.message || 'Erro ao abrir a lixeira')}</p></div>`; }
}

// Recarrega os dados do app (a restauração pode trazer lote, animais e registros de volta).
async function reloadAfterRestore() {
  const { phase2 } = await loadAllData();
  await phase2;
  const cur = document.querySelector('.page.active')?.id;
  if (cur === 'pageRebanho') refresh('rebanho'); else refreshCurrentPage();
}

async function restoreRow(x) {
  const { table } = x.type, row = x.row;
  if (table === 'lotes') {
    await rpcOr('restaurar_lote', { p_lote_id: row.id }, async () => {
      let r = await supabase.from('lotes').update({ deleted_at: null }).eq('id', row.id);
      if (r.error) throw r.error;
      r = await supabase.from('animais').update({ deleted_at: null }).eq('lote_id', row.id).eq('deleted_at', row.deleted_at);
      if (r.error) throw friendlyError(r.error);
    });
    return 'Lote restaurado com seus animais!';
  }
  if (table === 'animais') {
    // Se o lote do animal também está na lixeira, ele volta junto (senão o animal ficaria invisível).
    const { data: lote } = await supabase.from('lotes').select('id,deleted_at').eq('id', row.lote_id).single();
    if (lote?.deleted_at) { const r = await supabase.from('lotes').update({ deleted_at: null }).eq('id', lote.id); if (r.error) throw r.error; }
    const r = await supabase.from('animais').update({ deleted_at: null }).eq('id', row.id);
    if (r.error) throw friendlyError(r.error);
    return lote?.deleted_at ? 'Animal restaurado (o lote dele também voltou)' : 'Animal restaurado!';
  }
  const r = await supabase.from(table).update({ deleted_at: null }).eq('id', row.id);
  if (r.error) throw r.error;
  return `${x.type.label} restaurada!`;
}

export async function restoreTrashItem(i) {
  const x = items[i];
  if (!x) return;
  await safeRun(async () => {
    const msg = await restoreRow(x);
    await reloadAfterRestore();
    await fetchTrash(); renderTrash();
    toast(msg);
  }).catch(() => {});
}

// Apaga de vez (com as fotos dos animais no Storage).
async function purgeRows(type, rows) {
  if (!rows.length) return;
  const ids = rows.map(r => r.id);
  let photoPaths = [];
  if (type.table === 'animais') photoPaths = rows.map(r => r.photo_path).filter(Boolean);
  if (type.table === 'lotes') {
    const { data } = await supabase.from('animais').select('photo_path').in('lote_id', ids);
    photoPaths = (data || []).map(r => r.photo_path).filter(Boolean);
  }
  const { error } = await supabase.from(type.table).delete().in('id', ids);
  if (error) throw error;
  if (photoPaths.length) await supabase.storage.from('animal-photos').remove(photoPaths).catch(() => {});
}

export async function purgeTrashItem(i) {
  const x = items[i];
  if (!x) return;
  const ok = await showConfirm(`Apagar "${x.type.title(x.row)}" de vez? Não dá para desfazer.`, '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    await purgeRows(x.type, [x.row]);
    items.splice(i, 1);
    renderTrash();
  }, 'Apagado definitivamente').catch(() => {});
}

export async function emptyTrash() {
  if (!items.length) return;
  const ok = await showConfirm(`Apagar de vez os ${items.length} item(ns) da lixeira? Não dá para desfazer.`, '🗑️');
  if (!ok) return;
  await safeRun(async () => {
    for (const t of TYPES) await purgeRows(t, items.filter(x => x.type === t).map(x => x.row));
    items = [];
    renderTrash();
  }, 'Lixeira esvaziada').catch(() => {});
}

// Remove de vez o que está na lixeira há mais de 30 dias e atualiza o contador.
export async function purgeOldTrash() {
  if (!state.caps.trash) return;
  try {
    const cutoff = new Date(Date.now() - TRASH_DAYS * 864e5).toISOString();
    for (const t of TYPES) {
      const { data, error } = await supabase.from(t.table).select('*').not('deleted_at', 'is', null).lt('deleted_at', cutoff);
      if (!error) await purgeRows(t, data);
    }
    await fetchTrash();
    updateTrashBadge(items.length);
  } catch (err) { console.warn('Limpeza da lixeira falhou', err); }
}
