// ========== PONTO DE ENTRADA ==========
// index.html carrega só este arquivo (`<script type="module" src="assets/js/main.js">`).
// Como o HTML usa atributos inline (onclick="fn()", oninput="fn()"...) — mantidos de
// propósito para não precisar reescrever nenhuma tela — e módulos ES não colocam suas
// funções no escopo global sozinhos, este arquivo importa cada módulo de domínio (o que já
// dispara os registros feitos em cada um: registerPageEnter/registerModalSetup/
// registerAnimalSelectProvider) e expõe as funções chamadas pelo HTML em `window`.
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

const APP_VERSION = '4.1.0'; // sincronize com sw.js (VERSION) e version.json

Object.assign(window, {
  // ui.js
  togglePass: ui.togglePass, showConfirm: ui.showConfirm, confirmResolve: ui.confirmResolve,
  switchLoginTab: ui.switchLoginTab, openModal: ui.openModal, closeModal: ui.closeModal,
  goPage: ui.goPage, toggleFilterBar: ui.toggleFilterBar, toggleFolder: ui.toggleFolder,
  filterAnimalSelect: ui.filterAnimalSelect,
  // auth.js
  doLogin: auth.doLogin, doRegister: auth.doRegister, doLogout: auth.doLogout, changePassword: auth.changePassword,
  // profile.js
  setAvatar: profile.setAvatar,
  // fotos.js (form de foto do animal)
  onAnimalPhoto: fotos.onAnimalPhoto, removeAnimalPhoto: fotos.removeAnimalPhoto,
  // lotes.js
  saveLote: lotes.saveLote, editLoteFromCard: lotes.editLoteFromCard, delLote: lotes.delLote,
  openLoteDetail: lotes.openLoteDetail, backToLotes: lotes.backToLotes, toggleLoteFilter: lotes.toggleLoteFilter,
  renderLoteAnimals: lotes.renderLoteAnimals, renderLotes: lotes.renderLotes, moveLote: lotes.moveLote,
  // animais.js
  onSexoChange: animais.onSexoChange, onCatChange: animais.onCatChange, onSitChange: animais.onSitChange,
  onOrigemChange: animais.onOrigemChange, saveAnimalToLote: animais.saveAnimalToLote,
  openAnimalForLote: animais.openAnimalForLote, editAnimalInLote: animais.editAnimalInLote,
  delAnimalFromLote: animais.delAnimalFromLote, renderAnimaisFolder: animais.renderAnimaisFolder,
  openFicha: animais.openFicha,
  // rebanho.js
  openRebanhoView: rebanho.openRebanhoView, backToRebanhoHome: rebanho.backToRebanhoHome,
  // baixas.js
  openBaixa: baixas.openBaixa, setBaixaTipo: baixas.setBaixaTipo, confirmBaixa: baixas.confirmBaixa,
  renderBaixas: baixas.renderBaixas, restaurarBaixa: baixas.restaurarBaixa, delBaixa: baixas.delBaixa,
  // touros.js
  openTouros: touros.openTouros, saveTouro: touros.saveTouro, editTouro: touros.editTouro, delTouro: touros.delTouro,
  // inseminacao.js
  savePlanilha: inseminacao.savePlanilha, editPlanFromCard: inseminacao.editPlanFromCard, delPlan: inseminacao.delPlan,
  openInsemDetail: inseminacao.openInsemDetail, backToList: inseminacao.backToList, renderAnimals: inseminacao.renderAnimals,
  openInsemAnimalDirect: inseminacao.openInsemAnimalDirect, openInsemAnimalForPlan: inseminacao.openInsemAnimalForPlan,
  addInsemAnimal: inseminacao.addInsemAnimal, removeTempInsemAnimal: inseminacao.removeTempInsemAnimal,
  saveInsemAnimal: inseminacao.saveInsemAnimal, editInsemAnimal: inseminacao.editInsemAnimal,
  delInsemAnimal: inseminacao.delInsemAnimal, openParecer: inseminacao.openParecer, setParecer: inseminacao.setParecer,
  // medicacao.js
  setMedMode: medicacao.setMedMode, loadMedLoteAnimals: medicacao.loadMedLoteAnimals,
  toggleMedAnimalIncluded: medicacao.toggleMedAnimalIncluded, addMedAnimalIndiv: medicacao.addMedAnimalIndiv,
  removeMedIndivAnimal: medicacao.removeMedIndivAnimal, addMedRow: medicacao.addMedRow,
  saveMedAnimal: medicacao.saveMedAnimal, renderMedDirect: medicacao.renderMedDirect,
  editMedDirect: medicacao.editMedDirect, delMedDirect: medicacao.delMedDirect,
  // alimentacao.js
  setAliMode: alimentacao.setAliMode, loadAliLoteAnimals: alimentacao.loadAliLoteAnimals,
  toggleAliAnimalIncluded: alimentacao.toggleAliAnimalIncluded, addAliAnimalNew: alimentacao.addAliAnimalNew,
  removeAliAnimal: alimentacao.removeAliAnimal, onDietChange2: alimentacao.onDietChange2,
  calcAliCost: alimentacao.calcAliCost,
  saveAliDirect: alimentacao.saveAliDirect, editAliDirect: alimentacao.editAliDirect, delAliDirect: alimentacao.delAliDirect,
  // dashboard.js
  setChartFilter: dashboard.setChartFilter,
  // relatorios.js
  toggleAllReportSources: relatorios.toggleAllReportSources, downloadReport: relatorios.downloadReport,
  // help.js
  openHelp: help.openHelp,
});

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

