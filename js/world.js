'use strict';
// ---------------------------------------------------------------------------
// world.js — level generation, sprites, and the main WorldScene (hub + caves,
//            movement, mining, combat, enemy AI, lighting, HUD)
// ---------------------------------------------------------------------------
const T_FLOOR = 0, T_WALL = 1, T_GRASS = 2, T_PATH = 3, T_MAGMA = 4, T_BUILD = 5;
// Hub-only: T_STONE is masonry (solid), T_WOOD is a plank walkway (walkable).
const T_STONE = 6, T_WOOD = 7;

class Level {
  constructor(w, h, theme, floor) {
    this.w = w; this.h = h; this.theme = theme; this.floor = floor;
    this.tiles = new Uint8Array(w * h);
    this.nodes = []; this.enemies = []; this.npcs = []; this.torches = []; this.magma = [];
    this.spawn = { x: 0, y: 0 }; this.shaftDown = null; this.ladderUp = null; this.layer = null; this.buildings = []; this.glows = []; this.rooms = [];
  }
  t(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? T_WALL : this.tiles[y * this.w + x]; }
  solid(x, y) { const t = this.t(x, y); return t === T_WALL || t === T_BUILD || t === T_STONE; }
  tileAtPx(px, py) { return this.t(Math.floor(px / TS), Math.floor(py / TS)); }
}

function blockedAt(lv, x, y, r) {
  const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS), y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (lv.solid(tx, ty)) return true;
  for (const n of lv.nodes) {
    if (!n.alive) continue;
    if (Math.abs(n.x - x) < 16 && Math.abs(n.y - y) < 16 && Math.hypot(n.x - x, n.y - y) < r + n.r) return true;
  }
  for (const n of lv.npcs) if (Math.hypot(n.x - x, n.y - y) < r + 5) return true;
  return false;
}
function moveEnt(lv, e, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx && !blockedAt(lv, e.x + sx, e.y, e.r)) e.x += sx;
    if (sy && !blockedAt(lv, e.x, e.y + sy, e.r)) e.y += sy;
  }
}
function hasLOS(lv, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) { if (lv.tileAtPx(U.lerp(x0, x1, i / n), U.lerp(y0, y1, i / n)) === T_WALL) return false; }
  return true;
}

// ---------------------------------------------------------------- generation
function rollOre(floor, boost = 0, luck = 0) { // luck: numeric bonus (potion + race)
  const entries = [];
  for (const id of ORE_IDS) {
    const o = ORES[id];
    if (floor < o.f[0] || floor > o.f[1]) continue;
    entries.push([id, o.w * (1 + boost * o.tier * 1.5 * (1 + luck))]);
  }
  return U.wpick(entries);
}
function rollGem(floor, luck) {
  const e = Object.keys(GEMS).map(id => [id, GEMS[id].w * (id === 'topaz' ? 1 : 1 + (floor - 1) * 0.6 * (1 + luck * 0.8))]);
  return U.wpick(e);
}

function makeNode(type, tx, ty, floor) {
  const d = NODES[type];
  const hp = Math.round(d.hp * (1 + 0.5 * (floor - 1)));
  return { type, x: tx * TS + 8, y: ty * TS + 8, hp, max: hp, r: d.r, alive: true, respawn: 0, flash: 0, ore: rollOre(floor, d.boost), floor };
}

// The hub is a dwarven stronghold carved out of solid rock: a central forge chamber ringed by
// walled workshop rooms, joined by flagstone galleries, with plank bridges out to east and west.
function genHub() {
  const W = 50, H = 42, lv = new Level(W, H, 'hub', 0);
  const CX = 25, CY = 21;
  lv.tiles.fill(T_WALL);                       // start solid; everything below is carved out
  const set = (x, y, t) => { if (x >= 1 && y >= 1 && x < W - 1 && y < H - 1) lv.tiles[y * W + x] = t; };
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  const carveIf = (x0, y0, x1, y1, t, only) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lv.t(x, y) === only) set(x, y, t);
  };
  const disc = (cx, cy, r, t) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) set(x, y, t);
  };

  // ---- the great round gallery around the forge
  disc(CX, CY, 10, T_PATH);

  // ---- workshops: colour-coded rooms with a single doorway facing the gallery
  const ROOMS = [
    // Each plaque names the trade that actually works there — see the sign test in tests.js.
    { kind: 'smith',     npc: 'Pickaxe Smith', sign: 'Pickaxe Smith', x: 4,  y: 3,  w: 11, h: 8, col: '#2f7fc4', door: 's', nx: 9,  ny: 8 },
    { kind: 'enchanter', npc: 'Enchanter',     sign: 'Enchanter',     x: 36, y: 3,  w: 11, h: 8, col: '#9b3fd4', door: 's', nx: 41, ny: 8 },
    { kind: 'alchemist', npc: 'Alchemist',     sign: 'Alchemist',     x: 4,  y: 32, w: 11, h: 8, col: '#26b37a', door: 'n', nx: 9,  ny: 35 },
    { kind: 'board',     npc: 'Quest Board',   sign: 'Commissions',   x: 36, y: 32, w: 11, h: 8, col: '#d4c23f', door: 'n', nx: 41, ny: 35 },
    { kind: 'merchant',  npc: 'Merchant',      sign: 'Merchant',      x: 20, y: 32, w: 11, h: 8, col: '#c08a4a', door: 'n', nx: 25, ny: 35 },
  ];
  for (const r of ROOMS) {
    const x1 = r.x + r.w - 1, y1 = r.y + r.h - 1;
    rect(r.x, r.y, x1, y1, T_STONE);                        // shell
    rect(r.x + 1, r.y + 1, x1 - 1, y1 - 1, T_PATH);         // floor
    const dx = r.x + ((r.w - 3) >> 1);
    r.dx = dx; r.dy = r.door === 's' ? y1 : r.y;
    rect(dx, r.dy, dx + 2, r.dy, T_PATH);                   // doorway
    lv.rooms.push(r);
    lv.npcs.push({ id: r.kind, kind: r.kind, x: r.nx * TS + 8, y: r.ny * TS + 8, name: r.npc, col: r.col, r: 5 });
  }

  // ---- galleries linking each doorway back to the round hall
  rect(8, 11, 10, 16, T_PATH);   rect(9, 14, 17, 16, T_PATH);     // north-west
  rect(40, 11, 42, 16, T_PATH);  rect(33, 14, 41, 16, T_PATH);    // north-east
  rect(8, 26, 10, 31, T_PATH);   rect(9, 26, 17, 28, T_PATH);     // south-west
  rect(40, 26, 42, 31, T_PATH);  rect(33, 26, 41, 28, T_PATH);    // south-east
  rect(24, 29, 26, 32, T_PATH);                                   // south, to Storage
  rect(24, 6, 26, 13, T_PATH);                                    // north, to the mine gate

  // ---- plank bridges out to the shrine (west) and the gate (east)
  disc(8, 21, 3, T_PATH); disc(42, 21, 3, T_PATH);
  rect(8, 20, 15, 22, T_WOOD); rect(35, 20, 42, 22, T_WOOD);

  // ---- lava seams bleeding through the rock beside the hall
  // ragged blobs rather than neat squares, so they read as seams in the rock
  const seam = (cx2, cy2, cells) => { for (const c of cells) carveIf(cx2 + c[0], cy2 + c[1], cx2 + c[0], cy2 + c[1], T_MAGMA, T_WALL); };
  const BLOB = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [2, 0], [1, -1], [-1, 1], [2, 1], [0, 2]];
  for (const p of [[16, 12], [34, 12], [16, 30], [34, 30]]) seam(p[0], p[1], BLOB);
  for (const p of [[19, 9], [31, 9], [19, 33], [31, 33], [13, 17], [37, 17], [13, 25], [37, 25]]) seam(p[0], p[1], [[0, 0], [1, 0], [0, 1], [-1, 0]]);

  // ---- the forge itself, a sealed drum of stone with a molten heart
  const FX = 21, FY = 18, FW = 9, FH = 7;
  for (let y = FY; y < FY + FH; y++) for (let x = FX; x < FX + FW; x++) {
    const dx = (x - CX) / 4.6, dy = (y - CY) / 3.6;
    if (dx * dx + dy * dy <= 1.05) set(x, y, T_BUILD);
  }
  lv.buildings.push({ x: FX, y: FY, w: FW, h: FH, roof: '#a8433a', name: 'Central Forge', central: true });
  lv.npcs.push({ id: 'forge', kind: 'forge', x: CX * TS + 8, y: 26 * TS + 8, name: 'Blacksmith', col: '#d4883f', r: 5 });

  // ---- mine gate at the head of the north gallery
  rect(22, 3, 28, 5, T_STONE);
  lv.buildings.push({ x: 22, y: 3, w: 7, h: 3, roof: '#26222c', name: 'Mine Entrance', mine: true });
  lv.shaftDown = { x: 25 * TS + 8, y: 7 * TS };
  lv.mineReturn = { x: 25 * TS + 8, y: 9 * TS + 8 };

  // ---- shrine and gate stand at the far ends of the bridges
  lv.npcs.push({ id: 'shrine', kind: 'shrine', x: 8 * TS + 8, y: 21 * TS + 8, name: 'Race Shrine', col: '#9b3fd4', r: 5 });
  lv.npcs.push({ id: 'gate', kind: 'gate', x: 42 * TS + 8, y: 21 * TS + 8, name: 'Grove Gate', col: '#3a8a4a', r: 7 });

  lv.spawn = { x: CX * TS + 8, y: 29 * TS };

  // ---- firelight: the forge heart, its braziers, and a lamp in every room
  lv.glows = [{ x: CX * TS + 8, y: CY * TS + 8, r: 96, col: [255, 130, 36] }];
  for (const p of [[16, 12], [34, 12], [16, 30], [34, 30]]) lv.glows.push({ x: p[0] * TS + 8, y: p[1] * TS + 8, r: 44, col: [255, 120, 30] });
  for (const a of [0.7, 2.44, 3.84, 5.58]) {
    const tx = CX * TS + 8 + Math.cos(a) * 112, ty = CY * TS + 8 + Math.sin(a) * 92;
    lv.torches.push({ x: tx, y: ty }); lv.glows.push({ x: tx, y: ty, r: 34, col: [255, 170, 70] });
  }
  for (const r of ROOMS) {
    const cx = (r.x + r.w / 2) * TS, cy = (r.y + 1) * TS + 10;
    lv.glows.push({ x: cx, y: (r.y + r.h / 2) * TS, r: 52, col: [220, 200, 150] });
    lv.torches.push({ x: (r.x + 2) * TS + 8, y: cy }, { x: (r.x + r.w - 3) * TS + 8, y: cy });
  }
  lv.torches.push({ x: 23 * TS, y: 8 * TS }, { x: 27 * TS, y: 8 * TS });

  // ---- moss and a few cave trees soften the rock around the stronghold
  const rnd = mulberry32(31337);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    if (lv.t(x, y) !== T_WALL) continue;
    let open = false;
    for (let dy = -1; dy <= 1 && !open; dy++) for (let dx = -1; dx <= 1; dx++) { const t = lv.t(x + dx, y + dy); if (t === T_PATH || t === T_WOOD) { open = true; break; } }
    if (open && rnd() < 0.3) set(x, y, T_GRASS);            // mossy rim
  }
  lv.layer = renderLayer(lv);
  return lv;
}
function genCave(floor) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const lv = tryGenCave(floor);
    if (lv) return lv;
  }
  throw new Error('cave generation failed');
}
function tryGenCave(floor) {
  const w = 64, h = 52, lv = new Level(w, h, 'cave', floor);
  let t = lv.tiles;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) t[y * w + x] = (x === 0 || y === 0 || x === w - 1 || y === h - 1 || Math.random() < 0.46) ? T_WALL : T_FLOOR;
  for (let p = 0; p < 4; p++) {
    const n = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (lv.t(x + dx, y + dy) === T_WALL) c++;
      n[y * w + x] = (x === 0 || y === 0 || x === w - 1 || y === h - 1 || c >= 5) ? T_WALL : T_FLOOR;
    }
    t = lv.tiles = n;
  }
  // keep largest connected region
  const lab = new Int32Array(w * h).fill(-1); let best = -1, bestN = 0, id = 0;
  for (let i = 0; i < w * h; i++) {
    if (t[i] !== T_FLOOR || lab[i] !== -1) continue;
    const stack = [i]; lab[i] = id; let n = 0;
    while (stack.length) {
      const c = stack.pop(); n++;
      const cx = c % w, cy = (c / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, ni = ny * w + nx;
        if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1 && t[ni] === T_FLOOR && lab[ni] === -1) { lab[ni] = id; stack.push(ni); }
      }
    }
    if (n > bestN) { bestN = n; best = id; }
    id++;
  }
  if (bestN < 900) return null;
  for (let i = 0; i < w * h; i++) if (t[i] === T_FLOOR && lab[i] !== best) t[i] = T_WALL;
  const floors = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (t[y * w + x] === T_FLOOR) floors.push([x, y]);
  // spawn = top-left-most floor, shaft = farthest floor from spawn
  let sp = floors[0]; for (const f of floors) if (f[0] + f[1] < sp[0] + sp[1]) sp = f;
  let sh = sp; for (const f of floors) if (Math.hypot(f[0] - sp[0], f[1] - sp[1]) > Math.hypot(sh[0] - sp[0], sh[1] - sp[1])) sh = f;
  const clear = (c) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = c[0] + dx, y = c[1] + dy; if (x > 0 && y > 0 && x < w - 1 && y < h - 1) t[y * w + x] = T_FLOOR; } };
  clear(sp); clear(sh);
  lv.spawn = { x: sp[0] * TS + 8, y: sp[1] * TS + 8 };
  lv.ladderUp = { x: lv.spawn.x, y: lv.spawn.y - 14 };
  if (floor < MAX_FLOOR) lv.shaftDown = { x: sh[0] * TS + 8, y: sh[1] * TS + 8 }; else lv.shaftDown = null;
  lv.exitPt = { x: sh[0] * TS + 8, y: sh[1] * TS + 8 };
  const far = (x, y, d) => Math.hypot(x - sp[0], y - sp[1]) > d && Math.hypot(x - sh[0], y - sh[1]) > 4;
  const occ = new Set();
  // Enemy level: base for the floor + up to 4 more the further from the entrance (towards the shaft) it sits.
  const spanD = Math.max(1, Math.hypot(sh[0] - sp[0], sh[1] - sp[1]));
  const mobLevel = (x, y, elite) => (1 + (floor - 1) * 4) + Math.round(U.clamp(Math.hypot(x - sp[0], y - sp[1]) / spanD, 0, 1) * 4 + U.rnd(-0.4, 0.4)) + (elite ? 2 : 0);
  // magma pools from floor 2
  if (floor >= 2) {
    for (let k = 0; k < 2 + floor; k++) {
      const c = U.pick(floors); if (!far(c[0], c[1], 14)) continue;
      const r = 1 + Math.floor(Math.random() * 2);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = c[0] + dx, y = c[1] + dy;
        if (dx * dx + dy * dy <= r * r + 1 && lv.t(x, y) === T_FLOOR && far(x, y, 12)) { t[y * w + x] = T_MAGMA; lv.magma.push({ x: x * TS + 8, y: y * TS + 8 }); }
      }
    }
  }
  // Hidden cavern: a walled-off pocket reached through a sealed rock; holds crystals and a chest.
  // Tries a 7x7 solid block first, then falls back to 5x5 so nearly every cave has one.
  lv.chests = []; lv.secret = null;
  for (const size of [7, 7, 5]) {
    const half = (size - 1) / 2, edge = half, cr = half - 1;
    for (let attempt = 0; attempt < 1500 && !lv.secret; attempt++) {
      const rx = U.ri(3, w - size - 4), ry = U.ri(3, h - size - 4), cx = rx + half, cy = ry + half;
      if (Math.hypot(cx - sp[0], cy - sp[1]) < 10 || Math.hypot(cx - sh[0], cy - sh[1]) < 10) continue;
      let solid = true;
      for (let y = ry; y < ry + size && solid; y++) for (let x = rx; x < rx + size; x++) if (lv.t(x, y) !== T_WALL) { solid = false; break; }
      if (!solid) continue;
      const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]].sort(() => Math.random() - 0.5);
      for (const d of dirs) {
        const ex = cx + d[0] * edge, ey = cy + d[1] * edge;
        let k = 0;
        for (let j = 1; j <= 4; j++) { const tt = lv.t(ex + d[0] * j, ey + d[1] * j); if (tt === T_FLOOR) { k = j; break; } if (tt !== T_WALL) break; }
        if (!k) continue;
        for (let y = ry + 1; y < ry + size - 1; y++) for (let x = rx + 1; x < rx + size - 1; x++) t[y * w + x] = T_FLOOR;
        for (let j = 0; j < k; j++) t[(ey + d[1] * j) * w + (ex + d[0] * j)] = T_FLOOR;
        const sx = ex + d[0] * (k - 1), sy = ey + d[1] * (k - 1);
        const seal = makeNode('seal', sx, sy, floor); seal.ore = 'stone'; lv.nodes.push(seal); occ.add(sx + ',' + sy);
        for (const o of [[-cr, -cr], [cr, -cr], [-cr, cr], [cr, cr]]) { const n = makeNode('crystal', cx + o[0], cy + o[1], floor); lv.nodes.push(n); occ.add((cx + o[0]) + ',' + (cy + o[1])); }
        lv.chests.push({ x: cx * TS + 8, y: cy * TS + 8, opened: false }); occ.add(cx + ',' + cy);
        lv.torches.push({ x: cx * TS - 6, y: cy * TS + 4 }, { x: cx * TS + 22, y: cy * TS + 4 });
        lv.secret = { x: cx * TS + 8, y: cy * TS + 8, found: false, r: 60 };
        break;
      }
    }
  }  const free = (x, y) => lv.t(x, y) === T_FLOOR && !occ.has(x + ',' + y);
  const addNode = (type, x, y) => {
    if (!free(x, y)) return false;
    // do not seal corridors: require at least 5 open neighbours
    let open = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (lv.t(x + dx, y + dy) !== T_WALL && !occ.has((x + dx) + ',' + (y + dy))) open++;
    if (open < 6) return false;
    occ.add(x + ',' + y); lv.nodes.push(makeNode(type, x, y, floor)); return true;
  };
  // ambient nodes; density rises with depth
  const want = 80 + floor * 22;
  for (let i = 0, placed = 0; i < want * 8 && placed < want; i++) {
    const c = U.pick(floors); if (!far(c[0], c[1], 6)) continue;
    const type = U.wpick([['pebble', 40], ['rock', 32], ['boulder', 12 + floor * 3], ['vein', 3 + floor], ['crystal', 1 + floor]]);
    if (addNode(type, c[0], c[1])) placed++;
  }
  // guarded rich clusters: an elite standing over veins and crystals
  const clusters = 2 + floor;
  for (let k = 0, made = 0; k < 60 && made < clusters; k++) {
    const c = U.pick(floors); if (!far(c[0], c[1], 20)) continue;
    let placed = 0;
    for (let i = 0; i < 40 && placed < 5 + floor; i++) {
      const x = c[0] + U.ri(-3, 3), y = c[1] + U.ri(-3, 3);
      if ((x === c[0] && y === c[1]) || Math.hypot(x - c[0], y - c[1]) < 1.5) continue;
      if (addNode(Math.random() < 0.55 ? 'vein' : 'crystal', x, y)) placed++;
    }
    if (placed >= 3) {
      const types = floor === 1 ? ['grunt', 'rogue', 'bomber'] : ['grunt', 'rogue', 'bomber'];
      lv.enemies.push(new Enemy(U.pick(types), c[0] * TS + 8, c[1] * TS + 8, floor, true, mobLevel(c[0], c[1], true)));
      occ.add(c[0] + ',' + c[1]); made++;
    }
  }
  // roaming mobs
  const mobs = 7 + floor * 4;
  const pool = floor === 1 ? [['grunt', 3], ['rogue', 1.5], ['bomber', 1.5]] : floor === 2 ? [['grunt', 3], ['rogue', 2], ['bomber', 2]] : [['grunt', 3], ['rogue', 3], ['bomber', 3]];
  for (let i = 0, m = 0; i < 200 && m < mobs; i++) {
    const c = U.pick(floors); if (!far(c[0], c[1], 14) || !free(c[0], c[1])) continue;
    lv.enemies.push(new Enemy(U.wpick(pool), c[0] * TS + 8, c[1] * TS + 8, floor, false, mobLevel(c[0], c[1], false))); m++;
  }
  // torches beside the spawn ladder
  lv.torches.push({ x: lv.spawn.x - 24, y: lv.spawn.y }, { x: lv.spawn.x + 24, y: lv.spawn.y });
  if (lv.shaftDown) lv.torches.push({ x: lv.shaftDown.x - 20, y: lv.shaftDown.y }, { x: lv.shaftDown.x + 20, y: lv.shaftDown.y });
  lv.layer = renderLayer(lv);
  return lv;
}

