// ========== GRÁFICOS (canvas puro, sem lib externa) ==========
import { esc } from './ui.js';

// Paleta harmonizada com o tema bege/marrom (tons quentes + alguns frios para contraste).
export const COLORS = ['#c9a86a', '#1bd171', '#5b9aff', '#f0a35e', '#e46a76', '#a78bfa', '#2dd4bf', '#f472b6', '#8d6e48', '#a3e635', '#fbbf24', '#67e8f9'];

// Prepara o canvas para a densidade de pixels da tela (fica nítido em celulares) e
// devolve o contexto já escalado + o tamanho em pixels CSS.
function setupCanvas(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cssW = parseInt(c.dataset.w || c.getAttribute('width'), 10);
  const cssH = parseInt(c.dataset.h || c.getAttribute('height'), 10);
  c.dataset.w = cssW; c.dataset.h = cssH;
  c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
  c.style.width = cssW + 'px'; c.style.maxWidth = '100%'; c.style.aspectRatio = `${cssW} / ${cssH}`; c.style.height = 'auto';
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W: cssW, H: cssH };
}

// Rosca com o total no centro. `legendId` é opcional (null = quem chama monta a legenda).
export function drawPie(canvasId, legendId, data) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const { ctx, W, H } = setupCanvas(c);
  const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 8;
  ctx.clearRect(0, 0, W, H);
  const keys = Object.keys(data), total = keys.reduce((s, k) => s + data[k], 0);
  const leg = legendId ? document.getElementById(legendId) : null;
  if (!total) {
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(204,177,133,0.18)'; ctx.lineWidth = r * 0.44; ctx.stroke();
    ctx.fillStyle = 'rgba(238,224,201,0.5)'; ctx.font = '600 13px Sora'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Sem dados', cx, cy);
    if (leg) leg.innerHTML = '';
    return;
  }
  let start = -Math.PI / 2;
  const gap = keys.length > 1 ? 0.025 : 0;
  const legend = [];
  keys.forEach((k, i) => {
    const angle = (data[k] / total) * Math.PI * 2;
    const color = COLORS[i % COLORS.length];
    ctx.beginPath();
    ctx.arc(cx, cy, r, start + gap, start + angle - gap);
    ctx.arc(cx, cy, r * 0.58, start + angle - gap, start + gap, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (angle > 0.4) {
      const mid = start + angle / 2;
      const lx = cx + Math.cos(mid) * (r * 0.79), ly = cy + Math.sin(mid) * (r * 0.79);
      ctx.fillStyle = '#1c150c'; ctx.font = '700 11px Sora'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(data[k], lx, ly);
    }
    start += angle;
    legend.push(`<div class="legend-item"><div class="legend-dot" style="background:${color}"></div>${esc(k)} (${data[k]})</div>`);
  });
  if (leg) leg.innerHTML = legend.join('');
  ctx.fillStyle = '#fff'; ctx.font = '700 26px JetBrains Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 7);
  ctx.fillStyle = 'rgba(238,224,201,0.55)'; ctx.font = '600 10px Sora';
  ctx.fillText('ANIMAIS', cx, cy + 14);
}

export function drawLineChart(id, vals, color) {
  const c = document.getElementById(id);
  if (!c) return;
  const { ctx, W, H } = setupCanvas(c);
  const pad = 26;
  ctx.clearRect(0, 0, W, H);
  if (!vals.length) return;
  const max = Math.max(...vals), min = Math.min(...vals), range = (max - min) || 1, n = vals.length;
  const px = i => n > 1 ? pad + i * ((W - pad * 2) / (n - 1)) : W / 2;
  const py = v => H - pad - ((v - min) / range) * (H - pad * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();
  // área sob a linha
  if (n > 1) {
    const g = ctx.createLinearGradient(0, pad, 0, H - pad);
    g.addColorStop(0, color + '55'); g.addColorStop(1, color + '00');
    ctx.beginPath(); ctx.moveTo(px(0), H - pad);
    vals.forEach((v, i) => ctx.lineTo(px(i), py(v)));
    ctx.lineTo(px(n - 1), H - pad); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
  }
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  vals.forEach((v, i) => { const x = px(i), y = py(v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.stroke();
  ctx.font = '600 10px Sora'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  vals.forEach((v, i) => {
    const x = px(i), y = py(v);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(v, x, y - 6);
  });
}
