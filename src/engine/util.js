'use strict';
// ---------------------------------------------------------------------------
// util.js — maths, seeded RNG, colour helpers, easing, timing.
// ---------------------------------------------------------------------------
(function (F) {

  /** mulberry32 — small, fast, good enough, and reproducible. */
  F.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const U = F.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    sat: v => (v < 0 ? 0 : v > 1 ? 1 : v),
    lerp: (a, b, t) => a + (b - a) * t,
    /** Frame-rate independent exponential approach. */
    damp: (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt)),
    inv: (v, a, b) => (b === a ? 0 : (v - a) / (b - a)),
    map: (v, a, b, c, d) => c + (d - c) * U.sat((v - a) / (b - a || 1)),
    dist: (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0),
    dist2: (x0, y0, x1, y1) => (x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0),
    rnd: (a, b) => a + Math.random() * (b - a),
    ri: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: a => a[Math.floor(Math.random() * a.length)],
    chance: p => Math.random() < p,
    shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
    wpick(entries) {
      let t = 0; for (const e of entries) t += e[1];
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
    angLerp(a, b, t) { return a + U.angDiff(b, a) * t; },
    fmt(n) { return Math.floor(n).toLocaleString('en-US'); },
    // easing
    ease: {
      inQuad: t => t * t,
      outQuad: t => 1 - (1 - t) * (1 - t),
      inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
      outCubic: t => 1 - Math.pow(1 - t, 3),
      outBack: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
      outElastic: t => (t === 0 || t === 1) ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
      inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
    },
  };

  // ------------------------------------------------------------------ colour
  const C = F.Col = {
    parse(c) {
      if (Array.isArray(c)) return c;
      const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    hex(r, g, b) {
      const q = v => U.clamp(Math.round(v), 0, 255);
      return '#' + ((1 << 24) | (q(r) << 16) | (q(g) << 8) | q(b)).toString(16).slice(1);
    },
    shade(c, f) { const p = C.parse(c); return C.hex(p[0] * f, p[1] * f, p[2] * f); },
    mix(a, b, t) {
      const x = C.parse(a), y = C.parse(b);
      return C.hex(U.lerp(x[0], y[0], t), U.lerp(x[1], y[1], t), U.lerp(x[2], y[2], t));
    },
    /** Shift a colour toward a hue without washing it out. */
    warm(c, t) { return C.mix(c, '#ff9a3c', t); },
    cool(c, t) { return C.mix(c, '#4a7cff', t); },
    /** Pack '#rrggbb' + alpha into the ABGR uint the batcher wants. */
    tint(c, a) {
      const p = C.parse(c);
      const A = Math.round((a === undefined ? 1 : a) * 255);
      return ((A & 255) << 24 | (p[2] & 255) << 16 | (p[1] & 255) << 8 | (p[0] & 255)) >>> 0;
    },
    /** Linear 0..1 triple for light colours. */
    lin(c, scale) {
      const p = C.parse(c), s = (scale === undefined ? 1 : scale) / 255;
      return [p[0] * s, p[1] * s, p[2] * s];
    },
    hsl(h, s, l) {
      h = ((h % 1) + 1) % 1;
      const f = n => {
        const k = (n + h * 12) % 12;
        const a = s * Math.min(l, 1 - l);
        return l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
      };
      return C.hex(f(0) * 255, f(8) * 255, f(4) * 255);
    },
  };
  F.WHITE = 0xffffffff;

  // 2D value noise, seeded — used for terrain, clouds, shimmer.
  F.noise2 = function (seed) {
    const r = F.rng(seed), perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const grad = (h, x, y) => {
      switch (h & 3) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; }
    };
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    function n2(x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y);
      const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
      const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
      return U.lerp(U.lerp(grad(aa, x, y), grad(ba, x - 1, y), u),
                    U.lerp(grad(ab, x, y - 1), grad(bb, x - 1, y - 1), u), v) * 0.7071;
    }
    n2.fbm = function (x, y, oct, gain) {
      let s = 0, amp = 1, f = 1, norm = 0;
      for (let i = 0; i < (oct || 4); i++) { s += n2(x * f, y * f) * amp; norm += amp; amp *= (gain || 0.5); f *= 2; }
      return s / norm;
    };
    return n2;
  };

})(window.F2 = window.F2 || {});