// ---------------------------------------------------------------- tile art (prerendered per level)
// ---------------------------------------------------------------- tile art (prerendered per level)
// Two passes: flat ground first, then structures (trees, wall faces) so they can overhang upward.
function renderLayer(lv) {
  const cave = lv.theme === 'cave', boss = lv.theme === 'boss', hub = lv.theme === 'hub';
  // stable per-tile randomness so a map always looks the same
  const tr = (x, y, salt) => mulberry32(((x * 73856093) ^ (y * 19349663) ^ ((salt || 0) * 83492791) ^ (lv.floor * 977)) >>> 0);
  return Art.mk(lv.w * TS, lv.h * TS, (g) => {
    const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    // ---------- pass 1: ground
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
      const t = lv.tiles[y * lv.w + x], px = x * TS, py = y * TS, rnd = tr(x, y, 1);
      if (hub && t === T_GRASS) {
        // mossy rock at the lip of the carved halls
        R(['#241f23', '#282227', '#211c20'][Math.floor(rnd() * 3)], px, py, TS, TS);
        for (let i = 0; i < 4; i++) { const bw = 3 + Math.floor(rnd() * 6), bh = 2 + Math.floor(rnd() * 4);
          R(rnd() < 0.55 ? '#2d4a2a' : '#365a30', px + Math.floor(rnd() * (16 - bw)), py + Math.floor(rnd() * (16 - bh)), bw, bh); }
        for (let i = 0; i < 8; i++) R(rnd() < 0.5 ? '#1d3a1c' : '#4b7a42', px + Math.floor(rnd() * 16), py + Math.floor(rnd() * 16), 1, 1);
        if (rnd() < 0.25) { const tx = px + 3 + Math.floor(rnd() * 10), ty = py + 5 + Math.floor(rnd() * 8);
          R('#24401f', tx, ty, 1, 3); R('#4b7a42', tx, ty - 1, 1, 3); R('#365a30', tx + 1, ty + 1, 1, 2); }
      } else if (hub && t === T_STONE) {
        // dressed masonry: courses of big blocks with a lit top edge
        R('#181520', px, py, TS, TS);
        for (let by = 0; by < 2; by++) {
          const off = ((y * 2 + by) % 2) * 8;
          for (let bx = -off; bx < TS; bx += 16) {
            const c = ['#4e4859', '#565062', '#474252'][Math.floor(rnd() * 3)];
            R(c, px + bx + 1, py + by * 8 + 1, 14, 6);
            R(U.shade(c, 1.3), px + bx + 1, py + by * 8 + 1, 14, 1);
            R(U.shade(c, 0.72), px + bx + 1, py + by * 8 + 6, 14, 1);
          }
        }
        for (let i = 0; i < 5; i++) R(rnd() < 0.5 ? '#3d3849' : '#635c72', px + Math.floor(rnd() * 16), py + Math.floor(rnd() * 16), 2, 1);
      } else if (hub && t === T_WOOD) {
        // plank bridge, boards running across the span
        R('#2a1c10', px, py, TS, TS);
        for (let i = 0; i < 4; i++) {
          const c = ['#6b4526', '#5c3a1e', '#7a5230', '#63421f'][Math.floor(rnd() * 4)];
          R(c, px, py + i * 4, TS, 3);
          R(U.shade(c, 1.25), px, py + i * 4, TS, 1);
          for (let k = 0; k < 2; k++) R(U.shade(c, 0.8), px + Math.floor(rnd() * 14), py + i * 4 + 1, 3, 1);
        }
        R('#3a2a18', px, py, 1, TS); R('#3a2a18', px + TS - 1, py, 1, TS);
        if ((x % 4) === 0) { R('#8a8f9c', px + 2, py + 1, 2, 2); R('#8a8f9c', px + 12, py + 12, 2, 2); }   // iron studs
      } else if (t === T_GRASS || (boss && t === T_FLOOR)) {
        const greens = boss ? ['#2f4a2c', '#314d2d'] : ['#3d7a38', '#3f7d3a', '#3c7836'];
        R(greens[Math.floor(rnd() * greens.length)], px, py, TS, TS);
        // soft irregular mottling: small clumps, never a full-tile block, so no grid shows
        for (let i = 0; i < 3; i++) { const bw = 2 + Math.floor(rnd() * 4), bh = 2 + Math.floor(rnd() * 3);
          R(U.shade(greens[0], rnd() < 0.5 ? 0.94 : 1.06), px + Math.floor(rnd() * (16 - bw)), py + Math.floor(rnd() * (16 - bh)), bw, bh); }
        const spN = boss ? 5 : 12, spLo = boss ? '#25401f' : '#2f6a2c', spHi = boss ? '#3c6b34' : '#579a4a';
        for (let i = 0; i < spN; i++) { R(rnd() < 0.5 ? spLo : spHi, px + Math.floor(rnd() * 16), py + Math.floor(rnd() * 16), 1, 1); }
        // grass tufts
        if (rnd() < (boss ? 0.22 : 0.5)) {
          const tx = px + 2 + Math.floor(rnd() * 11), ty = py + 4 + Math.floor(rnd() * 9);
          const tl = boss ? '#2a4a24' : '#2c5f28', th = boss ? '#3f7336' : '#5aa04c', tm = boss ? '#376a30' : '#4a8f44';
          R(tl, tx, ty, 1, 3); R(th, tx, ty - 1, 1, 3); R(tm, tx - 1, ty, 1, 2); R(tm, tx + 1, ty + 1, 1, 2);
        }
        // occasional flower or pebble
        if (rnd() < 0.10) { const fx = px + 3 + Math.floor(rnd() * 10), fy = py + 4 + Math.floor(rnd() * 9);
          R('#2c5f28', fx, fy + 1, 1, 2); R(U.pick(['#e8d24a', '#e07aa8', '#e8e8f0', '#d8563a']), fx, fy, 1, 1); }
        else if (rnd() < 0.10) { const fx = px + 3 + Math.floor(rnd() * 10), fy = py + 5 + Math.floor(rnd() * 8);
          R('#6d6878', fx, fy, 2, 2); R('#8b8698', fx, fy, 1, 1); }
        if (boss) for (let i = 0; i < 2; i++) { R('#3a2614', px + Math.floor(rnd() * 14), py + Math.floor(rnd() * 14), 2, 1); } // creeping roots
      } else if (t === T_PATH) {
        // flagstone paving: dark mortar with four slabs per tile
        R('#59546a', px, py, TS, TS);
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
          const c = ['#8b8698', '#827d90', '#938ea2', '#7c7789'][Math.floor(rnd() * 4)];
          R(c, px + sx * 8, py + sy * 8, 7, 7);
          R(U.shade(c, 1.16), px + sx * 8, py + sy * 8, 7, 1);
          R(U.shade(c, 0.82), px + sx * 8, py + sy * 8 + 6, 7, 1);
          if (rnd() < 0.3) R(U.shade(c, 0.9), px + sx * 8 + Math.floor(rnd() * 5), py + sy * 8 + 2 + Math.floor(rnd() * 3), 2, 1);
        }
        for (let i = 0; i < 4; i++) { R(rnd() < 0.5 ? '#6e6980' : '#a09aae', px + Math.floor(rnd() * 16), py + Math.floor(rnd() * 16), 1, 1); }
        // soften the join with neighbouring grass
        if (lv.t(x, y - 1) === T_GRASS) for (let i = 0; i < 10; i++) R('#4a8244', px + Math.floor(rnd() * 16), py + Math.floor(rnd() * 3), 1, 1);
        if (lv.t(x, y + 1) === T_GRASS) for (let i = 0; i < 10; i++) R('#4a8244', px + Math.floor(rnd() * 16), py + 13 + Math.floor(rnd() * 3), 1, 1);
        if (lv.t(x - 1, y) === T_GRASS) for (let i = 0; i < 8; i++) R('#4a8244', px + Math.floor(rnd() * 3), py + Math.floor(rnd() * 16), 1, 1);
        if (lv.t(x + 1, y) === T_GRASS) for (let i = 0; i < 8; i++) R('#4a8244', px + 13 + Math.floor(rnd() * 3), py + Math.floor(rnd() * 16), 1, 1);
      } else if (t === T_FLOOR) {
        R(['#3b3644', '#37323f', '#3f3a48'][Math.floor(rnd() * 3)], px, py, TS, TS);
        for (let i = 0; i < 6; i++) { R(rnd() < 0.5 ? '#332e3b' : '#494356', px + Math.floor(rnd() * 16), py + Math.floor(rnd() * 16), 1, 1); }
        if (rnd() < 0.3) { // hairline crack
          let cx2 = px + 3 + Math.floor(rnd() * 9), cy2 = py + 3 + Math.floor(rnd() * 9);
          for (let i = 0; i < 4; i++) { R('#2b2734', cx2, cy2, 1, 1); cx2 += rnd() < 0.5 ? 1 : 0; cy2 += rnd() < 0.6 ? 1 : 0; }
        }
        if (rnd() < 0.18) { const sx = px + 4 + Math.floor(rnd() * 8), sy = py + 5 + Math.floor(rnd() * 7); R('#2e2a38', sx, sy + 1, 3, 1); R('#4e4860', sx, sy, 3, 1); }
      } else if (t === T_MAGMA) {
        // molten rock: dark crust broken by bright channels, charred where it meets stone
        R('#5c1a06', px, py, TS, TS);
        for (let i = 0; i < 5; i++) { const bw = 4 + Math.floor(rnd() * 7), bh = 3 + Math.floor(rnd() * 5);
          R(rnd() < 0.5 ? '#c03a0c' : '#a82f0a', px + Math.floor(rnd() * (16 - bw)), py + Math.floor(rnd() * (16 - bh)), bw, bh); }
        for (let i = 0; i < 7; i++) R(rnd() < 0.55 ? '#ff7a1a' : '#ff9a2a', px + Math.floor(rnd() * 14), py + Math.floor(rnd() * 14), 3, 2);
        for (let i = 0; i < 3; i++) R(rnd() < 0.5 ? '#ffd23f' : '#ffe98a', px + 2 + Math.floor(rnd() * 11), py + 2 + Math.floor(rnd() * 11), 2, 1);
        for (let i = 0; i < 4; i++) R('#3a1004', px + Math.floor(rnd() * 13), py + Math.floor(rnd() * 13), 4, 2);   // cooled crust
        // charred lip wherever the lava meets something solid
        const lip = (dx, dy, a, b, ww, hh) => { if (lv.t(x + dx, y + dy) !== T_MAGMA) { R('#241008', px + a, py + b, ww, hh); R('#4a1c0a', px + a + (dx ? (dx > 0 ? -1 : 1) : 0), py + b + (dy ? (dy > 0 ? -1 : 1) : 0), ww, hh); } };
        lip(0, -1, 0, 0, TS, 2); lip(0, 1, 0, TS - 2, TS, 2); lip(-1, 0, 0, 0, 2, TS); lip(1, 0, TS - 2, 0, 2, TS);
      } else if (t === T_WALL && cave) {
        R('#1b1822', px, py, TS, TS);
        for (let i = 0; i < 5; i++) { R(rnd() < 0.5 ? '#16131d' : '#232030', px + Math.floor(rnd() * 16), py + Math.floor(rnd() * 16), 2, 2); }
      } else if (t === T_WALL && boss) {
        R('#2c1d0e', px, py, TS, TS);
        for (let i = 0; i < 7; i++) R(rnd() < 0.5 ? '#3c2716' : '#4a3018', px + Math.floor(rnd() * 14), py + Math.floor(rnd() * 14), 4, 2);
        for (let i = 0; i < 4; i++) R('#1d4a22', px + Math.floor(rnd() * 13), py + Math.floor(rnd() * 13), 3, 2);   // moss
      } else if (hub && t === T_WALL) {
        // living rock that the stronghold was cut out of
        R(['#221d26', '#261f28', '#1e1a23'][Math.floor(rnd() * 3)], px, py, TS, TS);
        for (let i = 0; i < 7; i++) R(rnd() < 0.5 ? '#1a151f' : '#2f2836', px + Math.floor(rnd() * 13), py + Math.floor(rnd() * 13), 4, 3);
        for (let i = 0; i < 4; i++) R(rnd() < 0.5 ? '#332b3b' : '#171320', px + Math.floor(rnd() * 15), py + Math.floor(rnd() * 15), 2, 1);
      } else if (t === T_WALL) {
        R('#3a7034', px, py, TS, TS);
      } else R('#2a2530', px, py, TS, TS);
    }
    // ---------- pass 2: structures
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
      const t = lv.tiles[y * lv.w + x]; if (t !== T_WALL && !(hub && t === T_GRASS)) continue;
      const px = x * TS, py = y * TS, rnd = tr(x, y, 2);
      if (cave || boss || hub) {
        // Lit face where the wall meets open ground below; dark cap on the exposed top.
        const solidBelow = (tt) => tt === T_WALL || tt === T_BUILD || tt === T_STONE || (hub && tt === T_GRASS);
        const below = lv.t(x, y + 1);
        if (!solidBelow(below)) {
          R('#0e0c14', px, py + TS - 6, TS, 6);
          R('#4a4458', px, py + TS - 5, TS, 5);
          R('#5f5872', px, py + TS - 5, TS, 1);
          for (let i = 0; i < 5; i++) R(rnd() < 0.5 ? '#3d3849' : '#55506a', px + Math.floor(rnd() * 16), py + TS - 4 + Math.floor(rnd() * 4), 2, 1);
          if (rnd() < 0.4) { R('#6b6480', px + 2 + Math.floor(rnd() * 11), py + TS - 4, 3, 1); }
          if (boss) { R('#3c2716', px, py + TS - 5, TS, 5); R('#5a3a1e', px, py + TS - 5, TS, 2); R('#2c5a2a', px, py + TS - 7, TS, 2); for (let i = 0; i < 4; i++) R('#3f7d3a', px + Math.floor(rnd() * 15), py + TS - 8 + Math.floor(rnd() * 3), 2, 1); }
        }
        if (!solidBelow(lv.t(x, y - 1))) { R('#0a0810', px, py, TS, 2); R('#262233', px, py + 2, TS, 1); }
        if (!solidBelow(lv.t(x - 1, y))) R('#141220', px, py, 1, TS);
        if (!solidBelow(lv.t(x + 1, y))) R('#141220', px + TS - 1, py, 1, TS);
      } else {
        // Hub tree: shadow, trunk, layered canopy, a few highlight clumps.
        const big = rnd() < 0.45, cx2 = px + 8, oy = big ? -3 : 0;
        R('rgba(0,0,0,0.22)', px + 2, py + 12, 12, 4);
        R('#3c2a18', cx2 - 2, py + 8, 4, 8); R('#523a22', cx2 - 2, py + 8, 2, 8); R('#2a1c10', cx2 + 1, py + 8, 1, 8);
        const dark = '#16401b', mid = '#245c27', lite = '#3a8a38', hi = '#59ad4e';
        const blob = (bx, by, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(bx, by, r, 0, 6.3); g.fill(); };
        blob(cx2, py + 7 + oy, big ? 9 : 7.5, dark);
        blob(cx2 - 1, py + 6 + oy, big ? 7.5 : 6, mid);
        blob(cx2 - 2, py + 5 + oy, big ? 5.5 : 4.5, lite);
        blob(cx2 - 3, py + 4 + oy, 2.5, hi);
        for (let i = 0; i < 6; i++) R(rnd() < 0.5 ? dark : hi, px + 2 + Math.floor(rnd() * 12), py + 1 + oy + Math.floor(rnd() * 12), 1, 1);
        if (rnd() < 0.25) { const fx = px + 4 + Math.floor(rnd() * 8), fy = py + 4 + oy + Math.floor(rnd() * 7); R('#d8563a', fx, fy, 1, 1); } // fruit
      }
    }
    // ---------- workshop rooms: tinted floor, fittings, and a name plaque over the door
    for (const rm of lv.rooms) {
      const px = rm.x * TS, py = rm.y * TS, w = rm.w * TS, h = rm.h * TS;
      const rnd = mulberry32(rm.x * 7919 + rm.y * 104729);
      const ix = px + TS, iy = py + TS, iw = w - TS * 2, ih = h - TS * 2;   // interior
      const tint = rm.col, floorA = U.shade(tint, 0.40), floorB = U.shade(tint, 0.48);
      // tiled floor in the workshop's colour
      for (let ty = 0; ty < ih; ty += 16) for (let tx = 0; tx < iw; tx += 16) {
        const c = ((tx / 16 + ty / 16) % 2) ? floorA : floorB;
        R(c, ix + tx, iy + ty, 16, 16);
        R(U.shade(c, 1.2), ix + tx, iy + ty, 16, 1); R(U.shade(c, 0.78), ix + tx, iy + ty + 15, 16, 1);
        R(U.shade(c, 1.1), ix + tx, iy + ty, 1, 16); R(U.shade(c, 0.85), ix + tx + 15, iy + ty, 1, 16);
        for (let i = 0; i < 3; i++) R(U.shade(c, rnd() < 0.5 ? 0.9 : 1.12), ix + tx + 2 + Math.floor(rnd() * 12), iy + ty + 2 + Math.floor(rnd() * 12), 2, 1);
      }
      // inner face of the wall, catching the lamplight
      R(U.shade(tint, 0.62), ix, iy, iw, 4); R(U.shade(tint, 0.92), ix, iy, iw, 1);
      R(U.shade(tint, 0.3), ix, iy + ih - 4, iw, 4);
      R(U.shade(tint, 0.42), ix, iy, 4, ih); R(U.shade(tint, 0.42), ix + iw - 4, iy, 4, ih);
      // fittings, one set per trade
      const F = (c, a, b, ww, hh) => { g.fillStyle = c; g.fillRect(ix + a, iy + b, ww, hh); };
      const bench = (a, b, ww, hh) => {
        hh = hh || 14;
        F('#241708', a, b, ww, hh); F('#6b4526', a, b, ww, hh - 3); F('#8a6236', a, b, ww, 2); F('#4a3018', a, b + hh - 3, ww, 3);
        for (let k = 8; k < ww - 6; k += 14) F('#5c3a1e', a + k, b + 2, 1, hh - 5);
      };
      // long workbench against the wall opposite the door, with two shorter returns
      const backWall = rm.door === 's' ? 5 : ih - 19;
      bench(6, backWall, iw - 12);
      bench(4, backWall + (rm.door === 's' ? 26 : -28), 26, 13);
      bench(iw - 30, backWall + (rm.door === 's' ? 26 : -28), 26, 13);
      const midY = Math.round(ih / 2) - 4;
      if (rm.kind === 'smith') {
        F('#8a8f9c', 14, backWall + 2, 9, 6); F('#b0b6c4', 14, backWall + 2, 9, 1);              // stock and tools
        F('#5a3a1e', 32, backWall + 4, 20, 3); F('#8a8f9c', 58, backWall + 2, 7, 6);
        F('#15121b', iw / 2 - 22, midY, 44, 20); F('#4a4a56', iw / 2 - 20, midY, 40, 15);        // anvil
        F('#63636f', iw / 2 - 20, midY, 40, 3); F('#3a3a44', iw / 2 - 9, midY + 15, 18, 7);
        F('#2a4a6a', 8, ih - 28, 34, 20); F('#3f7fc4', 11, ih - 26, 28, 15); F('#8fd0ff', 14, ih - 24, 10, 4);   // quench trough
        F('#5a3a1e', iw - 20, 10, 4, ih - 24); for (let i = 0; i < 3; i++) F('#8a8f9c', iw - 27, 14 + i * 13, 15, 4);
      } else if (rm.kind === 'enchanter') {
        F('#2a1a3a', iw / 2 - 22, midY - 2, 44, 28); F('#4a2f6a', iw / 2 - 19, midY, 38, 22);    // pedestal
        F('#1a0f28', iw / 2 - 13, midY + 4, 26, 14);
        F('#9b3fd4', iw / 2 - 9, midY + 6, 18, 10); F('#e6b8ff', iw / 2 - 4, midY + 8, 9, 6); F('#ffffff', iw / 2 - 2, midY + 9, 3, 2);
        F('#c23bff', iw / 2 - 1, midY - 14, 2, 12);
        for (let i = 0; i < 4; i++) F(['#c23bff', '#7fd8ff', '#ffd23f', '#9b3fd4'][i], 16 + i * 18, backWall + 3, 7, 7);
        F('#3a2a50', iw - 36, ih - 36, 30, 30); for (let i = 0; i < 3; i++) F(['#c23bff', '#7fd8ff', '#ffd23f'][i], iw - 32, ih - 32 + i * 10, 22, 5);
      } else if (rm.kind === 'alchemist') {
        for (let i = 0; i < 6; i++) F(['#3fd17a', '#e0344f', '#7fd8ff', '#ffd23f', '#c23bff', '#ff8a3d'][i], 14 + i * 19, backWall + 2, 7, 9);
        F('#2a2a34', iw / 2 - 18, midY, 36, 24); F('#3f3f4e', iw / 2 - 15, midY + 2, 30, 19);    // cauldron
        F('#26b37a', iw / 2 - 11, midY + 5, 22, 12); F('#7fe8aa', iw / 2 - 6, midY + 7, 11, 6);
        F('#1a1008', iw / 2 - 20, midY + 24, 40, 5);
        F('#3a2a18', 6, ih - 38, 20, 34); for (let i = 0; i < 4; i++) { F('#5c3a20', 8, ih - 36 + i * 8, 16, 6); F(['#3fd17a', '#e0344f', '#7fd8ff', '#ffd23f'][i], 9, ih - 35 + i * 8, 5, 4); }
      } else if (rm.kind === 'board') {
        for (let i = 0; i < 6; i++) { const nx2 = 18 + (i % 3) * 22, ny2 = backWall + 1 + Math.floor(i / 3) * 6;
          F('#efe6c8', nx2, ny2, 16, 10); F(['#c0392b', '#3a6fa8', '#d4c23f'][i % 3], nx2 + 1, ny2 + 1, 4, 3); }
        F('#241708', iw / 2 - 28, midY + 6, 56, 20); F('#6b4526', iw / 2 - 28, midY + 6, 56, 17); F('#8a6236', iw / 2 - 28, midY + 6, 56, 2);
        F('#efe6c8', iw / 2 - 22, midY + 10, 16, 10); F('#d4c23f', iw / 2 + 2, midY + 11, 12, 7);
        F('#8a6236', 8, ih - 22, 24, 16); F('#efe6c8', 10, ih - 20, 20, 5);
      } else {
        for (const c of [[8, backWall + 2], [30, backWall + 1], [iw - 32, backWall + 2], [iw - 56, backWall + 1]]) {
          F('#3a2412', c[0], c[1], 19, 17); F('#7a5230', c[0] + 1, c[1] + 1, 17, 15); F('#9a6a3e', c[0] + 1, c[1] + 1, 17, 2);
          F('#5c3a1e', c[0] + 1, c[1] + 8, 17, 2); F('#c9a24b', c[0] + 7, c[1] + 7, 5, 4);
        }
        for (const b of [[iw / 2 - 24, midY + 2], [iw / 2 - 3, midY + 6], [iw / 2 + 18, midY]]) {
          F('#3a2412', b[0], b[1], 17, 22); F('#6b4526', b[0] + 1, b[1] + 1, 15, 20);
          F('#8a8f9c', b[0] + 1, b[1] + 4, 15, 2); F('#8a8f9c', b[0] + 1, b[1] + 15, 15, 2);
        }
        F('#3a2412', 6, ih - 26, 26, 22); F('#7a5230', 7, ih - 25, 24, 20); F('#c9a24b', 16, ih - 18, 6, 6);
      }
      // doorway: dark threshold with a lintel and a lamp either side
      const dpx = rm.dx * TS, dpy = rm.dy * TS;
      R('#0d0a12', dpx, dpy, TS * 3, TS);
      R(U.shade(tint, 0.55), dpx, rm.door === 's' ? dpy : dpy + TS - 3, TS * 3, 3);
      for (const lx of [dpx - 6, dpx + TS * 3 + 2]) { R('#2f2937', lx, dpy + 4, 5, 8); R('#ffb02a', lx + 1, dpy + 2, 3, 4); R('#fff3b0', lx + 2, dpy + 3, 1, 2); }
      // name plaque above the door, outside the room
      const sw = Math.max(52, UI.width(rm.sign) + 14), sx = Math.round(dpx + TS * 1.5 - sw / 2);
      const sy = rm.door === 's' ? dpy + TS + 3 : dpy - 15;
      R('#0d0a12', sx - 1, sy - 1, sw + 2, 13);
      R(U.shade(tint, 0.5), sx, sy, sw, 11); R(U.shade(tint, 0.78), sx, sy, sw, 2); R(U.shade(tint, 0.32), sx, sy + 9, sw, 2);
      const tsx = Math.round(sx + sw / 2 - UI.width(rm.sign) / 2);
      Font.draw(rm.sign, tsx + 1, sy + 4, '#0d0a12', 1, g);
      Font.draw(rm.sign, tsx, sy + 3, U.shade(tint, 1.7), 1, g);
    }
    // ---------- buildings
    for (const b of lv.buildings) {
      const px = b.x * TS, py = b.y * TS, w = b.w * TS, h = b.h * TS, rnd = mulberry32(b.x * 31 + b.y);
      if (b.central) {
        // The great forge: a stone drum with a lava heart, braziers and an anvil on the near lip.
        const ccx = px + w / 2, ccy = py + h / 2, rx = w * 0.52, ry = h * 0.56;
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(ccx, ccy + 8, rx + 3, ry + 2, 0, 0, 6.3); g.fill();
        // scorched apron of dark red brick, as though the heat has stained the floor around it
        g.fillStyle = '#3a1410'; g.beginPath(); g.ellipse(ccx, ccy + 1, rx + 15, ry + 12, 0, 0, 6.3); g.fill();
        g.fillStyle = '#54201a'; g.beginPath(); g.ellipse(ccx, ccy, rx + 13, ry + 10, 0, 0, 6.3); g.fill();
        g.fillStyle = '#6b2a20'; g.beginPath(); g.ellipse(ccx, ccy - 1, rx + 10, ry + 7, 0, 0, 6.3); g.fill();
        for (let i = 0; i < 26; i++) {
          const a = i / 26 * 6.283;
          g.fillStyle = i % 2 ? '#7a3226' : '#46180f';
          g.fillRect(Math.round(ccx + Math.cos(a) * (rx + 11)) - 3, Math.round(ccy + Math.sin(a) * (ry + 8)) - 2, 6, 5);
        }
        g.fillStyle = '#2a2430'; g.beginPath(); g.ellipse(ccx, ccy + 3, rx, ry, 0, 0, 6.3); g.fill();
        g.fillStyle = '#4b4459'; g.beginPath(); g.ellipse(ccx, ccy, rx, ry, 0, 0, 6.3); g.fill();
        g.fillStyle = '#5d566d'; g.beginPath(); g.ellipse(ccx, ccy - 2, rx - 2, ry - 2, 0, 0, 6.3); g.fill();
        // ring of blocks around the rim
        for (let i = 0; i < 20; i++) {
          const a = i / 20 * 6.283, bx2 = ccx + Math.cos(a) * (rx - 4), by2 = ccy + Math.sin(a) * (ry - 3);
          g.fillStyle = i % 2 ? '#6b6480' : '#565068'; g.fillRect(Math.round(bx2) - 4, Math.round(by2) - 3, 8, 6);
          g.fillStyle = '#7d7594'; g.fillRect(Math.round(bx2) - 4, Math.round(by2) - 3, 8, 1);
        }
        // lava heart
        g.fillStyle = '#140a0c'; g.beginPath(); g.ellipse(ccx, ccy - 2, rx - 12, ry - 10, 0, 0, 6.3); g.fill();
        const heat = [['#7a1f06', 1], ['#c03a0c', 0.82], ['#ff7a1a', 0.6], ['#ffb02a', 0.4], ['#ffe98a', 0.2]];
        for (const [col, k] of heat) { g.fillStyle = col; g.beginPath(); g.ellipse(ccx, ccy - 2, (rx - 13) * k, (ry - 11) * k, 0, 0, 6.3); g.fill(); }
        for (let i = 0; i < 14; i++) { g.fillStyle = rnd() < 0.5 ? '#ffd23f' : '#ff8a2a'; g.fillRect(ccx - 20 + Math.floor(rnd() * 40), ccy - 12 + Math.floor(rnd() * 20), 2, 1); }
        // braziers at the shoulders
        for (const s of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const bx2 = Math.round(ccx + s[0] * (rx - 6)), by2 = Math.round(ccy + s[1] * (ry - 4));
          g.fillStyle = '#2f2937'; g.fillRect(bx2 - 4, by2 - 2, 8, 7); g.fillStyle = '#463f52'; g.fillRect(bx2 - 4, by2 - 2, 8, 2);
          g.fillStyle = '#ff8a2a'; g.fillRect(bx2 - 3, by2 - 5, 6, 4); g.fillStyle = '#ffe98a'; g.fillRect(bx2 - 1, by2 - 4, 2, 2);
        }
        // anvil on the southern lip, where the smith works
        const ay = Math.round(ccy + ry - 4);
        g.fillStyle = '#15121b'; g.fillRect(ccx - 13, ay, 26, 5);
        g.fillStyle = '#4a4a56'; g.fillRect(ccx - 12, ay, 24, 4); g.fillStyle = '#63636f'; g.fillRect(ccx - 12, ay, 24, 1);
        g.fillStyle = '#3a3a44'; g.fillRect(ccx - 5, ay + 4, 10, 4);
      } else if (b.mine) {
        // timbered mine mouth cut into rock
        R('#0a0810', px - 2, py - 2, w + 4, h + 4);
        R('#5a5468', px, py, w, h); R('#6e6880', px, py, w, 2);
        for (let i = 0; i < 40; i++) R(rnd() < 0.5 ? '#4a4458' : '#7a7490', px + Math.floor(rnd() * w), py + Math.floor(rnd() * h), 3, 2);
        R('#060409', px + 18, py + 6, w - 36, h - 6);
        R('#7a5a3a', px + 14, py + 4, 5, h - 4); R('#7a5a3a', px + w - 19, py + 4, 5, h - 4); R('#8a6a44', px + 12, py + 1, w - 24, 5);
        R('#5c4228', px + 14, py + 4, 2, h - 4); R('#5c4228', px + w - 19, py + 4, 2, h - 4); R('#a07c50', px + 12, py + 1, w - 24, 2);
        R('#3a2a18', px + 20, py + 6, 2, 3); R('#3a2a18', px + w - 22, py + 6, 2, 3);
      } else {
        const roof = b.roof;
        R('rgba(0,0,0,0.3)', px + 2, py + 20, w + 2, h - 14);
        // stone footing + plaster wall + timber frame
        R('#8c8274', px, py + 18, w, h - 18);
        R('#a89c88', px, py + 18, w, h - 22);
        for (let i = 0; i < 26; i++) R(rnd() < 0.5 ? '#988c78' : '#b8ad9a', px + Math.floor(rnd() * w), py + 18 + Math.floor(rnd() * (h - 18)), 2, 1);
        R('#5a4028', px, py + 18, w, 2);
        for (let x2 = 0; x2 < w; x2 += 14) R('#5a4028', px + x2, py + 20, 2, h - 20);
        R('#6b5136', px, py + h - 4, w, 4);
        // roof: overhanging shingles
        R('#2a1c10', px - 4, py - 1, w + 8, 24);
        R(roof, px - 3, py, w + 6, 22);
        R(U.shade(roof, 1.35), px - 3, py, w + 6, 3);
        for (let ry = 4; ry < 22; ry += 5) {
          R(U.shade(roof, 0.72), px - 3, py + ry, w + 6, 1);
          for (let x2 = (ry / 5 % 2) * 5; x2 < w + 6; x2 += 10) R(U.shade(roof, 0.85), px - 3 + x2, py + ry, 1, 4);
        }
        R(U.shade(roof, 0.55), px - 3, py + 21, w + 6, 2);
        // door with frame and step
        const dx = px + Math.round(w / 2) - 7;
        R('#4a3218', dx - 1, py + 25, 16, 23); R('#2a1a0c', dx, py + 26, 14, 22);
        R('#5c3d1e', dx + 1, py + 27, 12, 20); R('#3f2a14', dx + 6, py + 27, 2, 20);
        R('#c9a24b', dx + 10, py + 37, 2, 2);
        R('#7d7058', dx - 2, py + h - 2, 18, 3);
        // shuttered windows with warm light
        for (const wx of [px + 6, px + w - 16]) {
          R('#4a3218', wx - 1, py + 27, 12, 11); R('#f5d27a', wx, py + 28, 10, 9);
          R('#d8a84a', wx, py + 32, 10, 1); R('#d8a84a', wx + 4, py + 28, 2, 9);
        }
        // chimney
        R('#7d7058', px + w - 12, py - 8, 8, 10); R('#948878', px + w - 12, py - 8, 8, 2); R('#5a5148', px + w - 11, py - 6, 6, 1);
      }
      // hanging sign
      const sw = Math.max(40, UI.width(b.name) + 12), sx = px + Math.round(w / 2 - sw / 2), sy = py - 16;
      R('#2a1a0c', sx - 1, sy - 1, sw + 2, 13);
      R('#6b4a2a', sx, sy, sw, 11); R('#8a6236', sx, sy, sw, 2); R('#4a3018', sx, sy + 9, sw, 2);
      const bsx = Math.round(px + w / 2 - UI.width(b.name) / 2);
      Font.draw(b.name, bsx + 1, sy + 4, '#2a1a0c', 1, g);
      Font.draw(b.name, bsx, sy + 3, '#ffd67a', 1, g);
    }
  });
}

