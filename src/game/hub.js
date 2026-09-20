'use strict';
// ---------------------------------------------------------------------------
// hub.js — Emberhold: a stronghold cut out of the rock around a forge that has
// never gone out. Everything you do between descents happens here.
// ---------------------------------------------------------------------------
(function (F) {

  const T = F.T, TS = F.TS;

  // room: [id, cx, cy, halfW, halfH, doorSide, title, npc]
  // Each workshop gets its own floor colour and its own fittings. A hub where
  // every room is the same grey flagstone is a hub nobody remembers.
  const ROOMS = [
    { id: 'smith',  cx: 13, cy: 12, w: 7, h: 5, door: 'S', title: 'DRILL WORKS',     npc: 'smith',
      col: '#6a4a2c', light: [1.0, 0.62, 0.28], fit: ['barrel', 'rack', 'anvil', 'trough', 'crate'] },
    { id: 'ench',   cx: 39, cy: 12, w: 7, h: 5, door: 'S', title: 'RUNE HALL',       npc: 'ench',
      col: '#4a3a6e', light: [0.66, 0.40, 1.0], fit: ['crate', 'pedestal', 'bench', 'pedestal', 'shelf'] },
    { id: 'alch',   cx: 10, cy: 26, w: 6, h: 5, door: 'E', title: 'APOTHECARY',      npc: 'alch',
      col: '#2f5a44', light: [0.42, 1.0, 0.66], fit: ['barrel', 'cauldron', 'shelf', 'bench'] },
    { id: 'shrine', cx: 13, cy: 39, w: 7, h: 5, door: 'N', title: 'ANCESTOR SHRINE', npc: 'shrine',
      col: '#2e4e5e', light: [0.44, 0.86, 1.0], fit: ['bench', 'shrinestone', 'bench'] },
    { id: 'market', cx: 42, cy: 26, w: 6, h: 5, door: 'W', title: 'STOREHOUSE',      npc: 'merchant',
      col: '#6a5a2e', light: [1.0, 0.86, 0.42], fit: ['barrel', 'crate', 'shelf', 'crate', 'barrel'] },
    { id: 'board',  cx: 39, cy: 39, w: 7, h: 5, door: 'N', title: 'NOTICE BOARD',    npc: 'board',
      col: '#5e4630', light: [1.0, 0.74, 0.40], fit: ['bench', 'noticeboard', 'noticeboard', 'crate'] },
  ];

  F.genHub = function () {
    const W = 52, H = 48;
    const lv = new F.Level(W, H, 'hub', 0);
    lv.zone = new Uint8Array(W * H);
    lv.zoneCol = ['#ffffff'];
    lv.name = 'Emberhold';
    lv.sub = 'The fire has never gone out';
    const t = lv.tiles;
    t.fill(T.WALL);

    const carveRect = (x0, y0, x1, y1, tile) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
        if (x > 0 && y > 0 && x < W - 1 && y < H - 1) t[y * W + x] = tile === undefined ? T.FLOOR : tile;
    };
    const carveDisc = (cx, cy, r, tile) => {
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        const dx = x - cx, dy = (y - cy) * 1.12;
        if (dx * dx + dy * dy <= r * r && x > 0 && y > 0 && x < W - 1 && y < H - 1)
          t[y * W + x] = tile === undefined ? T.FLOOR : tile;
      }
    };

    // the great hall
    const CX = 26, CY = 25;
    carveDisc(CX, CY, 12);
    // galleries out to the rooms and the gates
    carveRect(CX - 1, 4, CX + 1, CY);        // north, to the mine
    carveRect(CX - 1, CY, CX + 1, H - 6);    // south
    carveRect(6, CY - 1, W - 7, CY + 1);     // the long east-west gallery
    carveRect(12, 12, 14, CY);               // up to the smith
    carveRect(38, 12, 40, CY);               // up to the enchanter
    carveRect(12, CY, 14, 39);               // down to the shrine
    carveRect(38, CY, 40, 39);               // down to the board

    // rooms
    for (const R of ROOMS) {
      carveRect(R.cx - R.w, R.cy - R.h, R.cx + R.w, R.cy + R.h);
      // walls back in, then a door
      for (let y = R.cy - R.h; y <= R.cy + R.h; y++) for (let x = R.cx - R.w; x <= R.cx + R.w; x++) {
        const edge = (x === R.cx - R.w || x === R.cx + R.w || y === R.cy - R.h || y === R.cy + R.h);
        if (edge) t[y * W + x] = T.WALL;
      }
      const d = R.door;
      const dx = d === 'E' ? R.cx + R.w : d === 'W' ? R.cx - R.w : R.cx;
      const dy = d === 'S' ? R.cy + R.h : d === 'N' ? R.cy - R.h : R.cy;
      for (let k = -1; k <= 1; k++) {
        if (d === 'N' || d === 'S') t[dy * W + (dx + k)] = T.FLOOR;
        else t[(dy + k) * W + dx] = T.FLOOR;
      }
      R.doorX = dx * TS + 16; R.doorY = dy * TS + 16;
    }

    // ---- the forge itself. Its fire is painted into the drum sprite, not cut
    // into the tilemap: a lava disc under a round sprite only ever shows as
    // four ugly arms poking out from behind it.
    lv.solidLiquid = true;
    carveDisc(CX, CY, 3, T.BUILD);
    // a scorched apron of brick instead of lava tiles: diagonal runs of liquid
    // tiles read as staircases, which no smith ever built
    lv.decals = lv.decals || [];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.2832, rr = 4.2 + Math.random() * 3.4;
      lv.decals.push({
        sprite: 'blob', x: CX * TS + 16 + Math.cos(a) * rr * TS, y: CY * TS + 16 + Math.sin(a) * rr * TS * 0.88,
        rot: 0, alpha: 0.16 + Math.random() * 0.16, scale: 1.6 + Math.random() * 2.6,
        tint: F.Col.tint('#1c0e08'),
      });
    }

    // ---- lava seams bleeding through the rock, for light and mood
    const seams = [[CX - 15, CY - 12, CX - 9, CY - 4], [CX + 10, CY + 5, CX + 16, CY + 13],
                   [CX - 16, CY + 8, CX - 10, CY + 14], [CX + 11, CY - 14, CX + 17, CY - 7]];
    for (const s of seams) {
      let x = s[0], y = s[1];
      for (let i = 0; i < 26; i++) {
        if (x > 1 && y > 1 && x < W - 2 && y < H - 2 && t[y * W + x] === T.WALL) {
          t[y * W + x] = T.LIQUID;
          if (i % 5 === 0) lv.lights.push({ x: x * TS + 16, y: y * TS + 16, r: 140, col: [1.0, 0.36, 0.10], i: 1.3, z: 8, flicker: 0.3, shadow: 0.3 });
        }
        x += Math.sign(s[2] - x) * (Math.random() < 0.6 ? 1 : 0);
        y += Math.sign(s[3] - y) * (Math.random() < 0.6 ? 1 : 0);
        if (x === s[2] && y === s[3]) break;
      }
    }

    lv.spawn = { x: CX * TS + 16, y: (CY + 9) * TS + 16 };

    // ---- exits
    lv.exits.push({ kind: 'mine', x: CX * TS + 16, y: 6 * TS + 16, r: 30, label: 'Descend into the mines' });
    lv.exits.push({ kind: 'forge', x: CX * TS + 16, y: (CY + 5) * TS + 16, r: 34, label: 'Work the Great Forge' });

    // ---- props: the forge drum, braziers, anvils, crates
    lv.props.push({ kind: 'forgedrum', x: CX * TS + 16, y: CY * TS + 16, r: 0, solid: false });
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * 6.2832 + 0.3;
      const x = CX * TS + 16 + Math.cos(a) * 11.2 * TS, y = CY * TS + 16 + Math.sin(a) * 10.4 * TS;
      if (lv.t(Math.floor(x / TS), Math.floor(y / TS)) !== T.FLOOR) continue;
      lv.props.push({ kind: 'brazier', x, y, r: 8, solid: true, phase: Math.random() * 7 });
      lv.lights.push({ x, y: y - 16, r: 220, col: [1.0, 0.62, 0.28], i: 3.2, z: 30, flicker: 0.4, shadow: 1 });
    }
    // the forge's own light
    lv.lights.push({ x: CX * TS + 16, y: CY * TS + 6, r: 300, col: [1.0, 0.50, 0.20], i: 3.0, z: 34, flicker: 0.20, shadow: 0.35 });

    // ---- room interiors and shopkeepers
    lv.npcs = [];
    ROOMS.forEach((R, ri) => {
      // paint the room's floor so you know which trade you are standing in
      lv.zoneCol.push(R.col);
      for (let y = R.cy - R.h + 1; y < R.cy + R.h; y++)
        for (let x = R.cx - R.w + 1; x < R.cx + R.w; x++)
          if (lv.t(x, y) === T.FLOOR) lv.zone[y * W + x] = ri + 1;

      const px = R.cx * TS + 16, py = (R.cy - 1) * TS + 16;
      lv.npcs.push(makeNpc(R.npc, px, py, R));

      // plaque over the doorway
      const sx = R.doorX, sy = R.doorY + (R.door === 'S' ? 30 : R.door === 'N' ? -34 : 0);
      lv.props.push({ kind: 'plaque', x: sx, y: sy, r: 0, solid: false, title: R.title, col: R.col });
      lv.lights.push({ x: sx, y: sy - 14, r: 120, col: R.light, i: 1.5, z: 20, shadow: 0 });

      // the trade's fittings, spread along the back wall
      const back = (R.cy - R.h + 1) * TS + 30;
      const span = (R.w - 1.4) * 2 * TS;
      R.fit.forEach((kind, i) => {
        const t = R.fit.length === 1 ? 0.5 : i / (R.fit.length - 1);
        const fx = R.cx * TS + 16 + (t - 0.5) * span;
        const fy = back + ((i % 2) ? 6 : 0);
        lv.props.push({ kind, x: fx, y: fy, r: 10, solid: true, v: (Math.random() * 3) | 0 });
        if (kind === 'cauldron') lv.lights.push({ x: fx, y: fy - 22, r: 130, col: [0.35, 1.0, 0.6], i: 2.0, z: 16, flicker: 0.2, shadow: 0.3 });
        if (kind === 'pedestal') lv.lights.push({ x: fx, y: fy - 34, r: 140, col: [0.62, 0.32, 1.0], i: 2.4, z: 22, flicker: 0.14, shadow: 0.3 });
        if (kind === 'trough') lv.lights.push({ x: fx, y: fy - 8, r: 90, col: [0.30, 0.70, 0.90], i: 1.0, z: 8, shadow: 0 });
        if (kind === 'shrinestone') lv.lights.push({ x: fx, y: fy - 44, r: 190, col: [0.48, 0.92, 1.0], i: 2.8, z: 26, flicker: 0.1, shadow: 0.4 });
      });

      // lamps at the front corners, torches on the side walls, and a soft fill
      // of the trade's own colour over the whole room
      for (const sgn of [-1, 1]) {
        const lx = (R.cx + sgn * (R.w - 1)) * TS + 16, ly = (R.cy + R.h - 1) * TS + 16;
        lv.props.push({ kind: 'lantern_post', x: lx, y: ly, r: 6, solid: false });
        lv.lights.push({ x: lx, y: ly - 26, r: 270, col: [1.0, 0.80, 0.48], i: 4.0, z: 26, shadow: 1 });
        const tx = (R.cx + sgn * R.w) * TS + 16 - sgn * 10, ty = R.cy * TS + 20;
        lv.props.push({ kind: 'torch', x: tx, y: ty, r: 5, solid: false, phase: Math.random() * 7 });
        lv.lights.push({ x: tx, y: ty - 12, r: 250, col: [1.0, 0.66, 0.34], i: 3.8, z: 28, flicker: 0.45, shadow: 1 });
      }
      lv.lights.push({ x: R.cx * TS + 16, y: (R.cy - 1) * TS + 16, r: 340, col: R.light, i: 1.9, z: 70, flicker: 0.06, shadow: 0 });
    });

    // the boss gate, east end of the long gallery
    lv.exits.push({ kind: 'bossgate', x: (W - 7) * TS + 16, y: CY * TS + 16, r: 30, label: 'The Deep Gate' });
    lv.props.push({ kind: 'gate', x: (W - 7) * TS + 16, y: CY * TS + 16, r: 0, solid: false });
    lv.lights.push({ x: (W - 7) * TS + 16, y: CY * TS + 4, r: 200, col: [0.55, 0.30, 1.0], i: 2.6, z: 20, flicker: 0.16, shadow: 0.6 });

    // scattered dressing
    for (let i = 0; i < 40; i++) {
      const x = 4 + Math.floor(Math.random() * (W - 8)), y = 4 + Math.floor(Math.random() * (H - 8));
      if (lv.t(x, y) !== T.FLOOR) continue;
      if (Math.hypot(x - CX, y - CY) < 7) continue;
      lv.props.push({ kind: Math.random() < 0.5 ? 'rubble' : 'crate', x: x * TS + 16, y: y * TS + 16, r: 8, solid: Math.random() < 0.5, v: (Math.random() * 3) | 0 });
    }

    lv.rollVariants(4242);
    lv.placeRafts(4242);
    lv.noMap = false;
    return lv;
  };

  const NPCS = {
    smith:    { name: 'Durga Ashfall',   role: 'Pickaxe Smith', prompt: 'Talk to the Pickaxe Smith', col: '#b9c0cf', shop: 'smith' },
    ench:     { name: 'Veyra Runescribe',role: 'Runemaker',     prompt: 'Talk to the Runemaker',     col: '#b76cff', shop: 'ench' },
    alch:     { name: 'Hob Tinder',      role: 'Alchemist',     prompt: 'Talk to the Alchemist',     col: '#6ee787', shop: 'alch' },
    merchant: { name: 'Coll Weighpenny', role: 'Merchant',      prompt: 'Talk to the Merchant',      col: '#f4cf5a', shop: 'merchant' },
    shrine:   { name: 'The Ancestor',    role: 'Shrine',        prompt: 'Kneel at the Shrine',       col: '#7ef9ff', shop: 'shrine' },
    board:    { name: 'Notice Board',    role: 'Jobs',          prompt: 'Read the Notice Board',     col: '#ffb347', shop: 'board' },
  };

  function makeNpc(id, x, y, room) {
    const d = NPCS[id];
    return {
      id, x, y, r: 10, name: d.name, role: d.role, prompt: d.prompt, col: d.col, shop: d.shop,
      rig: F.makeRig(), seed: Math.random() * 10, animT: Math.random(), aim: Math.PI / 2, facing: 'S',
      room,
      onUse(sc) { F.openShop(d.shop, sc); },
    };
  }
  F.HUB_NPCS = NPCS;

})(window.F2 = window.F2 || {});
