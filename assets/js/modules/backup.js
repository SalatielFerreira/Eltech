// ========== BACKUP ==========
// Exportar: baixa uma cópia .json dos dados atuais (já vêm da nuvem).
// Importar backup antigo: traz os dados de uma exportação feita pela
// versão anterior do ELTECH (a que guardava tudo só no localStorage do
// aparelho) para dentro da conta atual no Supabase. Cobre o formato de
// backup das versões 3.3+ (com `lotes[].animals[]`, `medDirect[].animais[]`
// etc.) — não tenta reconstruir formatos ainda mais antigos.
import { state } from '../state.js';
import { toast, safeRun, showConfirm, requireOnline } from './ui.js';
import { dbInsert, dbInsertMany, dbUpdate, getAllAnimals, loadAllData } from './data.js';
import { uploadAvatar, uploadAnimalPhoto } from './fotos.js';
import { renderHome } from './dashboard.js';

function backupBlob() {
  const payload = {
    exportedAt: new Date().toISOString(),
    user: { name: state.db.user.name },
    lotes: state.db.lotes, inseminacao: state.db.inseminacao, medDirect: state.db.medDirect,
    aliDirect: state.db.aliDirect, touros: state.db.touros, baixas: state.db.baixas,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}
function backupFilename(ext) {
  const d = new Date();
  return `ELTECH_backup_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.${ext}`;
}

export function exportBackup() {
  const blob = backupBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = backupFilename('json');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup exportado!');
}

// Envia pelo menu de compartilhar do celular (Drive, WhatsApp, e-mail...); sem suporte, baixa o arquivo.
export function shareBackup() {
  const blob = backupBlob();
  const fname = backupFilename('txt');
  try {
    const file = new File([blob], fname, { type: 'text/plain' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Backup ELTECH', text: 'Backup dos dados do ELTECH' })
        .then(() => toast('Backup enviado!'))
        .catch(err => { if (!err || err.name !== 'AbortError') exportBackup(); });
      return;
    }
  } catch (e) { /* navegador sem suporte a compartilhar arquivos */ }
  exportBackup();
}

export async function importBackupFile(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!requireOnline()) return;
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch { toast('Arquivo inválido', 'error'); return; }
  const ok = await showConfirm('Isto vai ADICIONAR os dados deste arquivo à sua conta atual (não apaga o que já existe). Continuar?', '📦');
  if (!ok) return;

  await safeRun(async () => {
    const animalIdMap = {};   // id antigo (do arquivo) -> id novo (Supabase)
    const numToNewId = {};    // nº do animal -> id novo, para casar registros sem `aid`

    for (const lote of data.lotes || []) {
      const loteRow = await dbInsert('lotes', { name: lote.name, ordem: lote.ordem ?? null });
      for (const a of lote.animals || []) {
        const row = await dbInsert('animais', {
          lote_id: loteRow.id, num: a.num, nome: a.nome, origem: a.origem || null, tipo_prenhez: a.tipoPrenhez || null,
          data_nasc: a.dataNasc || null, sexo: a.sexo, cat: a.cat, sit: a.sit || null, raca: a.raca || null,
          grau_sangue: a.grauSangue || null, nome_mae: a.nomeMae || null, nome_pai: a.nomePai || null,
          peso: a.peso || null, leite: a.leite || null, ultimo_parto: a.ultimoParto || null, prenha_data: a.prenhaData || null,
        });
        if (a.id) animalIdMap[a.id] = row.id;
        numToNewId[a.num] = row.id;
        if (a.pesagens?.length) await dbInsertMany('animal_pesagens', a.pesagens.map(p => ({ animal_id: row.id, peso: p.peso, data: p.data })));
        if (a.leiteHist?.length) await dbInsertMany('animal_leite_hist', a.leiteHist.map(l => ({ animal_id: row.id, leite: l.leite, data: l.data })));
      }
    }
    const resolveImportedId = a => (a.aid && animalIdMap[a.aid]) || numToNewId[a.num] || null;

    for (const t of data.touros || []) {
      await dbInsert('touros', { nome: t.nome, raca: t.raca || null, grau_sangue: t.grauSangue || null, registro: t.registro || null });
    }

    for (const p of data.inseminacao || []) {
      const planRow = await dbInsert('inseminacao_planilhas', { name: p.name });
      const rows = (p.animals || []).map(a => ({
        planilha_id: planRow.id, animal_id: resolveImportedId(a), num: a.num, nome: a.nome, data: a.data || null,
        tempo: a.tempo || null, touro: a.touro || null, muco: a.muco || null, obs: a.obs || null,
        parecer: a.parecer || null, parecer_data: a.parecerData || null,
      }));
      if (rows.length) await dbInsertMany('inseminacao_registros', rows);
    }

    for (const m of data.medDirect || []) {
      const medRow = await dbInsert('medicacoes', { data_ini: m.dataIni || null, data_fim: m.dataFim || null, tipo: m.tipo || null, carencia_leite: m.carenciaLeite || null, carencia_carne: m.carenciaCarne || null });
      if (m.medicamentos?.length) await dbInsertMany('medicacao_medicamentos', m.medicamentos.map(x => ({ medicacao_id: medRow.id, nome: x.nome, dose: x.dose || null })));
      const animaisList = m.animais || [];
      if (animaisList.length) await dbInsertMany('medicacao_animais', animaisList.map(x => ({ medicacao_id: medRow.id, num: x.num, nome: x.nome, animal_id: resolveImportedId(x) })));
    }

    for (const al of data.aliDirect || []) {
      const aliRow = await dbInsert('alimentacoes', { nome_dieta: al.nomeDieta || null, num_animais: al.numAnimais || 0, custo_total: al.custoTotal || 0 });
      if (al.dietas?.length) await dbInsertMany('alimentacao_dietas', al.dietas.map(d => ({ alimentacao_id: aliRow.id, tipo: d.tipo, valor_kg: d.valorKg || null, kg: d.kg || null })));
      const animaisList = al.animais || [];
      if (animaisList.length) await dbInsertMany('alimentacao_animais', animaisList.map(x => ({ alimentacao_id: aliRow.id, num: x.num, nome: x.nome, animal_id: resolveImportedId(x) })));
    }

    for (const b of data.baixas || []) {
      const { baixa, ...snapshot } = b;
      await dbInsert('baixas', {
        num: b.num, nome: b.nome, sexo: b.sexo || null, cat: b.cat || null, tipo: baixa?.tipo || 'venda',
        data: baixa?.data || new Date().toISOString().split('T')[0], valor: baixa?.valor || null,
        obs: baixa?.obs || null, lote_name: baixa?.loteName || null, animal_snapshot: snapshot,
      });
    }

    if (data.user?.name) await dbUpdate('profiles', state.session.user.id, { name: data.user.name });
    if (typeof data.user?.avatar === 'string' && data.user.avatar.startsWith('data:')) {
      const blob = await (await fetch(data.user.avatar)).blob();
      await uploadAvatar(blob);
    }

    state.lastImportAnimalMap = animalIdMap;
    await loadAllData();
    renderHome();
  }, 'Backup antigo importado!');
}

export async function importLegacyPhotos(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!requireOnline()) return;
  if (!state.lastImportAnimalMap) {
    toast('Importe primeiro o "backup antigo" nesta mesma sessão — as fotos são casadas pelos animais recém-importados.', 'error');
    return;
  }
  const text = await file.text();
  let obj;
  try { obj = JSON.parse(text); } catch { toast('Arquivo inválido', 'error'); return; }
  await safeRun(async () => {
    let count = 0;
    for (const [oldId, dataUrl] of Object.entries(obj)) {
      const newId = state.lastImportAnimalMap[oldId];
      if (!newId || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) continue;
      const blob = await (await fetch(dataUrl)).blob();
      await uploadAnimalPhoto(newId, blob);
      const a = getAllAnimals().find(x => x.id === newId);
      if (a) a.photoPath = `${state.session.user.id}/${newId}.jpg`;
      count++;
    }
    toast(count + ' foto(s) importada(s)!');
  });
}