// ---------------------------------------------------------------- sprites
function silhouette(c, col) {
  return Art.mk(c.width, c.height, (g) => { g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); });
}
// Scale a sprite up by an integer-ish factor, keeping hard pixel edges (used for elites).
function upscale(src, f) {
  return Art.mk(Math.round(src.width * f), Math.round(src.height * f), (g) => {
    g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, Math.round(src.width * f), Math.round(src.height * f));
  });
}

const Sprites = {
  // ---------------- ore nodes
  // Crisp pixel ellipse (no antialiasing), so stone edges stay sharp.
  ell(g, cx, cy, rx, ry, col) {
    g.fillStyle = col;
    for (let y = Math.ceil(cy - ry); y < cy + ry; y++) {
      const dy = (y + 0.5 - cy) / ry;
      const w = Math.sqrt(Math.max(0, 1 - dy * dy)) * rx;
      const x0 = Math.round(cx - w), x1 = Math.round(cx + w);
      if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
    }
  },
  // A lump of stone: base shadow, body, lit cap, facet edge, cracks.
  stone(g, cx, by, r, h, rnd, pal) {
    const top = by - h;
    this.ell(g, cx, by - h * 0.52, r, h * 0.52, pal.lo);                    // silhouette
    this.ell(g, cx - 0.5, by - h * 0.58, r - 1, h * 0.46, pal.mid);         // body
    this.ell(g, cx - r * 0.28, by - h * 0.72, r * 0.62, h * 0.3, pal.hi);   // lit cap
    g.fillStyle = pal.lit; g.fillRect(Math.round(cx - r * 0.5), Math.round(top + h * 0.2), Math.max(2, Math.round(r * 0.6)), 1);
    g.fillStyle = pal.lo;  g.fillRect(Math.round(cx - r * 0.2), Math.round(by - 3), Math.max(2, Math.round(r * 0.9)), 1);
    // angular facet: a straight chord across the body reads as a broken face
    g.fillStyle = pal.edge;
    let fx = Math.round(cx - r * 0.7), fy = Math.round(top + h * 0.45);
    for (let i = 0; i < Math.round(r * 1.1); i++) { g.fillRect(fx + i, fy + Math.round(i * 0.42), 1, 1); }
    // cracks
    for (let c = 0; c < 2; c++) {
      let x = Math.round(cx + (rnd() - 0.5) * r), y = Math.round(top + h * 0.35 + rnd() * h * 0.3);
      g.fillStyle = pal.crack;
      for (let i = 0; i < 3 + Math.floor(rnd() * 3); i++) { g.fillRect(x, y, 1, 1); x += rnd() < 0.45 ? 1 : 0; y += rnd() < 0.7 ? 1 : 0; }
    }
  },
  // One embedded nugget: dark socket, metal, specular dot.
  nugget(g, x, y, w, h, o) {
    g.fillStyle = U.shade(o.col2, 0.55); g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = o.col2; g.fillRect(x, y, w, h);
    g.fillStyle = o.col; g.fillRect(x, y, Math.max(1, w - 1), Math.max(1, h - 1));
    g.fillStyle = U.shade(o.col, 1.75); g.fillRect(x, y, 1, 1);
    if (w > 2) { g.fillStyle = '#ffffff'; g.fillRect(x + 1, y, 1, 1); }
  },
  // A faceted crystal spike standing on the ground.
  shard(g, bx, by, w, h, lean, o) {
    const tipX = bx + lean;
    for (let i = 0; i < h; i++) {
      const t = i / (h - 1);
      const ww = Math.max(1, Math.round(1 + (w - 1) * t));
      const cx = Math.round(bx + (tipX - bx) * (1 - t));
      const x0 = cx - Math.floor(ww / 2);
      g.fillStyle = o.col2; g.fillRect(x0, by - h + i, ww, 1);
      g.fillStyle = o.col; g.fillRect(x0, by - h + i, Math.max(1, ww - 1), 1);
      if (ww > 2) { g.fillStyle = U.shade(o.col, 1.55); g.fillRect(x0, by - h + i, 1, 1); }
    }
    g.fillStyle = U.shade(o.col, 1.9); g.fillRect(tipX, by - h, 1, 2);
    g.fillStyle = '#ffffff'; g.fillRect(tipX, by - h, 1, 1);
  },
  STONE_PAL: { lo: '#3a3546', mid: '#565064', hi: '#6b647c', lit: '#847c96', edge: '#453f54', crack: '#2b2735' },
  DEAD_PAL:  { lo: '#2e2b38', mid: '#403c4d', hi: '#4d4859', lit: '#5a5568', edge: '#332f3d', crack: '#24212c' },

  nodeSprite(n) {
    if (n.type === 'seal') return Art.getOutlined('node_seal', 22, 22, (g) => {
      const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      const rnd = mulberry32(4242);
      this.stone(g, 11, 19, 9, 13, rnd, this.STONE_PAL);
      // split running through the rock, with light pouring out
      R('#1d1926', 10, 7, 3, 12); R('#1d1926', 6, 11, 5, 2); R('#1d1926', 12, 14, 5, 2);
      R('#c98a22', 11, 8, 1, 10); R('#ffd23f', 11, 10, 1, 6); R('#fff6c0', 11, 12, 1, 2);
      R('#ffd23f', 7, 11, 4, 1); R('#ffd23f', 13, 14, 3, 1);
      // rune marks
      R('#ffd23f', 6, 8, 2, 1); R('#ffd23f', 6, 8, 1, 3); R('#ffd23f', 15, 16, 2, 1); R('#ffd23f', 16, 14, 1, 3);
      R('#fff6c0', 11, 6, 1, 1);
    });
    const key = 'node_' + n.type + '_' + n.ore;
    const o = ORES[n.ore];
    return Art.getOutlined(key, 22, 22, (g) => {
      const rnd = mulberry32(n.ore.length * 31 + n.type.charCodeAt(0) * 17 + n.type.length);
      const P = this.STONE_PAL;
      if (n.type === 'crystal') {
        // cluster of shards on a small rock base
        this.ell(g, 11, 18, 8, 3, '#3a3546');
        this.ell(g, 11, 17, 7, 2, '#565064');
        this.shard(g, 6, 18, 4, 9, -1, o);
        this.shard(g, 16, 18, 4, 8, 1, o);
        this.shard(g, 8, 19, 3, 6, -1, o);
        this.shard(g, 11, 19, 6, 15, 0, o);
        this.shard(g, 14, 19, 3, 7, 1, o);
        g.fillStyle = U.shade(o.col, 1.9); g.fillRect(9, 8, 1, 1); g.fillRect(17, 12, 1, 1);
        return;
      }
      if (n.type === 'pebble') {
        // three loose stones rather than one blob
        this.stone(g, 8, 19, 5, 7, rnd, P);
        this.stone(g, 14, 19, 4, 6, rnd, P);
        this.stone(g, 11, 15, 3, 5, rnd, P);
        this.nugget(g, 7, 15, 2, 2, o);
        return;
      }
      const r = n.type === 'boulder' || n.type === 'vein' ? 9 : 7;
      const h = n.type === 'boulder' || n.type === 'vein' ? 14 : 11;
      this.stone(g, 11, 19, r, h, rnd, P);
      if (n.type === 'boulder') { this.stone(g, 5, 19, 4, 6, rnd, P); }           // shoulder chunk
      if (n.type === 'vein') {
        // a rich seam running diagonally across the face
        let vx = 5, vy = 15;
        for (let i = 0; i < 6; i++) {
          this.nugget(g, vx, vy, 2 + (i % 2), 2, o);
          vx += 2; vy -= 1 + (i % 2 ? 0 : 1);
        }
        this.nugget(g, 13, 15, 3, 2, o);
        this.nugget(g, 8, 8, 2, 2, o);
      } else {
        const chunks = n.type === 'boulder' ? 4 : 2;
        for (let i = 0; i < chunks; i++) {
          const cxp = 11 + Math.round((rnd() - 0.5) * (r * 1.2));
          const cyp = 19 - h + 3 + Math.floor(rnd() * (h - 6));
          this.nugget(g, cxp, cyp, 2, 2, o);
        }
      }
    });
  },
  plainRock(n) {
    return Art.getOutlined('node_plain_' + n.type, 22, 22, (g) => {
      const rnd = mulberry32(n.type.charCodeAt(0) * 91 + n.type.length);
      const P = this.DEAD_PAL;
      if (n.type === 'pebble') { this.stone(g, 8, 19, 5, 7, rnd, P); this.stone(g, 14, 19, 4, 6, rnd, P); this.stone(g, 11, 15, 3, 5, rnd, P); return; }
      if (n.type === 'crystal') { this.ell(g, 11, 18, 8, 3, P.lo); this.stone(g, 11, 19, 6, 11, rnd, P); return; }
      const r = n.type === 'boulder' || n.type === 'vein' ? 9 : 7;
      const h = n.type === 'boulder' || n.type === 'vein' ? 14 : 11;
      this.stone(g, 11, 19, r, h, rnd, P);
      if (n.type === 'boulder') this.stone(g, 5, 19, 4, 6, rnd, P);
    });
  },
  // ---------------- pickaxe (also drawn in the player's hands)
  // A real pick head: thick at the eye, sweeping down and out to two sharp points.
  pick(tier) {
    const heads = ['#8a8f9c', '#d1804f', '#b9c0cf', '#e4ecf6', '#5a7fff', '#8ff0ff'];
    return Art.getOutlined('pick_' + tier, 22, 26, (g) => {
      const c = heads[Math.min(tier, heads.length - 1)];
      const lo = U.shade(c, 0.58), hi = U.shade(c, 1.5), glint = U.shade(c, 1.95);
      const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
      // haft, running down from the eye
      R('#33210f', 10, 4, 4, 21); R('#5c3a1e', 10, 4, 3, 21); R('#7a5230', 10, 4, 1, 21);
      R('#241608', 9, 19, 6, 4); R('#4a3018', 9, 19, 6, 3); R('#2a1a0c', 9, 21, 6, 1);   // grip wrap
      // crown of the head, widening down to where the arms split
      const crown = [[9, 1, 5], [7, 2, 9], [5, 3, 13], [3, 4, 17]];
      for (const [x, y, w] of crown) { R(lo, x, y + 1, w, 1); R(c, x, y, w, 1); }
      R(hi, 8, 1, 6, 1); R(hi, 6, 2, 4, 1);
      // the two arms: each step outward drops a row and sheds a pixel, ending in a point
      const arm = [[2, 5, 6], [1, 6, 5], [0, 7, 4], [0, 8, 3], [0, 9, 2]];
      for (const [x, y, w] of arm) {
        R(lo, x, y, w, 2);
        R(c, x, y, w, 1);
        R(lo, 22 - x - w, y, w, 2);
        R(c, 22 - x - w, y, w, 1);
      }
      R(hi, 2, 5, 4, 1); R(hi, 16, 5, 4, 1);           // lit upper bevel
      R(lo, 0, 9, 1, 1); R(lo, 21, 9, 1, 1);           // darkened tips read as edges
      R(glint, 3, 4, 3, 1); R(glint, 16, 4, 3, 1);
      R(U.shade(c, 0.72), 9, 4, 4, 2);                  // shadow where the haft passes through
      if (tier >= 4) { R('#fff3b0', 5, 3, 1, 1); R('#fff3b0', 17, 6, 1, 1); R('#fff3b0', 1, 8, 1, 1); }
    });
  },

  // ---------------- enemies
  enemyBase(type) {
    return Art.getOutlined('enemy_base_' + type, 18, 18, (g) => {
      const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      if (type === 'grunt') {
        // stocky goblin brute with a club
        R('rgba(0,0,0,0.25)', 4, 16, 10, 2);
        R('#3c5c2a', 4, 8, 9, 7); R('#4f7a3a', 4, 8, 8, 6); R('#63975c', 5, 8, 6, 2);        // torso
        R('#2a1a10', 3, 12, 11, 3); R('#42301c', 3, 12, 11, 2);                              // belt / loincloth
        R('#3c5c2a', 3, 14, 4, 4); R('#3c5c2a', 9, 14, 4, 4);                                // legs
        R('#4f7a3a', 4, 5, 8, 6); R('#63975c', 5, 5, 6, 2);                                  // head
        R('#2f4720', 4, 5, 8, 1);
        R('#ffe14a', 5, 7, 2, 2); R('#ffe14a', 9, 7, 2, 2); R('#1a0f06', 6, 8, 1, 1); R('#1a0f06', 10, 8, 1, 1);
        R('#e8e4d0', 5, 10, 1, 2); R('#e8e4d0', 10, 10, 1, 2);                               // tusks
        R('#63975c', 12, 8, 3, 4);                                                           // arm
        R('#5a3a1e', 14, 4, 2, 9); R('#7a5230', 14, 4, 1, 9); R('#8a8f9c', 13, 2, 4, 4); R('#b0b6c4', 13, 2, 4, 1); // club
      } else if (type === 'rogue') {
        // hooded knife fighter
        R('rgba(0,0,0,0.25)', 4, 16, 10, 2);
        R('#2a1c3e', 4, 9, 9, 7); R('#4a3070', 4, 9, 8, 6); R('#6a48a0', 5, 9, 5, 2);        // cloak body
        R('#241832', 3, 14, 5, 4); R('#241832', 9, 14, 4, 4);
        R('#2c1a44', 4, 3, 9, 8); R('#4a3070', 5, 3, 7, 6); R('#6a48a0', 6, 3, 4, 2);        // hood
        R('#160d22', 5, 7, 7, 3);                                                            // shadowed face
        R('#ff4a6a', 6, 8, 2, 1); R('#ff4a6a', 10, 8, 1, 1);
        R('#3a2a50', 4, 11, 10, 2);
        R('#c9c9d6', 14, 6, 1, 7); R('#f0f0fa', 14, 6, 1, 4); R('#5a3a1e', 13, 12, 3, 2);    // dagger
        R('#c9c9d6', 2, 8, 1, 6); R('#5a3a1e', 1, 13, 3, 2);
      } else if (type === 'bomber') {
        // round imp clutching a lit bomb
        R('rgba(0,0,0,0.25)', 4, 16, 10, 2);
        R('#7a2418', 3, 7, 12, 9); R('#a83a2a', 3, 7, 11, 8); R('#d0523a', 5, 7, 7, 3);      // body
        R('#5a1a10', 3, 14, 4, 4); R('#5a1a10', 10, 14, 4, 4);
        R('#8a2a1c', 4, 4, 10, 5); R('#c04a34', 5, 4, 8, 3);                                 // head
        R('#3a1a14', 2, 3, 3, 3); R('#3a1a14', 13, 3, 3, 3);                                 // horns
        R('#ffe14a', 5, 6, 2, 2); R('#ffe14a', 10, 6, 2, 2); R('#1a0f06', 6, 7, 1, 1); R('#1a0f06', 11, 7, 1, 1);
        R('#1a0f06', 7, 10, 4, 2); R('#e8e4d0', 7, 10, 1, 1); R('#e8e4d0', 10, 10, 1, 1);    // grin
        R('#2a2a34', 10, 11, 6, 6); R('#3f3f4e', 11, 11, 4, 4); R('#5a5a6c', 12, 12, 2, 1);  // bomb
        R('#7a5a2a', 14, 9, 1, 3); R('#ff9a2a', 14, 8, 1, 2); R('#fff3b0', 14, 7, 1, 1);     // fuse
      }
    });
  },
  enemy(e) {
    if (e.type === 'guardian') return this.guardian();
    const base = this.enemyBase(e.type);
    if (!e.elite) return base;
    return Art.get('enemy_elite_' + e.type, 30, 30, (g) => {
      const up = upscale(base, 1.5);
      g.drawImage(up, 0, 0);
      // elite regalia: horned crown and shoulder studs
      const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      R('#ffd23f', 9, 1, 2, 4); R('#ffd23f', 18, 1, 2, 4); R('#ffd23f', 8, 4, 13, 2); R('#fff3b0', 8, 4, 13, 1);
      R('#c9a24b', 4, 13, 3, 3); R('#c9a24b', 23, 13, 3, 3); R('#ffd23f', 4, 13, 2, 1); R('#ffd23f', 23, 13, 2, 1);
    });
  },
  guardian() {
    return Art.getOutlined('enemy_guardian', 60, 58, (g) => {
      const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      const blob = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); };
      R('rgba(0,0,0,0.25)', 8, 52, 44, 5);
      // gnarled roots splayed at the base
      for (const r of [[2, 46, 16, 7], [42, 46, 16, 7], [14, 50, 12, 6], [34, 50, 12, 6]]) { R('#2c1d0e', r[0], r[1], r[2], r[3]); R('#4a3018', r[0], r[1], r[2], r[3] - 2); }
      R('#3c2716', 8, 44, 8, 6); R('#3c2716', 44, 44, 8, 6);
      // trunk body
      R('#2c1a0e', 16, 16, 28, 36); R('#4a2f18', 18, 16, 24, 34); R('#6a4526', 20, 18, 7, 30); R('#35220f', 36, 18, 5, 30);
      for (let i = 0; i < 7; i++) R('#3a2413', 22 + (i % 3) * 6, 20 + i * 4, 2, 7);      // bark grooves
      // branch arms
      R('#4a2f18', 4, 24, 14, 5); R('#6a4526', 4, 24, 14, 2); R('#4a2f18', 2, 28, 5, 8);
      R('#4a2f18', 42, 24, 14, 5); R('#6a4526', 42, 24, 14, 2); R('#4a2f18', 53, 28, 5, 8);
      // canopy crown
      blob(30, 12, 19, '#16401b'); blob(20, 12, 13, '#16401b'); blob(40, 12, 13, '#16401b');
      blob(28, 10, 15, '#245c27'); blob(19, 11, 10, '#245c27'); blob(40, 11, 10, '#245c27');
      blob(24, 7, 9, '#3a8a38'); blob(37, 8, 7, '#3a8a38'); blob(21, 5, 4, '#59ad4e');
      const rnd = mulberry32(99);
      for (let i = 0; i < 26; i++) R(rnd() < 0.5 ? '#16401b' : '#59ad4e', 6 + Math.floor(rnd() * 48), Math.floor(rnd() * 22), 2, 2);
      // face
      R('#0a0806', 21, 26, 7, 8); R('#0a0806', 33, 26, 7, 8);
      R('#9aff7a', 22, 28, 4, 5); R('#9aff7a', 34, 28, 4, 5);
      R('#e8ffd8', 23, 29, 2, 2); R('#e8ffd8', 35, 29, 2, 2);
      R('#1a0f08', 24, 39, 14, 4); R('#0a0806', 24, 39, 14, 2);
      for (let i = 0; i < 5; i++) R('#d8c8a0', 25 + i * 3, 39, 2, 2);                     // jagged teeth
    });
  },

  // ---------------- NPCs and props
  npc(n) {
    if (n.kind === 'gate') return Art.getOutlined('npc_gate', 38, 40, (g) => {
      const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      R('rgba(0,0,0,0.3)', 3, 36, 32, 4);
      R('#2f2937', 1, 6, 8, 32); R('#4b4459', 1, 6, 5, 32); R('#1b1722', 7, 6, 2, 32);      // stone jambs
      R('#2f2937', 29, 6, 8, 32); R('#4b4459', 29, 6, 5, 32); R('#1b1722', 35, 6, 2, 32);
      for (let i = 0; i < 5; i++) { R('#5d566d', 1, 8 + i * 6, 5, 1); R('#5d566d', 29, 8 + i * 6, 5, 1); }
      R('#2f2937', 0, 1, 38, 7); R('#4b4459', 1, 1, 36, 4); R('#635c72', 1, 1, 36, 1);      // lintel
      R('#16401b', 0, 0, 38, 3); for (let i = 0; i < 9; i++) R(i % 2 ? '#3a8a38' : '#59ad4e', 2 + i * 4, i % 3, 3, 2);
      R('#08120a', 9, 8, 20, 30); R('#16401b', 10, 9, 18, 28); R('#1d4a22', 12, 12, 14, 22);
      R('#9aff7a', 16, 20, 6, 5); R('#d8ffd0', 18, 21, 2, 2);
      for (let i = 0; i < 7; i++) R('#2c5a2a', 10 + (i % 3) * 7, 10 + i * 4, 3, 2);
      R('#ffb02a', 4, 14, 3, 5); R('#fff3b0', 5, 15, 1, 2);                                  // lamps
      R('#ffb02a', 31, 14, 3, 5); R('#fff3b0', 32, 15, 1, 2);
    });
    if (n.kind === 'shrine') return Art.getOutlined('npc_shrine', 22, 32, (g) => {
      const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      R('rgba(0,0,0,0.3)', 2, 28, 18, 4);
      R('#2f2937', 2, 25, 18, 5); R('#4b4459', 2, 25, 18, 3); R('#635c72', 2, 25, 18, 1);    // plinth
      R('#3a3448', 5, 21, 12, 5); R('#544c66', 5, 21, 12, 2);
      // amethyst cluster, tallest in the middle
      const shard = (bx, by, w2, h2, c1, c2, c3) => {
        for (let i = 0; i < h2; i++) { const t = i / (h2 - 1), ww = Math.max(1, Math.round(1 + (w2 - 1) * t)), x0 = bx - Math.floor(ww / 2);
          R(c2, x0, by - h2 + i, ww, 1); R(c1, x0, by - h2 + i, Math.max(1, ww - 1), 1); if (ww > 2) R(c3, x0, by - h2 + i, 1, 1); }
      };
      shard(11, 22, 7, 17, '#9b3fd4', '#5f1f8a', '#d8a0ff');
      shard(6, 23, 5, 11, '#8b35c0', '#531a78', '#c98fee');
      shard(16, 23, 5, 12, '#8b35c0', '#531a78', '#c98fee');
      shard(8, 24, 3, 6, '#a04fdc', '#63228f', '#e0b8ff');
      R('#f0d8ff', 11, 5, 1, 3); R('#ffffff', 11, 5, 1, 1);
      R('#c9a24b', 4, 24, 14, 1);
    });
    if (n.kind === 'board') return Art.getOutlined('npc_board', 22, 28, (g) => {
      const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      R('rgba(0,0,0,0.3)', 3, 25, 16, 3);
      R('#3a2412', 3, 16, 3, 11); R('#5c3a1e', 3, 16, 2, 11);
      R('#3a2412', 16, 16, 3, 11); R('#5c3a1e', 16, 16, 2, 11);
      R('#2a1a0e', 0, 1, 22, 18); R('#6b4526', 1, 2, 20, 16); R('#8a6236', 1, 2, 20, 2);
      for (let i = 0; i < 4; i++) R('#5c3a1e', 1, 5 + i * 4, 20, 1);
      R('#efe6c8', 3, 4, 7, 6); R('#d8cfae', 3, 8, 7, 2); R('#c0392b', 5, 4, 2, 2);
      R('#efe6c8', 12, 5, 7, 8); R('#d8cfae', 12, 11, 7, 2); R('#3a6fa8', 14, 5, 2, 2);
      R('#efe6c8', 4, 12, 6, 4); R('#d4c23f', 6, 12, 2, 2);
      R('#c9a24b', 0, 0, 22, 1); R('#c9a24b', 0, 18, 22, 1);
    });
    // ---- dwarven shopkeepers: stocky, bearded, each kitted out for their trade
    const TRADE = {
      forge:     { tunic: '#8a3a2a', trim: '#d4883f', beard: '#c8b48a', helm: '#8a8f9c' },
      smith:     { tunic: '#245f94', trim: '#4f9fd4', beard: '#8a6a3a', helm: '#6b7a8c' },
      enchanter: { tunic: '#4a2070', trim: '#9b3fd4', beard: '#d8d0e8', helm: '#3a1a58' },
      alchemist: { tunic: '#1d6a4a', trim: '#26b37a', beard: '#a8703a', helm: '#8a6236' },
      merchant:  { tunic: '#7a5424', trim: '#c08a4a', beard: '#6b4a2a', helm: '#5c3a1e' },
    };
    const T = TRADE[n.kind] || TRADE.merchant;
    return Art.getOutlined('npc_' + n.kind, 18, 26, (g) => {
      const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
      const dark = U.shade(T.tunic, 0.66), hi = U.shade(T.tunic, 1.3);
      const skin = '#e0b088', skinLo = '#bc8a60';
      R('rgba(0,0,0,0.3)', 3, 23, 12, 3);
      R('#241708', 3, 20, 5, 4); R('#3d2814', 3, 20, 5, 2);                      // boots
      R('#241708', 10, 20, 5, 4); R('#3d2814', 10, 20, 5, 2);
      R(dark, 4, 17, 4, 4); R(dark, 10, 17, 4, 4);                                // legs
      R(dark, 2, 10, 14, 8); R(T.tunic, 2, 10, 13, 7); R(hi, 3, 10, 6, 2);        // barrel chest
      R('#2a1a0e', 2, 16, 14, 3); R(T.trim, 7, 16, 4, 3); R(U.shade(T.trim, 1.5), 8, 17, 2, 1);   // belt + buckle
      R(skinLo, 0, 11, 3, 6); R(skin, 0, 11, 3, 4);                                // arms
      R(skinLo, 15, 11, 3, 6); R(skin, 15, 11, 3, 4);
      R(T.tunic, 0, 10, 3, 3); R(T.tunic, 15, 10, 3, 3);                           // sleeves
      R(skinLo, 5, 4, 8, 7); R(skin, 5, 4, 7, 6);                                  // head
      R(skinLo, 8, 7, 3, 2);                                                       // nose
      R('#1a1008', 6, 6, 1, 1); R('#1a1008', 11, 6, 1, 1);
      R(U.shade(T.beard, 0.7), 3, 8, 12, 9); R(T.beard, 3, 8, 11, 8);              // great beard
      R(T.beard, 4, 15, 10, 3); R(U.shade(T.beard, 0.8), 5, 17, 8, 2);
      R(U.shade(T.beard, 1.2), 5, 9, 4, 2);
      R(T.beard, 5, 7, 8, 2);                                                      // moustache
      R(U.shade(T.helm, 0.7), 4, 1, 10, 5); R(T.helm, 4, 1, 9, 4); R(U.shade(T.helm, 1.35), 5, 1, 5, 1);
      R(U.shade(T.helm, 0.8), 3, 3, 2, 4); R(U.shade(T.helm, 0.8), 13, 3, 2, 4);   // cheek guards
      // trade kit
      if (n.kind === 'forge') {
        R('#3a2412', 2, 10, 13, 8); R('#5c3a1e', 2, 10, 13, 7); R('#7a5230', 3, 10, 5, 2);     // leather apron
        R('#2a1a0e', 2, 16, 14, 2);
        R('#5a3a1e', 16, 4, 2, 12); R('#8a8f9c', 13, 1, 7, 5); R('#b0b6c4', 13, 1, 7, 1);       // hammer over the shoulder
        R('#ff8a2a', 0, 18, 2, 2); R('#ffd23f', 0, 18, 1, 1);
      } else if (n.kind === 'smith') {
        R('#3f3f4e', 4, 2, 10, 3); R('#7fd8ff', 5, 3, 3, 2); R('#7fd8ff', 10, 3, 3, 2);         // goggles pushed up
        R('#5a3a1e', 16, 6, 2, 11); R('#8a8f9c', 14, 4, 6, 3); R('#b0b6c4', 14, 4, 6, 1);       // pick on the shoulder
        R('#2a2a34', 1, 17, 5, 4); R('#4f9fd4', 2, 18, 3, 2);
      } else if (n.kind === 'enchanter') {
        R(U.shade(T.tunic, 0.8), 3, 0, 12, 8); R(T.tunic, 4, 1, 10, 6); R(hi, 5, 1, 4, 2);      // deep hood
        R('#120a1c', 5, 5, 8, 4); R('#c23bff', 6, 6, 2, 2); R('#c23bff', 10, 6, 2, 2);
        R('#5a3a1e', 16, 5, 2, 14); R('#9b3fd4', 14, 1, 5, 5); R('#e6b8ff', 15, 2, 3, 3); R('#ffffff', 16, 2, 1, 1);
        R('#9b3fd4', 2, 12, 2, 2); R('#9b3fd4', 13, 13, 2, 2);                                  // rune trim
      } else if (n.kind === 'alchemist') {
        R('#3a2a18', 2, 11, 14, 3); R('#5c3a20', 2, 11, 14, 2);                                 // bandolier
        for (let i = 0; i < 4; i++) R(['#3fd17a', '#e0344f', '#7fd8ff', '#ffd23f'][i], 3 + i * 3, 11, 2, 3);
        R('#2a2a34', 15, 15, 4, 6); R('#26b37a', 16, 16, 2, 4); R('#7fe8aa', 16, 16, 1, 2);      // flask in hand
        R('#8a6236', 0, 13, 3, 5); R('#efe6c8', 0, 14, 3, 3);                                    // book
      } else {
        R('#c9a24b', 2, 12, 13, 2);                                                              // coin chain
        R('#3a2412', 15, 13, 4, 6); R('#6b4526', 15, 13, 4, 5); R('#ffd23f', 16, 15, 2, 2);      // purse
        R('#efe6c8', 0, 12, 4, 6); R('#d8cfae', 0, 16, 4, 2); R('#3a6fa8', 1, 13, 2, 1);         // ledger
        R(T.trim, 4, 0, 10, 3); R(U.shade(T.trim, 1.3), 5, 0, 6, 1);                             // flat cap
      }
    });
  },
};
const Light = {
  cache: {},
  get(r) {
    r = Math.max(10, Math.round(r / 6) * 6);
    if (this.cache[r]) return this.cache[r];
    const c = Art.mk(r * 2, r * 2, (g) => {
      const gr = g.createRadialGradient(r, r, r * 0.15, r, r, r);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    });
    return (this.cache[r] = c);
  },
};

