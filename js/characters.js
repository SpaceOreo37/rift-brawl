'use strict';
// Standard melee kit, tuned per character.
//   side = Attack, up = Up+Attack, low = Down+Attack (ground), dair = Down+Attack (air, spikes downward)
function stdMoves(p) {
  return {
    side: { s: p.s, a: 3, r: 8 + Math.floor(p.s / 2), hb: { x: 2, y: -Math.round(p.h * 0.8), w: 10 + p.reach, h: 10 },
      hit: { dmg: p.dmg, kb: p.kb, scale: p.scale, angle: 38 }, lunge: 1.4, arm: 'punch', fx: 'side' },
    up: { s: p.s + 1, a: 4, r: 11, hb: { x: -8, y: -p.h - 12, w: 16, h: 15 },
      hit: { dmg: p.dmg + 1, kb: p.kb + 0.5, scale: p.scale, angle: 88 }, arm: 'up', fx: 'up' },
    dair: { s: p.s + 2, a: 5, r: 10, hb: { x: -7, y: -5, w: 14, h: 11 },
      hit: { dmg: p.dmg + 2, kb: p.kb + 0.5, scale: p.scale * 0.9, angle: -72 }, arm: 'down', fx: 'down' },
    low: { s: p.s + 1, a: 4, r: 12, hb: { x: -2, y: -7, w: 14 + p.reach, h: 7 },
      hit: { dmg: p.dmg, kb: p.kb + 0.6, scale: p.scale * 0.85, angle: 30 }, arm: 'low', fx: 'low' },
  };
}

const handPos = (f) => ({ x: f.x + f.facing * 7, y: f.y - f.h * 0.62 });

