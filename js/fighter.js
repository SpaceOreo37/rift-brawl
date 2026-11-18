'use strict';
// ---------------- Procedural pixel-art body ----------------
// Local coords: x forward (+ = facing direction), y up from feet (negative = up).
function humanoid(def, pose, P) {
  const b = def.body, pal = def.pal, t = pose.t;
  const legH = b.legH, legW = b.legW, tw = b.torsoW, th = b.torsoH, hw = b.headW, hh = b.headH, aw = b.armW || 2;
  let bob = 0;
  if (pose.state === 'idle') bob = Math.floor(t / 24) % 2;
  if (pose.state === 'run') bob = Math.floor(t / 5) % 2;
  if (pose.crouch) bob = 1;
  const torsoX = -Math.floor(tw / 2), torsoY = -legH - th + bob;
  const headX = torsoX + Math.floor((tw - hw) / 2) + 1, headY = torsoY - hh + 1;
  const legCol = pal.leg || pal.b, armCol = pal.arm || pal.a, handCol = pal.hand || pal.s;

  // legs
  let fx = torsoX + tw - legW, fy = -legH, fh = legH;
  let bx = torsoX, by = -legH, bh = legH;
  if (pose.state === 'run') {
    const ph = Math.floor(t / 5) % 4;
    if (ph === 0) { fx += 1; bx -= 1; } else if (ph === 1) { fy -= 1; fh -= 1; }
    else if (ph === 2) { fx -= 1; bx += 1; } else { by -= 1; bh -= 1; }
  }
  if (pose.air) { fx += 1; fy -= 1; fh -= 1; bx -= 1; bh -= 1; }

  // arms
  const sx = torsoX + Math.floor(tw / 2);
  const swing = pose.state === 'run' ? [1, 0, -1, 0][Math.floor(t / 5) % 4] : 0;
  let arm = [sx + swing, torsoY + 1, aw, 4], hand = [sx + swing, torsoY + 5, aw, 1];
  let bArm = [torsoX - 1 - swing, torsoY + 1, aw, 4];
  let frontLeg = [fx, fy, legW, fh];
  switch (pose.arm) {
    case 'punch': arm = [sx, torsoY + 2, 4 + aw, 2]; hand = [sx + 4 + aw, torsoY + 1, 2, 3]; break;
    case 'wind': arm = [sx - 3, torsoY + 2, 3, 2]; hand = [sx - 5, torsoY + 1, 2, 3]; break;
    case 'up': arm = [sx, torsoY - 5, aw, 6]; hand = [sx, torsoY - 7, aw, 2]; break;
    case 'down': arm = [sx + 1, torsoY + 2, aw, 6]; hand = [sx + 1, torsoY + 8, aw, 2]; break;
    case 'cast': arm = [sx, torsoY + 2, 4, 2]; hand = [sx + 4, torsoY + 1, 2, 3]; break;
    case 'hurt': arm = [sx - 1, torsoY - 3, aw, 4]; hand = [sx - 1, torsoY - 4, aw, 1]; bArm = [torsoX - 2, torsoY - 3, aw, 4]; break;
    case 'low': frontLeg = [torsoX + tw - 1, -3, 6, 2]; break;
  }
  P(...bArm, pal.b);
  P(bx, by, legW, bh, legCol);
  P(...frontLeg, legCol);
  P(torsoX, torsoY, tw, th, pal.a);
  P(headX, headY, hw, hh, pal.head || pal.s);
  P(...arm, armCol);
  P(...hand, handCol);
  return { torsoX, torsoY, tw, th, headX, headY, hw, hh, handX: hand[0], handY: hand[1], legH, bob, t, sx };
}

// Draws a character model. Parts get a shared outline pass so the silhouette reads cleanly.
function drawModel(ctx, def, X, Y, facing, pose, o = {}) {
  const back = [], body = [], front = [], det = [];
  const k = humanoid(def, pose, (...a) => body.push(a));
  def.look(k, pose, (...a) => back.push(a), (...a) => front.push(a), (...a) => det.push(a));
  const all = back.concat(body, front);
  const R = (x, y, w, h) => ctx.fillRect(facing > 0 ? X + x : X - x - w, Y + y, w, h);
  ctx.fillStyle = o.outline || def.pal.o;
  for (const p of all) R(p[0] - 1, p[1] - 1, p[2] + 2, p[3] + 2);
  for (const p of all) { ctx.fillStyle = o.tint || (o.white ? '#ffffff' : p[4]); R(p[0], p[1], p[2], p[3]); }
  if (!o.tint && !o.white) for (const d of det) { ctx.fillStyle = d[4]; R(d[0], d[1], d[2], d[3]); }
  return k;
}

