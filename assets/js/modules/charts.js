// ========== GRÁFICOS (canvas puro, sem lib externa) ==========
import { esc } from './ui.js';

export const COLORS = ['#1bd171', '#5b9aff', '#ffb830', '#ff4757', '#a78bfa', '#f472b6', '#2dd4bf', '#fb923c', '#818cf8', '#a3e635', '#fbbf24', '#67e8f9'];

export function drawPie(canvasId, legendId, data) {
  const c = document.getElementById(canvasId), ctx = c.getContext('2d'), W = c.width, H = c.height, cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 16;
  ctx.clearRect(0, 0, W, H);
  const keys = Object.keys(data), total = keys.reduce((s, k) => s + data[k], 0);
  const leg = document.getElementById(legendId);
  if (!total) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(78,232,152,0.15)'; ctx.lineWidth = 20; ctx.stroke();
    ctx.fillStyle = 'rgba(195,249,221,0.3)'; ctx.font = '500 13px Sora'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Sem dados', cx, cy);
    leg.innerHTML = '';
    return;
  }
  let start = -Math.PI / 2;
  leg.innerHTML = '';
  keys.forEach((k, i) => {
    const angle = (data[k] / total) * Math.PI * 2;
    const color = COLORS[i % COLORS.length];
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.arc(cx, cy, r * 0.55, start + angle, start, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    if (angle > 0.35) {
      const mid = start + angle / 2;
      const lx = cx + Math.cos(mid) * (r * 0.78), ly = cy + Math.sin(mid) * (r * 0.78);
      ctx.fillStyle = '#fff'; ctx.font = '700 11px Sora'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(data[k], lx, ly);
    }
    start += angle;
    leg.innerHTML += `<div class="legend-item"><div class="legend-dot" style="background:${color}"></div>${esc(k)} (${data[k]})</div>`;
  });
  ctx.fillStyle = '#fff'; ctx.font = '700 22px JetBrains Mono'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 6);
  ctx.fillStyle = 'rgba(195,249,221,0.5)'; ctx.font = '500 10px Sora';
  ctx.fillText('TOTAL', cx, cy + 12);
}

export function drawLineChart(id, vals, color) {
  const c = document.getElementById(id);
  if (!c) return;
  const ctx = c.getContext('2d'), W = c.width, H = c.height, pad = 26;
  ctx.clearRect(0, 0, W, H);
  if (!vals.length) return;
  const max = Math.max(...vals), min = Math.min(...vals), range = (max - min) || 1, n = vals.length;
  const px = i => n > 1 ? pad + i * ((W - pad * 2) / (n - 1)) : W / 2;
  const py = v => H - pad - ((v - min) / range) * (H - pad * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath();
  vals.forEach((v, i) => { const x = px(i), y = py(v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.stroke();
  ctx.font = '600 10px Sora'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  vals.forEach((v, i) => {
    const x = px(i), y = py(v);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(v, x, y - 6);
  });
}
