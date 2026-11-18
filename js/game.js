'use strict';
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
addEventListener('resize', resize);
resize();

function panel(x, y, w, h, border, fill = '#0d0820', alpha = 0.82) {
  ctx.globalAlpha = alpha; ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
}

function drawBig(def, x, y, s, t, facing = 1, pose = null) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  drawModel(ctx, def, 0, 0, facing, pose || idlePose(t));
  ctx.restore();
}

function dmgColor(d) {
  if (d < 40) return '#ffffff';
  if (d < 80) return '#ffe45c';
  if (d < 120) return '#ff9b2f';
  if (d < 170) return '#ff5a3a';
  return '#d81f3a';
}

// =====================================================================
// FIGHT
// =====================================================================
class Fight {
  constructor(defs, mode) {
    this.mode = mode; this.defs = defs;
    this.fx = new FX(); this.entities = [];
    this.frame = 0; this.hitstop = 0; this.shake = 0; this.flash = 0; this.darken = 0; this.darkenCur = 0;
    this.countdown = 200; this.locked = true; this.banner = null; this.over = false; this.overT = 0; this.paused = false;
    const pads = mode === 'cpu' ? [new KeyPad(BINDS_ALL), new AIPad()]
      : mode === 'demo' ? [new AIPad(), new AIPad()] : [new KeyPad(BINDS[0]), new KeyPad(BINDS[1])];
    const labels = mode === 'cpu' ? ['P1', 'CPU'] : mode === 'demo' ? ['CPU', 'CPU'] : ['P1', 'P2'];
    this.fighters = defs.map((d, i) => new Fighter(d, i, pads[i], this, labels[i]));
    this.solidsList = STAGE.solids;
  }

