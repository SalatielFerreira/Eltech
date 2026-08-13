// ========== UI GENÉRICA ==========
// Toast, modais, confirmação customizada, navegação entre páginas,
// validações de formulário e o botão "voltar" do celular.
//
// Os módulos de domínio (lotes.js, animais.js, ...) não são importados
// aqui — para evitar dependência circular, cada um se REGISTRA nesta
// tela via registerModalSetup/registerModalTeardown/registerPageEnter
// assim que é carregado (ver final de cada módulo de domínio).
import { state } from '../state.js';

// ---------- Escape / validações ----------
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
export const isValidEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const isValidPassword = p => p.length >= 6 && /[A-Z]/.test(p) && /[0-9]/.test(p) &&
  /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p);
export const isValidName = n => /^[a-zA-ZÀ-ÿ\s]{1,15}$/.test(n) && n.trim().length > 0;

// ---------- Toast ----------
export function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast toast-' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 2800);
}

// Envolve uma ação assíncrona: mostra toast de erro automaticamente se falhar.
// Usado por todo handler que fala com o Supabase (evita repetir try/catch).
export async function safeRun(action, okMsg) {
  try {
    const result = await action();
    if (okMsg) toast(okMsg);
    return result;
  } catch (err) {
    console.error(err);
    toast(err?.message || 'Erro inesperado. Tente novamente.', 'error');
    throw err;
  }
}

export function requireOnline() {
  if (!navigator.onLine) {
    toast('Sem internet — conecte-se para salvar.', 'error');
    return false;
  }
  return true;
}

// ---------- Senha (mostrar/ocultar) ----------
export function togglePass(id, btn) {
  const input = document.getElementById(id);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.innerHTML = isHidden
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  btn.style.color = isHidden ? 'var(--g400)' : 'var(--text3)';
}

// ---------- Confirmação customizada ----------
let _confirmCb = null;
export function showConfirm(msg, icon = '⚠️') {
  return new Promise(resolve => {
    _confirmCb = resolve;
    document.getElementById('confirmIcon').textContent = icon;
    document.getElementById('confirmMsg').textContent = msg;
    document.getElementById('confirmModal').classList.add('show');
  });
}
export function confirmResolve(val) {
  document.getElementById('confirmModal').classList.remove('show');
  if (_confirmCb) _confirmCb(val);
  _confirmCb = null;
}

// ---------- Login: troca de aba ----------
export function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab').forEach((t, i) => t.classList.toggle('active', ['login', 'register'][i] === tab));
  document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
  document.getElementById(tab === 'login' ? 'loginForm' : 'registerForm').classList.add('active');
}

// ---------- Modais (registro por id, preenchido pelos módulos de domínio) ----------
const modalSetups = {};
const modalTeardowns = {};
export function registerModalSetup(id, fn) { modalSetups[id] = fn; }
export function registerModalTeardown(id, fn) { modalTeardowns[id] = fn; }

export function openModal(id) {
  document.getElementById(id).classList.add('show');
  modalSetups[id]?.();
}
export function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('show');
  state.editAniId = null;
  state.editLoteId = null;
  state.editPlanId = null;
  state.tempMedAnimals = [];
  state.tempAliAnimals = [];
  state.tempInsemAnimals = [];
  modal.querySelectorAll('input:not([type=file]):not([disabled]):not([type=checkbox]),textarea').forEach(el => el.value = '');
  modal.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
  modalTeardowns[id]?.();
}

// ---------- Navegação entre páginas ----------
const pageEnterHandlers = {};
export function registerPageEnter(id, fn) { pageEnterHandlers[id] = fn; }

export function ensureBackBuffer() {
  try {
    if (!(history.state && history.state.eltechBuffer)) history.pushState({ eltechBuffer: true }, '');
  } catch (e) { /* ambientes sem History API (raro) — ignora */ }
}

export function goPage(id) {
  const cur = document.querySelector('.page.active');
  if (!state.navLock && cur && cur.id !== id) {
    state.pageHistory.push(cur.id);
    if (state.pageHistory.length > 25) state.pageHistory.shift();
    ensureBackBuffer();
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  document.querySelector('.page-content').scrollTop = 0;
  pageEnterHandlers[id]?.();
}

export function toggleFilterBar(id) {
  document.getElementById(id)?.classList.toggle('hidden');
}
export function toggleFolder(id) {
  document.getElementById(id)?.classList.toggle('open');
}

// ---------- Toolbar de seleção de animal com busca (usado em vários modais) ----------
// `optionsProvider()` deve devolver a lista de animais já filtrada/ordenada para o contexto.
const animalSelectProviders = {};
export function registerAnimalSelectProvider(type, fn) { animalSelectProviders[type] = fn; }
export function filterAnimalSelect(searchId, selectId, type) {
  const q = (document.getElementById(searchId)?.value || '').toLowerCase().trim();
  const sel = document.getElementById(selectId);
  const prev = sel.value;
  let animals = animalSelectProviders[type]?.() || [];
  if (q) animals = animals.filter(a => (a.num || '').toLowerCase().includes(q) || (a.nome || '').toLowerCase().includes(q));
  sel.innerHTML = '<option value="">Selecione...</option>';
  animals.forEach(a => {
    sel.innerHTML += `<option value="${esc(a.num)}|${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)} (${esc(a.loteName || '')})</option>`;
  });
  if (prev) sel.value = prev;
}
