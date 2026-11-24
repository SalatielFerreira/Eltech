// ========== ARRASTO LATERAL ENTRE PÁGINAS ==========
// Arrastar o dedo para os lados troca de aba (na mesma ordem da barra inferior), com a
// página vizinha entrando junto com o dedo. Dentro de uma sub-tela (ex.: detalhe do lote),
// arrastar para a direita faz "voltar".
//
// Desempenho: só `transform` (GPU) durante o arrasto, atualizado 1x por quadro via
// requestAnimationFrame; nada de reflow. A rolagem vertical continua nativa
// (.page-content tem touch-action: pan-y) e o gesto só "pega" quando o movimento é
// claramente horizontal.
import { state } from '../state.js';
import { NAV_ORDER, goPage, enterPage, callAction } from './ui.js';

const content = document.querySelector('.page-content');
const SUBVIEWS = { pageRebanho: ['animaisView', 'lotesView', 'baixasView', 'loteDetail'], pageInseminacao: ['insemDetail'] };
const IGNORE = 'input,textarea,select,canvas,.chip-scroll,.lote-stats,.baixa-summary,.check-list,.seg,[data-noswipe]';
const EASE = 'transform .26s cubic-bezier(.2,.8,.2,1)';
const EDGE = 16; // borda reservada aos gestos do sistema (voltar do Android/iOS)

let g = null; // gesto em andamento
let raf = 0;

const isSubview = page => (SUBVIEWS[page.id] || []).some(id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); });
const anyModalOpen = () => !!document.querySelector('.modal-overlay.show, .confirm-overlay.show');

function setX(el, x) { el.style.transform = `translate3d(${x}px,0,0)`; }

function preparePeek(id) {
  const page = document.getElementById(id);
  if (!page) return null;
  enterPage(id); // desenha com dados atuais (normalmente leve; listas longas saem em partes)
  page.classList.add('peek');
  page.style.top = content.scrollTop + 'px';
  page.style.transition = 'none';
  return page;
}
function clearPeek(page) {
  if (!page) return;
  page.classList.remove('peek');
  page.style.transform = page.style.transition = page.style.top = '';
}

function begin() {
  const cur = document.querySelector('.page.active');
  if (!cur) return false;
  const i = NAV_ORDER.indexOf(cur.id);
  g.cur = cur;
  g.w = content.clientWidth;
  g.back = isSubview(cur);
  g.prevId = g.back ? null : NAV_ORDER[i - 1] || null;
  g.nextId = g.back ? null : NAV_ORDER[i + 1] || null;
  g.peeks = {};
  cur.classList.remove('from-left', 'from-right');
  cur.style.transition = 'none';
  cur.style.willChange = 'transform';
  content.classList.add('swiping');
  return true;
}

function frame() {
  raf = 0;
  if (!g || g.mode !== 'h') return;
  let dx = g.dx;
  const targetId = dx > 0 ? g.prevId : g.nextId;
  const canGo = g.back ? dx > 0 : !!targetId;
  if (!canGo) dx = dx / 3.2; // resistência "elástica" quando não há para onde ir
  setX(g.cur, dx);
  g.cur.style.opacity = g.back ? String(1 - Math.min(Math.abs(dx) / g.w, 1) * 0.35) : '';
  // página vizinha entra junto com o dedo
  if (targetId && canGo) {
    const peek = g.peeks[targetId] || (g.peeks[targetId] = preparePeek(targetId));
    if (peek) setX(peek, dx > 0 ? dx - g.w : dx + g.w);
    const other = g.peeks[dx > 0 ? g.nextId : g.prevId];
    if (other) setX(other, dx > 0 ? g.w * 2 : -g.w * 2);
  }
}

function finish() {
  if (!g) return;
  const st = g; g = null;
  if (st.mode !== 'h') return;
  cancelAnimationFrame(raf); raf = 0;
  const dt = Math.max(1, performance.now() - st.lastT);
  const v = (st.dx - st.lastDx) / dt; // px/ms nos últimos quadros (gesto rápido = "flick")
  const dir = st.dx > 0 ? 1 : -1;
  const targetId = dir > 0 ? st.prevId : st.nextId;
  const allowed = st.back ? dir > 0 : !!targetId;
  const commit = allowed && (Math.abs(st.dx) > st.w * 0.3 || (Math.abs(v) > 0.45 && Math.abs(st.dx) > 30 && Math.sign(v) === dir));
  const peek = targetId ? st.peeks[targetId] : null;

  st.cur.style.transition = EASE + ', opacity .26s ease';
  if (peek) peek.style.transition = EASE;
  requestAnimationFrame(() => {
    if (commit) {
      setX(st.cur, dir * st.w);
      if (peek) setX(peek, 0);
    } else {
      setX(st.cur, 0);
      st.cur.style.opacity = '';
      if (peek) setX(peek, dir > 0 ? -st.w : st.w);
    }
  });
  const done = () => {
    content.classList.remove('swiping');
    st.cur.style.transform = st.cur.style.transition = st.cur.style.willChange = st.cur.style.opacity = '';
    Object.values(st.peeks).forEach(clearPeek);
    if (commit) {
      navigator.vibrate?.(8);
      if (st.back) callAction('goBack', { anim: false });
      else goPage(targetId, { skipEnter: true, noAnim: true });
    }
  };
  let ended = false;
  const once = () => { if (!ended) { ended = true; done(); } };
  st.cur.addEventListener('transitionend', once, { once: true });
  setTimeout(once, 320); // garantia caso o transitionend não dispare
}

content.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' || !e.isPrimary || g) return;
  if (anyModalOpen() || e.target.closest(IGNORE)) return;
  if (e.clientX < EDGE || e.clientX > window.innerWidth - EDGE) return;
  if (!document.getElementById('mainApp') || document.getElementById('mainApp').style.display === 'none') return;
  g = { id: e.pointerId, x: e.clientX, y: e.clientY, mode: null, dx: 0, lastDx: 0, lastT: performance.now() };
}, { passive: true });

content.addEventListener('pointermove', e => {
  if (!g || e.pointerId !== g.id) return;
  const dx = e.clientX - g.x, dy = e.clientY - g.y;
  if (!g.mode) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    if (Math.abs(dx) > Math.abs(dy) * 1.4 && begin()) {
      g.mode = 'h';
      g.x = e.clientX; // começa do ponto atual: sem "pulo" de 10px
      try { content.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    } else { g = null; return; }
  }
  const now = performance.now();
  if (now - g.lastT > 50) { g.lastDx = g.dx; g.lastT = now; }
  g.dx = e.clientX - g.x;
  if (!raf) raf = requestAnimationFrame(frame);
}, { passive: true });

content.addEventListener('pointerup', finish);
content.addEventListener('pointercancel', () => { if (g && g.mode === 'h') finish(); else g = null; });

// Um clique logo após um arrasto não deve abrir o cartão onde o dedo soltou.
content.addEventListener('click', e => { if (content.classList.contains('swiping')) { e.stopPropagation(); e.preventDefault(); } }, true);

export const swipeState = () => ({ active: !!g, loaded: state.loaded });
