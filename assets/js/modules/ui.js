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
// Antes de gravar, espera o fim do carregamento em segundo plano (fase 2), para o que
// chega do banco não sobrescrever o que o usuário acabou de salvar.
export async function safeRun(action, okMsg) {
  try {
    await state.ready;
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
    if (!(history.state && history.state.farmBuffer)) history.pushState({ farmBuffer: true }, '');
  } catch (e) { /* ambientes sem History API (raro) — ignora */ }
}

// Ordem das abas na barra inferior (usada na animação de direção e no arrasto lateral).
export const NAV_ORDER = ['pageRebanho', 'pageInseminacao', 'pageMedicacao', 'pageHome', 'pageAlimentacao', 'pageRelatorios', 'pageConfig'];
const renderedPages = new Set();
export const wasRendered = id => renderedPages.has(id);
export function enterPage(id) { pageEnterHandlers[id]?.(); renderedPages.add(id); }

// opts.skipEnter: a página já foi desenhada (arrasto lateral); opts.noAnim: sem animação.
export function goPage(id, opts = {}) {
  const cur = document.querySelector('.page.active');
  if (!state.navLock && cur && cur.id !== id) {
    state.pageHistory.push(cur.id);
    if (state.pageHistory.length > 25) state.pageHistory.shift();
    ensureBackBuffer();
  }
  const next = document.getElementById(id);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active', 'from-left', 'from-right', 'still'));
  if (opts.noAnim) next.classList.add('still');
  // Desliza da direção certa: aba à direita entra pela direita, à esquerda pela esquerda.
  if (!opts.noAnim && cur && cur.id !== id) {
    const a = NAV_ORDER.indexOf(cur.id), b = NAV_ORDER.indexOf(id);
    if (a >= 0 && b >= 0) next.classList.add(b > a ? 'from-right' : 'from-left');
  }
  next.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  document.querySelector('.page-content').scrollTop = 0;
  if (!opts.skipEnter) enterPage(id);
}
// Redesenha a página aberta sem mexer na rolagem (ex.: quando a fase 2 dos dados chega).
export function refreshCurrentPage() {
  const cur = document.querySelector('.page.active');
  if (!cur) return;
  const sc = document.querySelector('.page-content'), top = sc.scrollTop;
  enterPage(cur.id);
  sc.scrollTop = top;
}

// Placeholder animado enquanto a fase 2 dos dados ainda não chegou.
export const skeletonHtml = (n = 3) => Array.from({ length: n }, () =>
  '<div class="skel-card"><div class="skel skel-ico"></div><div class="skel-lines"><div class="skel skel-l1"></div><div class="skel skel-l2"></div></div></div>').join('');

// ---------- Ações (sem onclick no HTML) ----------
// O HTML e os templates usam data-click / data-input / data-change com um JSON:
//   ["nomeDaAcao", arg1, arg2]  ou  [["acao1", ...], ["acao2", ...]]
// Argumentos especiais: "$this" (o elemento), "$event", "$checked", "$value".
// Só o elemento MAIS PRÓXIMO com data-click roda — botões dentro de cartões clicáveis
// não disparam o cartão (equivale ao antigo event.stopPropagation()).
const actions = {};
export function registerActions(obj) { Object.assign(actions, obj); }
export function callAction(name, ...args) {
  const fn = actions[name];
  if (!fn) { console.warn('Ação desconhecida:', name); return undefined; }
  return fn(...args);
}
export const act = (name, ...args) => `data-click="${esc(JSON.stringify([name, ...args]))}"`;
export const actOn = (type, name, ...args) => `data-${type}="${esc(JSON.stringify([name, ...args]))}"`;
export const actChain = (type, ...steps) => `data-${type}="${esc(JSON.stringify(steps))}"`;
function runSteps(el, json, ev) {
  let steps;
  try { steps = JSON.parse(json); } catch { return; }
  if (!Array.isArray(steps[0])) steps = [steps];
  for (const [name, ...args] of steps) {
    callAction(name, ...args.map(x => (x === '$this' ? el : x === '$event' ? ev : x === '$checked' ? el.checked : x === '$value' ? el.value : x)));
  }
}
['click', 'input', 'change'].forEach(type => document.addEventListener(type, e => {
  const el = e.target.closest?.(`[data-${type}]`);
  if (!el || el.disabled) return;
  runSteps(el, el.getAttribute(`data-${type}`), e);
}));

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
  sel.innerHTML = '<option value="">Selecione...</option>' + animals.map(a =>
    `<option value="${esc(a.num)}|${esc(a.nome)}">#${esc(a.num)} - ${esc(a.nome)} (${esc(a.loteName || '')})</option>`).join('');
  if (prev) sel.value = prev;
}

