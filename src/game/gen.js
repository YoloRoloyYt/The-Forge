'use strict';
// ---------------------------------------------------------------------------
// gen.js — mine generation.
//
// The cavern algorithm is deliberately unchanged from The Forge 1: a 64 x 52
// grid, 46% initial wall fill, four smoothing passes at the 5-neighbour rule,
// largest region kept, entrance north-west, shaft at the far point. The mines
// feel the same size and shape they always did.
//
// Everything placed INSIDE it is rolled fresh: which ore a node carries, where
// nodes sit, where the rich guarded clusters are, where the sealed cavern is.
// ---------------------------------------------------------------------------
(function (F) {

  const T = F.T, TS = F.TS;

  /** Weighted ore roll for a depth. boost raises the odds of rarer tiers. */
  F.rollOre = function (depth, boost, luck) {
    boost = boost || 0; luck = luck || 0;
    const bias = (F.DEPTHS[depth - 1] || F.DEPTHS[0]).oreBias;
    const entries = [];
    for (const id of F.ORE_IDS) {
      const o = F.ORES[id];
      if (depth < o.f[0] || depth > o.f[1]) continue;
      // deeper mines naturally favour their own rarer ore; boost and luck stack on top
      const rareLift = 1 + (boost * 1.6 + bias * 1.3 + luck) * o.tier * 0.85;
      entries.push([id, o.w * rareLift]);
    }
    if (!entries.length) return 'stone';
    return F.U.wpick(entries);
  };

  F.rollGem = function (depth, luck) {
    const e = [];
    for (const id in F.GEMS) {
      const g = F.GEMS[id];
      const lift = id === 'topaz' ? 1 : 1 + (depth - 1) * 0.42 * (1 + (luck || 0));
      e.push([id, g.w * lift]);
    }
    return F.U.wpick(e);
  };

  F.makeNode = function (type, tx, ty, depth, oreOverride) {
    const d = F.NODES[type];
    const hp = Math.round(d.hp * F.nodeHpScale(depth));
    return {
      type, x: tx * TS + TS / 2, y: ty * TS + TS / 2, tx, ty,
      hp, max: hp, r: d.r, alive: true, flash: 0, shake: 0, hitT: 0,
      ore: oreOverride || F.rollOre(depth, d.boost),
      depth, seed: (Math.random() * 65535) | 0, respawn: 0,
    };
  };

  // -------------------------------------------------------------- the mine
  F.genMine = function (depth) {
    for (let attempt = 0; attempt < 24; attempt++) {
      const lv = tryGen(depth);
      if (lv) return lv;
    }
    throw new Error('mine generation failed at depth ' + depth);
  };

  function tryGen(depth) {
    const D = F.DEPTHS[depth - 1];
    const w = F.MINE_W, h = F.MINE_H;
    const lv = new F.Level(w, h, D.biome, depth);
    lv.name = D.name; lv.sub = D.sub;
    let t = lv.tiles;

    // --- cellular automata, exactly The Forge 1's parameters
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      t[y * w + x] = (x === 0 || y === 0 || x === w - 1 || y === h - 1 || Math.random() < 0.46) ? T.WALL : T.FLOOR;
    for (let p = 0; p < 4; p++) {
      const n = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (lv.t(x + dx, y + dy) === T.WALL) c++;
        n[y * w + x] = (x === 0 || y === 0 || x === w - 1 || y === h - 1 || c >= 5) ? T.WALL : T.FLOOR;
      }
      t = lv.tiles = n;
    }

    // --- keep the largest connected cavern
    const lab = new Int32Array(w * h).fill(-1);
    let best = -1, bestN = 0, id = 0;
    for (let i = 0; i < w * h; i++) {
      if (t[i] !== T.FLOOR || lab[i] !== -1) continue;
      const stack = [i]; lab[i] = id; let n = 0;
      while (stack.length) {
        const c = stack.pop(); n++;
        const cx = c % w, cy = (c / w) | 0;
        for (let k = 0; k < 4; k++) {
          const nx = cx + [1, -1, 0, 0][k], ny = cy + [0, 0, 1, -1][k], ni = ny * w + nx;
          if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && t[ni] === T.FLOOR && lab[ni] === -1) { lab[ni] = id; stack.push(ni); }
        }
      }
      if (n > bestN) { bestN = n; best = id; }
      id++;
    }
    if (bestN < 900) return null;
    for (let i = 0; i < w * h; i++) if (t[i] === T.FLOOR && lab[i] !== best) t[i] = T.WALL;

    const floors = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (t[y * w + x] === T.FLOOR) floors.push([x, y]);

    // entrance north-west, shaft at the farthest point
    let sp = floors[0];
    for (const f of floors) if (f[0] + f[1] < sp[0] + sp[1]) sp = f;
    let sh = sp;
    for (const f of floors) if (d2(f, sp) > d2(sh, sp)) sh = f;
    const clear = c => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = c[0] + dx, y = c[1] + dy; if (x > 0 && y > 0 && x < w - 1 && y < h - 1) t[y * w + x] = T.FLOOR; } };
    clear(sp); clear(sh);

    lv.spawn = { x: sp[0] * TS + TS / 2, y: sp[1] * TS + TS / 2 };
    lv.spawnTile = sp; lv.shaftTile = sh;
    lv.exits.push({ kind: 'up', x: lv.spawn.x, y: lv.spawn.y - 4, r: 26, label: depth === 1 ? 'Emberhold' : 'Depth ' + roman(depth - 1) });
    if (depth < F.MAX_DEPTH)
      lv.exits.push({ kind: 'down', x: sh[0] * TS + TS / 2, y: sh[1] * TS + TS / 2, r: 26, label: 'Depth ' + roman(depth + 1), depth: depth + 1 });

    const occ = new Set();
    const key = (x, y) => x + ',' + y;
    const far = (x, y, d) => dist(x, y, sp[0], sp[1]) > d && dist(x, y, sh[0], sh[1]) > 5;

    // --- liquid pools (water / lava / ichor / void, per biome)
    if (lv.B.liquid && depth >= 2) {
      const pools = 2 + Math.floor(depth * 0.9);
      for (let k = 0; k < pools; k++) {
        const c = F.U.pick(floors);
        if (!far(c[0], c[1], 16)) continue;
        const rr = 1 + Math.floor(Math.random() * 3);
        for (let dy = -rr - 1; dy <= rr + 1; dy++) for (let dx = -rr - 1; dx <= rr + 1; dx++) {
          const x = c[0] + dx, y = c[1] + dy;
          if (dx * dx + dy * dy <= rr * rr + rr && lv.t(x, y) === T.FLOOR && far(x, y, 13)) {
            t[y * w + x] = T.LIQUID;
            if (lv.B.liquid.emis > 0.6 && Math.random() < 0.30)
              lv.lights.push({ x: x * TS + 16, y: y * TS + 16, r: 130 + Math.random() * 60,
                col: F.Col.lin(lv.B.liquid.glow, 1), i: 1.5 * lv.B.liquid.emis, z: 6, flicker: 0.30, shadow: 0.35 });
          }
        }
      }
    }

    // --- the sealed cavern: a walled pocket behind a cracked rock
    lv.secret = null;
    for (const size of [9, 7, 7, 5]) {
      if (lv.secret) break;
      const half = (size - 1) / 2, edge = half, cr = half - 1;
      for (let attempt = 0; attempt < 1200 && !lv.secret; attempt++) {
        const rx = F.U.ri(3, w - size - 4), ry = F.U.ri(3, h - size - 4);
        const cx = rx + half, cy = ry + half;
        if (dist(cx, cy, sp[0], sp[1]) < 12 || dist(cx, cy, sh[0], sh[1]) < 12) continue;
        let solid = true;
        for (let y = ry; y < ry + size && solid; y++) for (let x = rx; x < rx + size; x++) if (lv.t(x, y) !== T.WALL) { solid = false; break; }
        if (!solid) continue;
        const dirs = F.U.shuffle([[-1, 0], [1, 0], [0, -1], [0, 1]]);
        for (const dd of dirs) {
          const ex = cx + dd[0] * edge, ey = cy + dd[1] * edge;
          let k = 0;
          for (let j = 1; j <= 4; j++) {
            const tt = lv.t(ex + dd[0] * j, ey + dd[1] * j);
            if (tt === T.FLOOR) { k = j; break; }
            if (tt !== T.WALL) break;
          }
          if (!k) continue;
          for (let y = ry + 1; y < ry + size - 1; y++) for (let x = rx + 1; x < rx + size - 1; x++) t[y * w + x] = T.FLOOR;
          for (let j = 0; j < k; j++) t[(ey + dd[1] * j) * w + (ex + dd[0] * j)] = T.FLOOR;
          const sx = ex + dd[0] * (k - 1), sy = ey + dd[1] * (k - 1);
          const seal = F.makeNode('seal', sx, sy, depth, 'stone');
          lv.nodes.push(seal); occ.add(key(sx, sy));
          // the prize: a ring of crystals, a motherlode and a chest
          const ring = [[-cr, -cr], [cr, -cr], [-cr, cr], [cr, cr], [0, -cr], [0, cr]];
          for (const o of ring) {
            const nx = cx + o[0], ny = cy + o[1];
            if (lv.t(nx, ny) !== T.FLOOR || occ.has(key(nx, ny))) continue;
            lv.nodes.push(F.makeNode(Math.random() < 0.3 ? 'motherlode' : 'crystal', nx, ny, depth));
            occ.add(key(nx, ny));
          }
          lv.chests.push({ x: cx * TS + 16, y: cy * TS + 16, opened: false, depth, r: 14 });
          occ.add(key(cx, cy));
          lv.props.push({ kind: 'lantern_post', x: (cx - cr) * TS + 16, y: (cy - cr) * TS + 26, r: 6, solid: false });
          lv.props.push({ kind: 'lantern_post', x: (cx + cr) * TS + 16, y: (cy - cr) * TS + 26, r: 6, solid: false });
          lv.secret = { x: cx * TS + 16, y: cy * TS + 16, found: false, r: 80 };
          break;
        }
      }
    }

    const free = (x, y) => lv.t(x, y) === T.FLOOR && !occ.has(key(x, y));
    const openCount = (x, y) => {
      let open = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
        if (lv.t(x + dx, y + dy) !== T.WALL && !occ.has(key(x + dx, y + dy))) open++;
      return open;
    };
    const addNode = (type, x, y, ore) => {
      if (!free(x, y) || openCount(x, y) < 6) return false;
      occ.add(key(x, y)); lv.nodes.push(F.makeNode(type, x, y, depth, ore)); return true;
    };

    // --- ambient ore, scattered at random; density and richness rise with depth
    const want = 92 + depth * 16;
    const mix = [['pebble', 34], ['rock', 34], ['boulder', 15 + depth * 2.6],
                 ['vein', 3.5 + depth * 1.5], ['crystal', 1.2 + depth * 0.9]];
    for (let i = 0, placed = 0; i < want * 9 && placed < want; i++) {
      const c = F.U.pick(floors);
      if (!far(c[0], c[1], 6)) continue;
      if (addNode(F.U.wpick(mix), c[0], c[1])) placed++;
    }

    // --- guarded rich clusters: an elite standing over a seam
    const clusters = 2 + Math.floor(depth * 0.8);
    const mobLevel = mobLeveller(sp, sh, depth);
    for (let k = 0, made = 0; k < 90 && made < clusters; k++) {
      const c = F.U.pick(floors);
      if (!far(c[0], c[1], 20)) continue;
      let placed = 0;
      // one ore type dominates a seam, which is how you go looking for a specific ore
      const seamOre = F.rollOre(depth, 1.4);
      for (let i = 0; i < 46 && placed < 5 + depth; i++) {
        const x = c[0] + F.U.ri(-3, 3), y = c[1] + F.U.ri(-3, 3);
        if (dist(x, y, c[0], c[1]) < 1.5) continue;
        const type = Math.random() < 0.12 ? 'motherlode' : Math.random() < 0.58 ? 'vein' : 'crystal';
        if (addNode(type, x, y, Math.random() < 0.7 ? seamOre : undefined)) placed++;
      }
      if (placed >= 3) {
        const type = F.U.pick(D.elites);
        lv.enemies.push(F.makeEnemy(type, c[0] * TS + 16, c[1] * TS + 16, depth, true, mobLevel(c[0], c[1], true)));
        occ.add(key(c[0], c[1]));
        made++;
      }
    }

    // --- roaming mobs
    const mobs = 9 + Math.floor(depth * 3.4);
    for (let i = 0, m = 0; i < 400 && m < mobs; i++) {
      const c = F.U.pick(floors);
      if (!far(c[0], c[1], 15) || !free(c[0], c[1])) continue;
      lv.enemies.push(F.makeEnemy(F.U.pick(D.mobs), c[0] * TS + 16, c[1] * TS + 16, depth, false, mobLevel(c[0], c[1], false)));
      m++;
    }

    // --- props: old workings, formations, bones, fungus
    scatterProps(lv, floors, occ, depth, free);

    // --- lights at the entrance and the shaft
    lv.props.push({ kind: 'ladder', x: lv.spawn.x, y: lv.spawn.y - 6, r: 8, solid: false });
    addTorch(lv, lv.spawn.x - 30, lv.spawn.y - 4);
    addTorch(lv, lv.spawn.x + 30, lv.spawn.y - 4);
    if (depth < F.MAX_DEPTH) {
      lv.props.push({ kind: 'shaft', x: sh[0] * TS + 16, y: sh[1] * TS + 16, r: 10, solid: false });
      addTorch(lv, sh[0] * TS - 12, sh[1] * TS + 12);
      addTorch(lv, sh[0] * TS + 44, sh[1] * TS + 12);
    }

    lv.rollVariants((Math.random() * 1e9) | 0);
    return lv;
  }

  function addTorch(lv, x, y) {
    lv.props.push({ kind: 'torch', x, y, r: 5, solid: false, phase: Math.random() * 7 });
    lv.lights.push({ x, y: y - 10, r: 190, col: [1.0, 0.62, 0.30], i: 3.4, z: 26, flicker: 0.5, shadow: 1 });
  }

  function scatterProps(lv, floors, occ, depth, free) {
    const B = lv.B;
    const kinds = [];
    kinds.push(['stalagmite', 26], ['rubble', 34], ['bones', 10]);
    if (depth <= 3) kinds.push(['mushroom', 20], ['timber', 16]);
    else if (depth <= 5) kinds.push(['timber', 14], ['crystalcluster', 18]);
    else kinds.push(['bones', 22], ['crystalcluster', 12], ['timber', 8]);
    const n = 46 + depth * 5;
    for (let i = 0, made = 0; i < n * 7 && made < n; i++) {
      const c = F.U.pick(floors);
      if (!free(c[0], c[1])) continue;
      const kind = F.U.wpick(kinds);
      const x = c[0] * F.TS + 8 + Math.random() * 16, y = c[1] * F.TS + 8 + Math.random() * 16;
      const solid = kind === 'stalagmite' || kind === 'crystalcluster' || kind === 'timber';
      lv.props.push({ kind, x, y, r: solid ? 8 : 5, solid, v: (Math.random() * 3) | 0, flip: Math.random() < 0.5 });
      if (solid) occ.add(c[0] + ',' + c[1]);
      if (kind === 'crystalcluster')
        lv.lights.push({ x, y: y - 6, r: 110, col: F.Col.lin(B.accentGlow || B.accent, 1), i: 1.5, z: 12, flicker: 0.12, shadow: 0.3 });
      if (kind === 'mushroom')
        lv.lights.push({ x, y: y - 4, r: 70, col: [0.30, 0.85, 0.55], i: 0.9, z: 8, flicker: 0.08, shadow: 0.2 });
      made++;
    }
  }

  /** Enemy level: rises with depth and with distance from the entrance. */
  function mobLeveller(sp, sh, depth) {
    const span = Math.max(1, dist(sh[0], sh[1], sp[0], sp[1]));
    const base = 1 + (depth - 1) * 5;
    return (x, y, elite) => base + Math.round(F.U.sat(dist(x, y, sp[0], sp[1]) / span) * 5 + F.U.rnd(-0.4, 0.4)) + (elite ? 3 : 0);
  }

  function d2(a, b) { const dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy; }
  function dist(x0, y0, x1, y1) { return Math.hypot(x1 - x0, y1 - y0); }

  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  function roman(n) { return ROMAN[n] || ('' + n); }
  F.roman = roman;

})(window.F2 = window.F2 || {});
