'use strict';
// Internal (low-res) resolution. Everything is drawn at this size and scaled up crisp.
const W = 480, H = 270;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const approach = (v, t, s) => (v < t ? Math.min(v + s, t) : Math.max(v - s, t));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// Deterministic 0..1 hash (for static procedural art)
function hash(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

let _hitId = 1;
const newHitId = () => _hitId++;

// 8-way direction from held keys; falls back to facing direction.
function dirFromPad(pad, facing) {
  let dx = (pad.held('right') ? 1 : 0) - (pad.held('left') ? 1 : 0);
  let dy = (pad.held('down') ? 1 : 0) - (pad.held('up') ? 1 : 0);
  if (!dx && !dy) dx = facing;
  const l = Math.hypot(dx, dy);
  return { x: dx / l, y: dy / l };
}

// ---- pixel drawing helpers ----
function pcircle(ctx, cx, cy, r, col) {
  ctx.fillStyle = col;
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

function pring(ctx, cx, cy, r, th, col) {
  ctx.fillStyle = col;
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  const ri = r - th;
  for (let y = -r; y <= r; y++) {
    const wo = Math.floor(Math.sqrt(r * r - y * y));
    const wi = Math.abs(y) <= ri && ri > 0 ? Math.floor(Math.sqrt(ri * ri - y * y)) : -1;
    if (wi < 0) ctx.fillRect(cx - wo, cy + y, wo * 2 + 1, 1);
    else {
      ctx.fillRect(cx - wo, cy + y, wo - wi, 1);
      ctx.fillRect(cx + wi + 1, cy + y, wo - wi, 1);
    }
  }
}

function pline(ctx, x0, y0, x1, y1, col, size = 1) {
  ctx.fillStyle = col;
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const o = Math.floor(size / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ctx.fillRect(Math.round(x0 + dx * t) - o, Math.round(y0 + dy * t) - o, size, size);
  }
}

const PCOL = ['#ff5a5a', '#4fb4ff'];