function idlePose(t) { return { t, state: 'idle', air: false, arm: 'idle', crouch: false, vx: 0, vy: 0 }; }

// Melee swoosh arcs
function drawSlash(ctx, f, m, t) {
  const k = t - m.s;
  if (k < 0 || k > m.a + 2) return;
  const hb = m.hb, X = Math.round(f.x), Y = Math.round(f.y), fc = f.facing;
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(fc > 0 ? X + x : X - x - w, Y + y, w, h); };
  const c1 = f.pal.fx1, c2 = f.pal.fx2;
  const fade = k > m.a;
  if (m.fx === 'side') {
    for (let i = 0; i < hb.h; i++) {
      const dx = Math.round(Math.sin((i / (hb.h - 1)) * Math.PI) * 4);
      if (fade && i % 2) continue;
      R(hb.x + hb.w - 6 + dx, hb.y + i, 2, 1, c1);
      if (i > 1 && i < hb.h - 2) R(hb.x + hb.w - 8 + dx, hb.y + i, 2, 1, c2);
    }
  } else if (m.fx === 'up') {
    for (let i = 0; i < hb.w; i++) {
      const dy = Math.round(Math.sin((i / (hb.w - 1)) * Math.PI) * 5);
      if (fade && i % 2) continue;
      R(hb.x + i, hb.y + 6 - dy, 1, 2, c1);
      R(hb.x + i, hb.y + 8 - dy, 1, 1, c2);
    }
  } else if (m.fx === 'down') {
    for (let i = 0; i < hb.w; i++) {
      const dy = Math.round(Math.sin((i / (hb.w - 1)) * Math.PI) * 5);
      if (fade && i % 2) continue;
      R(hb.x + i, hb.y + hb.h - 7 + dy, 1, 2, c1);
      R(hb.x + i, hb.y + hb.h - 8 + dy, 1, 1, c2);
    }
  } else if (m.fx === 'low') {
    R(hb.x + 2, hb.y + hb.h - 2, hb.w - 2, 1, c1);
    if (!fade) R(hb.x + 5, hb.y + hb.h - 4, hb.w - 7, 1, c2);
  }
}

// ---------------- Fighter ----------------
class Fighter {
  constructor(def, idx, pad, g, label) {
    this.def = def; this.idx = idx; this.pad = pad; this.g = g; this.label = label;
    this.pal = def.pal; this.st = def.stats;
    this.w = def.size.w; this.h = def.size.h;
    this.stocks = 3; this.meter = 0; this.dealt = 0; this.kos = 0; this.falls = 0;
    this.hitIds = new Set(); this.hudShake = 0;
    const sp = STAGE.spawns[idx];
    this.spawn(sp.x, sp.y, false);
  }

  spawn(x, y, respawn) {
    Object.assign(this, {
      x, y, vx: 0, vy: 0, facing: x < W / 2 ? 1 : -1, grounded: false, onPlat: false, jumps: this.st.jumps,
      damage: 0, cds: [0, 0], action: null, hitstun: 0, invuln: respawn ? 150 : 0, frozen: 0, stun: 0,
      burn: 0, burnT: 0, slow: 0, dropT: 0, flash: 0, empower: 0, armor: 0, animT: 0, dead: false, respawnT: 0,
      floatT: respawn ? 150 : 0, landT: 0, launched: false, freezeBy: null, lastHitBy: null,
    });
  }

  get cy() { return this.y - this.h / 2; }
  get rect() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  localRect(r) { return { x: this.facing > 0 ? this.x + r.x : this.x - r.x - r.w, y: this.y + r.y, w: r.w, h: r.h }; }
  get canAct() { return !this.dead && this.hitstun <= 0 && this.frozen <= 0 && this.stun <= 0 && !this.g.locked; }

