'use strict';
// ---------------------------------------------------------------------------
// particles.js — one flat pool, no allocation during play.
//
// Particles carry their own light budget: a handful of them (sparks, embers,
// magic motes) register a point light, capped per frame so a big explosion
// cannot drown the light pass.
// ---------------------------------------------------------------------------
(function (F) {

  const MAX = 2600;

  const P = F.Particles = {
    n: 0,
    lightBudget: 26,

    init() {
      this.x = new Float32Array(MAX); this.y = new Float32Array(MAX);
      this.vx = new Float32Array(MAX); this.vy = new Float32Array(MAX);
      this.life = new Float32Array(MAX); this.max = new Float32Array(MAX);
      this.sz = new Float32Array(MAX); this.sz1 = new Float32Array(MAX);
      this.rot = new Float32Array(MAX); this.vr = new Float32Array(MAX);
      this.drag = new Float32Array(MAX); this.grav = new Float32Array(MAX);
      this.r0 = new Float32Array(MAX); this.g0 = new Float32Array(MAX); this.b0 = new Float32Array(MAX);
      this.r1 = new Float32Array(MAX); this.g1 = new Float32Array(MAX); this.b1 = new Float32Array(MAX);
      this.emis = new Float32Array(MAX); this.a0 = new Float32Array(MAX);
      this.spr = new Uint8Array(MAX); this.lit = new Float32Array(MAX);
      this.z = new Float32Array(MAX);
      this.n = 0;
      return this;
    },

    clear() { this.n = 0; },

    /**
     * spawn(opt) — all fields optional.
     *  x,y  vx,vy  life  size,size1  col,col1  emis  drag  grav  sprite  light  rot,vr  z
     */
    spawn(o) {
      const i = this.n < MAX ? this.n++ : (Math.random() * MAX) | 0;
      this.x[i] = o.x; this.y[i] = o.y;
      this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0;
      const l = o.life === undefined ? 0.6 : o.life;
      this.life[i] = l; this.max[i] = l;
      this.sz[i] = o.size === undefined ? 3 : o.size;
      this.sz1[i] = o.size1 === undefined ? 0 : o.size1;
      this.rot[i] = o.rot || 0; this.vr[i] = o.vr || 0;
      this.drag[i] = o.drag === undefined ? 2.4 : o.drag;
      this.grav[i] = o.grav === undefined ? 0 : o.grav;
      const c0 = F.Col.parse(o.col || '#ffffff');
      const c1 = F.Col.parse(o.col1 || o.col || '#ffffff');
      this.r0[i] = c0[0]; this.g0[i] = c0[1]; this.b0[i] = c0[2];
      this.r1[i] = c1[0]; this.g1[i] = c1[1]; this.b1[i] = c1[2];
      this.emis[i] = o.emis === undefined ? 1.6 : o.emis;
      this.a0[i] = o.alpha === undefined ? 1 : o.alpha;
      this.spr[i] = SPR_ID[o.sprite || 'spark'] || 0;
      this.lit[i] = o.light || 0;
      this.z[i] = o.z === undefined ? 6 : o.z;
      return i;
    },

    /** Convenience emitters used all over the game. */
    burst(x, y, n, o) {
      for (let i = 0; i < n; i++) {
        const a = o.dir === undefined ? Math.random() * 6.2832 : o.dir + (Math.random() - 0.5) * (o.spread || 6.2832);
        const sp = F.U.rnd(o.speed0 === undefined ? 20 : o.speed0, o.speed1 === undefined ? 90 : o.speed1);
        this.spawn(Object.assign({}, o, {
          x: x + (Math.random() - 0.5) * (o.jitter || 0), y: y + (Math.random() - 0.5) * (o.jitter || 0),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: F.U.rnd((o.life || 0.6) * 0.6, (o.life || 0.6) * 1.25),
          size: F.U.rnd((o.size || 3) * 0.7, (o.size || 3) * 1.3),
          rot: Math.random() * 6.28, vr: F.U.rnd(-6, 6),
        }));
      }
    },

    update(dt, lv) {
      const n = this.n;
      for (let i = 0; i < n; i++) {
        let l = this.life[i] - dt;
        if (l <= 0) {
          // swap-remove keeps the array dense with no allocation
          const j = --this.n;
          if (i !== j) copy(this, j, i);
          this.n = j; i--; continue;
        }
        this.life[i] = l;
        const d = Math.exp(-this.drag[i] * dt);
        this.vx[i] *= d; this.vy[i] *= d;
        this.vy[i] += this.grav[i] * dt;
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        this.rot[i] += this.vr[i] * dt;
      }
    },

    draw(cam, time) {
      const A = F.Art, Bt = F.Batch;
      let lights = 0;
      const frames = SPR_FRAMES || (buildFrames());
      for (let i = 0; i < this.n; i++) {
        const x = this.x[i], y = this.y[i];
        if (x < cam.x - 40 || x > cam.x + cam.vw + 40 || y < cam.y - 40 || y > cam.y + cam.vh + 40) continue;
        const t = 1 - this.life[i] / this.max[i];
        const size = F.U.lerp(this.sz[i], this.sz1[i], t);
        if (size <= 0.05) continue;
        const r = F.U.lerp(this.r0[i], this.r1[i], t);
        const g = F.U.lerp(this.g0[i], this.g1[i], t);
        const b = F.U.lerp(this.b0[i], this.b1[i], t);
        const a = this.a0[i] * (1 - t * t);
        const f = frames[this.spr[i]];
        Bt.push(f, x, y, {
          scale: size / f.w * 2, rot: this.rot[i],
          tint: ((Math.round(a * 255) & 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0,
          emis: this.emis[i], height: 0,
        });
        if (this.lit[i] > 0 && lights < this.lightBudget) {
          lights++;
          F.Render.light({ x, y, r: this.lit[i] * (1 - t * 0.6), col: [r / 255, g / 255, b / 255],
            intensity: 1.4 * a, z: this.z[i], shadow: 0, spec: 0.3 });
        }
      }
    },
  };

  function copy(p, from, to) {
    for (const k of ['x', 'y', 'vx', 'vy', 'life', 'max', 'sz', 'sz1', 'rot', 'vr', 'drag', 'grav',
      'r0', 'g0', 'b0', 'r1', 'g1', 'b1', 'emis', 'a0', 'spr', 'lit', 'z']) p[k][to] = p[k][from];
  }

  const SPR_NAMES = ['spark', 'blob', 'dust', 'smoke', 'shard', 'px', 'streak', 'ring', 'ore_drop'];
  const SPR_ID = {};
  SPR_NAMES.forEach((n, i) => SPR_ID[n] = i);
  let SPR_FRAMES = null;
  function buildFrames() {
    SPR_FRAMES = SPR_NAMES.map(n => F.Art.has(n) ? F.Art.get(n) : F.Art.get('spark'));
    return SPR_FRAMES;
  }
  F.Particles.rebuildFrames = buildFrames;

})(window.F2 = window.F2 || {});
