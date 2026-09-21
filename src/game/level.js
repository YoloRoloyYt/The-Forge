'use strict';
// ---------------------------------------------------------------------------
// level.js — map data, generation and the terrain draw pass.
//
// Mines keep The Forge 1's footprint exactly: a 64 x 52 cellular-automata
// cavern, entrance in the north-west, shaft at the far end. What changed is
// everything inside it — ore is rolled fresh every descent, nothing is fixed.
// ---------------------------------------------------------------------------
(function (F) {

  const TS = F.TS;
  const SHORE_H = 14;
  const T = F.T = { VOID: 0, FLOOR: 1, WALL: 2, LIQUID: 3, FLOORLIT: 4, RAIL: 5, BUILD: 6, WOOD: 7 };
  F.MINE_W = 64; F.MINE_H = 52;          // unchanged from The Forge 1

  class Level {
    constructor(w, h, biome, depth) {
      this.w = w; this.h = h; this.biome = biome; this.depth = depth;
      this.B = F.BIOMES[biome];
      this.tiles = new Uint8Array(w * h);
      // variant byte: bits 0-2 sprite index, bit 3 flipX, bit 4 flipY
      this.variant = new Uint8Array(w * h);
      // per-tile brightness from low-frequency noise: the single most effective
      // trick against a visible 32px grid
      this.shade = new Uint8Array(w * h);
      this.nodes = []; this.enemies = []; this.props = []; this.lights = [];
      this.npcs = []; this.chests = []; this.decals = []; this.portals = [];
      this.spawn = { x: 0, y: 0 };
      this.exits = [];
      this.secret = null;
      this.name = this.B ? this.B.name : biome;
    }
    idx(x, y) { return y * this.w + x; }
    t(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? T.WALL : this.tiles[y * this.w + x]; }
    set(x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = v; }
    solid(x, y) {
      const v = this.t(x, y);
      if (v === T.LIQUID) return !!this.solidLiquid;   // hub lava is scenery, mine lava is a hazard
      return v === T.WALL || v === T.VOID || v === T.BUILD;
    }
    solidPx(px, py) { return this.solid(Math.floor(px / TS), Math.floor(py / TS)); }
    liquidAt(px, py) { return this.t(Math.floor(px / TS), Math.floor(py / TS)) === T.LIQUID; }
    /** Occlusion map for the shadow ray-march. */
    occlusion() {
      const o = new Uint8Array(this.w * this.h);
      for (let i = 0; i < o.length; i++) o[i] = (this.tiles[i] === T.WALL || this.tiles[i] === T.BUILD) ? 255 : 0;
      return o;
    }
    /**
     * Scatter large ground features over the floor. A floor built from tiles
     * alone only ever has detail at tile scale, which is why a big room reads
     * as noise; these are the shapes that cross tile boundaries.
     */
    placeGround(seed) {
      const B = this.B;
      if (!B || B.paved) return;
      const r = F.rng((seed || 771) ^ 0x2f13);
      const taken = [];
      const room = (x, y, w, h) => {
        for (const q of taken) if (Math.abs(q.x - x) < w && Math.abs(q.y - y) < h) return false;
        taken.push({ x, y }); return true;
      };
      // clear enough floor around the middle of the feature that it is not
      // half-buried in a wall
      const open = (tx, ty, rad) => {
        for (let j = -rad; j <= rad; j++) for (let i = -rad; i <= rad; i++)
          if (this.t(tx + i, ty + j) !== T.FLOOR) return false;
        return true;
      };
      const kinds = [
        // damp and mineral staining darkens the floor; a lightening wash reads
        // as mould spots, which is exactly what it looked like the first time
        { key: 'gr_wash',    p: 0.026, rad: 2, w: 120, h: 92, sc: [1.1, 2.1], a: [0.32, 0.6],
          col: () => F.Col.mix(B.floor[2], r() < 0.5 ? B.crack : (B.accent2 || B.crack), 0.35) },
        { key: 'gr_slab',    p: 0.020, rad: 2, w: 92,  h: 70, sc: [0.75, 1.3], a: [0.7, 1.0],
          col: () => B.floor[3] },
        { key: 'gr_scree',   p: 0.034, rad: 1, w: 74,  h: 56, sc: [0.6, 1.15], a: [0.8, 1.0],
          col: () => B.grit[(r() * B.grit.length) | 0] },
        { key: 'gr_fissure', p: 0.016, rad: 2, w: 104, h: 80, sc: [0.7, 1.25], a: [0.6, 0.9],
          col: () => F.Col.mix(B.crack, B.floor[0], 0.25) },
      ];
      for (const K of kinds) {
        for (let y = 2; y < this.h - 2; y++) {
          for (let x = 2; x < this.w - 2; x++) {
            if (this.tiles[y * this.w + x] !== T.FLOOR) continue;
            if (r() > K.p || !open(x, y, K.rad)) continue;
            const px = (x + 0.5) * TS + (r() - 0.5) * 16, py = (y + 0.5) * TS + (r() - 0.5) * 16;
            if (!room(px, py, K.w, K.h)) continue;
            this.decals.push({
              sprite: K.key + ((r() * 3) | 0), x: px, y: py, rot: r() * 6.2832,
              scale: K.sc[0] + r() * (K.sc[1] - K.sc[0]),
              alpha: K.a[0] + r() * (K.a[1] - K.a[0]),
              tint: F.Col.tint(K.col()),
            });
          }
        }
      }
    }

    /**
     * Scatter crust rafts over the pools. They go in as decals, so they are
     * placed in world space and break up the pool at a scale the tile art
     * cannot reach without giving the grid away.
     */
    placeRafts(seed) {
      if (!this.B || !this.B.liquid || this.B.liquid.emis < 0.45) return;
      const r = F.rng((seed || 991) ^ 0x5bd1);
      const taken = [];
      for (let y = 1; y < this.h - 1; y++) {
        for (let x = 1; x < this.w - 1; x++) {
          if (this.tiles[y * this.w + x] !== T.LIQUID) continue;
          // only well inside a pool: a raft hanging over the bank looks pasted on
          let n = 0;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++)
            if (this.t(x + i, y + j) === T.LIQUID) n++;
          if (n < 9 || r() > 0.16) continue;
          const px = (x + 0.5) * TS + (r() - 0.5) * 14, py = (y + 0.5) * TS + (r() - 0.5) * 12;
          let clash = false;
          for (const q of taken) if (Math.abs(q.x - px) < 74 && Math.abs(q.y - py) < 56) { clash = true; break; }
          if (clash) continue;
          taken.push({ x: px, y: py });
          this.decals.push({
            sprite: this.biome + '_raft' + ((r() * 3) | 0), x: px, y: py,
            rot: r() * 6.2832, alpha: 1, scale: 0.55 + r() * 0.5,
          });
        }
      }
    }

    rollVariants(seed) {
      const r = F.rng(seed || 12345);
      const n = F.noise2(seed || 12345);
      const paved = !!(this.B && this.B.paved);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        // A paved floor's variants are not a free choice: each one is a cell of
        // a 4x2-tile flagstone block, so the courses have to line up with their
        // neighbours. Flips would break them.
        this.variant[i] = paved ? ((x & 3) | ((y & 1) << 2))
          : ((r() * 8) | 0) | (r() < 0.5 ? 8 : 0) | (r() < 0.5 ? 16 : 0);
        // one slow octave only: anything faster than ~1/20 tiles turns the
        // tint map itself into a visible checkerboard
        const v = n.fbm(x * 0.052, y * 0.052, 3, 0.55);
        this.shade[i] = Math.round(F.U.clamp(1.0 + v * 0.05, 0.94, 1.06) * 200);
      }
    }
  }
  F.Level = Level;

  // ---------------------------------------------------------- collision help
  F.blocked = function (lv, x, y, r) {
    const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS);
    const y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (lv.solid(tx, ty)) return true;
    for (let i = 0; i < lv.nodes.length; i++) {
      const n = lv.nodes[i];
      if (!n.alive) continue;
      const dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy < (r + n.r) * (r + n.r)) return true;
    }
    for (let i = 0; i < lv.props.length; i++) {
      const p = lv.props[i];
      if (!p.solid) continue;
      const dx = p.x - x, dy = p.y - y;
      if (dx * dx + dy * dy < (r + p.r) * (r + p.r)) return true;
    }
    return false;
  };

  F.moveEnt = function (lv, e, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    const sx = dx / steps, sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx && !F.blocked(lv, e.x + sx, e.y, e.r)) e.x += sx;
      else if (sx) e.bumpX = true;
      if (sy && !F.blocked(lv, e.x, e.y + sy, e.r)) e.y += sy;
      else if (sy) e.bumpY = true;
    }
  };

  F.hasLOS = function (lv, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 10);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (lv.solid(Math.floor((x0 + (x1 - x0) * t) / TS), Math.floor((y0 + (y1 - y0) * t) / TS))) return false;
    }
    return true;
  };

  // ================================================================ rendering
  /**
   * Terrain pass. Floors, liquids, contact shadows and wall tops go down flat;
   * wall faces are handed to the caller's y-sorted list so entities can walk
   * in front of them.
   */
  F.drawTerrain = function (lv, cam, sorted, time) {
    const A = F.Art, Bt = F.Batch, id = lv.biome;
    const x0 = Math.max(0, Math.floor(cam.x / TS) - 1);
    const y0 = Math.max(0, Math.floor(cam.y / TS) - 2);
    const x1 = Math.min(lv.w - 1, Math.ceil((cam.x + cam.vw) / TS) + 1);
    const y1 = Math.min(lv.h - 1, Math.ceil((cam.y + cam.vh) / TS) + 2);
    // Every liquid tile used to advance on the same frame, so a lava pool blinked
    // instead of flowing. Phasing by world position turns the cycle into a wave
    // travelling across the pool.
    const liqT = lv.B.liquid ? time * 7 : 0;
    const topShade = lv.B.wallTop === undefined ? 0.4 : lv.B.wallTop;
    const shadeArr = lv.shade;
    // cache the 256 possible grey tints so the inner loop does no allocation
    if (!lv._tintCache) {
      lv._tintCache = new Uint32Array(256); lv._topTintCache = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        const g = i / 200;
        lv._tintCache[i] = F.Col.tint(F.Col.hex(g * 255, g * 255, g * 255));
        lv._topTintCache[i] = F.Col.tint(F.Col.hex(g * topShade * 255, g * topShade * 255, g * topShade * 255));
      }
    }
    const tintOf = lv._tintCache, topTintOf = lv._topTintCache;
    // per-zone shade caches, so a workshop's floor can carry its trade's colour
    const zone = lv.zone;
    if (zone && !lv._zoneCache) {
      lv._zoneCache = lv.zoneCol.map((col, zi) => {
        const cache = new Uint32Array(256);
        const p = F.Col.parse(col);
        for (let i = 0; i < 256; i++) {
          const g = i / 200;
          cache[i] = zi === 0 ? tintOf[i]
            : F.Col.tint(F.Col.hex(g * (p[0] * 0.80 + 60), g * (p[1] * 0.80 + 60), g * (p[2] * 0.80 + 60)));
        }
        return cache;
      });
    }
    const zoneCache = lv._zoneCache;

    // ---- pass 1: ground
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const ti = y * lv.w + x;
        const t = lv.tiles[ti];
        if (t === T.VOID) continue;
        const vb = lv.variant[ti], v = vb & 7;
        const fx = (vb & 8) !== 0, fy = (vb & 16) !== 0;
        const px = x * TS, py = y * TS;
        const sh = shadeArr[ti];
        // flipping a tile costs nothing and multiplies the variant count by four
        const ox = fx ? TS : 0, oy = fy ? TS : 0;
        if (t === T.LIQUID) {
          const fr = (((liqT + x * 0.8 + y * 1.7) | 0) % 6 + 6) % 6;
          Bt.push(A.get(id + '_liq' + fr), px, py, { ax: 0, ay: 0, height: 0.18 });
        } else if (t === T.WALL) {
          Bt.push(A.get(id + '_wall' + (v % 6)), px + ox, py + oy,
            { ax: 0, ay: 0, sx: fx ? -1 : 1, sy: fy ? -1 : 1, height: 1, tint: topTintOf[sh] });
        } else {
          const z = zone ? zone[ti] : 0;
          Bt.push(A.get(id + '_floor' + v), px + ox, py + oy,
            { ax: 0, ay: 0, sx: fx ? -1 : 1, sy: fy ? -1 : 1, height: 0.42,
              tint: z ? zoneCache[z][sh] : tintOf[sh] });
        }
      }
    }

    // ---- pass 1b: shoreline crust, hiding the straight cut where a pool ends
    if (lv.B.liquid) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (lv.tiles[y * lv.w + x] !== T.LIQUID) continue;
          const px = x * TS, py = y * TS, sv = ((x * 7 + y * 13) & 1);
          const bank = (nx, ny) => {
            const n = lv.t(nx, ny);
            return n !== T.LIQUID && n !== T.VOID && n !== T.WALL;
          };
          const o = { ax: 0, ay: 0, height: 0.3 };
          if (bank(x, y - 1)) Bt.push(A.get(id + '_shoren' + sv), px, py, o);
          if (bank(x, y + 1)) Bt.push(A.get(id + '_shores' + sv), px, py + TS - SHORE_H, o);
          if (bank(x - 1, y)) Bt.push(A.get(id + '_shorew' + sv), px, py, o);
          if (bank(x + 1, y)) Bt.push(A.get(id + '_shoree' + sv), px + TS - SHORE_H, py, o);
        }
      }
    }

    // ---- pass 2: contact shadows where the ground meets stone
    const aoN = A.get('ao_n'), aoS = A.get('ao_s'), aoE = A.get('ao_e'), aoW = A.get('ao_w');
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = lv.tiles[y * lv.w + x];
        if (t === T.WALL || t === T.VOID) continue;
        const px = x * TS, py = y * TS;
        if (lv.t(x, y - 1) === T.WALL) Bt.push(aoN, px, py, { ax: 0, ay: 0, height: 0 });
        if (lv.t(x, y + 1) === T.WALL) Bt.push(aoS, px, py + TS - 14, { ax: 0, ay: 0, height: 0 });
        if (lv.t(x - 1, y) === T.WALL) Bt.push(aoW, px, py, { ax: 0, ay: 0, height: 0 });
        if (lv.t(x + 1, y) === T.WALL) Bt.push(aoE, px + TS - 14, py, { ax: 0, ay: 0, height: 0 });
      }
    }

    // ---- pass 3: decals lie flat on the ground
    for (const d of lv.decals) {
      if (d.x < cam.x - 64 || d.x > cam.x + cam.vw + 64 || d.y < cam.y - 64 || d.y > cam.y + cam.vh + 64) continue;
      Bt.push(A.get(d.sprite), d.x, d.y, { rot: d.rot, alpha: d.alpha, tint: d.tint, scale: d.scale, height: 0.42 });
    }

    // ---- pass 4: wall faces join the sorted list
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (lv.tiles[y * lv.w + x] !== T.WALL) continue;
        if (lv.t(x, y + 1) === T.WALL || lv.t(x, y + 1) === T.VOID) continue;
        const ti = y * lv.w + x, vb = lv.variant[ti];
        sorted.push({ y: (y + 1) * TS + 0.5, face: true, sprite: id + '_face' + (vb & 7) % 6,
          x: x * TS, ty: (y + 1) * TS, flip: (vb & 8) !== 0, tint: lv._tintCache[shadeArr[ti]] });
      }
    }
  };

  /** Draw one entry produced by drawTerrain / entity collection. */
  F.drawSorted = function (list) {
    list.sort(cmpY);
    const A = F.Art, Bt = F.Batch;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.face) {
        Bt.push(A.get(e.sprite), e.x + (e.flip ? TS : 0), e.ty,
          { ax: 0, ay: F.FACE_H_ANCHOR, sx: e.flip ? -1 : 1, height: 0.9, tint: e.tint });
        continue;
      }
      if (e.draw) e.draw();
      else Bt.push(A.get(e.sprite), e.x, e.py !== undefined ? e.py : e.y, e.opt);
    }
  };
  F.FACE_H_ANCHOR = 42;
  function cmpY(a, b) { return a.y - b.y; }

})(window.F2 = window.F2 || {});