  update() {
    const g = this.g, pad = this.pad;
    if (this.dead) {
      if (this.stocks > 0 && --this.respawnT <= 0) {
        const rp = STAGE.respawn;
        this.spawn(rp.x + (this.idx ? 24 : -24), rp.y, true);
      }
      return;
    }
    this.animT++;
    for (let i = 0; i < 2; i++) if (this.cds[i] > 0) this.cds[i]--;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    if (this.slow > 0) this.slow--;
    if (this.dropT > 0) this.dropT--;
    if (this.empower > 0) this.empower--;
    if (this.armor > 0) this.armor--;
    if (this.landT > 0) this.landT--;
    if (this.hudShake > 0) this.hudShake--;
    if (this.stun > 0) this.stun--;
    if (this.hitstun > 0 && --this.hitstun <= 0) this.launched = false;

    if (this.burn > 0 && --this.burnT <= 0) {
      this.burnT = 30; this.burn--; this.damage += 1;
      g.fx.text(this.x, this.y - this.h - 4, '1', '#ff9b2f');
    }
    if (this.burn > 0 && this.animT % 3 === 0)
      g.fx.add(this.x + rand(-4, 4), this.y - rand(2, this.h), rand(-0.2, 0.2), -rand(0.4, 1), randi(10, 18), pick(['#ff9b2f', '#ffe45c', '#d8392f']));
    if (this.slow > 0 && this.animT % 6 === 0)
      g.fx.add(this.x + rand(-5, 5), this.y - rand(2, this.h), 0, 0.3, 16, pick(['#ffffff', '#9ad8ff']));
    if (this.launched && this.animT % 2 === 0)
      g.fx.add(this.x, this.cy, rand(-0.3, 0.3), rand(-0.3, 0.3), 22, pick(['#e8e0ff', '#b8a8d8']), { size: 2, shrink: true });
    if (this.stun > 0 && this.animT % 4 === 0)
      g.fx.add(this.x + rand(-6, 6), this.y - rand(4, this.h + 2), 0, 0, 6, pick(['#ffe23d', '#7df9ff']));

    if (this.frozen > 0) {
      this.frozen--; this.vx *= 0.9;
      if (this.frozen === 0) this.onThaw();
    }

    // respawn hover pad
    if (this.floatT > 0) {
      this.floatT--; this.vx = 0; this.vy = 0;
      const anyInput = ACTIONS.some((a) => pad.held(a));
      if ((anyInput && this.floatT < 135) || this.floatT === 0) this.floatT = 0;
      else return;
    }

    if (this.canAct) {
      if (this.action) this.tickAction();
      else this.control();
    } else if (this.action && (this.frozen > 0 || this.hitstun > 0 || this.stun > 0)) {
      this.action = null;
    }
    this.physics();
    const b = STAGE.blast;
    if (this.x < b.l || this.x > b.r || this.y > b.b || this.y < b.t) this.ko();
  }

  moveX(dx, factor) {
    const st = this.st, sl = this.slow > 0 ? 0.55 : 1;
    if (this.grounded) this.vx = approach(this.vx, dx * st.run * sl * factor, dx ? st.accel : st.fric);
    else if (dx) this.vx = approach(this.vx, dx * st.air * sl * factor, st.airAccel);
    else this.vx = approach(this.vx, 0, 0.04);
  }

  control() {
    const pad = this.pad, st = this.st, g = this.g;
    const dx = (pad.held('right') ? 1 : 0) - (pad.held('left') ? 1 : 0);
    this.moveX(dx, 1);
    if (dx && dx !== this.facing) {
      this.facing = dx;
      if (this.grounded && Math.abs(this.vx) > 1) this.dust(3);
    }
    if (this.grounded && this.onPlat && pad.buf('down', 3)) {
      pad.consume('down'); this.dropT = 14; this.grounded = false; this.y += 1;
    }
    if (pad.buf('up', 5)) {
      if (this.grounded) {
        pad.consume('up'); this.vy = -st.jump; this.grounded = false; this.dust(5); SFX.jump();
      } else if (this.jumps > 0) {
        pad.consume('up'); this.jumps--; this.vy = -st.djump;
        g.fx.burst(this.x, this.y, 7, ['#ffffff', '#d8d0ff'], 1.3, { life: [8, 14] });
        SFX.jump(1.4);
      }
    }
    if (pad.buf('attack')) {
      pad.consume('attack');
      let k = 'side';
      if (pad.held('up')) k = 'up';
      else if (pad.held('down')) k = this.grounded ? 'low' : 'dair';
      this.startMelee(k);
      return;
    }
    for (let i = 0; i < 2; i++) {
      const a = 'skill' + (i + 1);
      if (pad.buf(a)) {
        pad.consume(a);
        if (this.cds[i] <= 0) {
          const sk = this.def.skills[i];
          this.cds[i] = sk.cd;
          sk.use(this, g);
          return;
        } else SFX.deny();
      }
    }
    if (pad.buf('ult')) {
      pad.consume('ult');
      if (this.meter >= 100) {
        this.meter = 0;
        g.startUlt(this);
        this.def.ult.use(this, g);
        return;
      } else SFX.deny();
    }
  }