// ======================================================================
// BLAZE — fire brawler
// ======================================================================
const BLAZE = {
  id: 'blaze', name: 'BLAZE', title: 'HOT-HEADED BRAWLER', bars: { spd: 3, pwr: 4, wgt: 3 },
  pal: { o: '#2a0b10', a: '#d8392f', b: '#7c1d24', c: '#ff9b2f', d: '#ffe45c', s: '#f6c79c', e: '#2a0b10',
    hand: '#ff9b2f', ui: '#ff7a3d', fx1: '#ffe45c', fx2: '#ff9b2f' },
  body: { headW: 8, headH: 7, torsoW: 6, torsoH: 6, legH: 5, legW: 2, armW: 2 },
  size: { w: 10, h: 19 }, visH: 24,
  stats: { run: 2.2, air: 1.9, accel: 0.5, airAccel: 0.26, fric: 0.45, jump: 6.3, djump: 5.8, grav: 0.32, fall: 5.6, ffall: 8.2, weight: 1.0, jumps: 1 },
  melee: (() => { const m = stdMoves({ dmg: 6, kb: 2.1, scale: 0.5, s: 4, reach: 3, h: 19 }); m.side.hit.burn = 1; return m; })(),
  attackName: 'FLAME JAB',
  skills: [
    { name: 'FIREBALL', desc: 'BURNING SHOT. SETS FOES ALIGHT', cd: 48,
      use(f, g) {
        f.startAction({ dur: 14, arm: 'cast', move: 0.5, update(f, g, t) {
          if (t !== 4) return;
          const h = handPos(f);
          SFX.fire();
          g.add(new Proj({
            x: h.x, y: h.y, vx: 4.6 * f.facing, w: 8, h: 7, life: 75, owner: f,
            spec: { dmg: 6, kb: 1.8, scale: 0.45, angle: 30, burn: 2, dirX: f.facing },
            onTick(p, g) { if (p.t % 2 === 0) g.fx.add(p.x - p.vx, p.y + rand(-2, 2), -p.vx * 0.1, rand(-0.4, 0.1), 12, pick(['#ff9b2f', '#d8392f', '#ffe45c']), { size: 2, shrink: true }); },
            onKill(p, g) { g.fx.burst(p.x, p.y, 10, ['#ff9b2f', '#ffe45c', '#d8392f'], 2); },
            render(ctx, p) {
              const fl = (p.t >> 1) % 2;
              pcircle(ctx, p.x, p.y, 4 + fl, '#d8392f');
              pcircle(ctx, p.x + Math.sign(p.vx), p.y, 3, '#ff9b2f');
              pcircle(ctx, p.x + Math.sign(p.vx) * 2, p.y, 1 + fl, '#ffe45c');
            },
          }));
        } });
      } },
    { name: 'BLAZE RUSH', desc: 'FIERY 8-WAY DASH. GREAT RECOVERY', cd: 100,
      use(f, g) {
        let d = dirFromPad(f.pad, f.facing);
        if (f.grounded && d.y > 0) d = { x: f.facing, y: 0 };
        if (Math.abs(d.x) > 0.1) f.facing = d.x > 0 ? 1 : -1;
        const hitId = newHitId();
        SFX.fire();
        f.startAction({ dur: 20, arm: 'punch', noGrav: true, update(f, g, t) {
          if (t < 11) {
            f.vx = d.x * 6.4; f.vy = d.y * 6.4;
            const r = f.rect;
            g.hitbox(f, { x: r.x - 4, y: r.y - 3, w: r.w + 8, h: r.h + 6 }, { dmg: 8, kb: 3, scale: 0.55, angle: 40, burn: 2, dirX: f.facing }, hitId, f.x - d.x * 10, f.cy);
            for (let i = 0; i < 3; i++) g.fx.add(f.x + rand(-4, 4), f.cy + rand(-6, 6), -d.x * rand(0.5, 1.5), -d.y * rand(0.5, 1.5) - 0.3, randi(10, 20), pick(['#ff9b2f', '#ffe45c', '#d8392f']), { size: 2, shrink: true });
          } else {
            this.noGrav = false;
            if (t === 11) { f.vx *= 0.35; f.vy *= 0.3; }
          }
        } });
      } },
  ],
  ult: { name: 'INFERNO BURST', desc: 'HUGE EXPLOSION ALL AROUND YOU',
    use(f, g) {
      f.startAction({ dur: 38, arm: 'up', noGrav: true, update(f, g, t) {
        if (t < 20) {
          f.vx *= 0.8; f.vy = -0.25;
          for (let i = 0; i < 3; i++) {
            const a = rand(0, TAU), rr = rand(30, 50);
            g.fx.add(f.x + Math.cos(a) * rr, f.cy + Math.sin(a) * rr, -Math.cos(a) * 2, -Math.sin(a) * 2, 15, pick(['#ff9b2f', '#ffe45c', '#d8392f']), { drag: 1 });
          }
        }
        if (t === 20) {
          g.add(new Boom({ x: f.x, y: f.cy, r: 78, owner: f, spec: { dmg: 20, kb: 5, scale: 1.05, burn: 3 }, dur: 26, colors: ['#ff9b2f', '#ffe45c', '#ffffff'], shake: 12, parts: 60 }));
          g.flash = 6;
          this.noGrav = false;
        }
      } });
    } },
  ai: { range: 22, skills: [[50, 220, 18], [30, 110, 26]], recover: 1, ultRange: 64 },
  look(k, p, B, F, D) {
    const pal = this.pal, t = p.t;
    B(k.headX - 3, k.headY - 1, 3, 3, pal.c);                       // back hair flick
    const tail = k.headY + 2 + (Math.floor(t / 6) % 2);
    B(k.headX - 4, tail, 3, 1, pal.b); B(k.headX - 6, tail + 1, 2, 1, pal.b); // headband tails
    F(k.headX - 1, k.headY - 2, k.hw + 1, 3, pal.c);                 // flame hair base
    for (let i = 0; i < 4; i++) {
      const fh = 2 + ((Math.floor(t / 5) + i * 2) % 3);
      F(k.headX - 1 + i * 2, k.headY - 2 - fh, 2, fh, i % 2 ? pal.d : pal.c);
    }
    D(k.headX, k.headY + 1, k.hw, 1, pal.b);                          // headband
    D(k.headX + k.hw - 4, k.headY + 3, 1, 2, pal.e);                  // eyes
    D(k.headX + k.hw - 2, k.headY + 3, 1, 2, pal.e);
    D(k.headX + k.hw - 3, k.headY + 6, 2, 1, '#c98a6a');
    D(k.torsoX, k.torsoY + k.th - 2, k.tw, 1, pal.c);                 // belt
    D(k.torsoX + 2, k.torsoY + 1, 2, 2, pal.d);
    if (p.arm === 'punch' || p.arm === 'cast') D(k.handX + 1, k.handY, 1, 1, pal.d);
  },
};

