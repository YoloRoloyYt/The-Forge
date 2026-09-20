'use strict';
// ---------------------------------------------------------------------------
// art.js — the texture pipeline.
//
// Every sprite in the game is generated at load time by a function that paints
// into THREE layers at once:
//
//   albedo    RGBA  — base colour, alpha is the sprite's coverage
//   height    R=height  G=specular — relief, turned into normals by a Sobel pass
//   emissive  RGB   — light the sprite emits by itself
//
// The painter (`P`) draws the same shape into all three, so you write a rock
// once and get a lit, bumpy, correctly-shadowed rock out the other end.
// ---------------------------------------------------------------------------
(function (F) {

  const PAD = 2;

  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = false;
    return { c, g };
  }

  // ------------------------------------------------------------- the painter
  class Painter {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.A = mkCanvas(w, h); this.H = mkCanvas(w, h); this.E = mkCanvas(w, h); this.N = mkCanvas(w, h);
      this.a = this.A.g; this.hh = this.H.g; this.e = this.E.g; this.n = this.N.g;
      this._h = 0.5; this._s = 0.15; this._em = null; this._n = null;
      this.rng = F.rng(1);
    }
    /** Set the material used by subsequent shapes. h 0..1 relief, s 0..1 specular. */
    mat(h, s) { this._h = h; if (s !== undefined) this._s = s; return this; }
    /** Set the emissive colour (null = not emitting). */
    glow(col) { this._em = col; return this; }
    /**
     * Force the surface normal for subsequent shapes instead of deriving it
     * from the height field. nx/ny in -1..1 screen space (y is down).
     * Call nrm(null) to go back to height-derived normals.
     */
    nrm(nx, ny) {
      this._n = (nx === null || nx === undefined) ? null
        : 'rgb(' + Math.round((nx * 0.5 + 0.5) * 255) + ',' + Math.round((ny * 0.5 + 0.5) * 255) + ',0)';
      return this;
    }
    hs() { return 'rgb(' + Math.round(this._h * 255) + ',' + Math.round(this._s * 255) + ',0)'; }

    _begin(col) {
      this.a.fillStyle = col; this.a.strokeStyle = col;
      this.hh.fillStyle = this.hs(); this.hh.strokeStyle = this.hs();
      if (this._em) { this.e.fillStyle = this._em; this.e.strokeStyle = this._em; }
      if (this._n) { this.n.fillStyle = this._n; this.n.strokeStyle = this._n; }
    }
    _each(fn, col) {
      this._begin(col);
      fn(this.a); fn(this.hh);
      if (this._em) fn(this.e);
      if (this._n) fn(this.n);
    }
    rect(x, y, w, h, col) { this._each(g => g.fillRect(x, y, w, h), col); return this; }
    /** Rect that only writes albedo+emissive (keeps existing relief). */
    tint(x, y, w, h, col, alpha) {
      this.a.save(); this.a.globalAlpha = alpha === undefined ? 1 : alpha;
      this.a.fillStyle = col; this.a.fillRect(x, y, w, h); this.a.restore(); return this;
    }
    circle(cx, cy, r, col) { this._each(g => { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }, col); return this; }
    ellipse(cx, cy, rx, ry, col, rot) {
      this._each(g => { g.beginPath(); g.ellipse(cx, cy, rx, ry, rot || 0, 0, 7); g.fill(); }, col); return this;
    }
    poly(pts, col) {
      this._each(g => {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath(); g.fill();
      }, col); return this;
    }
    line(x0, y0, x1, y1, col, w) {
      this._each(g => { g.save(); g.lineWidth = w || 1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore(); }, col);
      return this;
    }
    rounded(x, y, w, h, r, col) {
      this._each(g => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }, col); return this;
    }
    /** A domed blob: albedo flat, height rises to `peak` at the centre. */
    dome(cx, cy, rx, ry, col, base, peak) {
      this.a.fillStyle = col;
      this.a.beginPath(); this.a.ellipse(cx, cy, rx, ry, 0, 0, 7); this.a.fill();
      if (this._em) { this.e.fillStyle = this._em; this.e.beginPath(); this.e.ellipse(cx, cy, rx, ry, 0, 0, 7); this.e.fill(); }
      if (this._n) { this.n.fillStyle = this._n; this.n.beginPath(); this.n.ellipse(cx, cy, rx, ry, 0, 0, 7); this.n.fill(); }
      const g = this.hh;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      const c1 = Math.round((peak === undefined ? 0.95 : peak) * 255);
      const c0 = Math.round((base === undefined ? 0.25 : base) * 255);
      const s = Math.round(this._s * 255);
      grad.addColorStop(0, 'rgb(' + c1 + ',' + s + ',0)');
      grad.addColorStop(1, 'rgb(' + c0 + ',' + s + ',0)');
      g.fillStyle = grad;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill();
      return this;
    }
    /** Linear height ramp inside a rect — for walls, blades, plates. */
    ramp(x, y, w, h, col, hFrom, hTo, vertical) {
      this.a.fillStyle = col; this.a.fillRect(x, y, w, h);
      if (this._em) { this.e.fillStyle = this._em; this.e.fillRect(x, y, w, h); }
      if (this._n) { this.n.fillStyle = this._n; this.n.fillRect(x, y, w, h); }
      const g = this.hh;
      const grad = vertical ? g.createLinearGradient(x, y, x, y + h) : g.createLinearGradient(x, y, x + w, y);
      const s = Math.round(this._s * 255);
      grad.addColorStop(0, 'rgb(' + Math.round(hFrom * 255) + ',' + s + ',0)');
      grad.addColorStop(1, 'rgb(' + Math.round(hTo * 255) + ',' + s + ',0)');
      g.fillStyle = grad; g.fillRect(x, y, w, h);
      return this;
    }
    /** Speckle a region with two colours — the workhorse for stone and dirt. */
    speckle(x, y, w, h, cols, n, hJit) {
      const r = this.rng;
      for (let i = 0; i < n; i++) {
        const px = x + Math.floor(r() * w), py = y + Math.floor(r() * h);
        const sw = 1 + Math.floor(r() * 2), sh = 1 + Math.floor(r() * 2);
        const oldH = this._h;
        if (hJit) this._h = Math.max(0, Math.min(1, oldH + (r() - 0.5) * hJit));
        this.rect(px, py, sw, sh, cols[Math.floor(r() * cols.length)]);
        this._h = oldH;
      }
      return this;
    }
    /** Cracks / veins: a wandering 1px line. */
    crack(x, y, len, col, dir, wob) {
      const r = this.rng;
      let cx = x, cy = y, ang = dir === undefined ? r() * 7 : dir;
      for (let i = 0; i < len; i++) {
        this.rect(Math.round(cx), Math.round(cy), 1, 1, col);
        ang += (r() - 0.5) * (wob === undefined ? 1.2 : wob);
        cx += Math.cos(ang); cy += Math.sin(ang);
        if (cx < 0 || cy < 0 || cx >= this.w || cy >= this.h) break;
      }
      return this;
    }
    /** Dark rim around everything painted so far — keeps sprites readable. */
    outline(col, alpha) {
      const w = this.w, h = this.h;
      const src = this.a.getImageData(0, 0, w, h);
      const d = src.data;
      const out = this.a.createImageData(w, h);
      const o = out.data;
      const rgb = parseHex(col === undefined ? '#0a0508' : col);
      const A = Math.round((alpha === undefined ? 1 : alpha) * 255);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] > 12) continue;
        let near = false;
        for (let k = 0; k < 4 && !near; k++) {
          const nx = x + [1, -1, 0, 0][k], ny = y + [0, 0, 1, -1][k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (d[(ny * w + nx) * 4 + 3] > 128) near = true;
        }
        if (near) { o[i] = rgb[0]; o[i + 1] = rgb[1]; o[i + 2] = rgb[2]; o[i + 3] = A; }
      }
      const tmp = mkCanvas(w, h);
      tmp.g.putImageData(out, 0, 0);
      this.a.globalCompositeOperation = 'destination-over';
      this.a.drawImage(tmp.c, 0, 0);
      this.a.globalCompositeOperation = 'source-over';
      // the rim sits slightly below the body so it reads as a lip
      this.hh.globalCompositeOperation = 'destination-over';
      this.hh.drawImage(tmp.c, 0, 0);
      this.hh.globalCompositeOperation = 'source-over';
      return this;
    }
    /** Multiply a soft top-down gradient over the albedo — cheap form shading. */
    formShade(strength) {
      const g = this.a, s = strength === undefined ? 0.35 : strength;
      g.save(); g.globalCompositeOperation = 'source-atop';
      const grad = g.createLinearGradient(0, 0, 0, this.h);
      grad.addColorStop(0, 'rgba(255,255,255,' + (s * 0.5) + ')');
      grad.addColorStop(0.45, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(0,0,0,' + s + ')');
      g.fillStyle = grad; g.fillRect(0, 0, this.w, this.h);
      g.restore(); return this;
    }
    seed(n) { this.rng = F.rng(n); return this; }
  }

  function parseHex(c) {
    if (c[0] !== '#') return [0, 0, 0];
    const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ------------------------------------------------------------------- atlas
  const Art = F.Art = {
    W: 2048, H: 2048,
    frames: {},              // key -> {u0,v0,u1,v1,w,h,ax,ay}
    _entries: [],
    _shelfX: 0, _shelfY: 0, _shelfH: 0,
    Painter,
    parseHex,

    reset() {
      this.frames = {}; this._entries = [];
      this._shelfX = PAD; this._shelfY = PAD; this._shelfH = 0;
      this.A = mkCanvas(this.W, this.H); this.Hc = mkCanvas(this.W, this.H);
      this.E = mkCanvas(this.W, this.H); this.Nc = mkCanvas(this.W, this.H);
      return this;
    },

    /**
     * define(key, w, h, draw, opts)
     *   draw(P, rng)  paints into the three layers of a w*h painter
     *   opts: { ax, ay (anchor, default centre), bump (normal strength, default 1),
     *           tile (wrap the normal sobel), outline }
     */
    define(key, w, h, draw, opts) {
      opts = opts || {};
      const p = new Painter(w, h);
      p.seed(opts.seed !== undefined ? opts.seed : hashStr(key));
      draw(p, p.rng);
      if (opts.outline !== false && opts.outline) p.outline(typeof opts.outline === 'string' ? opts.outline : undefined);
      this.place(key, p, opts);
      return this;
    },

    /** Place an already-painted Painter into the atlas. */
    place(key, p, opts) {
      opts = opts || {};
      const w = p.w, h = p.h;
      const aw = w + PAD * 2, ah = h + PAD * 2;
      if (this._shelfX + aw > this.W) { this._shelfX = PAD; this._shelfY += this._shelfH + PAD; this._shelfH = 0; }
      if (this._shelfY + ah > this.H) throw new Error('atlas full placing ' + key);
      const x = this._shelfX, y = this._shelfY;
      this._shelfX += aw; this._shelfH = Math.max(this._shelfH, ah);

      this.A.g.drawImage(p.A.c, x, y);
      this.Hc.g.drawImage(p.H.c, x, y);
      this.E.g.drawImage(p.E.c, x, y);
      this.Nc.g.drawImage(p.N.c, x, y);
      // edge padding so bilinear sampling never bleeds a neighbour in
      const pad = (g, src) => {
        g.drawImage(src, 0, 0, 1, h, x - PAD, y, PAD, h);
        g.drawImage(src, w - 1, 0, 1, h, x + w, y, PAD, h);
        g.drawImage(src, 0, 0, w, 1, x, y - PAD, w, PAD);
        g.drawImage(src, 0, h - 1, w, 1, x, y + h, w, PAD);
      };
      pad(this.A.g, p.A.c); pad(this.Hc.g, p.H.c); pad(this.E.g, p.E.c); pad(this.Nc.g, p.N.c);

      this._entries.push({ key, x, y, w, h, bump: opts.bump === undefined ? 1 : opts.bump, tile: !!opts.tile });
      this.frames[key] = {
        u0: x / this.W, v0: y / this.H, u1: (x + w) / this.W, v1: (y + h) / this.H,
        w, h,
        ax: opts.ax === undefined ? w / 2 : opts.ax,
        ay: opts.ay === undefined ? h / 2 : opts.ay,
        key,
      };
      return this.frames[key];
    },

    get(key) {
      const f = this.frames[key];
      if (!f) throw new Error('no such sprite: ' + key);
      return f;
    },
    has(key) { return !!this.frames[key]; },

    /**
     * Turn the height layer into a normal map and upload all three atlases.
     * Runs once after every sprite is defined.
     */
    build() {
      const W = this.W, H = this.H;
      const alb = this.A.g.getImageData(0, 0, W, H);
      const hs = this.Hc.g.getImageData(0, 0, W, H);
      const ems = this.E.g.getImageData(0, 0, W, H);
      const ovr = this.Nc.g.getImageData(0, 0, W, H);
      const nrm = this.A.g.createImageData(W, H);
      const hd = hs.data, nd = nrm.data, ad = alb.data, ed = ems.data, od = ovr.data;

      const heightAt = (x, y, e) => {
        let cx = x, cy = y;
        if (e.tile) {
          cx = e.x + ((x - e.x) % e.w + e.w) % e.w;
          cy = e.y + ((y - e.y) % e.h + e.h) % e.h;
        } else {
          cx = Math.max(e.x, Math.min(e.x + e.w - 1, x));
          cy = Math.max(e.y, Math.min(e.y + e.h - 1, y));
        }
        const i = (cy * W + cx) * 4;
        // outside the sprite the height is 0, which rounds the silhouette off
        return hd[i + 3] > 8 ? hd[i] / 255 : 0;
      };

      for (const e of this._entries) {
        const strength = 2.2 * e.bump;
        for (let y = e.y - PAD; y < e.y + e.h + PAD; y++) {
          for (let x = e.x - PAD; x < e.x + e.w + PAD; x++) {
            if (x < 0 || y < 0 || x >= W || y >= H) continue;
            const i = (y * W + x) * 4;
            const l = heightAt(x - 1, y, e), r = heightAt(x + 1, y, e);
            const u = heightAt(x, y - 1, e), d = heightAt(x, y + 1, e);
            const l2 = heightAt(x - 2, y, e), r2 = heightAt(x + 2, y, e);
            const u2 = heightAt(x, y - 2, e), d2 = heightAt(x, y + 2, e);
            let dx = (r - l) * 0.7 + (r2 - l2) * 0.3;
            let dy = (d - u) * 0.7 + (d2 - u2) * 0.3;
            let nx = -dx * strength, ny = -dy * strength, nz = 1;
            const len = Math.hypot(nx, ny, nz);
            if (od[i + 3] > 8) {                      // generator supplied the normal
              nd[i] = od[i]; nd[i + 1] = od[i + 1];
            } else {
              nd[i] = Math.round((nx / len * 0.5 + 0.5) * 255);
              nd[i + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
            }
            nd[i + 2] = hd[i + 3] > 8 ? hd[i] : 0;        // height
            nd[i + 3] = hd[i + 3] > 8 ? hd[i + 1] : 0;    // specular
          }
        }
      }
      // emissive of fully transparent pixels must be black, not stale colour
      for (let i = 0; i < ed.length; i += 4) {
        if (ed[i + 3] < 8) { ed[i] = 0; ed[i + 1] = 0; ed[i + 2] = 0; }
        else { const a = ed[i + 3] / 255; ed[i] *= a; ed[i + 1] *= a; ed[i + 2] *= a; }
        ed[i + 3] = 255;
      }
      // albedo must keep its own alpha (coverage), but premultiply is done in-shader
      const gl = F.GL.gl;
      const texAlb = F.GL.texture(W, H, { filter: gl.LINEAR, src: alb });
      const texNrm = F.GL.texture(W, H, { filter: gl.LINEAR, src: nrm });
      const texEms = F.GL.texture(W, H, { filter: gl.LINEAR, src: ems });
      this.tex = { alb: texAlb, nrm: texNrm, ems: texEms, w: W, h: H };
      F.Batch.setAtlas(this.tex);
      // keep the albedo sheet on the CPU so the UI can cut icons out of it
      this.sheet = this.A.c;
      this.Hc = this.E = this.Nc = null;
      return this.tex;
    },
  };

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  Art.hashStr = hashStr;

})(window.F2 = window.F2 || {});