  startAction(a) { a.t = 0; this.action = a; }

  tickAction() {
    const a = this.action, pad = this.pad;
    const dx = (pad.held('right') ? 1 : 0) - (pad.held('left') ? 1 : 0);
    if (a.move) this.moveX(dx, a.move);
    else if (this.grounded) this.vx = approach(this.vx, 0, this.st.fric);
    if (a.update) a.update(this, this.g, a.t);
    if (this.action !== a) return;
    a.t++;
    if (a.t >= a.dur) { this.action = null; if (a.onEnd) a.onEnd(this, this.g); }
  }

  startMelee(kind) {
    const m = this.def.melee[kind];
    if (!m) return;
    const hitId = newHitId();
    const spec = Object.assign({ melee: true }, m.hit);
    this.startAction({
      dur: m.s + m.a + m.r, melee: m, kind, move: this.grounded ? 0 : 0.7,
      update(f, g, t) {
        if (t === m.s) { if (m.lunge && f.grounded) f.vx += m.lunge * f.facing; SFX.swing(); }
        if (t >= m.s && t < m.s + m.a) {
          spec.dirX = f.facing;
          g.hitbox(f, f.localRect(m.hb), spec, hitId, f.x, f.cy);
        }
      },
    });
  }

  physics() {
    const st = this.st;
    const a = this.action;
    let grav = st.grav;
    if (a && a.noGrav && this.frozen <= 0) grav = 0;
    else if (this.hitstun > 0 && this.vy < 0) grav *= 0.7;
    else if (this.hitstun <= 0 && this.vy < 0 && !this.pad.held('up') && !a) grav *= 1.7; // short hop
    this.vy += grav;
    let maxF = st.fall;
    if (this.hitstun <= 0 && this.frozen <= 0 && !this.grounded && this.pad.held('down') && this.vy > 0 && !this.g.locked) {
      maxF = st.ffall; this.vy += 0.5;
    }
    if (this.hitstun > 0) { maxF = 14; this.vx *= 0.965; }
    if (this.vy > maxF) this.vy = approach(this.vy, maxF, 1);
    if (this.grounded && this.hitstun > 0) this.vx *= 0.85;

    const solids = this.g.solidsList;
    // horizontal
    this.x += this.vx;
    let r = this.rect;
    for (const s of solids) {
      if (overlap(r, s)) {
        if (this.x < s.x + s.w / 2) this.x = s.x - this.w / 2 - 0.01;
        else this.x = s.x + s.w + this.w / 2 + 0.01;
        if (this.hitstun > 0 && Math.abs(this.vx) > 4) this.vx *= -0.5; else this.vx = 0;
        r = this.rect;
      }
    }
    // vertical
    const prevBottom = this.y;
    const wasG = this.grounded;
    this.y += this.vy;
    this.grounded = false; this.onPlat = false;
    r = this.rect;
    for (const s of solids) {
      if (overlap(r, s)) {
        if (this.vy >= 0 && prevBottom <= s.y + 4) this.land(s.y, wasG);
        else if (this.vy < 0) { this.y = s.y + s.h + this.h; this.vy = 0; }
        else this.land(s.y, wasG);
        r = this.rect;
      }
    }
    if (this.vy >= 0 && this.dropT <= 0) {
      for (const p of STAGE.plats) {
        if (prevBottom <= p.y + 0.01 && this.y >= p.y && this.x + this.w / 2 > p.x && this.x - this.w / 2 < p.x + p.w) {
          this.land(p.y, wasG); this.onPlat = true;
        }
      }
    }
  }

  land(y, wasG) {
    this.y = y;
    if (this.hitstun > 0 && this.vy > 4.5) {   // tumble bounce
      this.vy = -this.vy * 0.45; this.vx *= 0.8; this.dust(6);
      return;
    }
    if (!wasG && this.vy > 2) { this.dust(4); this.landT = 4; }
    this.vy = 0; this.grounded = true; this.jumps = this.st.jumps;
    if (this.action && this.action.kind === 'dair') { this.action = null; this.landT = 6; }
  }