// ---------- Botão "voltar" do celular: fecha modal / volta de tela em vez de sair do app ----------
let _lastBack = 0;
window.addEventListener('popstate', () => {
  const modal = document.querySelector('.modal-overlay.show');
  if (modal) { ui.closeModal(modal.id); ui.ensureBackBuffer(); return; }
  const main = document.getElementById('mainApp');
  if (main && main.style.display !== 'none') {
    const ld = document.getElementById('loteDetail');
    if (ld && !ld.classList.contains('hidden')) { lotes.backToLotes(); ui.ensureBackBuffer(); return; }
    const rv = ['animaisView', 'lotesView', 'baixasView'].map(x => document.getElementById(x)).find(e => e && !e.classList.contains('hidden'));
    if (rv) { rebanho.backToRebanhoHome(); ui.ensureBackBuffer(); return; }
    const idt = document.getElementById('insemDetail');
    if (idt && !idt.classList.contains('hidden')) { inseminacao.backToList(); ui.ensureBackBuffer(); return; }
    if (state.pageHistory.length) { state.navLock = true; ui.goPage(state.pageHistory.pop()); state.navLock = false; ui.ensureBackBuffer(); return; }
    if (Date.now() - _lastBack < 2000) return;
    _lastBack = Date.now();
    ui.toast('Toque em voltar novamente para sair', 'info');
    ui.ensureBackBuffer();
  }
});

// ---------- PWA: service worker, auto-atualização, instalação ----------
function showUpdateBanner(worker) {
  if (document.getElementById('updateBanner')) return;
  const d = document.createElement('div');
  d.id = 'updateBanner';
  d.style.cssText = 'position:fixed;bottom:80px;left:16px;right:16px;z-index:70;padding:16px 20px;border-radius:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;animation:slideUp .4s ease';
  d.className = 'glass';
  d.innerHTML = '<div style="flex:1"><div style="font-weight:700;font-size:.88rem">Nova versão disponível</div><div style="font-size:.72rem;color:var(--text2);margin-top:2px">Toque para atualizar o ELTECH</div></div><button class="btn btn-primary btn-sm" id="updateBtn" style="flex-shrink:0">Atualizar</button>';
  document.body.appendChild(d);
  document.getElementById('updateBtn').onclick = () => worker.postMessage('SKIP_WAITING');
}
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
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
  d.style.cssText = 'position:fixed;bottom:80px;left:16px;right:16px;z-index:60;padding:16px 20px;border-radius:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;animation:slideUp .4s ease';
  d.className = 'glass';
  d.innerHTML = '<div style="flex:1"><div style="font-weight:700;font-size:.88rem">Instalar ELTECH</div><div style="font-size:.72rem;color:var(--text2);margin-top:2px">Adicione à tela inicial</div></div><button class="btn btn-primary btn-sm" id="installBtn" style="flex-shrink:0">Instalar</button><button id="dismissInstallBtn" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:4px;font-size:1.2rem">✕</button>';
  document.body.appendChild(d);
  document.getElementById('installBtn').onclick = () => {
    if (deferredPrompt) deferredPrompt.prompt();
    deferredPrompt?.userChoice.then(() => { deferredPrompt = null; d.remove(); });
  };
  document.getElementById('dismissInstallBtn').onclick = () => d.remove();
});

// ---------- Aviso "sem internet" ----------
function updateOnlineBanner() {
  const existing = document.getElementById('offlineBanner');
  if (navigator.onLine) { existing?.remove(); return; }
  if (existing) return;
  const d = document.createElement('div');
  d.id = 'offlineBanner';
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:80;padding:8px;text-align:center;font-size:.75rem;font-weight:600;background:var(--danger);color:#fff';
  d.textContent = 'Sem internet — reconecte para continuar usando o ELTECH.';
  document.body.appendChild(d);
}
window.addEventListener('online', updateOnlineBanner);
window.addEventListener('offline', updateOnlineBanner);
updateOnlineBanner();

// ---------- Boot ----------
auth.restoreSessionIfAny();
