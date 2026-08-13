// Estado global em memória da sessão atual.
// Substitui os antigos `let ACCOUNTS=[]; let DB=null;` do app.js monolítico.
// `state.db` é hidratado inteiro a partir do Supabase logo após o login
// (ver modules/data.js -> loadAllData) e os módulos de render leem daqui,
// exatamente como liam de `DB` antes — só muda a origem do dado.
export const state = {
  session: null, // sessão do Supabase Auth (supabase.auth.getSession())
  db: null,      // { lotes, inseminacao, medDirect, aliDirect, touros, baixas, user }

  // Navegação / seleção atual (equivalente aos globais soltos do app.js antigo)
  currentLoteId: null,
  editAniId: null,
  editLoteId: null,
  currentPlanId: null,
  editPlanId: null,
  parecerRecId: null,
  editTouroId: null,
  baixaAid: null,
  baixaTipo: null,

  tempMedAnimals: [],
  tempAliAnimals: [],
  tempInsemAnimals: [],
  tempAnimalPhoto: undefined, // File novo escolhido no formulário (undefined = não mexeu, '' = removida)

  chartFilter: 'categoria',
  medMode: 'lote',
  aliMode: 'lote',

  pageHistory: [],
  navLock: false,

  // URLs assinadas de fotos já resolvidas nesta sessão (evita repetir chamadas ao Storage)
  photoUrlCache: new Map(),

  // Mapa {idAntigo -> idNovo} da última importação de backup antigo, usado
  // para casar o arquivo de fotos exportado do app antigo com os animais novos.
  lastImportAnimalMap: null,
};

export function resetTempSelections() {
  state.currentLoteId = null;
  state.editAniId = null;
  state.editLoteId = null;
  state.currentPlanId = null;
  state.editPlanId = null;
  state.tempMedAnimals = [];
  state.tempAliAnimals = [];
  state.tempInsemAnimals = [];
}