// ======================================================================
// VOLT — lightning ninja
// ======================================================================
const VOLT = {
  id: 'volt', name: 'VOLT', title: 'LIGHTNING-FAST NINJA', bars: { spd: 5, pwr: 2, wgt: 2 },
  pal: { o: '#0a0f2a', a: '#2a47a8', b: '#16245e', c: '#ffe23d', c2: '#ffb92e', d: '#7df9ff', s: '#f0cfa8', e: '#0a0f2a',
    head: '#2a47a8', hand: '#16245e', ui: '#ffe23d', fx1: '#ffffff', fx2: '#7df9ff' },
  body: { headW: 8, headH: 7, torsoW: 6, torsoH: 6, legH: 5, legW: 2, armW: 2 },
  size: { w: 9, h: 18 }, visH: 19,
  stats: { run: 2.8, air: 2.3, accel: 0.7, airAccel: 0.32, fric: 0.5, jump: 6.4, djump: 5.6, grav: 0.34, fall: 5.8, ffall: 8.6, weight: 0.85, jumps: 2 },
  melee: stdMoves({ dmg: 4, kb: 1.8, scale: 0.44, s: 2, reach: 2, h: 18 }),
  attackName: 'QUICK SLASH',
  skills: [
    { name: 'ZAP DASH', desc: 'TELEPORT STRIKE IN ANY DIRECTION', cd: 80,
      use(f, g) {
        let d = dirFromPad(f.pad, f.facing);
        if (f.grounded && d.y > 0) d = { x: f.facing, y: 0 };
        if (Math.abs(d.x) > 0.1) f.facing = d.x > 0 ? 1 : -1;
        const sx = f.x, sy = f.y, pose = f.pose();
        for (let i = 0; i < 22; i++) {
          const nx = f.x + d.x * 4, ny = f.y + d.y * 4;
          if (g.rectBlocked({ x: nx - f.w / 2, y: ny - f.h, w: f.w, h: f.h })) break;
          f.x = nx; f.y = ny;
        }
        const minX = Math.min(sx, f.x) - f.w / 2 - 3, maxX = Math.max(sx, f.x) + f.w / 2 + 3;
        const minY = Math.min(sy, f.y) - f.h - 3, maxY = Math.max(sy, f.y) + 3;
        g.hitbox(f, { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, { dmg: 7, kb: 2.6, scale: 0.5, angle: 55, dirX: f.facing }, newHitId(), sx, sy - f.h / 2);
        g.add(new Bolt({ x0: sx, y0: sy - f.h / 2, x1: f.x, y1: f.y - f.h / 2, life: 10 }));
        for (let k = 0; k < 4; k++) g.add(new Ghost({ def: f.def, x: lerp(sx, f.x, k / 4), y: lerp(sy, f.y, k / 4), facing: f.facing, pose, color: '#7df9ff', life: 10 + k * 2 }));
        f.vx = d.x * 2.5; f.vy = d.y * 2.5 - (d.y < 0 ? 1.5 : 0);
        f.startAction({ dur: 10, arm: 'punch', move: 0.5 });
        SFX.zap();
      } },
    { name: 'CHAIN BOLT', desc: 'LONG BEAM THAT STUNS ON HIT', cd: 70,
      use(f, g) {
        f.startAction({ dur: 20, arm: 'cast', move: 0, update(f, g, t) {
          if (t !== 5) return;
          const h = handPos(f);
          let ex = h.x + f.facing * 150;
          const r = { x: Math.min(h.x, ex), y: h.y - 5, w: 150, h: 10 };
          for (const o of g.opponents(f)) if (overlap(r, o.rect)) ex = o.x;
          g.hitbox(f, r, { dmg: 6, kb: 1.4, scale: 0.25, angle: 20, stun: 30, dirX: f.facing }, newHitId(), f.x, h.y);
          g.add(new Bolt({ x0: h.x, y0: h.y, x1: ex, y1: h.y + rand(-2, 2), life: 12, c1: '#ffe23d', c2: '#ffffff', jit: 5 }));
          g.fx.burst(ex, h.y, 8, ['#ffe23d', '#ffffff'], 2);
          SFX.zap();
        } });
      } },
  ],
  ult: { name: 'THUNDERSTORM', desc: '6 LIGHTNING STRIKES HUNT YOUR FOE',
    use(f, g) {
      f.startAction({ dur: 22, arm: 'up', move: 0 });
      g.add(new Storm({ owner: f }));
    } },
  ai: { range: 18, skills: [[30, 90, 30], [30, 150, 12]], recover: 0, ultRange: 999 },
  look(k, p, B, F, D) {
    const pal = this.pal, t = p.t;
    const moving = p.state === 'run' || p.air;
    for (let i = 0; i < 5; i++) {                                     // flowing scarf
      const wave = Math.round(Math.sin(t * 0.3 - i * 0.9) * (moving ? 1.5 : 0.6));
      const droop = moving ? 0 : Math.floor(i / 2);
      B(k.torsoX - 2 - i * 2, k.torsoY + wave + droop, 2, 2, i % 2 ? pal.c2 : pal.c);
    }
    F(k.torsoX - 1, k.torsoY, k.tw + 1, 2, pal.c);                    // scarf wrap
    F(k.headX + 1, k.headY - 1, 2, 1, pal.a);                         // mask ear points
    F(k.headX + k.hw - 3, k.headY - 1, 2, 1, pal.a);
    D(k.headX + 2, k.headY + 2, k.hw - 2, 2, pal.s);                  // eye slit
    D(k.headX + k.hw - 4, k.headY + 2, 1, 2, pal.e);
    D(k.headX + k.hw - 2, k.headY + 2, 1, 2, pal.e);
    D(k.headX, k.headY + 1, k.hw, 1, pal.d);                          // glowing band
    D(k.torsoX + 3, k.torsoY + 2, 1, 1, pal.d); D(k.torsoX + 2, k.torsoY + 3, 2, 1, pal.d); D(k.torsoX + 2, k.torsoY + 4, 1, 1, pal.d);
  },
};

// ======================================================================
// FROSTA — ice witch
// ======================================================================
const FROSTA = {
  id: 'frosta', name: 'FROSTA', title: 'ICE WITCH. ZONE CONTROL', bars: { spd: 2, pwr: 3, wgt: 3 },
  pal: { o: '#151338', a: '#9ad8ff', b: '#4a62c9', c: '#ffffff', d: '#d4f7ff', s: '#f5dccb', e: '#3a2c8c', gem: '#ff6ad5',
    wood: '#6e82d6', hand: '#f5dccb', ui: '#9ad8ff', fx1: '#ffffff', fx2: '#9ad8ff' },
  body: { headW: 8, headH: 7, torsoW: 6, torsoH: 6, legH: 5, legW: 2, armW: 2 },
  size: { w: 10, h: 19 }, visH: 27,
  stats: { run: 1.9, air: 2.0, accel: 0.45, airAccel: 0.28, fric: 0.35, jump: 5.8, djump: 5.0, grav: 0.25, fall: 4.2, ffall: 7.0, weight: 0.92, jumps: 2 },
  melee: stdMoves({ dmg: 6, kb: 2.2, scale: 0.48, s: 5, reach: 8, h: 19 }),
  attackName: 'STAFF SWING',
  skills: [
    { name: 'ICE SHARDS', desc: '3 SHARDS THAT SLOW ENEMIES', cd: 55,
      use(f, g) {
        f.startAction({ dur: 16, arm: 'cast', move: 0.4, update(f, g, t) {
          if (t !== 5) return;
          const h = handPos(f);
          SFX.ice();
          for (const ang of [-0.2, 0, 0.2]) {
            g.add(new Proj({
              x: h.x, y: h.y, vx: Math.cos(ang) * 5 * f.facing, vy: Math.sin(ang) * 5, w: 5, h: 4, life: 42, owner: f,
              spec: { dmg: 4, kb: 1.3, scale: 0.3, angle: 25, slow: 110, dirX: f.facing },
              onTick(p, g) { if (p.t % 3 === 0) g.fx.add(p.x, p.y, 0, 0, 10, '#d4f7ff'); },
              onKill(p, g) { g.fx.burst(p.x, p.y, 5, ['#ffffff', '#9ad8ff'], 1.5); },
              render(ctx, p) {
                const x = Math.round(p.x), y = Math.round(p.y), s = Math.sign(p.vx);
                ctx.fillStyle = '#151338'; ctx.fillRect(x - 3, y - 2, 7, 4);
                ctx.fillStyle = '#9ad8ff'; ctx.fillRect(x - 2, y - 1, 5, 2);
                ctx.fillStyle = '#ffffff'; ctx.fillRect(x + s, y - 1, 2, 1);
              },
            }));
          }
        } });
      } },
    { name: 'GLACIER WALL', desc: 'ICE PILLAR. LAUNCHES + BLOCKS SHOTS', cd: 160,
      use(f, g) {
        f.startAction({ dur: 18, arm: 'down', move: 0, update(f, g, t) {
          if (t !== 4) return;
          for (const e of g.entities) if (e instanceof IceWall && e.owner === f) e.shatter(g);
          const wx = f.x + f.facing * 22;
          const gy = STAGE.groundBelow(wx, f.y - 6, 90) ?? f.y;
          g.add(new IceWall({ x: wx, y: gy, owner: f }));
          g.fx.burst(wx, gy, 10, ['#ffffff', '#9ad8ff'], 2, { grav: 0.1 });
          SFX.ice();
        } });
      } },
  ],
  ult: { name: 'ABSOLUTE ZERO', desc: 'FREEZE WAVE. FOE SHATTERS AFTER',
    use(f, g) {
      f.startAction({ dur: 32, arm: 'up', noGrav: true, update(f, g, t) {
        f.vx *= 0.85; f.vy = t < 10 ? -0.3 : 0;
        if (t === 8) { g.add(new FrostNova({ x: f.x, y: f.cy, owner: f })); g.flash = 4; SFX.ice(); }
        if (t === 20) this.noGrav = false;
      } });
    } },
  ai: { range: 30, skills: [[40, 180, 22], [16, 44, 20]], recover: null, ultRange: 130 },
  look(k, p, B, F, D) {
    const pal = this.pal, t = p.t;
    B(k.headX - 2, k.headY + 1, 3, k.hh + 2, pal.c);                  // long white hair
    F(k.headX - 2, k.headY - 1, k.hw + 3, 2, pal.b);                  // hat brim
    F(k.headX, k.headY - 4, k.hw - 2, 3, pal.b);                      // cone
    F(k.headX + 1, k.headY - 6, k.hw - 4, 2, pal.b);
    const flap = Math.floor(t / 14) % 2;
    F(k.headX - 1, k.headY - 7 + flap, 3, 2, pal.b);                  // bent tip
    // robe over the legs
    F(k.torsoX - 1, k.torsoY + k.th - 1, k.tw + 2, k.legH - 2, pal.a);
    F(k.torsoX - 2, k.torsoY + k.th + k.legH - 4, k.tw + 4, 1, pal.a);
    // staff
    const w = pal.wood, hx = k.handX, hy = k.handY;
    if (p.arm === 'punch' || p.arm === 'cast') { F(hx - 6, hy + 1, 16, 1, w); F(hx + 10, hy, 3, 3, pal.d); }
    else if (p.arm === 'up') { F(hx + 1, hy - 11, 1, 15, w); F(hx, hy - 14, 3, 3, pal.d); }
    else if (p.arm === 'down') { F(hx + 1, hy - 4, 1, 12, w); F(hx, hy + 8, 3, 3, pal.d); }
    else if (p.arm !== 'hurt') { F(hx + 1, hy - 10, 1, 14, w); F(hx, hy - 13, 3, 3, pal.d); }
    D(k.headX, k.headY - 2, k.hw - 2, 1, pal.d);                      // hat band
    D(k.headX + 2, k.headY - 2, 2, 1, pal.gem);
    D(k.headX + k.hw - 4, k.headY + 3, 1, 2, pal.e);
    D(k.headX + k.hw - 2, k.headY + 3, 1, 2, pal.e);
    D(k.torsoX + 2, k.torsoY + 1, 2, 1, pal.gem);
    D(k.torsoX - 1, k.torsoY + k.th + k.legH - 5, k.tw + 2, 1, pal.c); // robe trim
  },
};

// ======================================================================
// BRAMBLE — nature golem
// ======================================================================
const BRAMBLE = {
  id: 'bramble', name: 'BRAMBLE', title: 'HEAVY NATURE GOLEM', bars: { spd: 1, pwr: 5, wgt: 5 },
  pal: { o: '#1c1209', a: '#7d5432', b: '#4f341c', c: '#5fbf3a', d: '#b4f25e', s: '#8e6340', e: '#ffec5a', flower: '#ff7ab8',
    head: '#8e6340', hand: '#4f341c', ui: '#7fd94a', fx1: '#b4f25e', fx2: '#5fbf3a' },
  body: { headW: 9, headH: 7, torsoW: 9, torsoH: 8, legH: 5, legW: 3, armW: 3 },
  size: { w: 13, h: 21 }, visH: 25,
  stats: { run: 1.6, air: 1.55, accel: 0.35, airAccel: 0.2, fric: 0.5, jump: 6.1, djump: 5.6, grav: 0.36, fall: 6, ffall: 9, weight: 1.35, jumps: 1 },
  melee: (() => { const m = stdMoves({ dmg: 10, kb: 3, scale: 0.6, s: 8, reach: 5, h: 21 }); m.side.lunge = 2; return m; })(),
  attackName: 'LOG SLAM',
  skills: [
    { name: 'VINE LASH', desc: 'PULLS FOES IN. HOLD UP TO GRAPPLE', cd: 75,
      use(f, g) {
        const up = f.pad.held('up');
        const dir = up ? { x: 0.6 * f.facing, y: -0.8 } : { x: f.facing, y: 0 };
        const hitId = newHitId();
        SFX.swing();
        f.startAction({ dur: 90, arm: 'punch', move: 0, v: { len: 0, state: 'out', dir, caught: null, anchor: null },
          origin(f) { return { x: f.x + f.facing * 6, y: f.y - f.h * 0.6 }; },
          update(f, g) {
            const v = this.v, o = this.origin(f);
            this.noGrav = v.state === 'zip';
            if (v.state === 'out') {
              v.len += 9;
              if (v.len >= 115) v.state = 'back';
              const tx = o.x + v.dir.x * v.len, ty = o.y + v.dir.y * v.len;
              v.tip = { x: tx, y: ty };
              const tr = { x: tx - 4, y: ty - 4, w: 8, h: 8 };
              if (g.hitbox(f, tr, { dmg: 5, kb: 0, scale: 0, flinch: 30, onHit: (vic) => { v.caught = vic; } }, hitId, f.x, f.cy)) { v.state = 'pull'; SFX.thorn(); }
              else if (up || !f.grounded) {
                for (const s of STAGE.solids.concat(STAGE.plats)) {
                  if (tx >= s.x - 2 && tx <= s.x + s.w + 2 && ty >= s.y - 3 && ty <= s.y + Math.max(s.h, 6)) {
                    v.state = 'zip'; v.anchor = { x: tx, y: s.y }; SFX.thorn(); break;
                  }
                }
              }
            } else if (v.state === 'back') {
              v.len -= 14;
              v.tip = { x: o.x + v.dir.x * v.len, y: o.y + v.dir.y * v.len };
              if (v.len <= 0) f.action = null;
            } else if (v.state === 'pull') {
              const c = v.caught;
              if (!c || c.dead) { v.state = 'back'; return; }
              const dx = f.x + f.facing * 16 - c.x, dy = f.y - c.y, d = Math.hypot(dx, dy);
              v.tip = { x: c.x, y: c.cy };
              v.len = Math.hypot(c.x - o.x, c.cy - o.y);
              v.dir = { x: (c.x - o.x) / (v.len || 1), y: (c.cy - o.y) / (v.len || 1) };
              if (d < 8 || this.t > 60) { c.vx *= 0.2; c.vy = -1; c.hitstun = Math.max(c.hitstun, 8); v.state = 'back'; return; }
              const sp = Math.min(7, d * 0.3);
              c.vx = (dx / d) * sp; c.vy = (dy / d) * sp - 0.4;
            } else if (v.state === 'zip') {
              const dx = v.anchor.x - f.x, dy = v.anchor.y - f.y, d = Math.hypot(dx, dy);
              v.tip = { x: v.anchor.x, y: v.anchor.y };
              v.len = Math.hypot(v.anchor.x - o.x, v.anchor.y - o.y);
              v.dir = { x: (v.anchor.x - o.x) / (v.len || 1), y: (v.anchor.y - o.y) / (v.len || 1) };
              if (d < 10 || this.t > 60) { f.vy = -4; f.vx = f.facing * 1.5; f.jumps = Math.max(f.jumps, 1); f.action = null; return; }
              f.vx = (dx / d) * 7; f.vy = (dy / d) * 7;
            }
          },
          draw(ctx, f) {
            const v = this.v;
            if (!v.tip) return;
            const o = this.origin(f);
            pline(ctx, o.x, o.y, v.tip.x, v.tip.y, '#1c1209', 3);
            pline(ctx, o.x, o.y, v.tip.x, v.tip.y, '#5fbf3a', 1);
            const n = Math.floor(v.len / 8);
            for (let i = 1; i < n; i++) {
              const u = i / n, lx = lerp(o.x, v.tip.x, u), ly = lerp(o.y, v.tip.y, u);
              ctx.fillStyle = '#b4f25e'; ctx.fillRect(Math.round(lx), Math.round(ly) + (i % 2 ? -2 : 1), 2, 1);
            }
            ctx.fillStyle = '#1c1209'; ctx.fillRect(Math.round(v.tip.x) - 2, Math.round(v.tip.y) - 2, 5, 5);
            ctx.fillStyle = '#ff7ab8'; ctx.fillRect(Math.round(v.tip.x) - 1, Math.round(v.tip.y) - 1, 3, 3);
          },
        });
      } },
    { name: 'THORN SEED', desc: 'PLANTS A HIDDEN THORN TRAP (MAX 2)', cd: 90,
      use(f, g) {
        f.startAction({ dur: 16, arm: 'cast', move: 0.3, update(f, g, t) {
          if (t !== 5) return;
          const h = handPos(f);
          SFX.swing();
          g.add(new Proj({
            x: h.x, y: h.y, vx: 3 * f.facing + f.vx * 0.5, vy: -2.6, grav: 0.22, w: 4, h: 4, life: 140, owner: f, landable: true,
            spec: { dmg: 4, kb: 1.5, scale: 0.3, angle: 45, dirX: f.facing },
            onKill(p, g, why, s, py) {
              let y = null;
              if (why === 'land') y = s.y;
              else if (why === 'wall' && py + p.h / 2 <= s.y + 6) y = s.y;
              if (y === null) { g.fx.burst(p.x, p.y, 6, ['#5fbf3a', '#7d5432'], 1.5); return; }
              const mine = g.entities.filter((e) => e instanceof ThornPatch && e.owner === p.owner && !e.dead);
              if (mine.length >= 2) mine[0].dead = true;
              g.add(new ThornPatch({ x: p.x, y, owner: p.owner }));
              SFX.thorn();
            },
            render(ctx, p) {
              const x = Math.round(p.x), y = Math.round(p.y);
              ctx.fillStyle = '#1c1209'; ctx.fillRect(x - 2, y - 2, 5, 5);
              ctx.fillStyle = '#7d5432'; ctx.fillRect(x - 1, y - 1, 3, 3);
              ctx.fillStyle = '#b4f25e'; ctx.fillRect(x, y - 2, 1, 1);
            },
          }));
        } });
      } },
  ],
  ult: { name: 'WILDGROWTH', desc: 'GIANT THORNS ERUPT ACROSS THE GROUND',
    use(f, g) {
      f.startAction({ dur: 40, arm: 'down', move: 0, update(f, g, t) {
        if (t !== 6) return;
        g.addShake(6);
        const spec = { dmg: 13, kb: 4.6, scale: 1.0, angle: 82 };
        const hitId = newHitId();
        for (let i = 0; i < 9; i++) for (const side of [-1, 1]) {
          const x = f.x + side * (12 + i * 19);
          const y = STAGE.groundBelow(x, f.y - 30, 60) ?? f.y;
          g.add(new ThornSpike({ x, y, delay: i * 3, owner: f, hitId, spec, ox: f.x, sfx: side > 0 && i % 3 === 0 }));
        }
      } });
    } },
  ai: { range: 26, skills: [[30, 110, 16], [40, 120, 30]], recover: 0, ultRange: 150 },
  look(k, p, B, F, D) {
    const pal = this.pal;
    F(k.headX - 1, k.headY - 1, k.hw + 2, 3, pal.c);                  // moss cap
    F(k.headX + 1, k.headY - 3, 1, 2, pal.c); F(k.headX + 2, k.headY - 4, 2, 1, pal.d); // sprout
    F(k.headX + 5, k.headY - 2, 1, 1, pal.c); F(k.headX + 6, k.headY - 3, 2, 1, pal.d);
    F(k.torsoX - 1, k.torsoY, 3, 2, pal.c);                           // shoulder moss
    D(k.headX + 1, k.headY, 2, 1, pal.flower); D(k.headX + 1, k.headY - 1, 1, 1, '#ffffff');
    D(k.headX + k.hw - 6, k.headY + 3, 3, 1, pal.b);                  // heavy brow
    D(k.headX + k.hw - 5, k.headY + 4, 2, 1, pal.e);                  // glowing eyes
    D(k.headX + k.hw - 2, k.headY + 4, 1, 1, pal.e);
    D(k.headX + k.hw - 5, k.headY + 6, 4, 1, pal.b);
    D(k.torsoX + 2, k.torsoY + 2, 1, 3, pal.b); D(k.torsoX + 5, k.torsoY + 3, 1, 3, pal.b); // bark cracks
    D(k.torsoX + 3, k.torsoY + 5, 2, 1, pal.b);
    D(k.torsoX + 6, k.torsoY + 1, 2, 1, pal.d);
  },
};

// ======================================================================
// NYX — void trickster
// ======================================================================
const NYX = {
  id: 'nyx', name: 'NYX', title: 'VOID TRICKSTER', bars: { spd: 3, pwr: 3, wgt: 2 },
  pal: { o: '#09050f', a: '#4d1f80', b: '#2a0f4c', c: '#ff4fd8', d: '#d9b3ff', s: '#12081f', e: '#ff9cf0',
    head: '#4d1f80', hand: '#c9a6ff', ui: '#d36bff', fx1: '#ffffff', fx2: '#ff4fd8' },
  body: { headW: 8, headH: 7, torsoW: 6, torsoH: 7, legH: 5, legW: 2, armW: 2 },
  size: { w: 10, h: 19 }, visH: 21,
  stats: { run: 2.1, air: 2.1, accel: 0.5, airAccel: 0.3, fric: 0.4, jump: 6.0, djump: 5.6, grav: 0.29, fall: 4.8, ffall: 7.5, weight: 0.9, jumps: 1 },
  melee: stdMoves({ dmg: 6, kb: 2.0, scale: 0.5, s: 4, reach: 4, h: 19 }),
  attackName: 'VOID CLAW',
  skills: [
    { name: 'GRAVITY ORB', desc: 'SLOW ORB PULLS FOES, THEN BURSTS', cd: 100,
      use(f, g) {
        f.startAction({ dur: 16, arm: 'cast', move: 0.4, update(f, g, t) {
          if (t !== 5) return;
          const h = handPos(f);
          g.add(new GravOrb({ x: h.x + f.facing * 4, y: h.y, vx: 2.3 * f.facing, owner: f }));
          SFX.warp();
        } });
      } },
    { name: 'SHADOW STEP', desc: 'WARP BEHIND FOE. NEXT HIT x1.5', cd: 120,
      use(f, g) {
        const o = g.nearestFoe(f);
        const sx = f.x, sy = f.y, pose = f.pose();
        let ok = false;
        if (o && Math.hypot(o.x - f.x, o.y - f.y) < 170) {
          for (const side of [-o.facing, o.facing]) {
            const nx = o.x + side * 16, ny = o.y;
            if (!g.rectBlocked({ x: nx - f.w / 2, y: ny - f.h, w: f.w, h: f.h })) {
              f.x = nx; f.y = ny; f.facing = o.x > nx ? 1 : -1; ok = true; break;
            }
          }
        }
        if (!ok) {
          const d = dirFromPad(f.pad, f.facing);
          for (let i = 0; i < 18; i++) {
            const nx = f.x + d.x * 4, ny = f.y + d.y * 4;
            if (g.rectBlocked({ x: nx - f.w / 2, y: ny - f.h, w: f.w, h: f.h })) break;
            f.x = nx; f.y = ny;
          }
        }
        g.add(new Ghost({ def: f.def, x: sx, y: sy, facing: f.facing, pose, color: '#ff4fd8', life: 18 }));
        g.fx.burst(sx, sy - 9, 14, ['#4d1f80', '#ff4fd8', '#12081f'], 1.8);
        g.fx.burst(f.x, f.y - 9, 14, ['#4d1f80', '#ff4fd8', '#d9b3ff'], 1.8);
        f.vx = 0; f.vy = -1;
        f.empower = 75; f.invuln = Math.max(f.invuln, 8);
        f.startAction({ dur: 8, arm: 'cast', noGrav: true });
        SFX.warp();
      } },
  ],
  ult: { name: 'EVENT HORIZON', desc: 'BLACK HOLE DEVOURS, THEN DETONATES',
    use(f, g) {
      f.startAction({ dur: 24, arm: 'cast', move: 0, update(f, g, t) {
        if (t === 8) g.add(new BlackHole({ x: clamp(f.x + f.facing * 64, 24, W - 24), y: clamp(f.cy - 14, 24, 190), owner: f }));
      } });
    } },
  ai: { range: 24, skills: [[40, 140, 30], [60, 170, 60]], recover: 1, ultRange: 110 },
  look(k, p, B, F, D) {
    const pal = this.pal, t = p.t;
    B(k.headX - 2, k.headY + 2, 3, 4, pal.a); B(k.headX - 3, k.headY + 4, 2, 3, pal.a); // hood tail
    F(k.headX + 1, k.headY - 1, k.hw - 3, 1, pal.a);                  // hood peak
    F(k.torsoX - 1, k.torsoY + k.th - 1, k.tw + 2, k.legH - 2, pal.a); // cloak
    for (let i = 0; i < k.tw + 2; i += 2) {
      const len = 1 + (((i >> 1) + (t >> 3)) % 3 === 0 ? 1 : 0);
      F(k.torsoX - 1 + i, k.torsoY + k.th + k.legH - 3, 1, len, pal.b);
    }
    const ang = t * 0.08, ox = Math.round(Math.cos(ang) * 10), oy = Math.round(Math.sin(ang) * 3) - 13;
    if (Math.sin(ang) < 0) B(ox, oy, 1, 1, pal.c);                     // orbiting void mote
    else F(ox, oy, 1, 1, pal.c);
    D(k.headX + 3, k.headY + 2, k.hw - 3, k.hh - 3, pal.s);           // void face
    if (t % 140 > 4) { D(k.headX + k.hw - 4, k.headY + 4, 1, 1, pal.e); D(k.headX + k.hw - 2, k.headY + 4, 1, 1, pal.e); }
    D(k.torsoX, k.torsoY, k.tw, 1, pal.c);                            // collar trim
    D(k.torsoX + 2, k.torsoY + 3, 2, 2, pal.c);                       // sigil
  },
};

const CHARS = [BLAZE, VOLT, FROSTA, BRAMBLE, NYX];
