// ========== PONTO DE ENTRADA ==========
// index.html carrega version.js (versão única do app) e este módulo. Aqui cada módulo de
// domínio é importado (o que dispara os registros de páginas/janelas) e as funções que o
// HTML usa são registradas como AÇÕES — o HTML não tem onclick; usa data-click/data-input/
// data-change (ver ui.js -> "Ações"). Isso permite uma política de segurança (CSP) que
// bloqueia scripts inline.
import { state } from './state.js';
import * as ui from './modules/ui.js';
import * as auth from './modules/auth.js';
import * as profile from './modules/profile.js';
import * as fotos from './modules/fotos.js';
import * as lotes from './modules/lotes.js';
import * as animais from './modules/animais.js';
import * as rebanho from './modules/rebanho.js';
import * as baixas from './modules/baixas.js';
import * as touros from './modules/touros.js';
import * as inseminacao from './modules/inseminacao.js';
import * as medicacao from './modules/medicacao.js';
import * as alimentacao from './modules/alimentacao.js';
import * as dashboard from './modules/dashboard.js';
import * as relatorios from './modules/relatorios.js';
import * as help from './modules/help.js';
import * as lixeira from './modules/lixeira.js';
import './modules/swipe.js';

const APP_VERSION = window.FARM_VERSION || '?'; // definida só em version.js

// Versão exibida no rodapé de Configurações — único lugar do app onde aparece "Eltech" (a empresa).
const versionEl = document.getElementById('appVersion');
if (versionEl) versionEl.textContent = `FARM v${APP_VERSION} · Eltech`;

// ---------- Voltar (botão do celular, arrasto para a direita) ----------
// Fecha janela aberta > sai de sub-tela > volta à aba anterior. Devolve false se não havia
// para onde voltar.
function showView(el) {
  if (!el) return;
  el.classList.remove('view-in');
  void el.offsetWidth; // reinicia a animação
  el.classList.add('view-in');
}
function goBack() {
  const modal = document.querySelector('.modal-overlay.show');
  if (modal) { ui.closeModal(modal.id); return true; }
  const visible = id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); };
  const page = document.querySelector('.page.active')?.id;
  if (page === 'pageRebanho') {
    if (visible('loteDetail')) { lotes.backToLotes(); showView(document.getElementById('lotesView')); return true; }
    if (['animaisView', 'lotesView', 'baixasView'].some(visible)) { rebanho.backToRebanhoHome(); showView(document.getElementById('rebanhoHome')); return true; }
  }
  if (page === 'pageInseminacao' && visible('insemDetail')) { inseminacao.backToList(); showView(document.getElementById('insemList')); return true; }
  if (state.pageHistory.length) { state.navLock = true; ui.goPage(state.pageHistory.pop()); state.navLock = false; return true; }
  return false;
}

// Pequenas ações de formulário que antes eram código inline no HTML.
const onlyLetters = el => { el.value = el.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, ''); };
const removeParent = el => el.parentElement?.remove();