// ---------------------------------------------------------------- shared helpers
function gainXp(n) {
  S.xp += n;
  while (S.xp >= xpNeeded(S.level)) {
    S.xp -= xpNeeded(S.level); S.level++;
    S.spins = (S.spins || 0) + 1; Game.toast(`LEVEL UP! Level ${S.level} (+1 race spin)`, '#ffd23f'); Sfx.play('levelup');
  }
}
function addOre(id, n) { S.ores[id] = (S.ores[id] || 0) + n; (S.stats.seen || (S.stats.seen = {}))[id] = true; }
function addGem(id, n) { S.gems[id] = (S.gems[id] || 0) + n; }
function addGold(n) { S.gold += n; }

// ---------------------------------------------------------------------------
class WorldScene {
  constructor() {
    this.hub = null; this.caves = {}; this.lv = null; this.floor = 0;
    this.P = null; this.cam = { x: 0, y: 0 }; this.slashes = []; this.deadT = 0; this.prompt = null; this.saveT = 0; this.hitStop = 0; this.time = 0;
    this.held = 0; this.hintT = 0; this.hintMsg = ''; // held tool: 0 pickaxe, 1 weapon
    this.pickups = []; this.hazards = []; this.achT = 0; this.bossHurt = false;
  }
  enter() { if (!this.hub) this.hub = genHub(); this.goto(0); }
  goto(floor, fromBelow = false) {
    this.floor = floor; FX.clear(); this.slashes = []; this.pickups = []; this.hazards = []; this.bossHurt = false;
    if (floor === 0) { this.lv = this.hub; this.caves = {}; }
    else if (floor === BOSS_FLOOR) { this.lv = genBossArena(); this.caves = {}; this.bossIntro = 2.2; Game.toast('The Ancient Grove Guardian stirs...', '#7fd08a'); }
    else {
      if (!this.caves[floor]) this.caves[floor] = genCave(floor);
      this.lv = this.caves[floor];
      S.stats.bestFloor = Math.max(S.stats.bestFloor, floor);
      Quests.event('floor', floor);
    }
    const lv = this.lv;
    let sx = lv.spawn.x, sy = lv.spawn.y;
    if (floor === 0 && fromBelow === 'gate') { const g = lv.npcs.find(n => n.kind === 'gate'); sx = g.x; sy = g.y + 22; }
    else if (floor === 0 && fromBelow === 'spawn') { const r = lv.mineReturn || lv.spawn; sx = r.x; sy = r.y; } // step out of the mine mouth
    else if (fromBelow === true && lv.exitPt) { sx = lv.exitPt.x; sy = lv.exitPt.y - 16; }
    const hp = this.P ? this.P.hp : null;
    this.P = new Player(sx, sy);
    this.P.hp = hp && !this.P.dead ? Math.min(hp, this.P.stats.maxHp) : this.P.stats.maxHp;
    this.cam.x = U.clamp(sx - VW / 2, 0, lv.w * TS - VW); this.cam.y = U.clamp(sy - VH / 2, 0, lv.h * TS - VH);
    Save.save();
  }

