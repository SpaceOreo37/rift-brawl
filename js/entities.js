'use strict';
// ---------------- Particles + floating text ----------------
class FX {
  constructor() { this.p = []; this.texts = []; this.beams = []; }
  add(x, y, vx, vy, life, color, o = {}) {
    if (this.p.length > 1800) return;
    this.p.push({ x, y, vx, vy, life, max: life, color, size: o.size || 1, grav: o.grav || 0, drag: o.drag ?? 0.96, shrink: !!o.shrink });
  }
  burst(x, y, n, colors, speed = 2, o = {}) {
    const lf = o.life || [12, 28];
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(speed * 0.25, speed);
      this.add(x, y, Math.cos(a) * s, Math.sin(a) * s, randi(lf[0], lf[1]), pick(colors), o);
    }
  }
  text(x, y, str, color, s = 1) { this.texts.push({ x, y, str: String(str), color, life: 40, s }); }
  update() {
    for (const p of this.p) {
      p.vx *= p.drag; p.vy *= p.drag; p.vy += p.grav;
      p.x += p.vx; p.y += p.vy; p.life--;
    }
    this.p = this.p.filter((p) => p.life > 0);
    for (const t of this.texts) { t.y -= 0.45; t.life--; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const b of this.beams) b.t++;
    this.beams = this.beams.filter((b) => b.t < 22);
  }
  draw(ctx) {
    for (const p of this.p) {
      const s = p.shrink ? Math.max(1, Math.round(p.size * (p.life / p.max) + 0.4)) : p.size;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    for (const b of this.beams) {
      const len = 30 + b.t * 9, w = Math.max(1, 10 - Math.floor(b.t / 2));
      const ex = b.x + Math.cos(b.ang) * len, ey = b.y + Math.sin(b.ang) * len;
      pline(ctx, b.x, b.y, ex, ey, b.col, w);
      pline(ctx, b.x, b.y, ex, ey, '#ffffff', Math.max(1, w - 4));
    }
    for (const t of this.texts) {
      if (t.life < 10 && t.life % 2) continue;
      drawText(ctx, t.str, t.x, t.y, t.color, { s: t.s, align: 'center', outline: '#12081f' });
    }
  }
}

// ---------------- Entities ----------------
class Ent {
  constructor(o) { this.dead = false; this.t = 0; this.layer = 1; Object.assign(this, o); }
  update(g) {}
  draw(ctx, g) {}
}

// Generic projectile. Options: x,y,vx,vy,grav,w,h,life,owner,spec,render,onTick,onKill,pierce,landable
class Proj extends Ent {
  constructor(o) {
    super(Object.assign({ vx: 0, vy: 0, grav: 0, w: 6, h: 6, life: 60, pierce: false, landable: false }, o));
    this.hitId = newHitId();
  }
  get rect() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  update(g) {
    this.t++;
    this.vy += this.grav;
    const py = this.y;
    this.x += this.vx; this.y += this.vy;
    if (--this.life <= 0) return this.kill(g, 'expire');
    if (this.onTick) this.onTick(this, g);
    const r = this.rect;
    if (this.spec && g.hitbox(this.owner, r, this.spec, this.hitId, this.x - Math.sign(this.vx || 1) * 8, this.y) && !this.pierce)
      return this.kill(g, 'hit');
    for (const s of g.solidsList) {
      if (s.owner === this.owner) continue;
      if (overlap(r, s)) return this.kill(g, 'wall', s, py);
    }
    if (this.landable && this.vy > 0) {
      for (const p of STAGE.plats) {
        if (py + this.h / 2 <= p.y && this.y + this.h / 2 >= p.y && this.x > p.x && this.x < p.x + p.w) {
          this.y = p.y - this.h / 2;
          return this.kill(g, 'land', p, py);
        }
      }
    }
    if (this.x < -120 || this.x > W + 120 || this.y > H + 80 || this.y < -200) this.dead = true;
  }
  kill(g, why, s, py) { this.dead = true; if (this.onKill) this.onKill(this, g, why, s, py); }
  draw(ctx, g) { if (this.render) this.render(ctx, this, g); }
}

// Fading after-image of a fighter
class Ghost extends Ent {
  constructor(o) { super(o); this.life = this.life || 14; this.layer = 0; }
  update() { if (++this.t >= this.life) this.dead = true; }
  draw(ctx) {
    ctx.globalAlpha = 0.55 * (1 - this.t / this.life);
    drawModel(ctx, this.def, Math.round(this.x), Math.round(this.y), this.facing, this.pose, { tint: this.color, outline: this.color });
    ctx.globalAlpha = 1;
  }
}