// ---------- Desempenho: montar <option>s de uma vez só ----------
// (concatenar `innerHTML +=` dentro de um loop refaz o <select> inteiro a cada item —
// com centenas de animais isso travava a abertura das janelas por segundos).
export function setOptions(sel, placeholder, items) {
  if (typeof sel === 'string') sel = document.getElementById(sel);
  if (!sel) return;
  sel.innerHTML = (placeholder != null ? `<option value="">${esc(placeholder)}</option>` : '') +
    items.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
}

// ---------- Desempenho: lista longa renderizada em partes ----------
// Desenha os primeiros itens na hora (a tela aparece imediatamente) e o resto em lotes
// a cada quadro de animação. Se a lista for re-renderizada (ex.: digitando na busca),
// o trabalho pendente da renderização anterior é descartado.
const listTokens = new WeakMap();
export function renderListChunked(container, items, rowFn, { first = 20, chunk = 24, after } = {}) {
  if (!container) return;
  const token = {};
  listTokens.set(container, token);
  container.innerHTML = items.slice(0, first).map(rowFn).join('');
  after?.();
  let i = first;
  const step = () => {
    if (listTokens.get(container) !== token || i >= items.length) return;
    container.insertAdjacentHTML('beforeend', items.slice(i, i + chunk).map(rowFn).join(''));
    i += chunk;
    after?.();
    requestAnimationFrame(step);
  };
  if (i < items.length) requestAnimationFrame(step);
}

// ---------- Atualização centralizada de telas ----------
// Módulos que alteram dados chamam refresh('rebanho') em vez de redesenhar todas as
// listas (inclusive as escondidas); quem se registrou decide o que está visível.
const refreshers = {};
export function registerRefresher(name, fn) { refreshers[name] = fn; }
export function refresh(name) { refreshers[name]?.(); }

// ---------- Menu de ações (action sheet) ----------
// openActionSheet({ title, sub, actions: [{ label, icon, tone: 'danger'|'info'|..., fn }] })
export function openActionSheet({ title, sub = '', actions }) {
  document.getElementById('sheetTitle').textContent = title || '';
  document.getElementById('sheetSub').textContent = sub;
  const box = document.getElementById('sheetActions');
  box.innerHTML = actions.map((a, i) =>
    `<button type="button" class="sheet-btn${a.tone ? ' sheet-' + a.tone : ''}" data-i="${i}"><span class="sheet-ico">${a.icon || ''}</span><span>${esc(a.label)}</span></button>`).join('');
  box.querySelectorAll('.sheet-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = actions[+btn.dataset.i];
      closeModal('actionSheet');
      act?.fn?.();
    });
  });
  openModal('actionSheet');
}

// Fecha ao tocar fora apenas nas janelas marcadas com data-backdrop-close (menus e fichas
// de consulta). Formulários não fecham por toque acidental fora, para não perder o que foi digitado.
document.addEventListener('click', e => {
  const ov = e.target;
  if (ov.classList?.contains('modal-overlay') && ov.classList.contains('show') && ov.hasAttribute('data-backdrop-close')) closeModal(ov.id);
});