const ACTIONS = {
  goBack, onlyLetters, removeParent,
  // ui.js
  togglePass: ui.togglePass, showConfirm: ui.showConfirm, confirmResolve: ui.confirmResolve,
  switchLoginTab: ui.switchLoginTab, openModal: ui.openModal, closeModal: ui.closeModal,
  goPage: ui.goPage, toggleFilterBar: ui.toggleFilterBar, toggleFolder: ui.toggleFolder,
  filterAnimalSelect: ui.filterAnimalSelect,
  // auth.js
  doLogin: auth.doLogin, doRegister: auth.doRegister, doLogout: auth.doLogout, changePassword: auth.changePassword, reloadData: auth.reloadData,
  // profile.js / fotos.js
  setAvatar: profile.setAvatar, onAnimalPhoto: fotos.onAnimalPhoto, removeAnimalPhoto: fotos.removeAnimalPhoto,
  // lotes.js
  saveLote: lotes.saveLote, editLoteFromCard: lotes.editLoteFromCard, delLote: lotes.delLote,
  openLoteDetail: lotes.openLoteDetail, backToLotes: lotes.backToLotes, toggleLoteFilter: lotes.toggleLoteFilter,
  renderLoteAnimals: lotes.renderLoteAnimals, renderLotes: lotes.renderLotes, moveLote: lotes.moveLote,
  openLoteActions: lotes.openLoteActions, clearLoteFilters: lotes.clearLoteFilters,
  // animais.js
  onSexoChange: animais.onSexoChange, onCatChange: animais.onCatChange, onSitChange: animais.onSitChange,
  onOrigemChange: animais.onOrigemChange, saveAnimalToLote: animais.saveAnimalToLote,
  openAnimalForLote: animais.openAnimalForLote, editAnimalInLote: animais.editAnimalInLote,
  delAnimalFromLote: animais.delAnimalFromLote, renderAnimaisFolder: animais.renderAnimaisFolder,
  openFicha: animais.openFicha, openNewAnimal: animais.openNewAnimal, openAnimalActions: animais.openAnimalActions,
  setAnimalSexo: animais.setAnimalSexo, setAnimalOrigem: animais.setAnimalOrigem, updateAnimalHints: animais.updateAnimalHints,
  useSuggestedNum: animais.useSuggestedNum, clearAnimalFilters: animais.clearAnimalFilters,
  // rebanho.js
  openRebanhoView: rebanho.openRebanhoView, backToRebanhoHome: rebanho.backToRebanhoHome,
  // baixas.js
  openBaixa: baixas.openBaixa, setBaixaTipo: baixas.setBaixaTipo, confirmBaixa: baixas.confirmBaixa,
  renderBaixas: baixas.renderBaixas, restaurarBaixa: baixas.restaurarBaixa, delBaixa: baixas.delBaixa,
  openBaixaActions: baixas.openBaixaActions, clearBaixaFilters: baixas.clearBaixaFilters,
  // touros.js
  openTouros: touros.openTouros, saveTouro: touros.saveTouro, editTouro: touros.editTouro, delTouro: touros.delTouro,
  openTouroActions: touros.openTouroActions, cancelTouroEdit: touros.cancelTouroEdit,
  // inseminacao.js
  savePlanilha: inseminacao.savePlanilha, editPlanFromCard: inseminacao.editPlanFromCard, delPlan: inseminacao.delPlan,
  openInsemDetail: inseminacao.openInsemDetail, backToList: inseminacao.backToList, renderAnimals: inseminacao.renderAnimals,
  openInsemAnimalDirect: inseminacao.openInsemAnimalDirect, openInsemAnimalForPlan: inseminacao.openInsemAnimalForPlan,
  addInsemAnimal: inseminacao.addInsemAnimal, removeTempInsemAnimal: inseminacao.removeTempInsemAnimal,
  saveInsemAnimal: inseminacao.saveInsemAnimal, editInsemAnimal: inseminacao.editInsemAnimal,
  delInsemAnimal: inseminacao.delInsemAnimal, openParecer: inseminacao.openParecer, setParecer: inseminacao.setParecer,
  openPlanActions: inseminacao.openPlanActions, setInsemFilter: inseminacao.setInsemFilter, setInsemMuco: inseminacao.setInsemMuco,
  openInsemRecActions: inseminacao.openInsemRecActions,
  // medicacao.js
  setMedMode: medicacao.setMedMode, loadMedLoteAnimals: medicacao.loadMedLoteAnimals,
  toggleMedAnimalIncluded: medicacao.toggleMedAnimalIncluded, addMedAnimalIndiv: medicacao.addMedAnimalIndiv,
  removeMedIndivAnimal: medicacao.removeMedIndivAnimal, addMedRow: medicacao.addMedRow,
  saveMedAnimal: medicacao.saveMedAnimal, renderMedDirect: medicacao.renderMedDirect,
  editMedDirect: medicacao.editMedDirect, delMedDirect: medicacao.delMedDirect,
  openNewMed: medicacao.openNewMed, setMedTipo: medicacao.setMedTipo, setMedFilter: medicacao.setMedFilter,
  updateMedCarHint: medicacao.updateMedCarHint, toggleAllMedLote: medicacao.toggleAllMedLote, openMedActions: medicacao.openMedActions,
  // alimentacao.js
  setAliMode: alimentacao.setAliMode, loadAliLoteAnimals: alimentacao.loadAliLoteAnimals,
  toggleAliAnimalIncluded: alimentacao.toggleAliAnimalIncluded, addAliAnimalNew: alimentacao.addAliAnimalNew,
  removeAliAnimal: alimentacao.removeAliAnimal, onDietChange2: alimentacao.onDietChange2,
  calcAliCost: alimentacao.calcAliCost,
  saveAliDirect: alimentacao.saveAliDirect, editAliDirect: alimentacao.editAliDirect, delAliDirect: alimentacao.delAliDirect,
  openNewAli: alimentacao.openNewAli, openAliActions: alimentacao.openAliActions, toggleAllAliLote: alimentacao.toggleAllAliLote,
  // dashboard.js
  setChartFilter: dashboard.setChartFilter, quickAction: dashboard.quickAction, toggleAlerts: dashboard.toggleAlerts,
  // relatorios.js
  toggleAllReportSources: relatorios.toggleAllReportSources, downloadReport: relatorios.downloadReport, updateReportSummary: relatorios.updateReportSummary,
  // help.js
  openHelp: help.openHelp,
  // lixeira.js
  openLixeira: lixeira.openLixeira, restoreTrashItem: lixeira.restoreTrashItem, purgeTrashItem: lixeira.purgeTrashItem, emptyTrash: lixeira.emptyTrash,
};
ui.registerActions(ACTIONS);
// Um único ponto de acesso para depuração e para os testes automatizados (window.FARM.goPage(...)).
window.FARM = { ...ACTIONS, state, version: APP_VERSION };