// Lightning line visual
class Bolt extends Ent {
  constructor(o) { super(Object.assign({ life: 10, c1: '#7df9ff', c2: '#ffffff', jit: 4 }, o)); this.makePts(); }
  makePts() {
    const dx = this.x1 - this.x0, dy = this.y1 - this.y0, len = Math.hypot(dx, dy) || 1;
    const n = Math.max(3, Math.floor(len / 10)), px = -dy / len, py = dx / len;
    this.pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, j = i > 0 && i < n ? rand(-this.jit, this.jit) : 0;
      this.pts.push([this.x0 + dx * u + px * j, this.y0 + dy * u + py * j]);
    }
  }
  update() { if (this.t % 2 === 0) this.makePts(); if (++this.t >= this.life) this.dead = true; }
  draw(ctx) {
    if (this.t > this.life * 0.6 && this.t % 2) return;
    for (let i = 0; i < this.pts.length - 1; i++) pline(ctx, ...this.pts[i], ...this.pts[i + 1], this.c1, 3);
    for (let i = 0; i < this.pts.length - 1; i++) pline(ctx, ...this.pts[i], ...this.pts[i + 1], this.c2, 1);
  }
}

// Radial explosion: hits once on its first frame, then animates.
class Boom extends Ent {
  constructor(o) { super(Object.assign({ dur: 18, colors: ['#ff9b2f', '#ffe45c', '#ffffff'], parts: 30 }, o)); }
  update(g) {
    if (this.t === 0) {
      g.hitRadius(this.owner, this.x, this.y, this.r, Object.assign({ radial: true }, this.spec), newHitId());
      g.fx.burst(this.x, this.y, this.parts, this.colors, this.r / 7, { life: [14, 32], size: 2, shrink: true, drag: 0.9 });
      g.addShake(this.shake || this.r / 9);
      SFX.boom();
    }
    if (++this.t >= this.dur) this.dead = true;
  }
  draw(ctx) {
    const u = this.t / this.dur;
    const r = Math.round(this.r * (0.45 + 0.55 * Math.sqrt(u)));
    if (this.t < 3) pcircle(ctx, this.x, this.y, r, this.colors[2]);
    else if (u < 0.35) pcircle(ctx, this.x, this.y, Math.round(r * 0.8), this.colors[1]);
    pring(ctx, this.x, this.y, r, Math.max(1, Math.round((1 - u) * 6)), this.colors[0]);
    if (u < 0.6) pring(ctx, this.x, this.y, Math.round(r * 0.65), 2, this.colors[1]);
  }
}

// ---- Volt: Thunderstorm ----
class Storm extends Ent {
  constructor(o) { super(Object.assign({ count: 6, interval: 17, spawned: 0 }, o)); }
  update(g) {
    g.darken = Math.max(g.darken, 0.4);
    if (this.t % this.interval === 0 && this.spawned < this.count) {
      const foe = g.nearestFoe(this.owner);
      const tx = foe ? clamp(foe.x + foe.vx * 12, 8, W - 8) : rand(110, 370);
      this.spawned++;
      g.add(new Strike({ x: tx, owner: this.owner, delay: 22, final: this.spawned === this.count }));
    }
    if (++this.t > this.interval * this.count + 40) this.dead = true;
  }
}
class Strike extends Ent {
  update(g) {
    if (this.t === 0) {   // bolts pass through soft platforms, stop at solid ground
      const s = STAGE.solids.filter((r) => this.x >= r.x && this.x <= r.x + r.w);
      this.gy = s.length ? Math.min(...s.map((r) => r.y)) : H + 20;
    }
    if (this.t === this.delay) {
      const spec = this.final
        ? { dmg: 10, kb: 4.6, scale: 1.0, angle: 80 }
        : { dmg: 5, kb: 1.6, scale: 0.2, angle: 90, stun: 14 };
      g.hitbox(this.owner, { x: this.x - 9, y: -60, w: 18, h: this.gy + 60 }, spec, newHitId(), this.x, this.gy);
      g.fx.burst(this.x, this.gy, 16, ['#ffffff', '#7df9ff', '#ffe23d'], 3, { grav: 0.15 });
      g.addShake(this.final ? 8 : 3);
      g.flash = Math.max(g.flash, this.final ? 5 : 2);
      SFX.zap();
      this.bolt = new Bolt({ x0: this.x + rand(-8, 8), y0: -4, x1: this.x, y1: this.gy, c1: '#7df9ff', c2: '#ffffff', jit: 6 });
    }
    if (this.bolt) this.bolt.update();
    if (++this.t > this.delay + 10) this.dead = true;
  }
  draw(ctx) {
    const x = Math.round(this.x);
    if (this.t < this.delay) {
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#7df9ff'; ctx.fillRect(x - 8, 0, 16, this.gy); ctx.globalAlpha = 1;
      pcircle(ctx, x - 6, 4, 6, '#2a2850'); pcircle(ctx, x + 5, 3, 7, '#2a2850'); pcircle(ctx, x, 6, 5, '#3a3870');
      if (Math.floor(this.t / 3) % 2 === 0) {
        ctx.fillStyle = '#ffe23d';
        ctx.fillRect(x - 7, this.gy - 1, 15, 1); ctx.fillRect(x - 1, this.gy - 6, 3, 3);
      }
    } else if (this.bolt) {
      for (let i = 0; i < this.bolt.pts.length - 1; i++) pline(ctx, ...this.bolt.pts[i], ...this.bolt.pts[i + 1], '#7df9ff', this.final ? 7 : 5);
      this.bolt.draw(ctx);
    }
  }
}

