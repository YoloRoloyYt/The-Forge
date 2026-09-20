'use strict';
// ---------------------------------------------------------------------------
// draw.js — world-object drawing. Everything here appends to the y-sorted
// list so entities, nodes, props and wall faces interleave correctly.
// ---------------------------------------------------------------------------
(function (F) {

  const TS = F.TS;

  /** Ore nodes: grey body, then the ore inclusions tinted and lit by the ore. */
  F.drawNodes = function (lv, cam, sorted, time) {
    const A = F.Art, Bt = F.Batch;
    for (let i = 0; i < lv.nodes.length; i++) {
      const n = lv.nodes[i];
      if (!n.alive) continue;
      if (n.x < cam.x - 60 || n.x > cam.x + cam.vw + 60 || n.y < cam.y - 80 || n.y > cam.y + cam.vh + 60) continue;
      const O = F.ORES[n.ore] || F.ORES.stone;
      const v = n.seed & 3;
      const body = A.get('node_' + n.type + v), ore = A.get('ore_' + n.type + v);
      const sz = F.NODES[n.type].sz;
      // hit feedback: a quick squash and a white flash
      const hit = n.hitT > 0 ? n.hitT : 0;
      const sx = sz * (1 + hit * 0.16), sy = sz * (1 - hit * 0.13);
      const shake = n.shake > 0 ? (Math.random() - 0.5) * n.shake * 3 : 0;
      const x = n.x + shake, y = n.y + 4;
      const flash = n.flash > 0 ? n.flash : 0;
      const rockTint = lv._rockTint || (lv._rockTint = F.Col.tint(F.Col.mix(lv.B.wall[1], '#ffffff', 0.14)));
      sorted.push({
        y: n.y, draw() {
          Bt.push(A.get('shadow'), n.x, n.y + 2, { sx: sz * 0.95, sy: sz * 0.7, height: 0 });
          Bt.push(body, x, y, { sx, sy, tint: rockTint, emis: 0, height: 1.0 });
          if (flash > 0) Bt.push(body, x, y, { sx, sy, tint: F.Col.tint('#ffffff', flash * 0.8), emis: 0, height: 1 });
          const glowAmt = (O.glowAmt || 0) * (0.75 + 0.25 * Math.sin(time * 2.2 + n.seed));
          Bt.push(ore, x, y, { sx, sy, tint: F.Col.tint(O.col), emis: glowAmt * 2.6, height: 1.0 });
        },
      });
      // rich ore lights the rock around it
      if (O.glow && (O.glowAmt || 0) > 0.25 && F.NODES[n.type].rare) {
        F.Render.light({ x: n.x, y: n.y - 6, r: 60 + (O.glowAmt * 70), col: F.Col.lin(O.glow, 1),
          intensity: 0.9 + O.glowAmt * 1.4, z: 10, shadow: 0.25, spec: 1 });
      }
    }
  };

  const PROP_SPRITE = {
    stalagmite: 'p_stalagmite', rubble: 'p_rubble', bones: 'p_bones',
    mushroom: 'p_mushroom', timber: 'p_timber', crystalcluster: 'p_crystalcluster',
  };
  const FLAT_SPRITE = { bench: 'bench', crate: 'crate', anvil: 'anvil', sign: 'sign' };

  F.drawProps = function (lv, cam, sorted, time) {
    const A = F.Art, Bt = F.Batch, B = lv.B;
    for (let i = 0; i < lv.props.length; i++) {
      const p = lv.props[i];
      if (p.x < cam.x - 60 || p.x > cam.x + cam.vw + 60 || p.y < cam.y - 90 || p.y > cam.y + cam.vh + 60) continue;
      if (p.kind === 'torch') {
        sorted.push({ y: p.y, draw() {
          Bt.push(A.get('torch'), p.x, p.y, { emis: 1 });
          // the flame: three offset blobs that breathe
          for (let k = 0; k < 3; k++) {
            const t = time * (5 + k) + p.phase;
            const fy = p.y - 20 - k * 3 + Math.sin(t) * 1.6;
            const s = (0.5 - k * 0.11) * (1 + Math.sin(t * 1.7) * 0.14);
            Bt.push(A.get('blob'), p.x + Math.sin(t * 0.9) * 1.6, fy,
              { scale: s * 0.92, tint: F.Col.tint(k === 0 ? '#ff7a1e' : k === 1 ? '#ffab44' : '#ffd88a'),
                emis: 2.0, alpha: 0.92 - k * 0.1, height: 0 });
          }
        } });
        continue;
      }
      if (p.kind === 'ladder') { sorted.push({ y: p.y, sprite: 'ladder', x: p.x, opt: { height: 0.8 } }); continue; }
      if (p.kind === 'shaft') { sorted.push({ y: p.y + 6, sprite: 'shaft', x: p.x, opt: { height: 0.2 } }); continue; }
      if (p.kind === 'lantern_post') {
        sorted.push({ y: p.y, sprite: 'lantern_post', x: p.x, opt: { emis: 1.6 } });
        F.Render.light({ x: p.x, y: p.y - 26, r: 150, col: [1.0, 0.76, 0.42], intensity: 2.6, z: 22, shadow: 1, spec: 1 });
        continue;
      }
      if (p.kind === 'forgedrum') {
        sorted.push({ y: p.y + 10, draw() {
          Bt.push(A.get('forgedrum'), p.x, p.y, { emis: 1.05 + Math.sin(time * 1.7) * 0.12, height: 1 });
          // a low plume of heat off the throat
          for (let k = 0; k < 3; k++) {
            const t2 = time * (2.2 + k) + k;
            Bt.push(A.get('blob'), p.x + Math.sin(t2 * 0.8) * 9, p.y - 40 - k * 11 + Math.sin(t2) * 4,
              { scale: 1.1 - k * 0.24, tint: F.Col.tint(k === 0 ? '#c2501a' : '#d8792a'),
                emis: 1.1, alpha: 0.32, height: 0 });
          }
        } });
        continue;
      }
      if (p.kind === 'gate') {
        sorted.push({ y: p.y + 6, draw() {
          Bt.push(A.get('gate'), p.x, p.y, { emis: 1.4 + Math.sin(time * 2.1) * 0.3, height: 1 });
        } });
        continue;
      }
      if (p.kind === 'brazier') {
        sorted.push({ y: p.y, draw() {
          Bt.push(A.get('brazier'), p.x, p.y, { emis: 1 });
          for (let k = 0; k < 4; k++) {
            const t2 = time * (4.5 + k) + p.phase;
            Bt.push(A.get('blob'), p.x + Math.sin(t2 * 0.9) * 2.4, p.y - 30 - k * 4.5 + Math.sin(t2) * 2,
              { scale: 0.78 - k * 0.14, tint: F.Col.tint(k === 0 ? '#ff7a1e' : k === 1 ? '#ffab44' : '#ffd88a'),
                emis: 2.0, alpha: 0.9 - k * 0.12, height: 0 });
          }
        } });
        continue;
      }
      if (FLAT_SPRITE[p.kind]) {
        sorted.push({ y: p.y, sprite: FLAT_SPRITE[p.kind], x: p.x, opt: { flip: p.flip, height: 1 } });
        if (p.kind === 'sign' && p.title) sorted.push({ y: p.y + 0.1, draw() {} });
        continue;
      }
      const base = PROP_SPRITE[p.kind];
      if (!base) continue;
      const key = base + (p.v % 3);
      const tint = (p.kind === 'crystalcluster') ? F.Col.tint(B.accentGlow || B.accent)
        : (p.kind === 'stalagmite' || p.kind === 'rubble') ? F.Col.tint(B.wall[1])
        : (p.kind === 'bones') ? F.Col.tint(F.Col.mix(B.wall[1], '#cfc4a6', 0.55)) : 0xffffffff;
      const emis = p.kind === 'crystalcluster' ? 0.55 : p.kind === 'mushroom' ? 1.1 : 0;
      sorted.push({ y: p.y, sprite: key, x: p.x, opt: { flip: p.flip, tint, emis, height: 1 } });
    }
  };

  /** Shopkeepers: the same rig as everyone else, idling at their bench. */
  F.drawNpcs = function (lv, cam, sorted, time) {
    const A = F.Art, Bt = F.Batch;
    for (const n of lv.npcs) {
      if (n.x < cam.x - 80 || n.x > cam.x + cam.vw + 80) continue;
      n.animT = (time * 0.6 + n.seed) % 1;
      F.poseActor(n.rig, {
        moveSpeed: 0, animT: n.animT, aim: Math.PI / 2, aimLocal: -0.2,
        facing: 'S', holding: false, seed: n.seed,
        swingT: 0, swingDur: 0, mineT: 0, hurtT: 0, dashT: 0, deadT: 0,
      }, time);
      const tints = F.dressRig(n.rig, {}, {
        skin: '#c19a72', tunic: F.Col.shade(n.col, 0.45), sleeve: F.Col.shade(n.col, 0.55),
        trouser: '#3a3227', hair: F.Col.shade(n.col, 0.7),
      });
      n.rig.pose({ x: n.x, y: n.y, sx: 0.74, sy: 0.74 });
      sorted.push({ y: n.y, draw() {
        Bt.push(A.get('shadow'), n.x, n.y + 1, { sx: 0.78, sy: 0.66, height: 0 });
        n.rig.drawOutlined({ tints, height: 1 }, 1.05);
        // a soft mote of their trade colour, so you can find them across the hall
        Bt.push(A.get('blob'), n.x, n.y - 58 + Math.sin(time * 2 + n.seed) * 2.5,
          { scale: 0.45, tint: F.Col.tint(n.col), emis: 2.4, alpha: 0.8, height: 0 });
      } });
      F.Render.light({ x: n.x, y: n.y - 30, r: 90, col: F.Col.lin(n.col, 1), intensity: 0.9, z: 16, shadow: 0, spec: 0.4 });
    }
  };

  F.drawChests = function (lv, cam, sorted, time) {
    for (const c of lv.chests) {
      if (c.x < cam.x - 60 || c.x > cam.x + cam.vw + 60) continue;
      sorted.push({ y: c.y, sprite: c.opened ? 'chest_open' : 'chest', x: c.x, opt: { emis: c.opened ? 1.1 : 0, height: 1 } });
      if (!c.opened) F.Render.light({ x: c.x, y: c.y - 10, r: 90, col: [1.0, 0.82, 0.42], intensity: 1.3 + Math.sin(time * 2) * 0.25, z: 12, shadow: 0.3, spec: 1 });
    }
  };

  /** Loose pickups bob and spin on the floor. */
  F.drawPickups = function (lv, cam, sorted, time) {
    const A = F.Art, Bt = F.Batch;
    for (const d of lv.drops || []) {
      if (d.x < cam.x - 40 || d.x > cam.x + cam.vw + 40) continue;
      const bob = Math.sin(time * 3 + d.phase) * 2.2;
      sorted.push({ y: d.y, draw() {
        Bt.push(A.get('shadow'), d.x, d.y + 2, { sx: 0.35, sy: 0.3, height: 0 });
        Bt.push(A.get(d.sprite), d.x, d.y - 6 + bob,
          { tint: F.Col.tint(d.col), emis: 2.0, scale: d.scale || 1, rot: Math.sin(time * 2 + d.phase) * 0.12, height: 0.6 });
      } });
      F.Render.light({ x: d.x, y: d.y - 6, r: 46, col: F.Col.lin(d.col, 1), intensity: 0.85, z: 8, shadow: 0, spec: 0.4 });
    }
  };

})(window.F2 = window.F2 || {});