  // ------------------------------------------------------------ update
  update(dt) {
    dt = Math.min(dt, 0.05);
    if (this.hitStop > 0) { this.hitStop -= dt; this.updateHotbar(dt); return; } // hit-stop freezes the action but never eats hotbar input
    this.time += dt; S.stats.playTime += dt;
    const P = this.P, lv = this.lv;
    P.stats = calcStats();
    for (const k in S.buffs) { S.buffs[k] -= dt; if (S.buffs[k] <= 0) delete S.buffs[k]; }
    if (P.hp > P.stats.maxHp) P.hp = P.stats.maxHp;
    FX.update(dt);
    this.slashes = this.slashes.filter(s => (s.t -= dt) > 0);
    Game.shake = Math.max(0, Game.shake - dt * 30);
    for (const n of lv.nodes) {
      if (n.flash > 0) n.flash -= dt;
      if (!n.alive) { n.respawn -= dt; if (n.respawn <= 0 && U.dist(n.x, n.y, P.x, P.y) > 60) { n.alive = true; n.hp = n.max; } }
    }
    if (P.dead) { this.deadT += dt; if (this.deadT > 2.2) this.respawn(); return; }
    this.updateHotbar(dt);
    this.updatePlayer(dt);
    for (const e of lv.enemies) if (!e.dead) this.updateEnemy(e, dt);
    lv.enemies = lv.enemies.filter(e => !e.dead);
    this.updateExtras(dt);
    // magma damage
    if (lv.theme === 'cave' && lv.tileAtPx(P.x, P.y) === T_MAGMA && P.iframes <= 0) {
      P.hp -= 9 * dt * 100 / (100 + P.stats.def); if (Math.random() < 0.3) FX.spark(P.x, P.y, '#ff8a2a', 1, 30, 0.3);
      if (P.hp <= 0) this.killPlayer();
    }
    // camera
    const tx = U.clamp(P.x - VW / 2, 0, lv.w * TS - VW), ty = U.clamp(P.y - VH / 2, 0, lv.h * TS - VH);
    this.cam.x = U.lerp(this.cam.x, tx, Math.min(1, dt * 9)); this.cam.y = U.lerp(this.cam.y, ty, Math.min(1, dt * 9));
    // autosave in hub
    this.saveT += dt; if (this.saveT > 30 && this.floor === 0) { Save.save(); this.saveT = 0; }
  }

  updatePlayer(dt) {
    const P = this.P, lv = this.lv, st = P.stats;
    P.iframes -= dt; P.dashCd -= dt; P.stun -= dt; P.regenDelay -= dt;
    const mx = Game.top() === this ? Input.mx + this.cam.x : P.x, my = Input.my + this.cam.y;
    if (P.state !== 'attack' && P.state !== 'dash' && P.stun <= 0) P.face = Input.touch ? Touch.aim(this, P) : Math.atan2(my - P.y, mx - P.x);
    P.dir = Math.cos(P.face) >= 0 ? 1 : -1;
    // movement input
    let ix = (Input.key('KeyD', 'ArrowRight') ? 1 : 0) - (Input.key('KeyA', 'ArrowLeft') ? 1 : 0);
    let iy = (Input.key('KeyS', 'ArrowDown') ? 1 : 0) - (Input.key('KeyW', 'ArrowUp') ? 1 : 0);
    if (ix && iy) { ix *= Math.SQRT1_2; iy *= Math.SQRT1_2; }
    if (Input.stick && (Input.stick.x || Input.stick.y)) { ix = Input.stick.x; iy = Input.stick.y; } // touch joystick
    const moving = ix !== 0 || iy !== 0;
    if (P.sta <= 0) P.exhausted = true; else if (P.sta >= 18) P.exhausted = false;
    P.sprint = false;
    // Parry (F): only while holding the weapon. Lasts SHIELD_TIME seconds, then a cooldown.
    if (P.shieldT > 0 && this.held !== 1) { P.shieldT = 0.0001; } // putting the weapon away drops the parry
    if (P.shieldT > 0) { P.shieldT -= dt; if (P.shieldT <= 0) { P.shieldT = 0; P.shieldCd = SHIELD_CD; Sfx.play('bad'); } }
    else if (P.shieldCd > 0) P.shieldCd = Math.max(0, P.shieldCd - dt);
    else if (Input.hit('KeyF') && this.held !== 1) this.setHint('Select your weapon [2] to parry');
    else if (Input.hit('KeyF') && P.stun <= 0 && Game.top() === this) { P.shieldT = SHIELD_TIME; P.parryAng = P.face; Sfx.play('block'); FX.spark(P.x, P.y - 4, '#bfe6ff', 12, 70, 0.4); }
    P.blocking = P.shieldT > 0;
    let speed = 62 * st.moveMult;

    if (P.stun > 0) { speed = 0; P.state = 'stun'; }
    else if (P.state === 'dash') {
      P.t += dt; moveEnt(lv, P, Math.cos(P.dashAng) * 250 * dt, Math.sin(P.dashAng) * 250 * dt);
      if (P.t >= 0.17) { P.state = 'idle'; }
      speed = 0;
    } else if (P.state === 'attack') {
      const a = P.atk; a.t += dt; speed *= 0.2;
      if (!a.hit && a.t >= a.wind) { a.hit = true; this.doPlayerHits(a); }
      if (a.t >= a.wind + a.rec) { P.state = 'idle'; P.atk = null; }
    } else {
      P.state = 'idle';
      // sprint
      if (Input.key('ShiftLeft', 'ShiftRight') && moving && !P.exhausted) { P.sprint = true; speed *= 1.45; P.useSta(14 * dt); }
      // dash
      if (Input.hit('KeyQ') && P.dashCd <= 0 && P.sta >= 20 && !P.exhausted) {
        P.useSta(20); P.state = 'dash'; P.t = 0; P.iframes = Math.max(P.iframes, 0.24); P.dashCd = 0.45;
        P.dashAng = moving ? Math.atan2(iy, ix) : P.face + Math.PI; Sfx.play('dash');
        FX.spark(P.x, P.y + 4, '#ccc', 5, 40, 0.3);
      }
      // attacks
      if (P.state === 'idle') {
        const wantLight = (Input.mpressed[0] && !Input.touch) || Input.atkPressed, wantHeavy = Input.mpressed[2] || Input.hit('KeyR');
        if ((wantLight || wantHeavy) && this.held !== 1) this.setHint('Select your weapon [2] to fight');
        else if (wantLight) this.startAttack(false);
        else if (wantHeavy) this.startAttack(true);
      }
      // mining (hold E)
      this.updateMining(dt, moving);
    }
    if (P.state === 'idle' || P.state === 'attack') {
      if (moving && speed > 0) { moveEnt(lv, P, ix * speed * dt, iy * speed * dt); P.walk += dt * (P.sprint ? 14 : 9); }
    }
    // stamina regen
    if (P.regenDelay <= 0 && !P.sprint) P.sta = Math.min(100, P.sta + (P.exhausted ? 22 : 34) * dt);
    // interactables
    this.prompt = this.findInteract();
    if (this.prompt && Input.hit('KeyE')) this.activate(this.prompt);
    if (Input.hit('KeyT', 'Tab', 'KeyI')) Game.push(new InventoryScene());
    if (Input.hit('Escape')) Game.push(new PauseScene());
  }