// ---- Frosta: Glacier Wall ----
class IceWall extends Ent {
  constructor(o) { super(o); this.w = 12; this.hMax = 38; this.h = 0; this.life = 260; this.solid = false; this.hitId = newHitId(); }
  get rect() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  update(g) {
    this.t++;
    if (this.t <= 8) {
      this.h = Math.round((this.hMax * this.t) / 8);
      g.hitbox(this.owner, { x: this.x - this.w / 2 - 3, y: this.y - this.h - 2, w: this.w + 6, h: this.h + 2 },
        { dmg: 6, kb: 3.2, scale: 0.45, angle: 80 }, this.hitId, this.x, this.y);
    }
    this.solid = this.h > 6;
    if (this.t >= this.life) this.shatter(g);
  }
  shatter(g) {
    if (this.dead) return;
    this.dead = true;
    g.fx.burst(this.x, this.y - this.h / 2, 26, ['#ffffff', '#d4f7ff', '#9ad8ff'], 2.5, { grav: 0.15, life: [16, 30] });
    SFX.ice();
  }
  draw(ctx) {
    if (this.life - this.t < 45 && Math.floor(this.t / 3) % 2) ctx.globalAlpha = 0.6;
    const r = this.rect, x = Math.round(r.x), y = Math.round(r.y);
    ctx.fillStyle = '#151338'; ctx.fillRect(x - 1, y - 1, r.w + 2, r.h + 1);
    ctx.fillStyle = '#9ad8ff'; ctx.fillRect(x, y, r.w, r.h);
    ctx.fillStyle = '#e8fbff'; ctx.fillRect(x, y, 2, r.h); ctx.fillRect(x, y, r.w, 1);
    ctx.fillStyle = '#5f8fe0'; ctx.fillRect(x + r.w - 2, y + 1, 2, r.h - 1);
    ctx.fillStyle = '#c8efff';
    for (let i = 4; i < r.h - 2; i += 9) { ctx.fillRect(x + 3, y + i, 5, 1); ctx.fillRect(x + 5, y + i + 1, 1, 3); }
    if ((this.t >> 3) % 4 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3 + ((this.t >> 3) % 6), y + 3, 1, 1); }
    ctx.globalAlpha = 1;
  }
}

// ---- Frosta: Absolute Zero ----
class FrostNova extends Ent {
  constructor(o) { super(Object.assign({ rMax: 150, dur: 26, r: 0 }, o)); this.hitSet = new Set(); }
  update(g) {
    this.t++;
    this.r = this.rMax * Math.min(1, this.t / this.dur);
    if (this.t <= this.dur) {
      for (const f of g.opponents(this.owner)) {
        if (this.hitSet.has(f)) continue;
        if (Math.hypot(f.x - this.x, f.cy - this.y) <= this.r + 6) {
          this.hitSet.add(f);
          g.hit(this.owner, f, { dmg: 10, kb: 0, scale: 0, freeze: 110 }, this.x, this.y);
        }
      }
      for (let i = 0; i < 6; i++) {
        const a = rand(0, TAU);
        g.fx.add(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, 0, rand(0.2, 0.6), randi(14, 26), pick(['#ffffff', '#d4f7ff']), { drag: 0.98 });
      }
    }
    if (this.t > this.dur + 10) this.dead = true;
  }
  draw(ctx) {
    if (this.t > this.dur) ctx.globalAlpha = 1 - (this.t - this.dur) / 10;
    pring(ctx, this.x, this.y, this.r, 4, '#9ad8ff');
    pring(ctx, this.x, this.y, this.r, 2, '#ffffff');
    if (this.r > 20) pring(ctx, this.x, this.y, this.r * 0.6, 1, '#d4f7ff');
    ctx.globalAlpha = 1;
  }
}