  dust(n) {
    this.g.fx.burst(this.x, this.y - 1, n, ['#e8dcc8', '#b8a898'], 1, { life: [8, 16], grav: -0.02 });
  }

  onThaw() {
    const g = this.g;
    g.fx.burst(this.x, this.cy, 22, ['#ffffff', '#d4f7ff', '#9ad8ff'], 2.6, { grav: 0.15, life: [14, 26] });
    SFX.ice();
    if (this.freezeBy) {
      g.hit(this.freezeBy, this, { dmg: 7, kb: 3.8, scale: 0.6, angle: 75 }, this.freezeBy.x, this.freezeBy.cy);
      this.freezeBy = null;
    }
  }

  ko() {
    this.dead = true; this.stocks--; this.respawnT = 80; this.action = null;
    this.burn = 0; this.slow = 0; this.frozen = 0; this.stun = 0;
    this.g.onKO(this);
  }

  pose() {
    let state = 'idle';
    if (!this.grounded) state = 'air';
    else if (Math.abs(this.vx) > 0.4) state = 'run';
    let arm = 'idle';
    const a = this.action;
    if (this.frozen > 0) arm = 'idle';
    else if (this.hitstun > 0 || this.stun > 0) arm = 'hurt';
    else if (a) {
      if (a.melee) {
        const m = a.melee;
        arm = a.t < m.s ? 'wind' : a.t < m.s + m.a + 3 ? m.arm : 'idle';
      } else arm = a.arm || 'cast';
    }
    return { t: this.animT, state, air: !this.grounded, arm, crouch: this.landT > 0, vx: this.vx, vy: this.vy };
  }

  draw(ctx) {
    if (this.dead) return;
    const g = this.g;
    const X = Math.round(this.x), Y = Math.round(this.y);
    if (this.floatT > 0) {
      ctx.fillStyle = '#1d0f26'; ctx.fillRect(X - 11, Y, 22, 4);
      ctx.fillStyle = PCOL[this.idx]; ctx.fillRect(X - 10, Y + 1, 20, 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(X - 10 + ((this.animT >> 1) % 19), Y + 1, 2, 1);
      ctx.globalAlpha = 0.2; ctx.fillStyle = PCOL[this.idx]; ctx.fillRect(X - 8, Y + 4, 16, 30); ctx.globalAlpha = 1;
    }
    const pose = this.pose();
    const blink = this.invuln > 0 && this.floatT <= 0 && Math.floor(this.invuln / 4) % 2 === 0;
    ctx.globalAlpha = blink ? 0.45 : 1;
    const jx = this.stun > 0 ? ((this.animT >> 1) % 2 ? 1 : -1) : 0;
    // glow auras
    let glow = null;
    if (this.armor > 0) glow = (this.animT >> 1) % 2 ? '#ffffff' : this.pal.fx2;
    else if (this.empower > 0) glow = '#ff4fd8';
    else if (this.stun > 0 && (this.animT >> 1) % 2) glow = '#ffe23d';
    if (glow) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
      drawModel(ctx, this.def, X + jx + ox, Y + oy, this.facing, pose, { tint: glow, outline: glow });
    drawModel(ctx, this.def, X + jx, Y, this.facing, pose, { white: this.flash > 0 && this.flash % 2 === 0 });
    ctx.globalAlpha = 1;
    if (this.action && this.action.melee) drawSlash(ctx, this, this.action.melee, this.action.t);
    if (this.action && this.action.draw) this.action.draw(ctx, this, g);
    if (this.frozen > 0) {
      const r = this.rect, x = Math.round(r.x) - 3, y = Math.round(r.y) - 5, w = r.w + 6, h = r.h + 5;
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#bfefff'; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + 2, y + 2, 1, 4);
      ctx.fillStyle = '#5f8fe0'; ctx.fillRect(x + w - 1, y, 1, h); ctx.fillRect(x, y + h - 1, w, 1);
    }
    if (!g.over) {
      const ty = Y - this.def.visH - 9;
      drawText(ctx, this.label, X, ty, PCOL[this.idx], { align: 'center', outline: '#12081f' });
      ctx.fillStyle = PCOL[this.idx]; ctx.fillRect(X - 1, ty + 7, 3, 1); ctx.fillRect(X, ty + 8, 1, 1);
    }
  }
}
