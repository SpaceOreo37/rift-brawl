'use strict';
// "Sunset Rift" — floating island arena. Collision data + pre-rendered pixel art.
const STAGE = {
  // Solid ground (stacked rects approximate the island's tapered underside)
  solids: [
    { x: 100, y: 196, w: 280, h: 36 },
    { x: 118, y: 232, w: 244, h: 12 },
    { x: 146, y: 244, w: 188, h: 10 },
    { x: 190, y: 254, w: 100, h: 10 },
  ],
  // Pass-through platforms (land from above, hold DOWN to drop)
  plats: [
    { x: 128, y: 150, w: 72, h: 4 },
    { x: 280, y: 150, w: 72, h: 4 },
    { x: 204, y: 108, w: 72, h: 4 },
  ],
  blast: { l: -80, r: W + 80, t: -110, b: H + 50 },
  spawns: [{ x: 170, y: 190 }, { x: 310, y: 190 }],
  respawn: { x: 240, y: 62 },
  edgeL: 100, edgeR: 380, top: 196,
  bg: null, fg: null, clouds: [],
};

STAGE.build = function () {
  // ---------- background ----------
  const bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  const c = bg.getContext('2d');
  const img = c.createImageData(W, H);
  const d = img.data;
  const sky = ['#120a2a', '#1f1342', '#33195c', '#552270', '#7f2d78', '#b04574', '#de6667', '#f5955e', '#ffc46e'].map(hexRgb);
  const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < H; y++) {
    const v = clamp(y / (H * 0.8), 0, 1) * (sky.length - 1);
    const i = Math.floor(v), f = v - i;
    for (let x = 0; x < W; x++) {
      const th = (B[(x & 3) + ((y & 3) << 2)] + 0.5) / 16;
      const col = sky[Math.min(sky.length - 1, f > th ? i + 1 : i)];
      const k = (y * W + x) * 4;
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);

  // stars
  for (let i = 0; i < 140; i++) {
    const x = Math.floor(hash(i, 1) * W), y = Math.floor(Math.pow(hash(i, 2), 1.7) * 140);
    c.globalAlpha = clamp((0.35 + hash(i, 4) * 0.65) * (1 - y / 150), 0, 1);
    c.fillStyle = hash(i, 3) > 0.8 ? '#ffffff' : '#c9b6ff';
    c.fillRect(x, y, 1, 1);
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(hash(i, 11) * W), y = 10 + Math.floor(hash(i, 12) * 60);
    c.fillStyle = '#ffffff'; c.fillRect(x, y, 1, 1);
    c.fillStyle = '#a99ae0'; c.fillRect(x - 1, y, 1, 1); c.fillRect(x + 1, y, 1, 1); c.fillRect(x, y - 1, 1, 1); c.fillRect(x, y + 1, 1, 1);
  }

  // striped setting sun
  const sx = 240, sy = 168, r = 50;
  const sunCols = ['#fff3b0', '#ffd27a', '#ff9e66', '#ff6f5e'];
  for (let yy = -r; yy <= r; yy++) {
    if (yy > 4 && (yy % 8) < Math.floor(yy / 12) + 1) continue;
    const hw = Math.floor(Math.sqrt(r * r - yy * yy));
    const v = ((yy + r) / (2 * r)) * (sunCols.length - 1);
    const i = Math.floor(v), f = v - i;
    for (let xx = -hw; xx <= hw; xx++) {
      const th = (B[((sx + xx) & 3) + (((sy + yy) & 3) << 2)] + 0.5) / 16;
      c.fillStyle = sunCols[Math.min(sunCols.length - 1, f > th ? i + 1 : i)];
      c.fillRect(sx + xx, sy + yy, 1, 1);
    }
  }

  // distant floating rocks
  const rock = (x, y, w, col) => {
    c.fillStyle = col;
    for (let i = 0; i < w / 2; i++) c.fillRect(x + i, y + i * 0.9, w - i * 2, 1);
    c.fillRect(x - 1, y - 2, w + 2, 2);
  };
  rock(52, 92, 30, '#4a1d5e');
  rock(404, 70, 22, '#4a1d5e');
  rock(150, 60, 12, '#5a2470');

  // mountains (two parallax-looking layers)
  for (let x = 0; x < W; x++) {
    const h1 = Math.round(160 - (18 * Math.sin(x * 0.012 + 0.5) + 11 * Math.sin(x * 0.029 + 2.1) + 5 * Math.sin(x * 0.071 + 1.3)));
    c.fillStyle = '#5a2470'; c.fillRect(x, h1, 1, H - h1);
    c.fillStyle = '#7a3488'; c.fillRect(x, h1, 1, 1);
  }
  for (let x = 0; x < W; x++) {
    const h2 = Math.round(200 - (14 * Math.sin(x * 0.017 + 3) + 9 * Math.sin(x * 0.043 + 0.7) + 4 * Math.sin(x * 0.11)));
    c.fillStyle = '#371649'; c.fillRect(x, h2, 1, H - h2);
    c.fillStyle = '#4c1f5f'; c.fillRect(x, h2, 1, 1);
  }

  // sea of clouds
  const puffs = [];
  for (let i = 0; i < 34; i++) puffs.push([i * 15 + hash(i, 21) * 10 - 5, 236 + hash(i, 22) * 10, 7 + hash(i, 23) * 9]);
  for (const p of puffs) pcircle(c, p[0], p[1], p[2], '#ffb9b0');
  for (const p of puffs) pcircle(c, p[0], p[1] + 3, p[2] - 1, '#e7848f');
  c.fillStyle = '#b85a7e'; c.fillRect(0, 256, W, H - 256);
  for (let x = 0; x < W; x += 2) { c.fillStyle = '#c9688a'; c.fillRect(x + ((x >> 1) % 2), 255, 1, 1); }
  STAGE.bg = bg;

  // ---------- foreground: island + platforms ----------
  const fg = document.createElement('canvas');
  fg.width = W; fg.height = H;
  const g = fg.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const bots = [];
  for (let x = 100; x < 380; x++) {
    const u = (x + 0.5 - 240) / 140;
    const bot = Math.round(232 + 36 * Math.pow(Math.max(0, 1 - u * u), 0.7) + hash(x, 7) * 3);
    bots[x] = bot;
    const grassD = 3 + Math.floor(hash(x, 9) * 3);
    for (let y = 196; y <= bot; y++) {
      const dy = y - 196;
      let col;
      if (dy === 0) col = '#a6f07a';
      else if (dy < grassD) col = '#4fb548';
      else if (dy === grassD) col = '#2e7a3a';
      else {
        const dd = (y - 196) / (bot - 196) + (hash(x, y) - 0.5) * 0.12;
        col = dd < 0.35 ? '#7b4a3c' : dd < 0.7 ? '#5c3248' : '#3d2042';
        if (hash(x, y * 3) > 0.94) col = '#9a6650';
        if (hash(x * 3, y * 7) > 0.975) col = '#2a1430';
      }
      if (y === bot || x === 100 || x === 379) col = y < 196 + grassD ? '#2e7a3a' : '#1d0f26';
      px(x, y, col);
    }
  }
  // brick seams in the upper rock
  for (let row = 0; row < 3; row++) {
    const y = 206 + row * 8;
    for (let x = 104 + (row % 2) * 8; x < 376; x += 16) {
      if (bots[x] > y + 6) { g.fillStyle = '#5c3248'; g.fillRect(x, y, 1, 6); g.fillRect(x - 7, y + 6, 15, 1); }
    }
  }
  // embedded crystals
  for (let i = 0; i < 9; i++) {
    const x = 120 + Math.floor(hash(i, 31) * 240), y = 214 + Math.floor(hash(i, 32) * 26);
    if (bots[x] && bots[x] > y + 4) {
      g.fillStyle = '#1d0f26'; g.fillRect(x - 1, y - 1, 4, 5);
      g.fillStyle = '#4fd8ff'; g.fillRect(x, y, 2, 3);
      g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
    }
  }
  // hanging roots
  for (let x = 104; x < 376; x += 7) {
    if (hash(x, 41) < 0.55) continue;
    const len = 3 + Math.floor(hash(x, 42) * 12);
    for (let k = 0; k < len; k++) px(x + (k > 6 ? 1 : 0), bots[x] + k, k === len - 1 ? '#7ee36a' : '#2e7a3a');
  }
  // grass tufts + flowers on top
  for (let x = 101; x < 379; x++) {
    const h = hash(x, 51);
    if (h > 0.8) px(x, 195, '#a6f07a');
    if (h > 0.93) px(x, 194, '#a6f07a');
    if (hash(x, 52) > 0.975) { px(x, 193, '#ff7ab8'); px(x, 194, '#2e7a3a'); px(x, 195, '#2e7a3a'); }
  }
  // platforms
  for (const p of STAGE.plats) {
    g.fillStyle = '#1d0f26'; g.fillRect(p.x - 1, p.y - 1, p.w + 2, 7);
    g.fillStyle = '#d8c8f5'; g.fillRect(p.x, p.y, p.w, 1);
    g.fillStyle = '#9b82c9'; g.fillRect(p.x, p.y + 1, p.w, 3);
    g.fillStyle = '#6a4f9a'; g.fillRect(p.x, p.y + 4, p.w, 1);
    for (let x = p.x + 6; x < p.x + p.w; x += 12) { g.fillStyle = '#6a4f9a'; g.fillRect(x, p.y + 1, 1, 3); }
    for (let x = p.x; x < p.x + p.w; x++) if (hash(x, p.y) > 0.7) px(x, p.y, '#7ee36a');
    const mx = p.x + p.w / 2;
    g.fillStyle = '#1d0f26'; g.fillRect(mx - 2, p.y + 5, 5, 4);
    g.fillStyle = '#4fd8ff'; g.fillRect(mx - 1, p.y + 5, 3, 2); g.fillRect(mx, p.y + 7, 1, 1);
  }
  STAGE.fg = fg;

  // drifting clouds (pre-rendered sprites)
  for (let i = 0; i < 6; i++) {
    const cw = 40 + Math.floor(hash(i, 61) * 40);
    const cc = document.createElement('canvas');
    cc.width = cw + 4; cc.height = 20;
    const k = cc.getContext('2d');
    const n = 4 + Math.floor(cw / 14);
    for (let j = 0; j < n; j++) pcircle(k, 6 + (j / (n - 1)) * (cw - 8), 12 - hash(i, j) * 3, 4 + hash(j, i) * 4, '#f6b3c4');
    for (let j = 0; j < n; j++) pcircle(k, 6 + (j / (n - 1)) * (cw - 8), 14 - hash(i, j) * 3, 3 + hash(j, i) * 4, '#d98aa7');
    STAGE.clouds.push({ img: cc, x: hash(i, 62) * W, y: 30 + hash(i, 63) * 100, sp: 0.06 + hash(i, 64) * 0.12 });
  }
};

STAGE.drawBG = function (ctx, frame) {
  ctx.drawImage(STAGE.bg, 0, 0);
  // twinkle
  for (let i = 0; i < 14; i++) {
    if (((frame >> 3) + i * 7) % 11 < 2) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.floor(hash(i, 71) * W), Math.floor(hash(i, 72) * 110), 1, 1);
    }
  }
  ctx.globalAlpha = 0.75;
  for (const cl of STAGE.clouds) {
    const x = ((cl.x + frame * cl.sp) % (W + 100)) - 90;
    ctx.drawImage(cl.img, Math.round(x), Math.round(cl.y));
  }
  ctx.globalAlpha = 1;
};

STAGE.drawFG = function (ctx) { ctx.drawImage(STAGE.fg, 0, 0); };

// Highest surface top at/below y0 under x (solids + platforms)
STAGE.groundBelow = function (x, y0, maxD = 9999) {
  let best = null;
  for (const s of STAGE.solids.concat(STAGE.plats)) {
    if (x >= s.x && x <= s.x + s.w && s.y >= y0 - 1 && s.y - y0 <= maxD) {
      if (best === null || s.y < best) best = s.y;
    }
  }
  return best;
};