// ---------- Enter para logar/cadastrar ----------
['loginEmail', 'loginPass'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); auth.doLogin(); } });
});
['regName', 'regEmail', 'regPass', 'regPassConfirm'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); auth.doRegister(); } });
});
document.getElementById('regPass')?.addEventListener('input', function () {
  const p = this.value;
  const set = (id, ok) => { const el = document.getElementById(id); el.style.color = ok ? 'var(--g400)' : 'var(--text3)'; el.textContent = (ok ? '✓ ' : '◯ ') + el.textContent.substring(2); };
  set('reqUpper', /[A-Z]/.test(p)); set('reqNumber', /[0-9]/.test(p));
  set('reqSpecial', /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p)); set('reqLen', p.length >= 6);
});

profile.initProfileNameListener();

// ---------- Botão "voltar" do celular: fecha janela / volta de tela em vez de sair do app ----------
let _lastBack = 0;
window.addEventListener('popstate', () => {
  const main = document.getElementById('mainApp');
  if (!main || main.style.display === 'none') return;
  if (goBack()) { ui.ensureBackBuffer(); return; }
  if (Date.now() - _lastBack < 2000) return;
  _lastBack = Date.now();
  ui.toast('Toque em voltar novamente para sair', 'info');
  ui.ensureBackBuffer();
});

// ---------- PWA: service worker, auto-atualização, instalação ----------
function showUpdateBanner(worker) {
  if (document.getElementById('updateBanner')) return;
  const d = document.createElement('div');
  d.id = 'updateBanner';
  d.className = 'glass app-banner';
  d.innerHTML = '<div class="app-banner-txt"><b>Nova versão disponível</b><small>Toque para atualizar o FARM</small></div><button class="btn btn-primary btn-sm" id="updateBtn">Atualizar</button>';
  document.body.appendChild(d);
  document.getElementById('updateBtn').addEventListener('click', () => worker.postMessage('SKIP_WAITING'));
}
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => { // 'none': confere sw.js e version.js sem cache HTTP
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(nw);
        });
      });
    }).catch(() => {});
  });
}
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const d = document.createElement('div');
  d.id = 'installBanner';
  d.className = 'glass app-banner';
  d.innerHTML = '<div class="app-banner-txt"><b>Instalar FARM</b><small>Adicione à tela inicial</small></div><button class="btn btn-primary btn-sm" id="installBtn">Instalar</button><button class="app-banner-x" id="dismissInstallBtn" aria-label="Fechar">✕</button>';
  document.body.appendChild(d);
  document.getElementById('installBtn').addEventListener('click', () => {
    if (deferredPrompt) deferredPrompt.prompt();
    deferredPrompt?.userChoice.then(() => { deferredPrompt = null; d.remove(); });
  });
  document.getElementById('dismissInstallBtn').addEventListener('click', () => d.remove());
});

// ---------- Aviso "sem internet" ----------
function updateOnlineBanner() {
  const existing = document.getElementById('offlineBanner');
  if (navigator.onLine) { existing?.remove(); return; }
  if (existing) return;
  const d = document.createElement('div');
  d.id = 'offlineBanner';
  d.textContent = 'Sem internet — reconecte para continuar usando o FARM.';
  document.body.appendChild(d);
}
window.addEventListener('online', updateOnlineBanner);
window.addEventListener('offline', updateOnlineBanner);
updateOnlineBanner();

// ---------- Boot ----------
auth.restoreSessionIfAny();
