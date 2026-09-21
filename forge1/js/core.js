'use strict';
// ---------------------------------------------------------------------------
// core.js — canvas, utilities, input, art loader, audio, save state
// ---------------------------------------------------------------------------
const VW = 480, VH = 270, TS = 16;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VW; canvas.height = VH;
ctx.imageSmoothingEnabled = false;

function fitCanvas() {
  const s = Math.min(innerWidth / VW, innerHeight / VH);
  const f = s >= 2 ? Math.floor(s) : s; // integer scaling when it fits
  canvas.style.width = Math.floor(VW * f) + 'px';
  canvas.style.height = Math.floor(VH * f) + 'px';
}
addEventListener('resize', fitCanvas);
fitCanvas();

const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  dist: (a, b, c, d) => Math.hypot(c - a, d - b),
  rnd: (a, b) => a + Math.random() * (b - a),
  ri: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: a => a[Math.floor(Math.random() * a.length)],
  // entries: [[value, weight], ...]
  wpick(entries) {
    let t = 0;
    for (const e of entries) t += e[1];
    let r = Math.random() * t;
    for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  },
  angDiff(a, b) {
    let d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  },
  // multiply hex colour channels: f<1 darker, f>1 lighter
  shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = U.clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
    const g = U.clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
    const b = U.clamp(Math.round((n & 255) * f), 0, 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  },
  mix(h1, h2, t) {
    const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    const c = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
    return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
  },
  fmt(n) { return Math.floor(n).toLocaleString('en-US'); },
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- input
const Input = {
  down: {}, pressed: {}, mx: 0, my: 0, touch: false, stick: { x: 0, y: 0 }, atkPressed: false,
  mdown: [false, false, false], mpressed: [false, false, false],
  init() {
    addEventListener('keydown', e => {
      if (!this.down[e.code]) this.pressed[e.code] = true;
      this.down[e.code] = true;
      Sfx.unlock();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.down[e.code] = false; });
    addEventListener('blur', () => { this.down = {}; this.mdown = [false, false, false]; });
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      this.mx = (e.clientX - r.left) * VW / r.width;
      this.my = (e.clientY - r.top) * VH / r.height;
    };
    canvas.addEventListener('mousemove', pos);
    canvas.addEventListener('mousedown', e => { pos(e); this.mdown[e.button] = true; this.mpressed[e.button] = true; Sfx.unlock(); });
    addEventListener('mouseup', e => { this.mdown[e.button] = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },
  endFrame() { this.pressed = {}; this.mpressed = [false, false, false]; this.atkPressed = false; },
  // Drop any press that has already been acted on this frame.
  consume() { this.pressed = {}; this.mpressed = [false, false, false]; this.atkPressed = false; },
  key(...codes) { return codes.some(c => this.down[c]); },
  hit(...codes) { return codes.some(c => this.pressed[c]); },
};

// ---------------------------------------------------------------- art
// Every sprite goes through Art.get(key,...). If the file assets/<key>.png exists it is
// used; otherwise the procedural placeholder function draws it. Drop art into /assets.
const Art = {
  ext: {}, gen: {},
  probe(keys) {
    return Promise.all(keys.map(k => new Promise(res => {
      const im = new Image();
      im.onload = () => { this.ext[k] = im; res(); };
      im.onerror = () => res();
      im.src = 'assets/' + k + '.png';
    })));
  },
  mk(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    fn(g, w, h);
    return c;
  },
  get(key, w, h, fn) {
    if (this.ext[key]) return this.ext[key];
    return this.gen[key] || (this.gen[key] = this.mk(w, h, fn));
  },
  // Same as get(), but traces a 1px dark outline around the finished sprite so it reads
  // against any background. Result is cached, so the per-pixel pass runs once.
  getOutlined(key, w, h, fn, col) {
    if (this.ext[key]) return this.ext[key];
    if (this.gen[key]) return this.gen[key];
    return (this.gen[key] = this.outline(this.mk(w, h, fn), col));
  },
  outline(src, col = '#0b0810') {
    const w = src.width + 2, h = src.height + 2;
    const out = this.mk(w, h, (g) => g.drawImage(src, 1, 1));
    const g = out.getContext('2d');
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const alpha = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y * w + x) * 4 + 3];
    const n = parseInt(col.slice(1), 16), cr = (n >> 16) & 255, cg = (n >> 8) & 255, cb = n & 255;
    const edges = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (alpha(x, y) > 8) continue;
      if (alpha(x - 1, y) > 128 || alpha(x + 1, y) > 128 || alpha(x, y - 1) > 128 || alpha(x, y + 1) > 128) edges.push((y * w + x) * 4);
    }
    for (const i of edges) { d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    return out;
  },
};

