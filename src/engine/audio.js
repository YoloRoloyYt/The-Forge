'use strict';
// ---------------------------------------------------------------------------
// audio.js — every sound is synthesised. No files, no loading, and a hit on a
// magmite vein can be a different pitch from a hit on stone for free.
// ---------------------------------------------------------------------------
(function (F) {

  const S = F.Audio = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    volume: 0.7, musicVolume: 0.45, muted: false,
    _started: false,

    init() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return this;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      // a gentle limiter keeps a busy fight from clipping
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 24; comp.ratio.value = 6;
      comp.attack.value = 0.003; comp.release.value = 0.22;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.master);
      this._noise = makeNoise(this.ctx);
      return this;
    },
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      this._started = true;
    },
    setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; },
    setMusicVolume(v) { this.musicVolume = v; if (this.musicGain) this.musicGain.gain.value = v; },
    setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; },

    /** A single shaped oscillator voice. */
    tone(o) {
      if (!this.ctx || this.muted) return;
      const c = this.ctx, t = c.currentTime + (o.delay || 0);
      const osc = c.createOscillator();
      osc.type = o.type || 'sine';
      const f0 = o.freq || 440, f1 = o.freq1 === undefined ? f0 : o.freq1;
      osc.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + (o.dur || 0.2));
      const g = c.createGain();
      const vol = (o.vol === undefined ? 0.25 : o.vol);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.2));
      let node = osc;
      if (o.filter) {
        const f = c.createBiquadFilter();
        f.type = o.filter; f.frequency.value = o.cut || 900; f.Q.value = o.q || 1;
        node.connect(f); node = f;
      }
      node.connect(g); g.connect(o.bus || this.sfxGain);
      osc.start(t); osc.stop(t + (o.dur || 0.2) + 0.05);
    },

    /** Filtered noise — impacts, steps, wind, steam. */
    noise(o) {
      if (!this.ctx || this.muted) return;
      const c = this.ctx, t = c.currentTime + (o.delay || 0);
      const src = c.createBufferSource();
      src.buffer = this._noise; src.loop = true;
      const f = c.createBiquadFilter();
      f.type = o.filter || 'bandpass';
      f.frequency.setValueAtTime(o.cut || 1200, t);
      if (o.cut1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.cut1), t + (o.dur || 0.2));
      f.Q.value = o.q === undefined ? 1.2 : o.q;
      const g = c.createGain();
      const vol = o.vol === undefined ? 0.22 : o.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + (o.attack || 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.2));
      src.connect(f); f.connect(g); g.connect(o.bus || this.sfxGain);
      src.start(t); src.stop(t + (o.dur || 0.2) + 0.05);
    },

    // ------------------------------------------------------------- the kit
    pick(hard) {                      // pickaxe on stone
      this.noise({ cut: 2600, cut1: 500, dur: 0.11, vol: 0.16, q: 0.9 });
      this.tone({ type: 'triangle', freq: 210 + Math.random() * 60, freq1: 90, dur: 0.09, vol: 0.10 });
      if (hard) this.tone({ type: 'sine', freq: 70, freq1: 40, dur: 0.16, vol: 0.14 });
    },
    crack() {                         // a node finally breaks
      this.noise({ cut: 1800, cut1: 260, dur: 0.30, vol: 0.24, q: 0.6 });
      this.tone({ type: 'sine', freq: 130, freq1: 48, dur: 0.30, vol: 0.18 });
    },
    swing(size) {
      this.noise({ filter: 'bandpass', cut: 900 - size * 250, cut1: 2400, dur: 0.16 + size * 0.06, vol: 0.10, q: 0.7 });
    },
    hit(crit) {
      this.noise({ cut: 1500, cut1: 300, dur: 0.12, vol: crit ? 0.30 : 0.20, q: 0.8 });
      this.tone({ type: 'square', freq: crit ? 320 : 190, freq1: 60, dur: 0.10, vol: 0.10, filter: 'lowpass', cut: 1400 });
    },
    hurt() {
      this.tone({ type: 'sawtooth', freq: 240, freq1: 90, dur: 0.24, vol: 0.20, filter: 'lowpass', cut: 900 });
      this.noise({ cut: 700, cut1: 180, dur: 0.22, vol: 0.14 });
    },
    coin() {
      this.tone({ type: 'square', freq: 1180, dur: 0.06, vol: 0.09 });
      this.tone({ type: 'square', freq: 1580, dur: 0.10, vol: 0.08, delay: 0.05 });
    },
    ore() { this.tone({ type: 'triangle', freq: 620, freq1: 880, dur: 0.10, vol: 0.09 }); },
    ui() { this.tone({ type: 'square', freq: 520, dur: 0.045, vol: 0.06, filter: 'lowpass', cut: 2200 }); },
    uiBig() {
      this.tone({ type: 'triangle', freq: 330, freq1: 520, dur: 0.14, vol: 0.10 });
      this.tone({ type: 'triangle', freq: 660, dur: 0.10, vol: 0.06, delay: 0.05 });
    },
    error() { this.tone({ type: 'square', freq: 160, freq1: 110, dur: 0.16, vol: 0.10, filter: 'lowpass', cut: 900 }); },
    levelUp() {
      [523, 659, 784, 1047].forEach((f, i) =>
        this.tone({ type: 'triangle', freq: f, dur: 0.34, vol: 0.13, delay: i * 0.09 }));
    },
    forgeHit(quality) {
      this.noise({ cut: 3200, cut1: 700, dur: 0.16, vol: 0.22, q: 1.4 });
      this.tone({ type: 'triangle', freq: 300 + quality * 500, freq1: 160, dur: 0.24, vol: 0.14 });
      this.tone({ type: 'sine', freq: 90, freq1: 50, dur: 0.24, vol: 0.16 });
    },
    quench() {
      this.noise({ filter: 'lowpass', cut: 5200, cut1: 300, dur: 1.1, vol: 0.20, q: 0.4 });
    },
    bellows() { this.noise({ filter: 'lowpass', cut: 500, dur: 0.45, vol: 0.10 }); },
    pour() { this.noise({ filter: 'bandpass', cut: 380, cut1: 220, dur: 0.7, vol: 0.10, q: 0.5 }); },
    dash() { this.noise({ filter: 'highpass', cut: 900, cut1: 2600, dur: 0.18, vol: 0.10 }); },
    parry() {
      this.tone({ type: 'triangle', freq: 1400, freq1: 700, dur: 0.20, vol: 0.16 });
      this.noise({ cut: 4200, cut1: 1200, dur: 0.18, vol: 0.14, q: 2 });
    },
    boom() {
      this.noise({ filter: 'lowpass', cut: 900, cut1: 90, dur: 0.6, vol: 0.32 });
      this.tone({ type: 'sine', freq: 90, freq1: 30, dur: 0.55, vol: 0.24 });
    },
    boss() {
      this.tone({ type: 'sawtooth', freq: 70, freq1: 44, dur: 1.6, vol: 0.20, filter: 'lowpass', cut: 420 });
      this.tone({ type: 'sine', freq: 46, dur: 2.0, vol: 0.18 });
    },
    death() {
      [392, 330, 262, 196].forEach((f, i) =>
        this.tone({ type: 'triangle', freq: f, dur: 0.6, vol: 0.13, delay: i * 0.16, filter: 'lowpass', cut: 1200 }));
    },
    step(depth) {
      this.noise({ filter: 'bandpass', cut: 420 + Math.random() * 180, dur: 0.07, vol: 0.055, q: 1.4 });
    },
  };

  function makeNoise(c) {
    const len = c.sampleRate * 2;
    const b = c.createBuffer(1, len, c.sampleRate);
    const d = b.getChannelData(0);
    // brownish noise: less harsh than white, sits better under everything
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2 + w * 0.35;
    }
    return b;
  }

})(window.F2 = window.F2 || {});