// ---- Bramble: Thorn trap ----
class ThornPatch extends Ent {
  constructor(o) { super(o); this.w = 26; this.life = 480; this.sprung = 0; this.layer = 0; this.hitId = newHitId(); }
  update(g) {
    this.t++;
    if (this.sprung) { if (++this.sprung > 18) this.dead = true; return; }
    if (this.t > 16) {
      const r = { x: this.x - this.w / 2, y: this.y - 9, w: this.w, h: 9 };
      if (g.hitbox(this.owner, r, { dmg: 7, kb: 3.4, scale: 0.45, angle: 82 }, this.hitId, this.x, this.y)) {
        this.sprung = 1;
        SFX.thorn();
        g.fx.burst(this.x, this.y - 4, 12, ['#5fbf3a', '#b4f25e', '#7d5432'], 2.4, { grav: 0.15 });
      }
    }
    if (this.t >= this.life) this.dead = true;
  }
  draw(ctx) {
    if (this.life - this.t < 60 && (this.t >> 2) % 2) return;
    const x0 = Math.round(this.x - this.w / 2), y = Math.round(this.y);
    const grow = Math.min(1, this.t / 16);
    ctx.fillStyle = '#1c1209'; ctx.fillRect(x0 - 1, y - 4, this.w + 2, 4);
    ctx.fillStyle = '#4f341c'; ctx.fillRect(x0, y - 3, this.w, 3);
    ctx.fillStyle = '#5fbf3a';
    for (let i = 0; i < this.w; i += 3) ctx.fillRect(x0 + i, y - 3 - (i % 2), 2, 1);
    const sh = this.sprung ? Math.round(16 * (1 - this.sprung / 18)) + 2 : Math.round(3 * grow);
    for (let i = 2; i < this.w; i += 5) {
      for (let k = 0; k < sh; k++) {
        const w = k < sh - 2 ? 2 : 1;
        ctx.fillStyle = k === sh - 1 ? '#ffe9c0' : '#7d5432';
        ctx.fillRect(x0 + i, y - 4 - k, w, 1);
      }
    }
  }
}

// ---- Bramble: Wildgrowth spike ----
class ThornSpike extends Ent {
  constructor(o) { super(o); this.hgt = 0; }
  update(g) {
    this.t++;
    const k = this.t - this.delay;
    if (k < 0) return;
    if (k === 0) { g.fx.burst(this.x, this.y, 6, ['#7d5432', '#5fbf3a', '#b4f25e'], 2, { grav: 0.2 }); if (this.sfx) SFX.thorn(); }
    if (k < 6) this.hgt = Math.round((38 * (k + 1)) / 6);
    else if (k < 22) this.hgt = 38;
    else if (k < 32) this.hgt = Math.round((38 * (32 - k)) / 10);
    else { this.dead = true; return; }
    if (this.hgt > 8 && k < 22) g.hitbox(this.owner, { x: this.x - 5, y: this.y - this.hgt, w: 10, h: this.hgt }, this.spec, this.hitId, this.ox, this.y);
  }
  draw(ctx) {
    if (this.hgt <= 0) return;
    const x = Math.round(this.x), y = Math.round(this.y), h = this.hgt;
    for (let i = 0; i < h; i++) {
      const hw = Math.max(0, Math.round(4 * (1 - i / h)));
      ctx.fillStyle = '#1c1209'; ctx.fillRect(x - hw - 1, y - i - 1, hw * 2 + 3, 1);
    }
    for (let i = 0; i < h; i++) {
      const hw = Math.max(0, Math.round(4 * (1 - i / h)));
      ctx.fillStyle = i % 7 < 2 ? '#5fbf3a' : '#7d5432';
      ctx.fillRect(x - hw, y - i, hw * 2 + 1, 1);
      if (i % 6 === 3) { ctx.fillStyle = '#ffe9c0'; ctx.fillRect(x - hw - 2, y - i, 1, 1); ctx.fillRect(x + hw + 2, y - i - 2, 1, 1); }
    }
    ctx.fillStyle = '#ffe9c0'; ctx.fillRect(x, y - h, 1, 2);
  }
}