// ---------------------------------------------------------------- audio (tiny synth)
const Sfx = {
  a: null, vol: 0.25,
  unlock() {
    if (this.a) { if (this.a.state === 'suspended') this.a.resume(); return; }
    try { this.a = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.a = null; }
  },
  tone(f, d, type = 'square', v = 1, slide = 0) {
    if (!this.a) return;
    const t = this.a.currentTime, o = this.a.createOscillator(), g = this.a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(this.vol * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.a.destination);
    o.start(t); o.stop(t + d + 0.02);
  },
  noise(d, v = 1) {
    if (!this.a) return;
    const n = Math.floor(this.a.sampleRate * d), buf = this.a.createBuffer(1, n, this.a.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.a.createBufferSource(), g = this.a.createGain();
    s.buffer = buf; g.gain.value = this.vol * v;
    s.connect(g); g.connect(this.a.destination); s.start();
  },
  play(name) {
    switch (name) {
      case 'mine': this.tone(180 + Math.random() * 60, 0.07, 'square', 0.6, -80); this.noise(0.05, 0.4); break;
      case 'break': this.tone(120, 0.18, 'sawtooth', 0.8, -70); this.noise(0.15, 0.7); break;
      case 'swing': this.noise(0.08, 0.35); this.tone(300, 0.08, 'triangle', 0.3, -150); break;
      case 'hit': this.tone(150, 0.09, 'square', 0.8, -90); this.noise(0.06, 0.6); break;
      case 'hurt': this.tone(110, 0.2, 'sawtooth', 0.9, -60); break;
      case 'dash': this.noise(0.12, 0.3); break;
      case 'block': this.tone(500, 0.06, 'square', 0.6); this.tone(700, 0.05, 'square', 0.4); break;
      case 'coin': this.tone(880, 0.06, 'square', 0.5); setTimeout(() => this.tone(1320, 0.1, 'square', 0.5), 60); break;
      case 'ui': this.tone(660, 0.04, 'square', 0.35); break;
      case 'bad': this.tone(140, 0.15, 'square', 0.6); break;
      case 'perfect': this.tone(880, 0.08, 'square', 0.6); setTimeout(() => this.tone(1175, 0.12, 'square', 0.6), 70); break;
      case 'clang': this.tone(420, 0.12, 'square', 0.7, -30); this.noise(0.05, 0.5); break;
      case 'levelup': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 'square', 0.6), i * 90)); break;
      case 'boom': this.noise(0.4, 1); this.tone(70, 0.35, 'sawtooth', 1, -40); break;
      case 'steam': this.noise(0.6, 0.5); break;
      case 'fuse': this.tone(900, 0.05, 'square', 0.3); break;
    }
  },
};

// ---------------------------------------------------------------- game state / save
function newState() {
  return {
    v: 1, gold: 0, xp: 0, level: 1, essence: 0, runeFrags: 0,
    ores: { stone: 14, copper: 5 }, gems: {}, items: [], nextId: 1,
    equip: { weapon: null, head: null, chest: null, legs: null, boots: null },
    pickaxe: 0, lantern: 0, pickRune: null,
    potions: { heal: 2 }, buffs: {}, forgemBonus: 0, hotbar: ['heal', null, null, null, null],
    quests: [], questSeed: 1,
    stats: { forged: 0, perfect: 0, kills: 0, mined: 0, deaths: 0, bestFloor: 0, playTime: 0, master100: 0, secrets: 0, bossNoHit: 0, seen: {} },
    tutorial: { forge: false, mine: false },
    // Phase 3/4 additions
    spins: 5, race: 'human', pity: 0, ach: {}, bossKills: 0, forgeFrenzy: false,
    settings: { vol: 0.25, mute: false, shake: true },
  };
}
let S = newState();
const Save = {
  KEY: 'theforge_save_v1',
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(S)); } catch (e) { /* storage blocked */ } },
  load() { try { const s = localStorage.getItem(this.KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ } },
};

// ---------------------------------------------------------------- scene stack
const Game = {
  stack: [], shake: 0, time: 0, toasts: [],
  // Opening or closing a screen consumes the key/click that did it, so the screen underneath
  // (or the one just opened) cannot react to the same press later in the very same frame.
  push(s) { Input.consume(); this.stack.push(s); if (s.enter) s.enter(); },
  pop() { Input.consume(); const s = this.stack.pop(); if (s && s.exit) s.exit(); },
  replaceAll(s) { this.stack = []; this.push(s); },
  top() { return this.stack[this.stack.length - 1]; },
  toast(msg, col = '#ffffff') { this.toasts.push({ msg, col, t: 3 }); if (this.toasts.length > 5) this.toasts.shift(); },
};