  // ---- helpers used by fighters / abilities ----
  add(e) { this.entities.push(e); return e; }
  addShake(n) { this.shake = Math.max(this.shake, n); }
  opponents(f) { return this.fighters.filter((o) => o !== f && !o.dead); }
  nearestFoe(f) {
    let best = null, bd = Infinity;
    for (const o of this.opponents(f)) { const d = Math.hypot(o.x - f.x, o.y - f.y); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  rectBlocked(r) { return this.solidsList.some((s) => overlap(r, s)) || r.y < STAGE.blast.t + 20; }

  hitbox(owner, rect, spec, hitId, srcX, srcY) {
    let n = 0;
    for (const o of this.fighters) {
      if (o === owner || o.dead || o.invuln > 0 || o.hitIds.has(hitId)) continue;
      if (!overlap(rect, o.rect)) continue;
      o.hitIds.add(hitId);
      if (o.hitIds.size > 80) o.hitIds = new Set([...o.hitIds].slice(-40));
      if (this.hit(owner, o, spec, srcX ?? rect.x + rect.w / 2, srcY ?? rect.y + rect.h / 2)) n++;
    }
    return n;
  }

  hitRadius(owner, x, y, r, spec, hitId) {
    for (const o of this.fighters) {
      if (o === owner || o.dead || o.invuln > 0 || o.hitIds.has(hitId)) continue;
      const R = o.rect;
      const dx = clamp(x, R.x, R.x + R.w) - x, dy = clamp(y, R.y, R.y + R.h) - y;
      if (dx * dx + dy * dy > r * r) continue;
      o.hitIds.add(hitId);
      this.hit(owner, o, spec, x, y);
    }
  }

  hit(att, vic, spec, srcX, srcY) {
    if (vic.dead || vic.invuln > 0) return false;
    let dmg = spec.dmg;
    if (att && spec.melee && att.empower > 0) { dmg *= 1.5; att.empower = 0; }
    dmg = Math.round(dmg);
    vic.damage = Math.min(999, vic.damage + dmg);
    if (vic.frozen > 0 && !spec.freeze) {
      vic.frozen = 0; vic.freezeBy = null;
      this.fx.burst(vic.x, vic.cy, 14, ['#ffffff', '#9ad8ff'], 2.4, { grav: 0.15 });
    }
    let mag = 0;
    if (vic.armor > 0) {
      // super armor: takes damage, no flinch
    } else if (spec.kb > 0 || spec.scale > 0) {
      mag = (spec.kb + vic.damage * spec.scale * 0.07) / vic.st.weight;
      let dir = spec.dirX ?? (vic.x >= srcX ? 1 : -1);
      let ang = (spec.angle ?? 45) * Math.PI / 180;
      if (spec.radial) {
        const ax = vic.x - srcX, ay = vic.cy - srcY;
        dir = Math.abs(ax) < 1 ? (att ? att.facing : 1) : Math.sign(ax);
        ang = clamp(Math.atan2(-ay, Math.abs(ax)), 0.44, 1.3);
      }
      if (vic.grounded && ang < 0) ang = -ang * 0.5; // spikes pop grounded foes up
      vic.vx = Math.cos(ang) * mag * dir;
      vic.vy = -Math.sin(ang) * mag;
      if (vic.grounded && vic.vy > -1.2 && vic.vy <= 0) vic.vy = -1.2;
      vic.grounded = false;
      vic.hitstun = Math.floor(mag * 3.2 + 4);
      vic.action = null;
      vic.launched = mag > 6.5;
    } else if (spec.flinch) {
      vic.hitstun = Math.max(vic.hitstun, spec.flinch);
      vic.action = null;
    }
    if (vic.armor <= 0) {
      if (spec.stun) { vic.stun = Math.max(vic.stun, spec.stun); vic.action = null; }
      if (spec.freeze) { vic.frozen = spec.freeze; vic.vx = 0; vic.vy = 0; vic.action = null; vic.freezeBy = att; vic.hitstun = 0; }
    }
    if (spec.burn) { vic.burn = Math.max(vic.burn, spec.burn); vic.burnT = 30; }
    if (spec.slow) vic.slow = Math.max(vic.slow, spec.slow);
    vic.flash = 8; vic.hudShake = 10;
    vic.lastHitBy = att; vic.lastHitFrame = this.frame;
    if (att) { att.meter = Math.min(100, att.meter + dmg * 1.1); att.dealt += dmg; }
    vic.meter = Math.min(100, vic.meter + dmg * 0.45);
    if (!spec.quiet) {
      this.hitstop = Math.max(this.hitstop, Math.round(clamp(2 + dmg * 0.3 + mag * 0.4, 2, 14)));
      this.addShake(Math.min(10, mag * 0.7 + 1));
      const hx = lerp(vic.x, srcX, 0.3), hy = lerp(vic.cy, srcY, 0.3);
      const cols = att ? ['#ffffff', att.pal.fx2, att.pal.fx1] : ['#ffffff'];
      this.fx.burst(hx, hy, 6 + Math.round(mag * 2), cols, 1.5 + mag * 0.35, { life: [8, 20], size: 2, shrink: true, drag: 0.88 });
      SFX.hit(mag);
    }
    this.fx.text(vic.x + rand(-4, 4), vic.y - vic.h - 6, dmg, dmgColor(vic.damage));
    if (spec.onHit) spec.onHit(vic, att, this);
    return true;
  }

  startUlt(f) {
    this.banner = { text: f.def.ult.name, f, t: 56 };
    this.hitstop = Math.max(this.hitstop, 18);
    f.armor = 46;
    this.flash = 3;
    SFX.ult();
  }

  onKO(f) {
    const ex = clamp(f.x, 6, W - 6), ey = clamp(f.y - f.h / 2, 6, H - 6);
    const ang = Math.atan2(H / 2 - ey, W / 2 - ex);
    for (let i = 0; i < 46; i++) {
      const a = ang + rand(-0.55, 0.55), s = rand(2, 8);
      this.fx.add(ex, ey, Math.cos(a) * s, Math.sin(a) * s, randi(20, 42), pick([PCOL[f.idx], '#ffffff', f.pal.c, f.pal.ui]), { size: randi(1, 3), drag: 0.94, shrink: true });
    }
    this.fx.beams.push({ x: ex, y: ey, ang, col: PCOL[f.idx], t: 0 });
    this.addShake(12); this.flash = 4;
    SFX.ko();
    f.falls++;
    const k = f.lastHitBy;
    if (k && k !== f && this.frame - (f.lastHitFrame || 0) < 360) k.kos++;
    if (!this.over && this.fighters.filter((o) => o.stocks > 0).length <= 1) {
      this.over = true;
      this.winner = this.fighters.find((o) => o.stocks > 0) || null;
      this.banner = { text: 'GAME!', t: 120, game: true };
      setTimeout(() => SFX.game(), 300);
    }
  }

  update() {
    if (Keys.pressed.has('Escape') && !this.over) { this.paused = !this.paused; SFX.select(); }
    if (this.paused) {
      if (Keys.pressed.has('KeyQ')) return { go: 'title' };
      if (Keys.pressed.has('KeyR')) return { go: 'fight', defs: this.defs, mode: this.mode };
      return;
    }
    if (this.banner && --this.banner.t <= 0) this.banner = null;
    if (this.countdown > 0) {
      const before = Math.ceil((this.countdown - 50) / 50);
      this.countdown--;
      const after = Math.ceil((this.countdown - 50) / 50);
      if (this.countdown === 199 || (after !== before && after > 0)) SFX.count();
      if (this.countdown === 50) SFX.go();
    }
    this.locked = this.countdown > 50 || this.over;

    if (this.hitstop > 0) {
      this.hitstop--;
      for (const f of this.fighters) f.pad.tick(false);
      if (this.shake > 0) this.shake *= 0.9;
      return;
    }
    if (this.over) {
      this.overT++;
      if (this.overT > 190) return { go: 'results', fight: this };
      if (this.overT < 70 && this.overT % 3 !== 0) { for (const f of this.fighters) f.pad.tick(false); return; } // slow-mo
    }
    this.frame++;
    this.solidsList = STAGE.solids.concat(
      this.entities.filter((e) => e.solid && !e.dead).map((e) => Object.assign(e.rect, { owner: e.owner })));
    this.darken = 0;
    for (const f of this.fighters) { if (f.pad.think) f.pad.think(f, this); f.pad.tick(true); }
    for (const f of this.fighters) f.update();
    // gentle push-apart so fighters don't stack
    const [a, b] = this.fighters;
    if (!a.dead && !b.dead && a.grounded && b.grounded && overlap(a.rect, b.rect)) {
      const d = a.x < b.x ? -1 : 1;
      a.x += d * 0.6; b.x -= d * 0.6;
    }
    for (const e of this.entities) if (!e.dead) e.update(this);
    this.entities = this.entities.filter((e) => !e.dead);
    this.fx.update();
    if (!this.locked) for (const f of this.fighters) if (!f.dead) f.meter = Math.min(100, f.meter + 0.025);
    this.shake = this.shake > 0.3 ? this.shake * 0.86 : 0;
    if (this.flash > 0) this.flash--;
    this.darkenCur = lerp(this.darkenCur, this.darken, 0.12);
  }

  draw() {
    STAGE.drawBG(ctx, this.frame);
    ctx.save();
    if (this.shake > 0.5) ctx.translate(Math.round(rand(-this.shake, this.shake)), Math.round(rand(-this.shake, this.shake)));
    STAGE.drawFG(ctx);
    if (this.darkenCur > 0.02) { ctx.globalAlpha = this.darkenCur; ctx.fillStyle = '#05020c'; ctx.fillRect(-20, -20, W + 40, H + 40); ctx.globalAlpha = 1; }
    for (const e of this.entities) if (e.layer === 0) e.draw(ctx, this);
    for (const f of this.fighters) f.draw(ctx);
    for (const e of this.entities) if (e.layer !== 0) e.draw(ctx, this);
    this.fx.draw(ctx);
    ctx.restore();

    // off-screen bubbles
    for (const f of this.fighters) {
      if (f.dead || (f.x > 0 && f.x < W && f.y - f.h > 0)) continue;
      const bx = clamp(f.x, 9, W - 9), by = clamp(f.cy, 9, H - 9);
      pcircle(ctx, bx, by, 8, PCOL[f.idx]);
      pcircle(ctx, bx, by, 7, '#0d0820');
      drawText(ctx, f.label === 'CPU' ? 'CP' : f.label, bx + 1, by - 2, PCOL[f.idx], { align: 'center' });
    }

    this.drawHUD();

    if (this.countdown > 0) {
      if (this.countdown > 50) {
        const n = Math.ceil((this.countdown - 50) / 50);
        const s = 8 + Math.max(0, ((this.countdown - 50) % 50) - 40);
        drawText(ctx, n, W / 2, 90, '#ffe45c', { s, align: 'center', outline: '#12081f', shadow: '#ff6f5e' });
      } else if (this.countdown > 10 || this.countdown % 2) {
        drawText(ctx, 'FIGHT!', W / 2, 96, '#ffffff', { s: 6, align: 'center', outline: '#12081f', shadow: '#ff6f5e' });
      }
    }
    if (this.banner) this.drawBanner();
    if (this.flash > 0) { ctx.globalAlpha = this.flash * 0.08; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (this.paused) this.drawPause();
  }

  drawBanner() {
    const b = this.banner;
    if (b.game) {
      drawText(ctx, 'GAME!', W / 2, 92, '#ffffff', { s: 8, align: 'center', outline: '#12081f', shadow: '#ff6f5e' });
      return;
    }
    const f = b.f, age = 56 - b.t;
    const slide = Math.max(0, 12 - age) * 30;
    const y = 104, hgt = 46;
    ctx.globalAlpha = 0.88; ctx.fillStyle = '#0d0820'; ctx.fillRect(0, y, W, hgt); ctx.globalAlpha = 1;
    ctx.fillStyle = f.pal.ui; ctx.fillRect(0, y, W, 2); ctx.fillRect(0, y + hgt - 2, W, 2);
    for (let i = 0; i < 12; i++) { ctx.fillStyle = f.pal.fx2; ctx.fillRect(((i * 53 + age * 9) % (W + 40)) - 20, y + 6 + (i % 5) * 8, 14, 1); }
    drawBig(f.def, 70 - slide, y + hgt - 4, 2, age, 1, { t: age, state: 'idle', air: false, arm: 'up' });
    drawText(ctx, f.def.name + ' ULTIMATE', 120 + slide, y + 9, f.pal.ui, { s: 1 });
    drawText(ctx, b.text, 120 + slide, y + 19, '#ffffff', { s: 4, outline: '#12081f', shadow: f.pal.fx2 });
  }

  drawHUD() {
    for (const f of this.fighters) {
      const x0 = f.idx === 0 ? 6 : W - 6 - 152, y0 = 233;
      const sh = f.hudShake > 0 ? randi(-1, 1) : 0;
      panel(x0, y0, 152, 34, f.pal.ui);
      ctx.fillStyle = PCOL[f.idx]; ctx.fillRect(x0 + 1, y0 + 1, 3, 32);
      // portrait
      ctx.save(); ctx.beginPath(); ctx.rect(x0 + 5, y0 + 2, 22, 30); ctx.clip();
      drawModel(ctx, f.def, x0 + 16, y0 + 29, 1, idlePose(0), f.dead ? { tint: '#3a2c50', outline: '#1a1028' } : {});
      ctx.restore();
      drawText(ctx, f.def.name, x0 + 30, y0 + 4, f.pal.ui);
      drawText(ctx, f.label, x0 + 30 + textW(f.def.name) + 4, y0 + 4, PCOL[f.idx]);
      const dtxt = f.dead && f.stocks <= 0 ? 'OUT' : Math.floor(f.damage) + '%';
      drawText(ctx, dtxt, x0 + 30 + sh, y0 + 13 + sh, dmgColor(f.damage), { s: 3, shadow: '#000000' });
      // stocks
      for (let i = 0; i < 3; i++) {
        const sx = x0 + 145 - i * 7, sy = y0 + 4;
        ctx.fillStyle = '#12081f'; ctx.fillRect(sx - 1, sy - 1, 6, 6);
        ctx.fillStyle = i < f.stocks ? f.pal.ui : '#3a2c50'; ctx.fillRect(sx, sy, 4, 4);
      }
      // skill cooldowns + ult meter
      const keys = this.mode === 'pvp' ? KEYNAMES[f.idx] : this.mode === 'cpu' && f.idx === 0 ? KEYNAMES[0] : null;
      for (let i = 0; i < 2; i++) {
        const bx = x0 + 96 + i * 18, by = y0 + 12;
        const sk = f.def.skills[i], cd = f.cds[i];
        ctx.fillStyle = '#12081f'; ctx.fillRect(bx, by, 16, 11);
        ctx.fillStyle = cd > 0 ? '#2a2040' : f.pal.ui; ctx.fillRect(bx + 1, by + 1, 14, 9);
        if (cd > 0) { const hh = Math.ceil((9 * cd) / sk.cd); ctx.fillStyle = '#4a3c66'; ctx.fillRect(bx + 1, by + 10 - hh, 14, hh); }
        drawText(ctx, keys ? keys['skill' + (i + 1)] : i + 1, bx + 8, by + 3, cd > 0 ? '#8a7ca8' : '#12081f', { align: 'center' });
      }
      const ready = f.meter >= 100;
      const mx = x0 + 96, my = y0 + 26;
      ctx.fillStyle = '#12081f'; ctx.fillRect(mx - 1, my - 1, 52, 5);
      ctx.fillStyle = '#2a2040'; ctx.fillRect(mx, my, 50, 3);
      ctx.fillStyle = ready ? ((this.frame >> 2) % 2 ? '#ffffff' : f.pal.ui) : f.pal.fx2;
      ctx.fillRect(mx, my, Math.round(50 * f.meter / 100), 3);
      const ul = ready ? 'ULT ' + (keys ? keys.ult : '') : 'ULT';
      drawText(ctx, ul, x0 + 96 + 52 - textW(ul), my - 7 - 1, ready ? '#ffffff' : '#8a7ca8');
    }
  }

  drawPause() {
    ctx.globalAlpha = 0.78; ctx.fillStyle = '#05020c'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    drawText(ctx, 'PAUSED', W / 2, 40, '#ffffff', { s: 5, align: 'center', shadow: '#ff6f5e' });
    drawControls(W / 2, 92);
    drawText(ctx, 'ESC RESUME     R RESTART     Q QUIT TO MENU', W / 2, 232, '#ffe45c', { align: 'center' });
  }
}

function drawControls(cx, y) {
  const rows = [
    ['', 'PLAYER 1', 'PLAYER 2'],
    ['MOVE / JUMP', 'A D / W', '← → / ↑'],
    ['FAST FALL / DROP', 'S', '↓'],
    ['ATTACK', 'F', 'K'],
    ['SKILL 1', 'G', 'L'],
    ['SKILL 2', 'H', ';'],
    ['ULTIMATE', 'T', 'O'],
  ];
  rows.forEach((r, i) => {
    const col = i === 0 ? '#ffe45c' : '#ffffff';
    drawText(ctx, r[0], cx - 40, y + i * 11, '#b8a8d8', { align: 'right' });
    drawText(ctx, r[1], cx + 10, y + i * 11, i === 0 ? PCOL[0] : col, { align: 'center' });
    drawText(ctx, r[2], cx + 80, y + i * 11, i === 0 ? PCOL[1] : col, { align: 'center' });
  });
  drawText(ctx, 'HOLD UP / DOWN + ATTACK FOR UP AND DOWN ATTACKS', cx, y + rows.length * 11 + 4, '#b8a8d8', { align: 'center' });
  drawText(ctx, 'SKILLS AIM WITH YOUR MOVEMENT KEYS', cx, y + rows.length * 11 + 13, '#b8a8d8', { align: 'center' });
}

// =====================================================================
// TITLE
// =====================================================================
class Title {
  constructor() { this.sel = 0; this.t = 0; this.help = false; }
  update() {
    this.t++;
    if (this.help) { if (Keys.pressed.size) this.help = false; return; }
    if (mp(0, 'up') || mp(1, 'up') || mp(0, 'down') || mp(1, 'down')) { this.sel = (this.sel + 1) % 2; SFX.select(); }
    if (Keys.pressed.has('KeyC')) { this.help = true; SFX.select(); return; }
    if (anyConfirm()) { SFX.confirm(); return { go: 'select', mode: this.sel === 0 ? 'pvp' : 'cpu' }; }
  }
  draw() {
    STAGE.drawBG(ctx, this.t);
    STAGE.drawFG(ctx);
    CHARS.forEach((d, i) => drawModel(ctx, d, 152 + i * 44, 196, i < 2 ? 1 : i === 2 ? (this.t >> 6) % 2 ? 1 : -1 : -1, idlePose(this.t + i * 7)));
    if (this.help) {
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#05020c'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      drawText(ctx, 'CONTROLS', W / 2, 30, '#ffffff', { s: 4, align: 'center', shadow: '#ff6f5e' });
      drawControls(W / 2, 70);
      drawText(ctx, 'KNOCK FOES OFF THE STAGE. HIGHER % = FLIES FARTHER. 3 STOCKS EACH.', W / 2, 186, '#ffe45c', { align: 'center' });
      drawText(ctx, 'ULT METER FILLS AS YOU DEAL AND TAKE DAMAGE.', W / 2, 196, '#ffe45c', { align: 'center' });
      drawText(ctx, 'PRESS ANY KEY', W / 2, 240, (this.t >> 4) % 2 ? '#ffffff' : '#8a7ca8', { align: 'center' });
      return;
    }
    const bob = Math.round(Math.sin(this.t * 0.05) * 2);
    ctx.save();
    drawText(ctx, 'RIFT BRAWL', W / 2, 34 + bob, '#ffd36b', { s: 7, align: 'center', outline: '#12081f', shadow: '#b04574' });
    ctx.beginPath(); ctx.rect(0, 34 + bob + 18, W, 20); ctx.clip();
    drawText(ctx, 'RIFT BRAWL', W / 2, 34 + bob, '#ff7a59', { s: 7, align: 'center' });
    ctx.restore();
    drawText(ctx, 'A 2-PLAYER ABILITY PLATFORM FIGHTER', W / 2, 78, '#ffffff', { align: 'center', outline: '#12081f' });
    const opts = ['VS PLAYER', 'VS CPU'];
    opts.forEach((o, i) => {
      const y = 104 + i * 16, on = i === this.sel;
      if (on) { ctx.globalAlpha = 0.7; ctx.fillStyle = '#0d0820'; ctx.fillRect(W / 2 - 52, y - 4, 104, 14); ctx.globalAlpha = 1; }
      drawText(ctx, (on ? '> ' : '  ') + o + (on ? ' <' : '  '), W / 2, y, on ? '#ffe45c' : '#d8c8f5', { s: 2 - (on ? 0 : 0), align: 'center', outline: '#12081f' });
    });
    drawText(ctx, 'W/S OR ↑/↓ TO CHOOSE    F / K / ENTER TO START    C CONTROLS', W / 2, 252, (this.t >> 5) % 2 ? '#ffffff' : '#d8c8f5', { align: 'center', outline: '#12081f' });
  }
}

// =====================================================================
// CHARACTER SELECT
// =====================================================================
class Select {
  constructor(mode, prev) {
    this.mode = mode; this.t = 0; this.startT = 0;
    this.cur = prev ? prev.map((d) => CHARS.indexOf(d)) : [0, 4];
    this.locked = [false, false];
  }
  label(i) { return this.mode === 'cpu' && i === 1 ? 'CPU' : 'P' + (i + 1); }
  handle(keyset, ci) {
    if (!this.locked[ci]) {
      if (mp(keyset, 'left')) { this.cur[ci] = (this.cur[ci] + 4) % 5; SFX.select(); }
      if (mp(keyset, 'right')) { this.cur[ci] = (this.cur[ci] + 1) % 5; SFX.select(); }
      if (mp(keyset, 'attack') || (keyset === 0 && Keys.pressed.has('Enter'))) { this.locked[ci] = true; SFX.confirm(); return; }
    }
    if (mp(keyset, 'skill1')) {
      if (this.locked[ci]) { this.locked[ci] = false; this.startT = 0; SFX.select(); }
      else if (this.mode === 'cpu' && ci === 1) { this.locked[0] = false; SFX.select(); }
    }
  }
  update() {
    this.t++;
    if (Keys.pressed.has('Escape')) return { go: 'title' };
    if (this.mode === 'pvp') { this.handle(0, 0); this.handle(1, 1); }
    else {
      const ci = this.locked[0] ? 1 : 0;
      this.handle(0, ci);
      if (!Keys.pressed.has('Enter')) this.handle(1, ci);
    }
    if (this.locked[0] && this.locked[1]) {
      if (++this.startT > 50) return { go: 'fight', defs: [CHARS[this.cur[0]], CHARS[this.cur[1]]], mode: this.mode };
    } else this.startT = 0;
  }
  draw() {
    STAGE.drawBG(ctx, this.t);
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#05020c'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    drawText(ctx, 'CHOOSE YOUR FIGHTER', W / 2, 8, '#ffffff', { s: 2, align: 'center', outline: '#12081f', shadow: '#b04574' });
    // cards
    CHARS.forEach((d, i) => {
      const x = 52 + i * 78, y = 26, w = 70, h = 66;
      const hl0 = this.cur[0] === i, hl1 = this.cur[1] === i;
      panel(x, y, w, h, hl0 || hl1 ? '#ffffff' : d.pal.ui, '#140c2a', 0.9);
      ctx.globalAlpha = 0.25; ctx.fillStyle = d.pal.ui; ctx.fillRect(x + 1, y + 40, w - 2, 12); ctx.globalAlpha = 1;
      const anim = hl0 || hl1 ? this.t : 0;
      drawBig(d, x + w / 2, y + 52, 2, anim, 1, null);
      drawText(ctx, d.name, x + w / 2, y + 56, d.pal.ui, { align: 'center' });
      for (const [p, on] of [[0, hl0], [1, hl1]]) {
        if (!on) continue;
        const c = PCOL[p], o = p * 3, pulse = this.locked[p] ? 0 : (this.t >> 3) % 2;
        ctx.fillStyle = c;
        ctx.fillRect(x - 2 - o - pulse, y - 2 - o - pulse, w + 4 + 2 * o + 2 * pulse, 2);
        ctx.fillRect(x - 2 - o - pulse, y + h + o + pulse, w + 4 + 2 * o + 2 * pulse, 2);
        ctx.fillRect(x - 2 - o - pulse, y - 2 - o - pulse, 2, h + 4 + 2 * o + 2 * pulse);
        ctx.fillRect(x + w + o + pulse, y - 2 - o - pulse, 2, h + 4 + 2 * o + 2 * pulse);
        const tag = this.label(p);
        const tx = p === 0 ? x + 3 : x + w - 3 - textW(tag);
        ctx.fillStyle = c; ctx.fillRect(tx - 2, y + 2, textW(tag) + 4, 8);
        drawText(ctx, tag, tx, y + 4, '#12081f');
      }
    });
    // info panels
    for (let p = 0; p < 2; p++) {
      const d = CHARS[this.cur[p]];
      const x = p === 0 ? 8 : W / 2 + 4, y = 102, w = W / 2 - 12, h = 160;
      panel(x, y, w, h, PCOL[p], '#0d0820', 0.9);
      drawText(ctx, this.label(p), x + 6, y + 6, PCOL[p], { s: 2 });
      drawText(ctx, d.name, x + 6 + textW(this.label(p), 2) + 8, y + 6, d.pal.ui, { s: 2 });
      drawText(ctx, d.title, x + 6, y + 20, '#b8a8d8');
      const bars = [['SPEED', d.bars.spd], ['POWER', d.bars.pwr], ['WEIGHT', d.bars.wgt]];
      bars.forEach(([n, v], i) => {
        drawText(ctx, n, x + 6, y + 30 + i * 8, '#8a7ca8');
        for (let k = 0; k < 5; k++) { ctx.fillStyle = k < v ? d.pal.ui : '#2a2040'; ctx.fillRect(x + 36 + k * 9, y + 30 + i * 8, 7, 5); }
      });
      drawBig(d, x + w - 34, y + 70, 3, this.t + p * 30, p === 0 ? 1 : -1);
      const keys = this.mode === 'cpu' ? (p === 0 ? KEYNAMES[0] : null) : KEYNAMES[p];
      const moves = [
        [keys ? keys.attack : 'ATK', d.attackName, 'COMBO WITH UP / DOWN'],
        [keys ? keys.skill1 : 'S1', d.skills[0].name, d.skills[0].desc],
        [keys ? keys.skill2 : 'S2', d.skills[1].name, d.skills[1].desc],
        [keys ? keys.ult : 'ULT', d.ult.name + ' (ULT)', d.ult.desc],
      ];
      moves.forEach(([k, n, desc], i) => {
        const yy = y + 80 + i * 17;
        const kw = Math.max(9, textW(k) + 4);
        ctx.fillStyle = i === 3 ? d.pal.ui : '#d8c8f5'; ctx.fillRect(x + 6, yy - 2, kw, 9);
        drawText(ctx, k, x + 6 + kw / 2, yy, '#12081f', { align: 'center' });
        drawText(ctx, n, x + 10 + kw, yy, i === 3 ? d.pal.ui : '#ffffff');
        drawText(ctx, desc, x + 10 + kw, yy + 7, '#8a7ca8');
      });
      if (this.locked[p]) {
        const rx = x + w - 52, ry = y + 6;
        ctx.fillStyle = PCOL[p]; ctx.fillRect(rx, ry - 2, 46, 11);
        drawText(ctx, 'READY!', rx + 23, ry, '#12081f', { align: 'center', s: 1 });
      }
    }
    let hint;
    if (this.mode === 'pvp') hint = 'P1: A/D + F TO PICK, G BACK      P2: ←/→ + K TO PICK, L BACK      ESC MENU';
    else hint = this.locked[0] ? 'NOW PICK THE CPU FIGHTER  (G = BACK)' : 'A/D + F TO PICK YOUR FIGHTER      ESC MENU';
    if (this.locked[0] && this.locked[1]) hint = 'GET READY...';
    drawText(ctx, hint, W / 2, 264, (this.t >> 5) % 2 ? '#ffffff' : '#d8c8f5', { align: 'center' });
  }
}

// =====================================================================
// RESULTS
// =====================================================================
class Results {
  constructor(fight) { this.f = fight; this.t = 0; }
  update() {
    this.t++;
    if (this.t < 30) return;
    const m = this.f.mode;
    if (mp(0, 'attack') || mp(1, 'attack') || Keys.pressed.has('Enter')) { SFX.confirm(); return { go: 'fight', defs: this.f.defs, mode: m }; }
    if (mp(0, 'skill1') || mp(1, 'skill1')) { SFX.select(); return { go: 'select', mode: m === 'demo' ? 'cpu' : m, prev: this.f.defs }; }
    if (Keys.pressed.has('Escape')) return { go: 'title' };
  }
  draw() {
    STAGE.drawBG(ctx, this.t);
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#05020c'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const win = this.f.winner;
    if (win) {
      drawText(ctx, win.label + ' WINS!', W / 2, 12, PCOL[win.idx], { s: 4, align: 'center', outline: '#12081f' });
      drawText(ctx, win.def.name, W / 2, 36, win.pal.ui, { s: 2, align: 'center' });
      for (let i = 0; i < 10; i++) {
        const a = this.t * 0.02 + (i * TAU) / 10;
        pline(ctx, W / 2, 128, W / 2 + Math.cos(a) * 80, 128 + Math.sin(a) * 80, i % 2 ? '#2a1a44' : '#1f1236', 6);
      }
      drawBig(win.def, W / 2, 156, 5, this.t, 1, { t: this.t, state: 'idle', air: false, arm: (this.t >> 5) % 2 ? 'up' : 'idle' });
    } else drawText(ctx, 'DRAW!', W / 2, 20, '#ffffff', { s: 4, align: 'center' });
    this.f.fighters.forEach((f, i) => {
      const x = i === 0 ? 20 : W - 150, y = 170;
      panel(x, y, 130, 62, PCOL[i]);
      drawText(ctx, f.label + '  ' + f.def.name, x + 6, y + 6, PCOL[i]);
      drawText(ctx, 'KOS', x + 6, y + 20, '#b8a8d8'); drawText(ctx, f.kos, x + 124, y + 20, '#ffffff', { align: 'right' });
      drawText(ctx, 'FALLS', x + 6, y + 30, '#b8a8d8'); drawText(ctx, f.falls, x + 124, y + 30, '#ffffff', { align: 'right' });
      drawText(ctx, 'DAMAGE DEALT', x + 6, y + 40, '#b8a8d8'); drawText(ctx, f.dealt + '%', x + 124, y + 40, '#ffffff', { align: 'right' });
      drawText(ctx, 'STOCKS LEFT', x + 6, y + 50, '#b8a8d8'); drawText(ctx, Math.max(0, f.stocks), x + 124, y + 50, '#ffffff', { align: 'right' });
    });
    if (this.t > 30) drawText(ctx, 'F / K  REMATCH      G / L  CHARACTER SELECT      ESC  MENU', W / 2, 250, (this.t >> 5) % 2 ? '#ffffff' : '#ffe45c', { align: 'center' });
  }
}

// =====================================================================
// MAIN LOOP
// =====================================================================
STAGE.build();
const params = new URLSearchParams(location.search);
let scene = new Title();
if (params.has('demo')) {
  const pick2 = (params.get('demo') || '').split(',').map((n) => CHARS.find((c) => c.id === n)).filter(Boolean);
  scene = new Fight(pick2.length === 2 ? pick2 : [CHARS[randi(0, 4)], CHARS[randi(0, 4)]], 'demo');
} else if (params.has('select')) scene = new Select('pvp');

function go(r) {
  if (!r) return;
  if (r.go === 'title') scene = new Title();
  else if (r.go === 'select') scene = new Select(r.mode, r.prev);
  else if (r.go === 'fight') scene = new Fight(r.defs, r.mode);
  else if (r.go === 'results') scene = new Results(r.fight);
}

function step() {
  if (Keys.pressed.has('KeyM')) SFX.muted = !SFX.muted;
  go(scene.update());
  Keys.pressed.clear();
}

let last = performance.now(), acc = 0;
const DT = 1000 / 60;
function frame(now) {
  acc += Math.min(100, now - last);
  last = now;
  let n = 0;
  while (acc >= DT && n < 5) { step(); acc -= DT; n++; }
  scene.draw();
  requestAnimationFrame(frame);
}
// Headless test hook: advance N frames synchronously.
window.__advance = (n) => { for (let i = 0; i < n; i++) step(); scene.draw(); };
window.__scene = () => scene;
window.addEventListener('error', (e) => {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 20);
  drawText(ctx, 'ERROR: ' + e.message, 4, 4, '#ff5a5a');
});
if (params.has('ff')) window.__advance(+params.get('ff'));   // dev: fast-forward N frames
requestAnimationFrame(frame);
