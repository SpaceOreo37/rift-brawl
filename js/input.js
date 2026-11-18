'use strict';
// Keyboard state + per-player "pads" (keyboard or AI share one interface).
const Keys = { down: new Set(), pressed: new Set() };
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Semicolon', 'Quote', 'Slash', 'Tab']);

addEventListener('keydown', (e) => {
  SFX.init();
  if (!Keys.down.has(e.code)) Keys.pressed.add(e.code);
  Keys.down.add(e.code);
  if (PREVENT.has(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => Keys.down.delete(e.code));
addEventListener('blur', () => Keys.down.clear());

const ACTIONS = ['up', 'down', 'left', 'right', 'attack', 'skill1', 'skill2', 'ult'];

// Player 1: left side of keyboard.  Player 2: right side (+ numpad alternates).
const BINDS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    attack: ['KeyF'], skill1: ['KeyG'], skill2: ['KeyH'], ult: ['KeyT'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    attack: ['KeyK', 'Numpad1'], skill1: ['KeyL', 'Numpad2'], skill2: ['Semicolon', 'Numpad3'], ult: ['KeyO', 'Numpad0'] },
];
// In VS CPU mode the human can use either key set.
const BINDS_ALL = {};
for (const a of ACTIONS) BINDS_ALL[a] = [...BINDS[0][a], ...BINDS[1][a]];

const KEYNAMES = [
  { up: 'W', down: 'S', left: 'A', right: 'D', attack: 'F', skill1: 'G', skill2: 'H', ult: 'T' },
  { up: '↑', down: '↓', left: '←', right: '→', attack: 'K', skill1: 'L', skill2: ';', ult: 'O' },
];

// Was a menu action pressed this frame by key set i?
const mp = (i, a) => BINDS[i][a].some((k) => Keys.pressed.has(k));
const anyConfirm = () => mp(0, 'attack') || mp(1, 'attack') || Keys.pressed.has('Enter') || Keys.pressed.has('Space');

class Pad {
  constructor() { this.age = {}; for (const a of ACTIONS) this.age[a] = 99; }
  buf(a, n = 6) { return this.age[a] <= n; }   // pressed within the last n frames (input buffer)
  consume(a) { this.age[a] = 99; }
}

class KeyPad extends Pad {
  constructor(binds) { super(); this.b = binds; }
  held(a) { return this.b[a].some((k) => Keys.down.has(k)); }
  tick(advance = true) {
    for (const a of ACTIONS) {
      if (this.b[a].some((k) => Keys.pressed.has(k))) this.age[a] = 0;
      else if (advance && this.age[a] < 99) this.age[a]++;
    }
  }
}
