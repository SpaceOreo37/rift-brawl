'use strict';
// Synthesized retro sound effects (WebAudio, no audio files).
const SFX = {
  ac: null, master: null, noiseBuf: null, muted: false,

  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ac.destination);
      const len = this.ac.sampleRate;
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ac = null; }
  },

  tone(f, dur, type = 'square', vol = 0.2, f2 = null, delay = 0) {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, vol = 0.2, freq = 1200, delay = 0, type = 'lowpass') {
    if (!this.ac || this.muted) return;
    const t = this.ac.currentTime + delay;
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = this.ac.createBiquadFilter();
    filt.type = type; filt.frequency.value = freq;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  },

  jump(m = 1) { this.tone(260 * m, 0.1, 'square', 0.07, 520 * m); },
  swing() { this.noise(0.06, 0.08, 3500, 0, 'highpass'); },
  hit(mag) {
    this.noise(0.08 + mag * 0.012, 0.22 + mag * 0.02, 1600);
    this.tone(220 - mag * 10, 0.1 + mag * 0.01, 'square', 0.14, 50);
    if (mag > 6) this.tone(110, 0.3, 'sine', 0.35, 30);
  },
  fire() { this.noise(0.25, 0.14, 700); this.tone(300, 0.15, 'sawtooth', 0.05, 120); },
  shoot() { this.tone(700, 0.1, 'sawtooth', 0.07, 200); },
  zap() { this.tone(1400, 0.14, 'sawtooth', 0.08, 180); this.noise(0.1, 0.1, 5000, 0, 'highpass'); },
  ice() { this.tone(1600, 0.09, 'triangle', 0.12, 900); this.tone(2100, 0.08, 'triangle', 0.08, 1400, 0.04); },
  warp() { this.tone(180, 0.18, 'sine', 0.16, 900); this.tone(90, 0.18, 'square', 0.04, 450); },
  thorn() { this.noise(0.12, 0.16, 900); this.tone(140, 0.12, 'square', 0.08, 70); },
  boom() { this.noise(0.5, 0.42, 420); this.tone(120, 0.5, 'sine', 0.38, 30); },
  ko() { this.noise(0.7, 0.45, 600); this.tone(500, 0.7, 'square', 0.18, 40); this.tone(90, 0.6, 'sine', 0.4, 25, 0.05); },
  ult() { this.tone(220, 0.45, 'sawtooth', 0.12, 880); this.tone(330, 0.45, 'square', 0.06, 1320, 0.05); },
  deny() { this.tone(110, 0.06, 'square', 0.05); },
  select() { this.tone(660, 0.05, 'square', 0.07); },
  confirm() { this.tone(520, 0.12, 'square', 0.09, 1040); },
  count() { this.tone(440, 0.15, 'square', 0.1); },
  go() { this.tone(660, 0.35, 'square', 0.12, 990); },
  game() { this.tone(330, 0.6, 'square', 0.12, 165); this.noise(0.6, 0.25, 800); },
};