  // ------------------------------------------------------------ hotbar
  // Slot 0 = pickaxe, slot 1 = weapon (held tools); slots 2-6 = potions assigned in the inventory.
  hotbarRect(i) { const w = 24, x0 = Math.round((VW - HOTBAR_SLOTS * (w + 1)) / 2); return { x: x0 + i * (w + 1), y: VH - 27, w, h: 24 }; }
  // The parry guards a cone toward the exact mouse angle at the moment F was pressed.
  // Locked in the moment F is pressed: moving the mouse afterwards does not turn the guard.
  parryDir() { return this.P.shieldT > 0 ? this.P.parryAng : this.P.face; }
  hudButtons() {
    return [
      { x: VW - 86, y: VH - 31, w: 80, h: 13, label: 'Quests [J]', fn: () => Game.push(new QuestLogScene()) },
      { x: VW - 86, y: VH - 16, w: 80, h: 13, label: 'Controls [H]', fn: () => Game.push(new ControlsScene()) },
    ];
  }
  setHint(msg) { this.hintMsg = msg; this.hintT = 1.6; }
  selectSlot(i) {
    if (i < 2) {
      if (this.held !== i && this.P.state === 'attack') return;
      if (this.held !== i) { this.held = i; Sfx.play('ui'); this.P.mineT = 0; }
    } else {
      const id = S.hotbar[i - 2];
      if (id && S.potions[id] > 0) usePotion(id, this);
      else if (id) this.setHint(`Out of ${POTIONS[id].n}s`);
      else this.setHint('Empty slot: assign potions in your inventory (T)');
    }
  }
  updateHotbar(dt) {
    if (this.hintT > 0) this.hintT -= dt;
    for (let i = 0; i < HOTBAR_SLOTS; i++) if (Input.hit('Digit' + (i + 1))) this.selectSlot(i);
    if (UI.wheel) { const d = Math.sign(UI.wheel); this.selectSlot(U.clamp(this.held + d, 0, 1)); UI.wheel = 0; }
    if (Input.hit('KeyH')) Game.push(new ControlsScene());
    if (Input.hit('KeyJ')) Game.push(new QuestLogScene());
    if (Input.hit('KeyK')) Game.push(new AchievementsScene());
    if (Input.mpressed[0]) {
      for (const b of this.hudButtons()) {
        if (Input.mx >= b.x && Input.mx < b.x + b.w && Input.my >= b.y && Input.my < b.y + b.h) { Input.mpressed[0] = false; Sfx.play('ui'); b.fn(); return; }
      }
      for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const r = this.hotbarRect(i);
        if (Input.mx >= r.x && Input.mx < r.x + r.w && Input.my >= r.y && Input.my < r.y + r.h) { this.selectSlot(i); Input.mpressed[0] = false; break; }
      }
    }
  }

  startAttack(heavy) {
    const P = this.P, ws = P.stats.wstats;
    const cost = ws.sta * (heavy ? 1.7 : 1);
    if (P.sta < Math.min(cost, 25) || P.exhausted) return;
    P.useSta(cost);
    const wind = ws.wind * (heavy ? 1.7 : 1), rec = Math.max(0.12, (ws.cd - ws.wind) * (heavy ? 1.4 : 1));
    P.state = 'attack'; P.atk = { heavy, t: 0, wind, rec, hit: false, ang: P.face, range: ws.range * (heavy ? 1.15 : 1), arc: ws.arc * (heavy ? 1.1 : 1) };
    Sfx.play('swing');
  }

  doPlayerHits(a) {
    const P = this.P, st = P.stats;
    this.slashes.push({ x: P.x, y: P.y, ang: a.ang, range: a.range, arc: a.arc, t: 0.14, max: 0.14, col: st.weapon ? st.weapon.color : '#fff', heavy: a.heavy });
    let hits = 0;
    for (const e of this.lv.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (d > a.range + e.r) continue;
      const ang = Math.atan2(e.y - P.y, e.x - P.x);
      if (d > e.r + 7 && Math.abs(U.angDiff(ang, a.ang)) > (a.arc * Math.PI / 180) / 2) continue;
      this.damageEnemy(e, st.dmg * (a.heavy ? 1.8 : 1), { heavy: a.heavy, ang: a.ang }); hits++;
    }
    if (hits && P.fireCharges > 0) P.fireCharges--;
    if (hits) { this.hitStop = a.heavy ? 0.06 : 0.03; Game.shake = Math.max(Game.shake, a.heavy ? 3 : 1.5); }
  }

  damageEnemy(e, dmg, o = {}) {
    const P = this.P, st = P.stats;
    const crit = Math.random() < 0.08;
    const punish = (e.parried && e.stun > 0 ? 1.5 : 1) * (st.voidBonus && e.hp < e.maxHp * 0.6 ? 1 + st.voidBonus : 1) * (!o.noProc && P.fireCharges > 0 ? 1.4 : 1); // parry-stun, Void spell and Inferno powerup bonuses
    const d = dmg * (0.92 + Math.random() * 0.16) * (crit ? 1.5 : 1) * punish;
    e.hp -= d; e.hitFlash = 0.12;
    const kb = (o.heavy ? 120 : 60) * (e.elite ? 0.4 : 1) * (e.boss ? 0.1 : 1);
    e.kx = Math.cos(o.ang || 0) * kb; e.ky = Math.sin(o.ang || 0) * kb;
    if (o.heavy && !e.elite && !e.boss) { e.stun = Math.max(e.stun, 0.4); if (e.state === 'windup' || e.state === 'fuse') { e.state = 'chase'; e.t = 0; } }
    FX.text(e.x, e.y - 10, String(Math.round(d)), crit ? '#ffd23f' : '#ffffff');
    FX.spark(e.x, e.y, crit ? '#ffd23f' : '#ffe8c0', 5, 70, 0.3);
    Sfx.play('hit');
    if (st.lifesteal) P.hp = Math.min(st.maxHp, P.hp + d * st.lifesteal);
    if (!o.noProc) {
      if (st.burnAlways || Math.random() < st.burnChance) { e.burn = 3; e.burnDps = Math.max(e.burnDps, dmg * 0.12); }
      if (Math.random() < st.boom) this.explode(e.x, e.y, 40, dmg * 0.6, e);
      if (P.fireCharges > 0) { e.burn = 3; e.burnDps = Math.max(e.burnDps, dmg * 0.2); }
      if (st.slowHit) e.slow = 2.5;
      if (Math.random() < st.chain) this.chainLightning(e, dmg * 0.5);
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  chainLightning(from, dmg) {
    let hit = 0;
    for (const t of this.lv.enemies) {
      if (t === from || t.dead || hit >= 2 || Math.hypot(t.x - from.x, t.y - from.y) > 70) continue;
      hit++; for (let i = 0; i <= 6; i++) FX.spark(U.lerp(from.x, t.x, i / 6), U.lerp(from.y, t.y, i / 6), '#bfe6ff', 1, 10, 0.25, 2);
      this.damageEnemy(t, dmg, { noProc: true, ang: Math.atan2(t.y - from.y, t.x - from.x) });
    }
  }

  explode(x, y, r, dmg, skip) {
    FX.spark(x, y, '#ff9a2a', 18, 110, 0.5, 2); FX.spark(x, y, '#fff3b0', 8, 60, 0.3, 1); Sfx.play('boom'); Game.shake = Math.max(Game.shake, 4);
    for (const e of this.lv.enemies) if (e !== skip && !e.dead && Math.hypot(e.x - x, e.y - y) < r + e.r) this.damageEnemy(e, dmg, { noProc: true, ang: Math.atan2(e.y - y, e.x - x) });
  }

  killEnemy(e) {
    if (e.dead) return; e.dead = true;
    const d = e.d, mult = e.elite ? 3 : 1;
    const gold = Math.round(U.ri(d.gold[0], d.gold[1]) * mult * (1 + 0.1 * (e.level - 1)) * (S.buffs.goldrush > 0 ? 2 : 1));
    addGold(gold); FX.text(e.x, e.y - 14, `+${gold}g`, '#ffd23f'); Sfx.play('coin');
    if (Math.random() < (e.elite ? 1 : 0.3)) { const n = e.elite ? U.ri(2, 4) : 1; S.essence += n; FX.text(e.x, e.y - 22, `+${n} essence`, '#b58cff'); }
    if (Math.random() < (e.elite ? 0.9 : 0.06)) { const n = e.elite ? U.ri(1, 2) : 1; S.runeFrags += n; FX.text(e.x, e.y - 30, `+${n} rune frag`, '#ff8a5a'); }
    gainXp(Math.round(d.xp * mult * (1 + 0.08 * (e.level - 1)))); S.stats.kills++;
    Quests.event('kill', e.type);
    FX.spark(e.x, e.y, '#8a2a2a', 8, 60, 0.5, 2);
    if (e.boss) this.bossDefeated(e); else this.dropPowerup(e);
  }

  killPlayer() {
    const P = this.P; if (P.dead) return;
    P.dead = true; P.hp = 0; this.deadT = 0; S.stats.deaths++; Sfx.play('hurt'); Game.shake = 6;
  }
  respawn() {
    const loss = Math.min(S.gold, Math.round(S.gold * 0.08));
    S.gold -= loss; S.buffs = {};
    this.P.dead = false; this.P.hp = 1;
    this.goto(0);
    this.P.hp = this.P.stats.maxHp;
    Game.toast(`You were knocked out. Lost ${loss} gold. Gear and ore are safe.`, '#ff8a8a');
  }

  hurtPlayer(raw, sx, sy, src) {
    const P = this.P;
    if (P.iframes > 0 || P.dead || P.state === 'dash') return false;
    const st = P.stats;
    let dmg = raw * 100 / (100 + st.def * 2) * (1 - st.dr);
    const from = Math.atan2(sy - P.y, sx - P.x);
    if (P.shieldT > 0 && Math.abs(U.angDiff(from, this.parryDir())) <= PARRY_ARC) { // hit from the guarded side: no damage, attacker stunned
      Sfx.play('perfect'); FX.spark(P.x + Math.cos(from) * 11, P.y - 4 + Math.sin(from) * 11, '#ffffff', 12, 90, 0.3, 2);
      P.iframes = 0.15; this.hitStop = Math.max(this.hitStop, 0.07); Game.shake = Math.max(Game.shake, 3);
      if (src && !src.dead) {
        src.stun = Math.max(src.stun, PARRY_STUN * (src.boss ? 0.45 : src.elite ? 0.6 : 1)); src.parried = true;
        if (src.boss) { src.bstate = 'move'; src.at = null; src.cd = 0.8; }
        src.state = 'chase'; src.t = 0; src.swing = 0; src.hitDone = true;
        src.kx = -Math.cos(from) * 70; src.ky = -Math.sin(from) * 70;
        FX.text(P.x, P.y - 18, 'PARRY!', '#ffd23f'); FX.text(src.x, src.y - 20, 'STUNNED', '#ffd23f');
      } else FX.text(P.x, P.y - 18, 'BLOCKED', '#bfe6ff');
      return true;
    } else if (P.barrier > 0) { // Barrier powerup
      P.barrier--; P.iframes = 0.3; Sfx.play('block'); FX.text(P.x, P.y - 18, 'BARRIER', '#7fd8ff'); return true;
    } else if (Math.random() < st.iceShield) { // Ice Shield spell
      P.iframes = 0.3; Sfx.play('block'); FX.text(P.x, P.y - 18, 'ICE SHIELD', '#bfe6ff'); return true;
    } else {
      P.iframes = 0.5; Sfx.play('hurt'); Game.shake = Math.max(Game.shake, 3); this.bossHurt = true; Quests.event('hurt');
      P.vx = -Math.cos(from) * 90; moveEnt(this.lv, P, -Math.cos(from) * 6, -Math.sin(from) * 6);
      if (src && st.reflect) { src.burn = 3; src.burnDps = Math.max(src.burnDps, st.reflect); }
      if (st.armBoom && Math.random() < st.armBoom) this.explode(P.x, P.y, 44, 30, null);
      if (P.state === 'attack' && dmg > st.maxHp * 0.12) { P.state = 'idle'; P.atk = null; }
    }
    P.hp -= dmg; FX.text(P.x, P.y - 12, String(Math.round(dmg)), '#ff5a5a');
    if (P.hp <= 0) this.killPlayer();
    return true;
  }

  // ------------------------------------------------------------ mining
  updateMining(dt, moving) {
    const P = this.P, lv = this.lv;
    P.mineTarget = null;
    if (!Input.key('KeyE') || P.state !== 'idle' || this.prompt) { P.mineT = Math.max(0, P.mineT - dt); return; }
    let best = null, bd = 30;
    for (const n of lv.nodes) {
      if (!n.alive) continue;
      const d = Math.hypot(n.x - P.x, n.y - P.y) - n.r;
      if (d < bd) { bd = d; best = n; }
    }
    if (best && this.held !== 0) { this.setHint('Select your pickaxe [1] to mine'); return; } // must be holding the pickaxe
    if (!best) return;
    P.mineTarget = best; P.face = Math.atan2(best.y - P.y, best.x - P.x);
    best.labelUntil = this.time + 1.2;   // keep the name plate up briefly between swings
    const interval = P.stats.haste ? 0.34 : 0.42;
    P.mineT += dt;
    if (P.mineT >= interval) {
      if (P.exhausted || P.sta < 3) return;
      P.mineT = 0; P.useSta(3.2); Sfx.play('mine');
      const dmg = P.stats.minePower * U.rnd(0.9, 1.1);
      best.hp -= dmg; best.flash = 0.1;
      FX.spark(best.x + Math.cos(P.face + Math.PI) * best.r * 0.6, best.y + Math.sin(P.face + Math.PI) * best.r * 0.6, ORES[best.ore].col, 3, 45, 0.3, 1, 90);
      FX.text(best.x, best.y - 10, String(Math.round(dmg)), '#cfcfcf');
      if (best.hp <= 0) this.breakNode(best);
    }
  }
  breakNode(n) {
    const P = this.P, d = NODES[n.type], st = P.stats;
    n.alive = false; n.respawn = 150; Sfx.play('break'); Game.shake = Math.max(Game.shake, 1.5);
    FX.spark(n.x, n.y, ORES[n.ore].col, 12, 80, 0.5, 2, 120); FX.spark(n.x, n.y, '#777', 6, 50, 0.4, 1, 120);
    if (d.seal) { n.respawn = 1e9; Game.toast('The rock crumbles, revealing a hidden cavern!', '#ffd23f'); gainXp(d.xp); return; }
    let count = U.ri(d.drops[0], d.drops[1]);
    count = Math.floor(count * st.yieldMult + Math.random());
    const got = {};
    for (let i = 0; i < count; i++) {
      const id = Math.random() < 0.55 ? n.ore : rollOre(n.floor, d.boost, st.luck);
      got[id] = (got[id] || 0) + 1;
    }
    let dy = 0;
    for (const id in got) { addOre(id, got[id]); FX.text(n.x, n.y - 12 - dy, `+${got[id]} ${ORES[id].n}`, ORES[id].col); dy += 8; Quests.event('ore', id, got[id]); }
    if (Math.random() < d.gemChance * (1 + st.luck * 0.8) * st.yieldMult) {
      const g = rollGem(n.floor, st.luck); addGem(g, 1); FX.text(n.x, n.y - 12 - dy, `+1 ${GEMS[g].n}!`, GEMS[g].col); Sfx.play('perfect');
    }
    gainXp(d.xp); S.stats.mined++; S.tutorial.mine = true;
  }

  // ------------------------------------------------------------ interaction
  findInteract() {
    const P = this.P, lv = this.lv; let best = null, bd = 26;
    const test = (o, label) => { const d = Math.hypot(o.x - P.x, o.y - P.y); if (d < bd) { bd = d; best = { o, label }; } };
    for (const n of lv.npcs) test(n, n.name);
    for (const c of lv.chests || []) if (!c.opened) test(c, 'Open the Chest');
    if (this.floor === BOSS_FLOOR) test(lv.ladderUp, 'Leave the Arena');
    else if (this.floor === 0) test(lv.shaftDown, 'Mine Levels');
    else {
      test(lv.ladderUp, 'Mine Levels');
      if (lv.shaftDown) test(lv.shaftDown, 'Mine Levels');
    }
    return best;
  }
  activate(p) {
    const o = p.o;
    if (this.floor === BOSS_FLOOR && o === this.lv.ladderUp) { Save.save(); return this.goto(0, 'gate'); }
    if ((this.lv.chests || []).includes(o)) return this.openChest(o);
    if (this.floor === 0 && o === this.lv.shaftDown) return Game.push(new DescendScene(this));
    if (this.floor > 0 && (o === this.lv.ladderUp || o === this.lv.shaftDown)) return Game.push(new DescendScene(this));
    switch (o.kind) {
      case 'forge': return Game.push(new ForgeScene());
      case 'merchant': return Game.push(new MerchantScene());
      case 'smith': return Game.push(new SmithScene());
      case 'alchemist': return Game.push(new AlchemistScene());
      case 'enchanter': return Game.push(new EnchanterScene());
      case 'board': return Game.push(new BoardScene());
      case 'shrine': return Game.push(new RaceScene());
      case 'gate': return Game.push(new BossGateScene(this));
    }
  }

  // ------------------------------------------------------------ enemy AI
  step(e, tx, ty, spd, dt) {
    const a = Math.atan2(ty - e.y, tx - e.x), want = spd * dt;
    for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
      const ox = e.x, oy = e.y;
      moveEnt(this.lv, e, Math.cos(a + off) * want, Math.sin(a + off) * want);
      if (Math.hypot(e.x - ox, e.y - oy) > want * 0.4) return;
    }
  }
  updateEnemy(e, dt) {
    const P = this.P, lv = this.lv, d = e.d;
    e.hitFlash -= dt; e.bob += dt * 5;
    if (e.burn > 0) { e.burn -= dt; e.hp -= e.burnDps * dt; if (Math.random() < 0.2) FX.spark(e.x, e.y - 4, '#ff8a2a', 1, 20, 0.3); if (e.hp <= 0) return this.killEnemy(e); }
    if (Math.abs(e.kx) + Math.abs(e.ky) > 1) { moveEnt(lv, e, e.kx * dt, e.ky * dt); e.kx *= Math.max(0, 1 - dt * 9); e.ky *= Math.max(0, 1 - dt * 9); }
    if (e.stun > 0) { e.stun -= dt; if (e.stun <= 0) e.parried = false; return; }
    if (e.boss) return this.updateBoss(e, dt);
    const dx = P.x - e.x, dy = P.y - e.y, dist = Math.hypot(dx, dy);
    if (e.slow > 0) e.slow -= dt;
    const spd = e.spd * (e.slow > 0 ? 0.55 : 1);
    const aggro = d.aggro * (e.elite ? 1.3 : 1);
    switch (e.state) {
      case 'idle': {
        e.wander.t -= dt;
        if (e.wander.t <= 0) { e.wander.x = e.home.x + U.rnd(-30, 30); e.wander.y = e.home.y + U.rnd(-30, 30); e.wander.t = U.rnd(1.5, 3.5); }
        if (Math.hypot(e.wander.x - e.x, e.wander.y - e.y) > 3) this.step(e, e.wander.x, e.wander.y, spd * 0.35, dt);
        if (!P.dead && dist < aggro && hasLOS(lv, e.x, e.y, P.x, P.y)) { e.state = 'chase'; e.t = 0; }
        break;
      }
      case 'chase': {
        if (P.dead || dist > aggro * 2.4) { e.state = 'idle'; break; }
        e.face = Math.atan2(dy, dx);
        if (e.type === 'grunt' && dist <= d.range) { e.state = 'windup'; e.t = 0; e.face = Math.atan2(dy, dx); }
        else if (e.type === 'rogue' && dist <= d.range && dist > 30) { e.state = 'windup'; e.t = 0; e.dirX = dx / dist; e.dirY = dy / dist; }
        else if (e.type === 'rogue' && dist <= 26) { e.state = 'windup'; e.t = 0; e.dirX = dx / dist; e.dirY = dy / dist; }
        else if (e.type === 'bomber' && dist <= d.range) { e.state = 'fuse'; e.t = 0; Sfx.play('fuse'); }
        else this.step(e, P.x, P.y, spd * (e.type === 'rogue' ? 0.8 : 1), dt);
        break;
      }
      case 'windup': {
        e.t += dt;
        if (e.type === 'grunt' && e.t < d.wind * 0.5) e.face = Math.atan2(dy, dx);
        if (e.t >= d.wind) {
          if (e.type === 'grunt') {
            e.state = 'recover'; e.t = 0; e.swing = 0.15;
            if (dist <= d.range + P.r + 6 && Math.abs(U.angDiff(Math.atan2(dy, dx), e.face)) < 1.1) this.hurtPlayer(e.dmg, e.x, e.y, e);
          } else { e.state = 'lunge'; e.t = 0; e.hitDone = false; }
        }
        break;
      }
      case 'lunge': {
        e.t += dt; moveEnt(lv, e, e.dirX * 230 * dt, e.dirY * 230 * dt);
        if (!e.hitDone && Math.hypot(P.x - e.x, P.y - e.y) < e.r + P.r + 3) { e.hitDone = true; this.hurtPlayer(e.dmg, e.x, e.y, e); }
        if (e.t >= 0.28) { e.state = 'recover'; e.t = 0; }
        break;
      }
      case 'fuse': {
        e.t += dt; this.step(e, P.x, P.y, spd * 0.45, dt);
        if (Math.floor(e.t * 8) !== Math.floor((e.t - dt) * 8)) Sfx.play('fuse');
        if (e.t >= d.wind) {
          this.explode(e.x, e.y, 0, 0, e); // visuals + chain damage to other mobs
          if (Math.hypot(P.x - e.x, P.y - e.y) < 42) this.hurtPlayer(e.dmg, e.x, e.y, null);
          e.dead = true;
        }
        break;
      }
      case 'recover': {
        e.t += dt; if (e.swing > 0) e.swing -= dt;
        if (e.t >= d.rec) { e.state = 'chase'; e.t = 0; }
        break;
      }
    }
  }

  // ------------------------------------------------------------ draw
  draw() {
    const lv = this.lv, P = this.P;
    const sh = S.settings && S.settings.shake === false ? 0 : Game.shake, ox = sh ? (Math.random() - 0.5) * sh : 0, oy = sh ? (Math.random() - 0.5) * sh : 0;
    const cx = Math.round(this.cam.x + ox), cy = Math.round(this.cam.y + oy);
    ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, VW, VH);
    ctx.drawImage(lv.layer, cx, cy, VW, VH, 0, 0, VW, VH);
    const cave = lv.theme === 'cave';
    // soft light pools (the forge heart and its braziers) — breathe slightly
    for (const gl of lv.glows) {
      if (gl.x < cx - gl.r || gl.x > cx + VW + gl.r || gl.y < cy - gl.r || gl.y > cy + VH + gl.r) continue;
      const k = 0.10 + Math.sin(this.time * 2.4 + gl.x * 0.01) * 0.02;
      const grd = ctx.createRadialGradient(gl.x - cx, gl.y - cy, 0, gl.x - cx, gl.y - cy, gl.r);
      grd.addColorStop(0, 'rgba(' + gl.col[0] + ',' + gl.col[1] + ',' + gl.col[2] + ',' + k + ')');
      grd.addColorStop(1, 'rgba(' + gl.col[0] + ',' + gl.col[1] + ',' + gl.col[2] + ',0)');
      ctx.fillStyle = grd; ctx.fillRect(gl.x - cx - gl.r, gl.y - cy - gl.r, gl.r * 2, gl.r * 2);
    }
    // animated magma glow / torches
    if (cave) for (const m of lv.magma) {
      if (m.x < cx - 16 || m.x > cx + VW + 16 || m.y < cy - 16 || m.y > cy + VH + 16) continue;
      ctx.fillStyle = `rgba(255,${120 + Math.sin(this.time * 3 + m.x) * 60 | 0},30,0.25)`; ctx.fillRect(m.x - 8 - cx, m.y - 8 - cy, 16, 16);
    }
    // ladders / shafts
    const drawHole = (p, up) => {
      const x = Math.round(p.x - cx), y = Math.round(p.y - cy);
      ctx.fillStyle = '#050408'; ctx.fillRect(x - 8, y - 6, 16, 14);
      ctx.fillStyle = up ? '#8a6a3a' : '#5a4a2a';
      if (up) { ctx.fillRect(x - 5, y - 6, 2, 14); ctx.fillRect(x + 3, y - 6, 2, 14); for (let i = 0; i < 4; i++) ctx.fillRect(x - 5, y - 4 + i * 4, 10, 1); }
      else { ctx.fillRect(x - 8, y - 6, 16, 2); ctx.fillRect(x - 8, y + 6, 16, 2); }
    };
    if (cave) { drawHole(lv.ladderUp, true); if (lv.shaftDown) drawHole(lv.shaftDown, false); }
    // sort drawables by y
    const items = [];
    const vis = (x, y, m = 24) => x > cx - m && x < cx + VW + m && y > cy - m && y < cy + VH + m;
    for (const n of lv.nodes) if (n.alive && vis(n.x, n.y)) items.push({ y: n.y, f: () => this.drawNode(n, cx, cy) });
    for (const n of lv.npcs) items.push({ y: n.y, f: () => this.drawNpc(n, cx, cy) });
    for (const e of lv.enemies) if (vis(e.x, e.y)) items.push({ y: e.y, f: () => this.drawEnemy(e, cx, cy) });
    for (const c of lv.chests || []) items.push({ y: c.y, f: () => this.drawChest(c, cx, cy) });
    items.push({ y: P.y, f: () => this.drawPlayer(cx, cy) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.f();
    // torches
    for (const t of lv.torches) {
      const x = Math.round(t.x - cx), y = Math.round(t.y - cy);
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 1, y - 2, 2, 8);
      ctx.fillStyle = Math.sin(this.time * 12 + t.x) > 0 ? '#ffb02a' : '#ff8a1a'; ctx.fillRect(x - 2, y - 6, 4, 4);
      ctx.fillStyle = '#fff3b0'; ctx.fillRect(x - 1, y - 5, 2, 2);
    }
    // slashes
    for (const s of this.slashes) {
      ctx.globalAlpha = s.t / s.max; ctx.strokeStyle = U.shade(s.col, 1.4); ctx.lineWidth = s.heavy ? 4 : 2;
      ctx.beginPath(); ctx.arc(Math.round(s.x - cx), Math.round(s.y - cy), s.range * 0.85, s.ang - s.arc * Math.PI / 360, s.ang + s.arc * Math.PI / 360); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    this.drawExtras(cx, cy);
    FX.draw(cx, cy);
    if (cave) this.drawDarkness(cx, cy);
    this.drawHud();
  }

  drawNode(n, cx, cy) {
    const P = this.P, lit = !NODES[n.type].rare || Math.hypot(n.x - P.x, n.y - P.y) < P.stats.lightR * 0.92 || this.lv.torches.some(t => Math.hypot(n.x - t.x, n.y - t.y) < 44);
    const s = lit ? Sprites.nodeSprite(n) : Sprites.plainRock(n);
    const shake = n.flash > 0 ? (Math.random() - 0.5) * 2 : 0;
    ctx.drawImage(s, Math.round(n.x - s.width / 2 - cx + shake), Math.round(n.y - s.height + 10 - cy));
    if (n.hp < n.max && lit) UI.bar(Math.round(n.x - 8 - cx), Math.round(n.y + 8 - cy), 16, 2, n.hp / n.max, '#d8d8d8', '#333');
    // name plate while being mined: the ore, and what kind of deposit it is
    if (lit && n.labelUntil > this.time) {
      const seal = NODES[n.type].seal, ore = ORES[n.ore];
      const name = seal ? 'Sealed Rock' : ore.n, kind = seal ? 'mine it open' : NODES[n.type].n;
      const col = seal ? '#ffd23f' : ore.col;
      const fade = U.clamp((n.labelUntil - this.time) * 3, 0, 1);
      const w = Math.max(UI.width(name, 8), UI.width(kind, 7)) + 10;
      const bx = Math.round(n.x - w / 2 - cx), by = Math.round(n.y - s.height + 10 - cy) - 22;
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(8,5,12,0.82)'; ctx.fillRect(bx, by, w, 20);
      ctx.fillStyle = col; ctx.fillRect(bx, by, w, 1); ctx.fillRect(bx, by + 19, w, 1);
      if (!seal) oreIcon(n.ore, bx + 3, by + 3, 7);
      UI.text(name, Math.round(n.x - cx) + (seal ? 0 : 4), by + 2, col, 'center', 8);
      UI.text(kind, Math.round(n.x - cx) + (seal ? 0 : 4), by + 11, PAL.dim, 'center', 7);
      ctx.globalAlpha = 1;
    }
  }
  drawNpc(n, cx, cy) {
    const s = Sprites.npc(n), bob = n.kind === 'board' ? 0 : Math.round(Math.sin(this.time * 2 + n.x) * 0.6);
    ctx.drawImage(s, Math.round(n.x - s.width / 2 - cx), Math.round(n.y - s.height + 8 - cy + bob));
  }
  drawEnemy(e, cx, cy) {
    const s = Sprites.enemy(e), sz = s.width, x = Math.round(e.x - sz / 2 - cx), y = Math.round(e.y - sz / 2 - cy - (e.state === 'idle' ? 0 : Math.abs(Math.sin(e.bob)) * 1.2));
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(Math.round(e.x - cx), Math.round(e.y + e.r - cy), e.r + 1, 2, 0, 0, 6.3); ctx.fill();
    const flip = Math.cos(e.face) < 0;
    ctx.save();
    if (flip) { ctx.translate(x + sz, y); ctx.scale(-1, 1); ctx.drawImage(s, 0, 0); } else ctx.drawImage(s, x, y);
    ctx.restore();
    if (e.hitFlash > 0) { ctx.globalAlpha = 0.7; ctx.drawImage(Art.get('sil_' + s.width + e.type + e.elite, sz, sz, g => g.drawImage(silhouette(s, '#ffffff'), 0, 0)), x, y); ctx.globalAlpha = 1; }
    if (e.burn > 0) { ctx.fillStyle = '#ff8a2a'; ctx.fillRect(Math.round(e.x - cx) - 1, Math.round(e.y - cy) - sz / 2 - 2, 2, 2); }
    if (e.parried && e.stun > 0) { // stun stars circling the head
      for (let i = 0; i < 3; i++) { const a = this.time * 6 + i * 2.1; ctx.fillStyle = '#ffd23f'; ctx.fillRect(Math.round(e.x - cx + Math.cos(a) * 7), Math.round(e.y - cy - sz / 2 + Math.sin(a) * 2), 2, 2); }
    }
    // telegraphs
    const wx = Math.round(e.x - cx), wy = Math.round(e.y - cy);
    if (e.state === 'windup') {
      const k = e.t / e.d.wind;
      ctx.fillStyle = `rgba(255,60,60,${0.3 + 0.4 * k})`;
      if (e.type === 'rogue') { ctx.strokeStyle = `rgba(255,80,80,${0.4 + 0.5 * k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + e.dirX * 66, wy + e.dirY * 66); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(wx, wy); ctx.arc(wx, wy, e.d.range + 6, e.face - 0.9, e.face + 0.9); ctx.fill(); }
      UI.text('!', wx, wy - sz / 2 - 8, '#ff5a5a', 'center');
    }
    if (e.state === 'fuse') {
      const flash = Math.floor(e.t * 10) % 2 === 0;
      ctx.strokeStyle = flash ? '#ff4a2a' : '#ffb02a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(wx, wy, 42 * Math.min(1, e.t / e.d.wind + 0.2), 0, 6.3); ctx.stroke();
      if (flash) { ctx.globalAlpha = 0.5; ctx.drawImage(silhouette(s, '#ffffff'), x, y); ctx.globalAlpha = 1; }
    }
    if (e.swing > 0) { ctx.strokeStyle = '#ffdddd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(wx, wy, e.d.range, e.face - 0.9, e.face + 0.9); ctx.stroke(); }
    if (e.hp < e.maxHp) UI.bar(wx - 8, wy - sz / 2 - 5, 16, 2, e.hp / e.maxHp, e.elite ? '#ffd23f' : '#e0344f', '#331');
    // name tag so players know which mobs their quests want
    if (e.boss) return;   // the boss gets a dedicated bar at the top of the screen
    // colour hints danger relative to the player's own level
    const gap = e.level - S.level, tagCol = e.elite ? '#ffd23f' : gap >= 3 ? '#ff6a6a' : gap >= 1 ? '#ffb066' : '#f3ecd8';
    UI.textOut(`Lv ${e.level} ` + (e.elite ? 'Elite ' : '') + e.d.n, wx, wy - sz / 2 - 15, tagCol, 'center', 7);
  }

  drawPlayer(cx, cy) {
    const P = this.P, st = P.stats, x = Math.round(P.x - cx), y = Math.round(P.y - cy);
    const eq = { head: getItem(S.equip.head), chest: getItem(S.equip.chest), legs: getItem(S.equip.legs), boots: getItem(S.equip.boots) };
    if (P.iframes > 0 && P.state !== 'dash' && Math.floor(this.time * 20) % 2) ctx.globalAlpha = 0.5;
    if (P.state === 'dash') ctx.globalAlpha = 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(x, y + 6, 6, 2.5, 0, 0, 6.3); ctx.fill();

    // walk cycle / idle breathing
    const moving = P.state !== 'dash' && (Input.key('KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight') || (Input.stick && (Input.stick.x || Input.stick.y)));
    const ph = moving ? Math.sin(P.walk) : 0;
    const legF = ph > 0.35 ? -1 : 0, legB = ph < -0.35 ? -1 : 0;
    const bob = moving ? (Math.abs(ph) > 0.65 ? -1 : 0) : (Math.sin(this.time * 2.2) > 0.4 ? -1 : 0);
    const crouch = P.state === 'attack' && P.atk && P.atk.t < P.atk.wind ? 1 : 0;   // brace during windup
    const dir = P.dir;

    const skin = '#e8c49c', skinLo = '#c2996c';
    const bootC = eq.boots ? eq.boots.color : '#4a3020', bootD = eq.boots ? eq.boots.color2 : '#32200f';
    const legC = eq.legs ? eq.legs.color : '#3f4f80', legD = eq.legs ? eq.legs.color2 : '#2c3a63';
    const chC = eq.chest ? eq.chest.color : '#5b7fbf', chD = eq.chest ? eq.chest.color2 : '#3a5a9a', chH = U.shade(chC, 1.35);

    // Whole body drawn through one function so it can be stamped 4x in ink for a clean outline.
    const body = (ddx, ddy, tint) => {
      const R = (col, ox, oy, w, h) => {
        const fx = dir > 0 ? ox : -ox - w;
        ctx.fillStyle = tint || col;
        ctx.fillRect(x + fx + ddx, y + oy + ddy, w, h);
      };
      // back arm
      R(skinLo, -6, -11 + crouch, 3, 6);
      if (eq.chest) R(eq.chest.color2, -6, -11 + crouch, 3, 3);
      // legs + boots
      R(legD, -4, -3 + legB, 4, 5); R(legC, -4, -3 + legB, 3, 5);
      R(legD, 1, -3 + legF, 4, 5); R(legC, 1, -3 + legF, 3, 5);
      R(bootD, -5, 2 + legB, 5, 4); R(bootC, -5, 2 + legB, 5, 3); R(U.shade(bootC, 1.3), -5, 2 + legB, 2, 1);
      R(bootD, 1, 2 + legF, 5, 4); R(bootC, 1, 2 + legF, 5, 3); R(U.shade(bootC, 1.3), 1, 2 + legF, 2, 1);
      // torso
      R(chD, -5, -12 + bob + crouch, 10, 9);
      R(chC, -5, -12 + bob + crouch, 9, 8);
      R(chH, -4, -12 + bob + crouch, 7, 1);
      if (eq.chest) {
        R(eq.chest.accent, -1, -11 + bob + crouch, 2, 6);            // centre ridge
        R(chD, -6, -12 + bob + crouch, 3, 4); R(chC, -6, -12 + bob + crouch, 2, 3);  // pauldron
        R(eq.chest.accent, -5, -5 + bob + crouch, 10, 2);            // belt
      } else {
        R('#6b4a2a', -5, -5 + bob + crouch, 10, 2); R('#c9a24b', 0, -5 + bob + crouch, 2, 2);
      }
      // front arm
      R(skinLo, 3, -11 + bob + crouch, 3, 6); R(skin, 3, -11 + bob + crouch, 3, 4);
      if (eq.chest) R(eq.chest.color, 3, -11 + bob + crouch, 3, 3);
      // head
      R(skinLo, -3, -19 + bob, 7, 8); R(skin, -3, -19 + bob, 6, 7);
      if (eq.head) {
        const h = eq.head;
        R(h.color2, -4, -20 + bob, 9, 6); R(h.color, -4, -20 + bob, 8, 5); R(U.shade(h.color, 1.4), -3, -20 + bob, 5, 1);
        R(h.accent, -1, -22 + bob, 2, 3);                            // crest
        R('#0a0810', -3, -15 + bob, 7, 2);                           // visor slit
        R(h.accent, -4, -16 + bob, 9, 1);
        R(h.color2, -4, -14 + bob, 2, 3); R(h.color2, 3, -14 + bob, 2, 3);   // cheek guards
      } else {
        R('#4a3018', -4, -20 + bob, 8, 4); R('#63431f', -4, -20 + bob, 7, 3);   // hair
        R('#4a3018', -4, -17 + bob, 2, 3);
        R('#1a1008', 1, -16 + bob, 1, 1);                            // eye
        R('#c98a6a', 0, -13 + bob, 3, 1);                            // mouth line
      }
    };
    for (const o of [[-1, 0], [1, 0], [0, -1], [0, 1]]) body(o[0], o[1], PAL.ink);
    body(0, 0, null);

    // ---- held tool, rotated toward the aim
    ctx.globalAlpha = P.state === 'dash' ? 0.6 : ctx.globalAlpha;
    let wa;
    if (P.state === 'attack') {
      const a = P.atk, span = (a.arc * Math.PI / 180);
      if (a.t < a.wind) wa = a.ang - span / 2 - 0.35 * (a.t / a.wind);
      else wa = a.ang - span / 2 + span * U.clamp((a.t - a.wind) / 0.12, 0, 1);
    } else wa = P.dir > 0 ? 0.55 : Math.PI - 0.55;
    const w = st.weapon;
    const hx = x + (dir > 0 ? 4 : -4), hy = y - 8 + bob + crouch;
    ctx.save(); ctx.translate(hx, hy);
    if (this.held === 0) {
      const interval = st.haste ? 0.34 : 0.42, sw = P.mineTarget ? Math.sin(U.clamp(P.mineT / interval, 0, 1) * Math.PI) : 0;
      const pa = P.mineTarget ? P.face - 1.0 + sw * 1.7 : wa;
      ctx.rotate(pa + Math.PI / 2); const ps = Sprites.pick(S.pickaxe); ctx.drawImage(ps, -ps.width / 2, -ps.height + 4);
    } else {
      ctx.rotate(wa + Math.PI / 2);
      if (w) { const s = ItemArt.sprite(w); ctx.drawImage(s, -s.width / 2, -s.height + 3); }
      else { ctx.fillStyle = PAL.ink; ctx.fillRect(-3, -7, 5, 5); ctx.fillStyle = skin; ctx.fillRect(-2, -6, 3, 3); }
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // ---- parry arc
    if (P.shieldT > 0) {
      const fading = P.shieldT < 0.3 && Math.floor(this.time * 20) % 2 === 0, a = this.parryDir(), r = 17 + Math.sin(this.time * 12) * 0.6;
      const cy2 = y - 7;
      ctx.fillStyle = `rgba(255,220,100,${fading ? 0.08 : 0.2})`;
      ctx.beginPath(); ctx.moveTo(x, cy2); ctx.arc(x, cy2, r, a - PARRY_ARC, a + PARRY_ARC); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, cy2, r, a - PARRY_ARC, a + PARRY_ARC); ctx.stroke();
      ctx.strokeStyle = fading ? 'rgba(255,240,180,0.45)' : '#ffe08a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, cy2, r, a - PARRY_ARC, a + PARRY_ARC); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, cy2, r + 1.5, a - PARRY_ARC, a + PARRY_ARC); ctx.stroke();
    }
  }
  drawHotbar() {
    const P = this.P;
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const r = this.hotbarRect(i), held = i < 2 && this.held === i;
      const hov = Input.mx >= r.x && Input.mx < r.x + r.w && Input.my >= r.y && Input.my < r.y + r.h && Game.top() === this;
      if (held) { ctx.fillStyle = 'rgba(255,210,63,0.16)'; ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); }
      UI.slot(r.x, r.y, r.w, r.h, { fill: held ? '#241d18' : '#15111e', edge: held ? PAL.gold : hov ? PAL.edge : '#3d3550' });
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (i === 0) { const s = Sprites.pick(S.pickaxe); ctx.save(); ctx.translate(cx + 1, cy); ctx.rotate(Math.PI / 4); ctx.drawImage(s, -s.width / 2, -s.height / 2); ctx.restore(); }
      else if (i === 1) {
        const w = P.stats.weapon;
        if (w) { const s = ItemArt.sprite(w), sc = Math.min(19 / s.width, 19 / s.height); ctx.save(); ctx.translate(cx + 1, cy); ctx.rotate(Math.PI / 4); ctx.drawImage(s, -s.width * sc / 2, -s.height * sc / 2, s.width * sc, s.height * sc); ctx.restore(); }
        else { ctx.fillStyle = PAL.ink; ctx.fillRect(cx - 5, cy - 4, 10, 9); ctx.fillStyle = '#e8c49c'; ctx.fillRect(cx - 4, cy - 3, 8, 6); ctx.fillStyle = '#c2996c'; ctx.fillRect(cx - 4, cy + 1, 8, 2); }
      } else {
        const id = S.hotbar[i - 2], n = id ? (S.potions[id] || 0) : 0;
        if (id) {
          ctx.globalAlpha = n ? 1 : 0.3;
          potionIcon(id, cx - 5, cy - 6);
          ctx.globalAlpha = 1;
          UI.textOut(String(n), r.x + r.w - 3, r.y + r.h - 10, n ? '#ffffff' : PAL.bad, 'right', 7);
        }
      }
      UI.textOut(String(i + 1), r.x + 3, r.y + 2, held ? PAL.gold : '#9a90ac', 'left', 7);
    }
    // name plate for whatever is in hand
    const label = this.held === 0 ? PICKS[S.pickaxe].n : (P.stats.weapon ? P.stats.weapon.name : 'Bare Fists');
    const lw = UI.width(label) + 14, lx = Math.round(VW / 2 - lw / 2), ly = VH - 40;
    ctx.fillStyle = 'rgba(8,5,12,0.75)'; ctx.fillRect(lx, ly, lw, 11);
    ctx.fillStyle = PAL.edgeLo; ctx.fillRect(lx, ly, lw, 1); ctx.fillRect(lx, ly + 10, lw, 1);
    UI.text(label, VW / 2, ly + 2, this.held === 0 ? '#d8c8a0' : (P.stats.weapon ? Forge.gradeColor(P.stats.weapon.grade) : PAL.dim), 'center');
  }
  drawDarkness(cx, cy) {
    const P = this.P, f = this.floor;
    const A = [0, 0.58, 0.74, 0.86][f];
    if (!this._dk) this._dk = Art.mk(VW, VH, () => {});
    const g = this._dk.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, VW, VH);
    g.fillStyle = `rgba(4,3,10,${A})`; g.fillRect(0, 0, VW, VH);
    g.globalCompositeOperation = 'destination-out';
    const flick = 1 + Math.sin(this.time * 9) * 0.02 + Math.sin(this.time * 23) * 0.015;
    const lightAt = (x, y, r, a = 1) => { g.globalAlpha = a; const s = Light.get(r); g.drawImage(s, Math.round(x - cx - s.width / 2), Math.round(y - cy - s.height / 2)); };
    lightAt(P.x, P.y, P.stats.lightR * flick);
    for (const t of this.lv.torches) lightAt(t.x, t.y, 52 * flick, 0.95);
    for (const m of this.lv.magma) if (m.x > cx - 40 && m.x < cx + VW + 40 && m.y > cy - 40 && m.y < cy + VH + 40) lightAt(m.x, m.y, 34, 0.8);
    for (const s of this.slashes) lightAt(s.x, s.y, 46, 0.7 * s.t / s.max);
    for (const e of this.lv.enemies) if (e.burn > 0) lightAt(e.x, e.y, 28, 0.7);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this._dk, 0, 0);
    // warm glow around the lantern
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.10;
    const s = Light.get(P.stats.lightR * 0.8 * flick); ctx.drawImage(Art.get('warm' + s.width, s.width, s.height, gg => { gg.drawImage(silhouette(s, '#ff9a3a'), 0, 0); }), Math.round(P.x - cx - s.width / 2), Math.round(P.y - cy - s.height / 2));
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ HUD
  drawHud() {
    const P = this.P, st = P.stats;
    // ---------- status plate
    const px = 4, py = 4, pw = 122, ph = 44;
    ctx.fillStyle = 'rgba(8,5,12,0.72)'; ctx.fillRect(px, py, pw, ph);
    UI.frame(px, py, pw, ph, PAL.edgeLo);
    // level medallion: the number stands alone in the ring, with a small "LV" plate hanging below it
    const bx = px + 16, by = py + 16;
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(bx, by, 13, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#2f2545'; ctx.beginPath(); ctx.arc(bx, by, 12, 0, 6.3); ctx.fill();
    ctx.strokeStyle = PAL.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, 11.5, 0, 6.3); ctx.stroke();
    ctx.strokeStyle = PAL.edgeHi; ctx.beginPath(); ctx.arc(bx, by, 11.5, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke();
    const lvs = String(S.level), big = lvs.length <= 2;         // 2x digits when they fit, 1x for 3+ digits
    UI.text(lvs, bx, big ? by - 6 : by - 3, PAL.gold, 'center', big ? 12 : 7);
    ctx.fillStyle = PAL.ink; ctx.fillRect(bx - 10, by + 11, 21, 11);
    ctx.fillStyle = '#3b2f52'; ctx.fillRect(bx - 9, by + 12, 19, 9);
    ctx.fillStyle = PAL.edge; ctx.fillRect(bx - 9, by + 12, 19, 1); ctx.fillRect(bx - 9, by + 20, 19, 1);
    UI.text('LV', bx, by + 13, PAL.text, 'center', 7);
    // bars
    const gx = px + 30, gw = 86;
    UI.bar(gx, py + 6, gw, 8, P.hp / st.maxHp, '#d6394f');
    UI.text(`${Math.ceil(Math.max(0, P.hp))}/${st.maxHp}`, gx + gw / 2, py + 6, '#ffffff', 'center', 7);
    UI.bar(gx, py + 17, gw, 5, P.sta / 100, P.exhausted ? '#c9a24b' : '#4ac97a');
    if (P.exhausted) UI.text('TIRED', gx + gw / 2, py + 17, '#3a2a10', 'center', 7);
    UI.bar(gx, py + 25, gw, 3, S.xp / xpNeeded(S.level), '#5a8aff');
    // parry readiness: label on the left, bar on the right so neither crowds the other
    const parryOn = P.shieldT > 0, pcol = parryOn ? PAL.gold : P.shieldCd > 0 ? '#6d7a8a' : '#7fd0ff';
    UI.text(parryOn ? 'PARRY!' : P.shieldCd > 0 ? `F ${Math.ceil(P.shieldCd)}s` : 'F READY', gx, py + 31, pcol, 'left', 7);
    const pbx = gx + 50, pbw = gw - 50;
    UI.bar(pbx, py + 32, pbw, 4, parryOn ? P.shieldT / SHIELD_TIME : P.shieldCd > 0 ? 1 - P.shieldCd / SHIELD_CD : 1, pcol);

    // ---------- gold + location
    const gs = `${U.fmt(S.gold)}`, gwid = UI.width(gs) + 26;
    ctx.fillStyle = 'rgba(8,5,12,0.72)'; ctx.fillRect(VW - gwid - 4, 4, gwid, 15);
    UI.frame(VW - gwid - 4, 4, gwid, 15, PAL.edgeLo);
    const cix = VW - gwid + 4;
    ctx.fillStyle = '#8a6a1a'; ctx.beginPath(); ctx.arc(cix, 11, 5, 0, 6.3); ctx.fill();
    ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(cix, 11, 4, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(cix - 2, 8, 2, 1);
    UI.text(gs, VW - 8, 8, PAL.gold, 'right');
    const loc = this.floor === 0 ? 'Greenwood Hub' : this.floor === BOSS_FLOOR ? 'Grove Guardian Arena' : `Mine \u2014 Floor ${this.floor}`;
    UI.textOut(loc, VW - 6, 22, '#cfc6e8', 'right', 8);

    // ---------- buff chips
    let by2 = 52;
    for (const k in S.buffs) {
      const nm = (POTIONS[k] || { n: BUFF_NAMES[k] || k }).n.split(' ')[0];
      const col = POTIONS[k] ? POTIONS[k].col : (POWERUPS[k] ? POWERUPS[k].col : '#fff');
      UI.chip(`${nm} ${Math.ceil(S.buffs[k])}s`, 6, by2, col); by2 += 11;
    }
    if (P.barrier > 0) { UI.chip(`Barrier x${P.barrier}`, 6, by2, POWERUPS.barrier.col); by2 += 11; }
    if (P.fireCharges > 0) { UI.chip(`Inferno x${P.fireCharges}`, 6, by2, POWERUPS.inferno.col); by2 += 11; }

    // ---------- interact prompt & hint
    if (this.prompt) {
      const s = `[E]  ${this.prompt.label}`, w = UI.width(s) + 16;
      const bxp = Math.round(VW / 2 - w / 2), byp = VH - 66;
      ctx.fillStyle = 'rgba(8,5,12,0.85)'; ctx.fillRect(bxp, byp, w, 14);
      UI.frame(bxp, byp, w, 14, PAL.edge);
      UI.text(s, VW / 2, byp + 3, PAL.gold, 'center');
    }
    const hint = this.hintT > 0 ? this.hintMsg : this.hint();
    if (hint) UI.textOut(hint, VW / 2, VH - 51, this.hintT > 0 ? '#ffb066' : '#e8e0c8', 'center');
    this.drawHotbar();

    // ---------- corner buttons
    for (const b of this.hudButtons()) {
      const hov = Game.top() === this && Input.mx >= b.x && Input.mx < b.x + b.w && Input.my >= b.y && Input.my < b.y + b.h;
      ctx.fillStyle = hov ? 'rgba(96,74,128,0.95)' : 'rgba(8,5,12,0.8)'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = hov ? PAL.edgeHi : '#4a3f5c';
      ctx.fillRect(b.x, b.y, b.w, 1); ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1); ctx.fillRect(b.x, b.y, 1, b.h); ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);
      UI.text(b.label, b.x + b.w / 2, b.y + 3, hov ? '#ffffff' : '#cfc6e8', 'center', 7);
    }
    const ready = S.quests.filter(q => q.done === true).length;
    if (ready) {
      const s = `${ready} quest${ready > 1 ? 's' : ''} ready!`, w = UI.width(s, 7) + 8;
      const pulse = Math.sin(this.time * 4) > 0;
      ctx.fillStyle = 'rgba(8,5,12,0.8)'; ctx.fillRect(VW - w - 6, VH - 44, w, 11);
      ctx.fillStyle = pulse ? PAL.good : '#3f8a4a'; ctx.fillRect(VW - w - 6, VH - 44, w, 1); ctx.fillRect(VW - w - 6, VH - 34, w, 1);
      UI.text(s, VW - w - 2, VH - 42, PAL.good, 'left', 7);
    }

    // ---------- toasts
    let ty = 54;
    for (const t of Game.toasts) {
      ctx.globalAlpha = U.clamp(t.t, 0, 1);
      const w = UI.width(t.msg) + 14, bxt = Math.round(VW / 2 - w / 2);
      ctx.fillStyle = 'rgba(8,5,12,0.8)'; ctx.fillRect(bxt, ty - 2, w, 13);
      ctx.fillStyle = t.col; ctx.fillRect(bxt, ty - 2, 2, 13);
      UI.text(t.msg, VW / 2 + 1, ty + 1, t.col, 'center');
      ty += 15;
    }
    ctx.globalAlpha = 1;

    if (P.dead) {
      const k = U.clamp(this.deadT / 1.5, 0, 1);
      ctx.fillStyle = `rgba(20,0,0,${k * 0.85})`; ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = k;
      UI.text('YOU WERE KNOCKED OUT', VW / 2, VH / 2 - 12, '#ff6a6a', 'center', 16);
      UI.text('Gear and ore are safe. Some gold is lost.', VW / 2, VH / 2 + 8, PAL.dim, 'center');
      ctx.globalAlpha = 1;
    }
  }  hint() {
    const P = this.P;
    if (!S.stats.forged && this.floor === 0) return 'Visit the Blacksmith (E) to forge your first item from your starter ore.';
    if (this.floor === 0 && (S.spins || 0) > 0 && S.level >= 2 && !S.tutorial.race) return 'You have race spins! Visit the Race Shrine in the hub.';
    if (this.floor === 0 && !S.tutorial.mine) return 'Take the north avenue to the Mine, then hold E beside rocks to mine ore.';
    if (this.floor === 1 && !S.tutorial.mine) return 'Hold E next to a rock to mine it (pickaxe = slot 1). Mining uses stamina.';
    if (this.floor > 0 && !S.equip.weapon) return 'No weapon equipped: you only have fists. Forge one at the Blacksmith.';
    if (this.floor === 0 && Game.time < 60) return 'Press H for controls, J for your quests';
    return '';
  }
}

function usePotion(id, world) {
  const p = POTIONS[id];
  if (!S.potions[id]) return;
  if (id === 'heal') {
    if (world.P.hp >= world.P.stats.maxHp) { Game.toast('Already at full health.'); return; }
    world.P.hp = Math.min(world.P.stats.maxHp, world.P.hp + 60); FX.text(world.P.x, world.P.y - 14, '+60', '#5aff8a');
  } else if (id === 'forgem') {
    if (S.forgemBonus) { Game.toast('Forgemaster already active.'); return; }
    S.forgemBonus = 5;
  } else S.buffs[id] = p.dur;
  S.potions[id]--; if (!S.potions[id]) delete S.potions[id];
  Sfx.play('coin'); Game.toast(`Used ${p.n}`, p.col);
}
