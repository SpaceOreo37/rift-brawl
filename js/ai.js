'use strict';
// Simple CPU opponent. Drives a virtual pad with the same interface as the keyboard.
class AIPad extends Pad {
  constructor() {
    super();
    this.h = new Set(); this.next = new Set();
    this.t = 0; this.snap = null; this.atkCD = 0; this.jumpCD = 0; this.skillCD = 30; this.wander = 0;
  }
  held(a) { return this.h.has(a); }
  press(a) { this.next.add(a); }
  tick(advance = true) {
    for (const a of ACTIONS) {
      if (this.next.has(a)) this.age[a] = 0;
      else if (advance && this.age[a] < 99) this.age[a]++;
    }
    this.next.clear();
  }

  think(me, g) {
    const h = this.h;
    h.clear();
    if (me.dead || g.locked) return;
    this.t++;
    if (this.atkCD > 0) this.atkCD--;
    if (this.jumpCD > 0) this.jumpCD--;
    if (this.skillCD > 0) this.skillCD--;
    const ai = me.def.ai;
    const L = STAGE.edgeL, R = STAGE.edgeR, top = STAGE.top;

    // ---- recovery: get back to the stage ----
    const offstage = me.x < L + 2 || me.x > R - 2 || me.y > top + 2;
    if (offstage && !me.grounded) {
      const toward = me.x < W / 2 ? 'right' : 'left';
      h.add(toward);
      if (me.y > top - 40) h.add('up');
      if (me.vy > 0.5 && me.jumps > 0 && this.jumpCD <= 0 && me.y > top - 50) { this.press('up'); this.jumpCD = 14; }
      else if (me.jumps === 0 && me.vy > 0 && me.y > top - 20 && ai.recover !== null && me.cds[ai.recover] <= 0) {
        h.add('up'); this.press('skill' + (ai.recover + 1));
      }
      return;
    }

    // Perception is refreshed every few frames (reaction delay).
    const foe = g.nearestFoe(me);
    if (this.t % 6 === 0 || !this.snap) this.snap = foe ? { x: foe.x, y: foe.y, vx: foe.vx, hurt: foe.hitstun > 0 } : null;
    const s = this.snap;
    if (!foe || !s) {
      if (Math.abs(me.x - W / 2) > 24) h.add(me.x < W / 2 ? 'right' : 'left');
      return;
    }
    const dx = s.x - me.x, dy = s.y - me.y, adx = Math.abs(dx);
    const face = dx > 0 ? 'right' : 'left';

    // movement
    if (this.wander > 0) { this.wander--; h.add(dx > 0 ? 'left' : 'right'); }
    else if (adx > ai.range) h.add(face);
    else if (Math.random() < 0.01) this.wander = randi(8, 20);
    if (me.grounded && ((me.x < L + 14 && h.has('left')) || (me.x > R - 14 && h.has('right')))) { h.delete('left'); h.delete('right'); }
    if (dy < -30 && adx < 70 && me.grounded && this.jumpCD <= 0 && Math.random() < 0.08) { this.press('up'); this.jumpCD = 30; }
    if (me.onPlat && dy > 30 && Math.random() < 0.05) this.press('down');
    if (Math.random() < 0.004 && this.jumpCD <= 0) { this.press('up'); this.jumpCD = 40; }

    if (me.action) return;
    // melee
    if (this.atkCD <= 0) {
      if (adx < 22 + (me.def.size.w > 11 ? 6 : 0) && Math.abs(dy) < 20 && Math.random() < 0.3) {
        h.add(face); this.press('attack'); this.atkCD = randi(14, 32);
      } else if (adx < 18 && dy < -16 && dy > -50 && Math.random() < 0.25) {
        h.add('up'); this.press('attack'); this.atkCD = 24;
      } else if (!me.grounded && adx < 14 && dy > 6 && dy < 40 && Math.random() < 0.25) {
        h.add('down'); this.press('attack'); this.atkCD = 24;
      }
    }
    // skills
    if (this.skillCD <= 0) {
      for (let i = 0; i < 2; i++) {
        const sk = ai.skills[i];
        if (me.cds[i] <= 0 && adx >= sk[0] && adx <= sk[1] && Math.abs(dy) < sk[2] && Math.random() < 0.06) {
          h.add(face); this.press('skill' + (i + 1)); this.skillCD = randi(20, 50); break;
        }
      }
    }
    if (me.meter >= 100 && adx < ai.ultRange && Math.random() < 0.04) this.press('ult');
  }
}