// ---- Nyx: Gravity Orb ----
class GravOrb extends Ent {
  constructor(o) { super(Object.assign({ life: 90 }, o)); }
  update(g) {
    this.t++;
    this.x += this.vx; this.vx *= 0.985;
    let explode = this.t >= this.life;
    const r = { x: this.x - 4, y: this.y - 4, w: 8, h: 8 };
    for (const f of g.opponents(this.owner)) {
      if (f.frozen > 0 || f.invuln > 0) continue;
      const dx = this.x - f.x, dy = this.y - f.cy, d = Math.hypot(dx, dy);
      if (d < 72 && d > 2) { const s = 0.3 * (1 - d / 80) + 0.07; f.vx += (dx / d) * s; f.vy += (dy / d) * s * 0.8; }
      if (overlap(r, f.rect)) explode = true;
    }
    for (const s of g.solidsList) if (s.owner !== this.owner && overlap(r, s)) explode = true;
    if (this.t % 2 === 0) {
      const a = rand(0, TAU);
      g.fx.add(this.x + Math.cos(a) * 18, this.y + Math.sin(a) * 18, -Math.cos(a) * 1.2, -Math.sin(a) * 1.2, 14, pick(['#ff4fd8', '#d9b3ff']), { drag: 1 });
    }
    if (this.x < -30 || this.x > W + 30) this.dead = true;
    if (explode) {
      this.dead = true;
      g.add(new Boom({ x: this.x, y: this.y, r: 30, owner: this.owner, spec: { dmg: 9, kb: 3.4, scale: 0.62 }, dur: 16, colors: ['#ff4fd8', '#d9b3ff', '#ffffff'] }));
    }
  }
  draw(ctx) {
    const p = Math.round(Math.sin(this.t * 0.4));
    pcircle(ctx, this.x, this.y, 6 + p, '#ff4fd8');
    pcircle(ctx, this.x, this.y, 4, '#12081f');
    pring(ctx, this.x, this.y, 9 + p, 1, '#d9b3ff');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(this.x) - 2, Math.round(this.y) - 2, 1, 1);
  }
}

// ---- Nyx: Event Horizon ----
class BlackHole extends Ent {
  constructor(o) { super(Object.assign({ life: 150 }, o)); }
  update(g) {
    this.t++;
    g.darken = Math.max(g.darken, 0.35);
    for (const f of g.opponents(this.owner)) {
      if (f.invuln > 0) continue;
      const dx = this.x - f.x, dy = this.y - f.cy, d = Math.hypot(dx, dy);
      if (d < 175 && d > 3) {
        const s = 0.6 * (1 - d / 175) + 0.12;
        f.vx += (dx / d) * s; f.vy += (dy / d) * s;
        f.vx *= 0.94; f.vy *= 0.94;
      }
      if (d < 24 && this.t % 10 === 0) g.hit(this.owner, f, { dmg: 2, kb: 0, scale: 0, flinch: 12, quiet: true }, this.x, this.y);
    }
    for (let i = 0; i < 2; i++) {
      const a = rand(0, TAU), rr = rand(40, 80);
      g.fx.add(this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr, -Math.cos(a) * 1.6 - Math.sin(a), -Math.sin(a) * 1.6 + Math.cos(a), 26, pick(['#ff4fd8', '#d9b3ff', '#7a3cff']), { drag: 0.99 });
    }
    if (this.t >= this.life) {
      this.dead = true;
      g.add(new Boom({ x: this.x, y: this.y, r: 58, owner: this.owner, spec: { dmg: 14, kb: 5.4, scale: 1.05 }, dur: 24, colors: ['#ff4fd8', '#d9b3ff', '#ffffff'], shake: 12, parts: 50 }));
      g.flash = 6;
    }
  }
  draw(ctx) {
    const ring = (front) => {
      for (let i = 0; i < 28; i++) {
        const a = this.t * 0.12 + (i * TAU) / 28;
        if ((Math.sin(a) > 0) !== front) continue;
        ctx.fillStyle = i % 3 === 0 ? '#ffffff' : i % 2 ? '#ff4fd8' : '#d9b3ff';
        ctx.fillRect(Math.round(this.x + Math.cos(a) * 20), Math.round(this.y + Math.sin(a) * 6), 2, 1);
      }
    };
    ring(false);
    const grow = Math.min(1, this.t / 12);
    pcircle(ctx, this.x, this.y, Math.round(13 * grow), '#ff4fd8');
    pcircle(ctx, this.x, this.y, Math.round(11 * grow), '#7a3cff');
    pcircle(ctx, this.x, this.y, Math.round(9 * grow), '#000000');
    ring(true);
  }
}
