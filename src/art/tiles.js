'use strict';
// ---------------------------------------------------------------------------
// tiles.js — terrain art. One set of generators, driven by a biome palette,
// so every depth gets its own stone without a new line of drawing code.
//
// Naming: `<biome>_floor0..3`, `<biome>_wall0..3`, `<biome>_face0..3`,
//         `<biome>_liq0..3`, plus shared contact-shadow and decal sprites.
// ---------------------------------------------------------------------------
(function (F) {

  const TS = F.TS = 32;
  const FACE_H = 42;          // wall face sprite height (32 tile + 10px lip over the wall behind)
  const SHORE_H = 14;         // how far the cooled crust reaches out over the liquid

  const Tiles = F.Tiles = {
    /** Build every tile variant for one biome. */
    FLOOR_V: 8, WALL_V: 6, FACE_V: 6,
    build(id, B) {
      const A = F.Art;
      for (let v = 0; v < 8; v++)
        A.define(id + '_floor' + v, TS, TS, (P, r) => floor(P, r, B, v), { tile: true, bump: 0.85, ax: 0, ay: 0, seed: hash(id, 'f', v) });
      for (let v = 0; v < 6; v++) {
        A.define(id + '_wall' + v, TS, TS, (P, r) => wallTop(P, r, B, v), { tile: true, bump: 0.9, ax: 0, ay: 0, seed: hash(id, 'w', v) });
        A.define(id + '_face' + v, TS, FACE_H, (P, r) => wallFace(P, r, B, v), { bump: 1.0, ax: 0, ay: FACE_H, seed: hash(id, 'e', v) });
      }
      if (B.liquid) {
        for (let v = 0; v < 6; v++)
          A.define(id + '_liq' + v, TS, TS, (P, r) => liquid(P, r, B, v), { tile: true, bump: 0.7, ax: 0, ay: 0, seed: hash(id, 'l', v) });
        for (let v = 0; v < 3; v++)
          A.define(id + '_raft' + v, 88, 64, (P, r) => raft(P, r, B, v), { bump: 1.2, ax: 44, ay: 32, seed: hash(id, 'ra', v) });
        // shoreline crust, two variants per edge so a long bank does not repeat
        for (let v = 0; v < 2; v++) for (const d of ['n', 's', 'e', 'w']) {
          const vert = d === 'n' || d === 's';
          A.define(id + '_shore' + d + v, vert ? TS : SHORE_H, vert ? SHORE_H : TS,
            (P, r) => shore(P, r, B, d), { bump: 1.0, ax: 0, ay: 0, seed: hash(id, 's' + d, v) });
        }
      }
      // rubble / accent props scattered on the floor
      for (let v = 0; v < 3; v++)
        A.define(id + '_rub' + v, 18, 14, (P, r) => rubble(P, r, B, v), { ax: 9, ay: 11, seed: hash(id, 'r', v) });
    },

    /** Shared, biome-independent sprites: contact shadows, decals, grid helpers. */
    buildShared() {
      const A = F.Art;
      // soft contact shadow, one per edge direction + inner corner
      A.define('ao_n', TS, 16, (P) => aoGrad(P, TS, 16, 'n'), { ax: 0, ay: 0 });
      A.define('ao_s', TS, 14, (P) => aoGrad(P, TS, 14, 's'), { ax: 0, ay: 0 });
      A.define('ao_e', 14, TS, (P) => aoGrad(P, 14, TS, 'e'), { ax: 0, ay: 0 });
      A.define('ao_w', 14, TS, (P) => aoGrad(P, 14, TS, 'w'), { ax: 0, ay: 0 });
      A.define('ao_corner', 16, 16, (P) => {
        const g = P.a; const rad = g.createRadialGradient(0, 0, 0, 0, 0, 16);
        rad.addColorStop(0, 'rgba(0,0,0,0.62)'); rad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rad; g.fillRect(0, 0, 16, 16);
      }, { ax: 0, ay: 0 });
      // ground features, scattered in world space and tinted per biome
      for (let v = 0; v < 3; v++) {
        A.define('gr_scree' + v, 104, 76, (P, r) => scree(P, r, v), { bump: 1.1, ax: 52, ay: 38, seed: hash('g', 's', v) });
        A.define('gr_fissure' + v, 136, 98, (P, r) => fissure(P, r, v), { bump: 1.0, ax: 68, ay: 49, seed: hash('g', 'f', v) });
        A.define('gr_slab' + v, 118, 86, (P, r) => slab(P, r, v), { bump: 0.8, ax: 59, ay: 43, seed: hash('g', 'b', v) });
        A.define('gr_wash' + v, 148, 112, (P, r) => wash(P, r, v), { bump: 0, ax: 74, ay: 56, seed: hash('g', 'w', v) });
      }
      // a plain white dot / soft round blob used for particles, glows and bars
      A.define('px', 4, 4, (P) => { P.mat(0.5, 0).rect(0, 0, 4, 4, '#ffffff'); }, { bump: 0 });
      A.define('blob', 32, 32, (P) => {
        const g = P.a; const rad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        rad.addColorStop(0, 'rgba(255,255,255,1)'); rad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
        rad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rad; g.fillRect(0, 0, 32, 32);
        P.hh.fillStyle = 'rgb(128,0,0)'; P.hh.fillRect(0, 0, 32, 32);
        P.n.fillStyle = 'rgb(128,128,0)'; P.n.fillRect(0, 0, 32, 32);
      }, { bump: 0 });
      A.define('ring', 48, 48, (P) => {
        const g = P.a;
        g.strokeStyle = '#ffffff'; g.lineWidth = 3;
        g.beginPath(); g.arc(24, 24, 20, 0, 7); g.stroke();
        P.n.fillStyle = 'rgb(128,128,0)';
        P.n.beginPath(); P.n.arc(24, 24, 20, 0, 7); P.n.lineWidth = 3; P.n.strokeStyle = 'rgb(128,128,0)'; P.n.stroke();
      }, { bump: 0 });
      A.define('spark', 8, 8, (P) => {
        const g = P.a; const rad = g.createRadialGradient(4, 4, 0, 4, 4, 4);
        rad.addColorStop(0, '#ffffff'); rad.addColorStop(0.5, 'rgba(255,255,255,0.5)'); rad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rad; g.fillRect(0, 0, 8, 8);
        P.n.fillStyle = 'rgb(128,128,0)'; P.n.fillRect(0, 0, 8, 8);
      }, { bump: 0 });
      // a long soft streak for trails, slashes and beams
      A.define('streak', 64, 12, (P) => {
        const g = P.a;
        const grad = g.createLinearGradient(0, 0, 64, 0);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.55, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.beginPath(); g.ellipse(32, 6, 32, 5, 0, 0, 7); g.fill();
        P.n.fillStyle = 'rgb(128,128,0)'; P.n.fillRect(0, 0, 64, 12);
      }, { bump: 0 });
      // Crescent weapon trails. Three widths, baked at high resolution. Built as
      // ONE tapering shape filled through a conic gradient — stacking dozens of
      // small strokes to fake the taper leaves visible concentric banding.
      [['slash_n', 0.62], ['slash_m', 1.05], ['slash_w', 1.62]].forEach(([key, half]) => {
        A.define(key, 168, 168, (P) => {
          const g = P.a, steps = 84, span = half * 2, turn = span / (Math.PI * 2);
          const fat = t => Math.pow(Math.sin(t * Math.PI), 0.62);
          const rOut = t => 78 - (1 - fat(t)) * 7;
          const rIn = t => rOut(t) - (5 + fat(t) * 25);
          g.save();
          g.translate(84, 84);

          const crescent = () => {
            g.beginPath();
            for (let i = 0; i <= steps; i++) {
              const t = i / steps, a = -half + t * span, r = rOut(t);
              const x = Math.cos(a) * r, y = Math.sin(a) * r;
              i ? g.lineTo(x, y) : g.moveTo(x, y);
            }
            for (let i = steps; i >= 0; i--) {
              const t = i / steps, a = -half + t * span, r = rIn(t);
              g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            g.closePath();
          };

          const ramp = (a0, a1, a2) => {
            let grad;
            if (g.createConicGradient) {
              grad = g.createConicGradient(-half, 0, 0);
              grad.addColorStop(0, 'rgba(255,255,255,0)');
              grad.addColorStop(turn * 0.16, 'rgba(255,255,255,' + a0 + ')');
              grad.addColorStop(turn * 0.58, 'rgba(255,255,255,' + a1 + ')');
              grad.addColorStop(turn * 0.93, 'rgba(255,255,255,' + a2 + ')');
              grad.addColorStop(Math.min(0.999, turn), 'rgba(255,255,255,0)');
              grad.addColorStop(1, 'rgba(255,255,255,0)');
            } else {
              grad = 'rgba(255,255,255,' + a1 + ')';
            }
            return grad;
          };

          // body
          crescent();
          g.fillStyle = ramp(0.30, 0.62, 0.22);
          g.fill();
          // leading edge: a single clean stroke along the outer rim
          g.beginPath();
          for (let i = 0; i <= steps; i++) {
            const t = i / steps, a = -half + t * span, r = rOut(t) - 1;
            const x = Math.cos(a) * r, y = Math.sin(a) * r;
            i ? g.lineTo(x, y) : g.moveTo(x, y);
          }
          g.lineCap = 'round'; g.lineJoin = 'round';
          g.lineWidth = 4.5;
          g.strokeStyle = ramp(0.45, 1.0, 0.30);
          g.stroke();
          g.lineWidth = 1.6;
          g.strokeStyle = ramp(0.30, 0.9, 0.20);
          g.stroke();
          g.restore();
          P.n.fillStyle = 'rgb(128,128,0)'; P.n.fillRect(0, 0, 168, 168);
        }, { bump: 0 });
      });
      // kept for the parry guard, which wants a soft fan rather than a trail
      A.define('slash', 72, 72, (P) => {
        const g = P.a;
        g.save(); g.translate(36, 36);
        for (let i = 0; i < 12; i++) {
          const t = i / 11;
          g.strokeStyle = 'rgba(255,255,255,' + (0.14 + 0.75 * Math.sin(t * Math.PI)) + ')';
          g.lineWidth = 1.5 + 5 * Math.sin(t * Math.PI);
          g.beginPath(); g.arc(0, 0, 24 + i * 0.6, -0.95, 0.95); g.stroke();
        }
        g.restore();
        P.n.fillStyle = 'rgb(128,128,0)'; P.n.fillRect(0, 0, 72, 72);
      }, { bump: 0 });
      // ground-crack decal used by slams and heavy impacts
      A.define('crackdecal', 64, 64, (P, r) => {
        P.mat(0.3, 0.05);
        for (let i = 0; i < 9; i++) P.crack(32, 32, 16 + Math.floor(r() * 14), '#000000', r() * 7, 0.5);
      }, { bump: 0.4 });
      A.define('shadow', 40, 20, (P) => {
        const g = P.a; const rad = g.createRadialGradient(20, 10, 0, 20, 10, 20);
        rad.addColorStop(0, 'rgba(0,0,0,0.55)'); rad.addColorStop(0.6, 'rgba(0,0,0,0.30)'); rad.addColorStop(1, 'rgba(0,0,0,0)');
        g.save(); g.translate(20, 10); g.scale(1, 0.5); g.translate(-20, -10);
        g.fillStyle = rad; g.beginPath(); g.arc(20, 10, 20, 0, 7); g.fill(); g.restore();
      }, { bump: 0 });
    },
  };

  function hash(a, b, c) { return F.Art.hashStr(a + '|' + b + '|' + c); }

  // ------------------------------------------------------------------ floors
  /** Dressed flagstones: for places somebody built rather than dug. */
  // A flagstone floor laid one tile at a time always shows the 32px grid,
  // because the mortar lands on the same coordinate in every tile. So the
  // layout is cut from a 4x2-tile block instead: each variant draws the slabs
  // that fall in its own cell, and the courses run straight across the seams.
  const PAVE_W = TS * 4, PAVE_H = TS * 2;
  let PAVE = null;
  function paveLayout() {
    if (PAVE) return PAVE;
    const R = F.rng(88123), out = [];
    // Four courses is what closes on 64px, but courses of equal-height stones
    // in a running bond is brickwork, not flagstone — and a floor that reads as
    // a wall is worse than the tiled grid this replaced. So a stone may take the
    // whole course height or be split into two stacked halves, and the widths
    // run from a cobble to a long slab.
    const heights = [12, 16, 14, 12];         // + 2px mortar each = 56 + 8 = 64
    let y = 0;
    heights.forEach((h, row) => {
      const w = [];
      let total = 0;
      while (total < PAVE_W - 16) {
        const q = 9 + Math.floor(R() * R() * 44);
        w.push(Math.max(9, q)); total += q + 2;
      }
      const slack = PAVE_W - total;
      w[w.length - 1] += slack;
      let x = -Math.floor(R() * 26);          // stagger the course
      for (const q of w) {
        if (q > 20 && R() < 0.34) {
          // split it: two stones stacked, so the course line breaks up
          const top = Math.round(h * (0.38 + R() * 0.24));
          out.push([x, y, q, top, R(), R(), R()]);
          out.push([x, y + top + 2, q, h - top - 2, R(), R(), R()]);
        } else {
          out.push([x, y, q, h, R(), R(), R()]);
        }
        x += q + 2;
      }
      y += h + 2;
    });
    PAVE = out;
    return out;
  }

  function paved(P, r, B, v) {
    const base = B.floor[0];
    const ox = (v & 3) * TS, oy = ((v >> 2) & 1) * TS;
    P.mat(0.22, 0.05).rect(0, 0, TS, TS, F.Col.shade(base, 0.45));   // mortar
    for (const [sx, sy, sw, sh, k, k2, k3] of paveLayout()) {
      // draw every wrap of the slab; the canvas clips whatever misses
      for (const wx of [-PAVE_W, 0, PAVE_W]) for (const wy of [-PAVE_H, 0, PAVE_H]) {
        const x = sx + wx - ox, y = sy + wy - oy;
        if (x > TS || y > TS || x + sw < 0 || y + sh < 0) continue;
        // slabs were cut from different stone and have worn differently; without
        // real spread between them the course reads as brickwork
        const stone = F.Col.mix(B.floor[(k2 * B.floor.length) | 0], base, 0.35);
        const sunk = k3 < 0.13;
        P.mat(sunk ? 0.48 : 0.70, 0.10);
        P.rounded(x + 0.5, y + 0.5, sw - 1, sh - 1, 1.5,
          F.Col.shade(stone, (sunk ? 0.62 : 0.80) + k * 0.42));
        // lit top edge, shaded bottom — makes each slab read as a block
        P.a.save(); P.a.globalAlpha = sunk ? 0.07 : 0.14;
        P.a.fillStyle = '#ffffff'; P.a.fillRect(x + 1.5, y + 1, sw - 3, 1.2);
        P.a.globalAlpha = sunk ? 0.10 : 0.18;
        P.a.fillStyle = '#000000'; P.a.fillRect(x + 1.5, y + sh - 2.2, sw - 3, 1.4);
        P.a.restore();
        // a few slabs are split clean through
        if (k3 > 0.86) {
          P.mat(0.30, 0.04);
          P.a.save(); P.a.globalAlpha = 0.55;
          P.line(x + sw * k2, y + 1, x + sw * (1 - k2 * 0.7), y + sh - 1, B.crack, 1.1);
          P.a.restore();
        }
        P.mat(0.68, 0.08).speckle(x + 2, y + 2, sw - 4, sh - 4, B.grit, Math.round(sw * sh * 0.028), 0.06);
        if (k < 0.4) { P.mat(0.58, 0.05); P.crack(x + k * sw * 2, y + k * sh * 2, 6, B.crack, k * 17, 0.7); }
      }
    }
    // worn hollows where feet go
    for (let i = 0; i < 3; i++) {
      P.a.save(); P.a.globalAlpha = 0.12;
      P.mat(0.60, 0.06).ellipse(r() * TS, r() * TS, 3 + r() * 5, 2 + r() * 4, F.Col.shade(base, 0.7));
      P.a.restore();
    }
    if (B.accentAmt && r() < 0.18) {
      P.a.save(); P.a.globalAlpha = 0.22;
      P.mat(0.68, 0.08).ellipse(r() * TS, r() * TS, 2 + r() * 3, 2 + r() * 2, B.accent2);
      P.a.restore();
    }
  }

  function floor(P, r, B, v) {
    if (B.paved) return paved(P, r, B, v);
    // Every variant shares ONE base colour. Varying the base per variant is what
    // makes a tiled floor read as a checkerboard, however good the detail is.
    const base = B.floor[0];
    P.mat(0.40, 0.06).rect(0, 0, TS, TS, base);
    // large tonal blotches keep big areas from reading flat
    for (let i = 0; i < 5; i++) {
      const x = r() * TS, y = r() * TS, rr = 5 + r() * 9;
      P.mat(0.40 + (r() - 0.5) * 0.10, 0.06);
      P.a.save(); P.a.globalAlpha = 0.16;
      P.ellipse(x, y, rr, rr * 0.8, B.floor[1 + ((r() * (B.floor.length - 1)) | 0)]);
      P.a.restore();
    }
    P.mat(0.38, 0.05).speckle(0, 0, TS, TS, B.grit, 46, 0.12);
    // hairline cracks
    if (r() < 0.55) {
      P.a.save(); P.a.globalAlpha = 0.40;
      for (let i = 0; i < 2; i++) { P.mat(0.30, 0.03); P.crack(r() * TS, r() * TS, 7 + r() * 8, B.crack, r() * 7, 0.8); }
      P.a.restore();
    }
    // A few pebbles sell the relief. Any more than this and the whole floor
    // reads as bubble wrap once the lantern picks out every dome at once.
    for (let i = 0; i < 4; i++) {
      const x = 2 + r() * (TS - 4), y = 2 + r() * (TS - 4), rr = 0.9 + r() * r() * 2.6;
      P.mat(0.46, 0.09).dome(x, y, rr, rr * (0.6 + r() * 0.35),
        B.grit[(r() * B.grit.length) | 0], 0.38, 0.55);
    }
    // biome accent: moss, verdigris, ash, crystal bloom
    // biome accent: moss, verdigris, ash bloom. Small, broken up, low contrast —
    // big saturated patches tile obviously and read as wallpaper.
    if (B.accentAmt && r() < B.accentAmt * 0.40) {
      const n = 2 + (r() * 3 | 0);
      const ox = r() * TS, oy = r() * TS;
      for (let i = 0; i < n; i++) {
        const x = ox + (r() - 0.5) * 11, y = oy + (r() - 0.5) * 11, rr = 1.2 + r() * 2.6;
        P.mat(0.44, 0.09);
        if (B.accentGlow) P.glow(shadeGlow(B.accentGlow, B.accentEmis * 0.35));
        P.a.save(); P.a.globalAlpha = 0.26 + r() * 0.16;
        P.ellipse(x, y, rr, rr * 0.8, F.Col.mix(B.accent2, base, 0.35)); P.a.restore();
        P.a.save(); P.a.globalAlpha = 0.20 + r() * 0.14;
        P.ellipse(x - 0.5, y - 0.5, rr * 0.6, rr * 0.5, F.Col.mix(B.accent, base, 0.25)); P.a.restore();
        P.glow(null);
      }
      // a few single-pixel flecks spreading out from the patch
      P.mat(0.42, 0.08);
      for (let i = 0; i < 6; i++) {
        P.a.save(); P.a.globalAlpha = 0.30;
        P.rect(ox + (r() - 0.5) * 22, oy + (r() - 0.5) * 22, 1, 1, r() < 0.5 ? B.accent : B.accent2);
        P.a.restore();
      }
    }
  }

  // --------------------------------------------------------------- wall tops
  function wallTop(P, r, B, v) {
    const base = B.wall[0];
    P.mat(0.92, 0.10).rect(0, 0, TS, TS, base);
    for (let i = 0; i < 7; i++) {
      const x = r() * TS, y = r() * TS, rr = 4 + r() * 8;
      P.mat(0.86 + r() * 0.12, 0.10);
      P.dome(x, y, rr, rr * 0.85, B.wall[(r() * B.wall.length) | 0], 0.80, 0.99);
    }
    P.mat(0.88, 0.08).speckle(0, 0, TS, TS, B.wallGrit, 54, 0.08);
    for (let i = 0; i < 4; i++) { P.mat(0.70, 0.04); P.crack(r() * TS, r() * TS, 12 + r() * 12, B.crack, r() * 7, 0.9); }
    if (B.accentAmt && r() < B.accentAmt * 0.35) {
      P.mat(0.90, 0.12);
      if (B.accentGlow) P.glow(shadeGlow(B.accentGlow, B.accentEmis * 0.30));
      P.a.save(); P.a.globalAlpha = 0.30;
      P.ellipse(r() * TS, r() * TS, 2.5 + r() * 3, 2 + r() * 2.5, B.accent2); P.a.restore();
      P.glow(null);
    }
  }

  // -------------------------------------------------------------- wall faces
  // Sprite is TS wide, FACE_H tall, anchored bottom-left on the tile below the
  // wall's top edge, so 10px of lip overhangs the wall behind it.
  function wallFace(P, r, B, v) {
    const H = FACE_H, LIP = 10;
    const base = B.wall[0];
    const dark = F.Col.shade(base, 0.48);
    const lip = F.Col.mix(base, '#ffffff', 0.16);

    // ---- the lip: the top surface rolling over the edge, catching sky
    P.nrm(0, -0.42).mat(0.99, 0.16).rect(0, 0, TS, LIP, F.Col.mix(base, '#ffffff', 0.10));
    P.mat(0.99, 0.12).speckle(0, 0, TS, LIP - 1, B.wallGrit, 26, 0.04);
    P.a.save(); P.a.globalAlpha = 0.5; P.a.fillStyle = lip; P.a.fillRect(0, LIP - 2, TS, 2); P.a.restore();

    // ---- the face. A single flat normal over the whole plane makes a grey
    // slab; break it into columns that each face slightly differently and the
    // lantern rakes across it instead.
    P.nrm(0, 0.62).mat(0.80, 0.09);
    P.ramp(0, LIP, TS, H - LIP, base, 0.86, 0.42, true);
    let x = 0;
    while (x < TS) {
      const w = 3 + Math.floor(r() * 6);
      const tilt = (r() - 0.5) * 0.55;
      const shade = 0.78 + r() * 0.46;
      P.nrm(tilt, 0.60 - Math.abs(tilt) * 0.25);
      P.mat(0.80, 0.09 + r() * 0.10);
      P.ramp(x, LIP, Math.min(w, TS - x), H - LIP, F.Col.shade(base, shade), 0.86, 0.42, true);
      x += w;
    }

    // ---- horizontal strata: a dark bed with a lit ledge above it
    const beds = 2 + Math.floor(r() * 3);
    for (let i = 0; i < beds; i++) {
      const y = LIP + 3 + Math.floor(r() * (H - LIP - 8));
      P.nrm(0, 0.88);
      P.a.save(); P.a.globalAlpha = 0.42; P.a.fillStyle = B.crack;
      P.a.fillRect(0, y, TS, 1 + Math.floor(r() * 2)); P.a.restore();
      P.nrm(0, 0.18);
      P.a.save(); P.a.globalAlpha = 0.40; P.a.fillStyle = lip;
      P.a.fillRect(0, y - 1.4, TS, 1.4); P.a.restore();
    }

    // ---- broken blocks jutting out, with real height-derived relief
    P.nrm(null);
    for (let i = 0; i < 4; i++) {
      const bx = r() * TS, by = LIP + 3 + r() * (H - LIP - 12);
      const bw = 3 + r() * 5, bh = 2.5 + r() * 4;
      P.mat(0.70 + r() * 0.26, 0.16);
      P.dome(bx, by, bw, bh, F.Col.mix(base, r() < 0.5 ? lip : dark, r() * 0.7), 0.42, 0.98);
    }
    P.nrm(0, 0.62);
    P.mat(0.6, 0.06).speckle(0, LIP, TS, H - LIP, B.wallGrit, 56, 0.10);
    for (let i = 0; i < 2; i++) { P.mat(0.5, 0.04); P.crack(r() * TS, LIP + r() * (H - LIP), 9 + r() * 9, B.crack, 1.4 + (r() - 0.5), 0.6); }
    P.nrm(null);

    // ---- the floor meets the wall in a dark contact line
    P.a.save();
    const cg = P.a.createLinearGradient(0, H - 7, 0, H);
    cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(0,0,0,0.72)');
    P.a.fillStyle = cg; P.a.fillRect(0, H - 7, TS, 7);
    P.a.restore();

    if (B.accentAmt && r() < B.accentAmt * 0.7) {
      P.mat(0.85, 0.12).nrm(0, 0.55);
      if (B.accentGlow) P.glow(shadeGlow(B.accentGlow, B.accentEmis * 0.7));
      const ax = r() * TS, ay = LIP + r() * (H - LIP - 8);
      P.a.save(); P.a.globalAlpha = 0.40;
      P.ellipse(ax, ay, 2 + r() * 3, 3 + r() * 5, B.accent2);
      P.a.globalAlpha = 0.34;
      P.ellipse(ax, ay - 1, 1.4 + r() * 1.6, 2 + r() * 3, B.accent);
      P.a.restore(); P.glow(null); P.nrm(null);
    }
  }

  // --------------------------------------------------------- ground features
  // Tiles can only carry detail up to their own size, so a floor built from
  // tiles alone is fine grain and nothing else — it reads as noise wallpaper.
  // These are greyscale masters, scattered in world space and tinted per biome,
  // and they are what gives a cavern floor its large shapes.

  /** A field of loose stone: the spoil that collects in the low spots. */
  function scree(P, r, v) {
    const W = 104, H = 76, cx = W / 2, cy = H / 2;
    // a dim bed under the stones, so the patch has a footprint
    P.mat(0.30, 0.04);
    for (let i = 0; i < 14; i++) {
      P.a.save(); P.a.globalAlpha = 0.14;
      P.ellipse(cx + (r() - 0.5) * W * 0.7, cy + (r() - 0.5) * H * 0.7,
        9 + r() * 15, 7 + r() * 11, '#6e6e6e');
      P.a.restore();
    }
    const n = 54 + v * 16;
    for (let i = 0; i < n; i++) {
      // pack them toward the middle, so the patch fades out instead of ending
      const a = r() * 6.2832, k = Math.pow(r(), 0.62);
      const x = cx + Math.cos(a) * k * W * 0.47, y = cy + Math.sin(a) * k * H * 0.47;
      const rr = 1.4 + r() * (3.4 - k * 1.4);
      const g = 120 + (r() * 90) | 0;
      P.mat(0.5 + r() * 0.34, 0.14 + r() * 0.12);
      P.a.save(); P.a.globalAlpha = 1 - k * 0.45;
      P.dome(x, y, rr, rr * (0.72 + r() * 0.2), F.Col.hex(g, g, g), 0.30, 0.95);
      P.a.restore();
    }
  }

  /** A fissure running across the floor, branching as it goes. */
  function fissure(P, r, v) {
    const W = 136, H = 98;
    const walk = (x, y, ang, len, wide, depth) => {
      let cx = x, cy = y, a = ang;
      for (let i = 0; i < len; i++) {
        const t = i / len, w = wide * (1 - t * 0.75);
        // the dark of the gap, and a bright lip on the side facing the light
        P.mat(0.06, 0.02);
        P.a.save(); P.a.globalAlpha = 0.82;
        P.ellipse(cx, cy, w, w * 0.8, '#2c2c2c', a); P.a.restore();
        P.mat(0.62, 0.20);
        P.a.save(); P.a.globalAlpha = 0.34;
        P.ellipse(cx + Math.sin(a) * w * 0.9, cy - Math.cos(a) * w * 0.9,
          w * 0.62, w * 0.45, '#cdcdcd', a); P.a.restore();
        a += (r() - 0.5) * 0.34;
        cx += Math.cos(a) * 2.6; cy += Math.sin(a) * 2.6;
        if (cx < -4 || cy < -4 || cx > W + 4 || cy > H + 4) return;
        if (depth < 2 && i > len * 0.3 && r() < 0.05)
          walk(cx, cy, a + (r() < 0.5 ? 0.8 : -0.8), len * 0.45, wide * 0.6, depth + 1);
      }
    };
    const a0 = (r() - 0.5) * 0.7;
    walk(4, H * (0.25 + r() * 0.5), a0, 52 + v * 8, 2.6 + v * 0.5, 0);
  }

  /** Bedrock showing through the spoil: one big flat slab, cracked. */
  function slab(P, r, v) {
    const W = 118, H = 86, cx = W / 2, cy = H / 2;
    const a0 = r() * 6.2832, a1 = r() * 6.2832;
    const rad = t => 0.42 + 0.09 * Math.sin(t * 2 + a0) + 0.06 * Math.sin(t * 3 + a1) + v * 0.02;
    const ring = k => {
      const p = [];
      for (let i = 0; i < 48; i++) { const t = i / 48 * 6.2832;
        p.push([cx + Math.cos(t) * rad(t) * W * k, cy + Math.sin(t) * rad(t) * H * k]); }
      return p;
    };
    // nested rings with rising opacity: a hard elliptical edge is the one thing
    // that makes a ground decal read as a sticker
    for (let k = 0; k < 5; k++) {
      P.mat(0.34 + k * 0.05, 0.07 + k * 0.012);
      P.a.save(); P.a.globalAlpha = 0.12;
      P.poly(ring(1.0 - k * 0.055), F.Col.hex(90 + k * 32, 90 + k * 32, 90 + k * 32));
      P.a.restore();
    }
    // joints across the face of the slab
    P.mat(0.18, 0.04);
    for (let i = 0; i < 4; i++) {
      P.a.save(); P.a.globalAlpha = 0.45;
      P.crack(cx + (r() - 0.5) * W * 0.5, cy + (r() - 0.5) * H * 0.5, 22 + r() * 26, '#3a3a3a', r() * 7, 0.55);
      P.a.restore();
    }
  }

  /** A soft stain: damp, ash, mineral bloom. Colour only, no relief. */
  function wash(P, r, v) {
    const W = 148, H = 112, cx = W / 2, cy = H / 2;
    for (let i = 0; i < 9 + v * 3; i++) {
      const a = r() * 6.2832, k = Math.pow(r(), 0.7);
      const g = P.a, x = cx + Math.cos(a) * k * W * 0.34, y = cy + Math.sin(a) * k * H * 0.34;
      const rr = 16 + r() * 30;
      const grad = g.createRadialGradient(x, y, 0, x, y, rr);
      grad.addColorStop(0, 'rgba(255,255,255,0.13)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.055)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.beginPath(); g.ellipse(x, y, rr, rr * 0.78, r() * 6.2832, 0, 7); g.fill();
    }
  }

  // ----------------------------------------------------------------- liquids
  function liquid(P, r, B, v) {
    const L = B.liquid;
    if (L.emis > 0.45) molten(P, r, B, v, L); else water(P, r, B, v, L);
    // a gentle surface normal ripple, so the light does not slide over glass
    const phase = v / 6;
    for (let i = 0; i < 10; i++) {
      const x = r() * TS, y = r() * TS;
      P.nrm(Math.cos(i + phase * 6) * 0.35, Math.sin(i * 1.7 + phase * 6) * 0.35);
      P.a.save(); P.a.globalAlpha = 0.001; P.ellipse(x, y, 4, 3, '#ffffff'); P.a.restore();
    }
    P.nrm(null).glow(null);
  }

  /**
   * Molten rock. Drawn the way it actually looks: a hot sheet with cooled
   * crust drifting on it, so the glow survives only in the channels between
   * the plates. A flat orange field with bright specks scattered over it —
   * which is what this used to be — reads as polka dots, not as lava.
   */
  function molten(P, r, B, v, L) {
    const phase = v / 6;
    // The tile carries only fine, low-contrast texture. Anything with structure
    // at the scale of the tile itself makes the 32px grid readable the moment
    // two neighbours land on different frames — the large shapes belong to the
    // world-space crust rafts instead (see F.placeRafts).
    P.mat(0.12, 0.34).glow(shadeGlow(L.glow, L.emis * 0.22)).rect(0, 0, TS, TS, L.col);
    const cr = F.rng(4407);
    const wrap = (fn) => { for (const ox of [-TS, 0, TS]) for (const oy of [-TS, 0, TS]) fn(ox, oy); };

    // convection cells: darker, cooler skin drifting over the melt
    for (let i = 0; i < 11; i++) {
      const bx = cr() * TS, by = cr() * TS;
      const rx = 3 + cr() * 4.5, ry = 2.4 + cr() * 3.6, rot = cr() * 6.2832;
      const x = (bx + phase * TS * 0.5) % TS, y = (by + phase * TS * 0.85) % TS;
      P.mat(0.20 + cr() * 0.10, 0.18).glow(shadeGlow(L.glow, L.emis * 0.16));
      P.a.save(); P.a.globalAlpha = 0.42;
      wrap((ox, oy) => P.ellipse(x + ox, y + oy, rx, ry, F.Col.mix(L.col, L.col2, 0.75), rot));
      P.a.restore();
    }
    // and the bright seams between them
    P.mat(0.10, 0.5).glow(shadeGlow(L.glow, L.emis * 0.55));
    for (let i = 0; i < 6; i++) {
      const bx = cr() * TS, by = cr() * TS;
      const x = (bx - phase * TS * 0.3 + TS) % TS, y = (by - phase * TS * 0.5 + TS) % TS;
      const len = 2.5 + cr() * 5, ang = cr() * 6.2832;
      P.a.save(); P.a.globalAlpha = 0.34 + cr() * 0.3;
      wrap((ox, oy) => P.line(x + ox - Math.cos(ang) * len, y + oy - Math.sin(ang) * len,
        x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len,
        F.Col.mix(L.glow, '#ffffff', 0.3), 0.8 + cr() * 0.6));
      P.a.restore();
    }
  }

  /**
   * A raft of cooled crust floating on a pool. Big, irregular and placed in
   * world space, so the pool gets its large shapes from something that does not
   * repeat every 32 pixels.
   */
  function raft(P, r, B, v) {
    const L = B.liquid, W = 88, H = 64, cx = W / 2, cy = H / 2;
    const basalt = F.Col.mix(L.col2, '#15100e', 0.80);
    // outline: one lumpy closed curve, sampled from three harmonics
    const a0 = r() * 6.2832, a1 = r() * 6.2832, a2 = r() * 6.2832;
    const rad = t => (0.56 + 0.16 * Math.sin(t * 2 + a0) + 0.12 * Math.sin(t * 3 + a1)
      + 0.08 * Math.sin(t * 5 + a2)) * (0.8 + v * 0.14);
    const at = (t, k) => [cx + Math.cos(t) * rad(t) * W * k, cy + Math.sin(t) * rad(t) * H * k];
    const ring = (k) => { const p = []; for (let i = 0; i < 64; i++) p.push(at(i / 64 * 6.2832, k)); return p; };

    // the hot rind first, so it survives as a lip around the slab
    P.mat(0.22, 0.45).glow(shadeGlow(L.glow, L.emis * 0.55));
    P.poly(ring(1.0), F.Col.mix(L.glow, L.col, 0.55));
    // Then the slab itself. It has to paint BLACK into the emissive channel, not
    // simply stop writing to it: glow(null) leaves the rind's emissive underneath
    // and the whole raft comes out as a flat glowing silhouette.
    P.mat(0.62, 0.10).glow('#000000');
    P.poly(ring(0.955), basalt);
    // plates within the slab, cracked apart
    const cr = F.rng(771 + v * 31);
    P.mat(0.68, 0.12);
    for (let i = 0; i < 7; i++) {
      const t = cr() * 6.2832, k = cr() * 0.72;
      const px = cx + Math.cos(t) * rad(t) * W * k, py = cy + Math.sin(t) * rad(t) * H * k;
      P.ellipse(px, py, 5 + cr() * 9, 4 + cr() * 7,
        F.Col.mix(basalt, B.wallGrit[1], 0.18 + cr() * 0.3), cr() * 6.2832);
    }
    // fissures letting the melt show through
    P.mat(0.30, 0.4).glow(shadeGlow(L.glow, L.emis * 0.42));
    for (let i = 0; i < 5; i++) {
      const t = cr() * 6.2832;
      let px = cx + Math.cos(t) * rad(t) * W * 0.12, py = cy + Math.sin(t) * rad(t) * H * 0.12;
      const ang = t + (cr() - 0.5) * 1.2;
      for (let k = 0; k < 4; k++) {
        const nx = px + Math.cos(ang + (cr() - 0.5) * 0.9) * (5 + cr() * 6);
        const ny = py + Math.sin(ang + (cr() - 0.5) * 0.9) * (4 + cr() * 5);
        P.line(px, py, nx, ny, F.Col.mix(L.glow, L.col2, 0.45), 1.1 - k * 0.22);
        px = nx; py = ny;
      }
    }
    P.glow(null);
  }

  /** Water, ichor: a body you can see into, with light crawling on the floor. */
  function water(P, r, B, v, L) {
    const phase = v / 6;
    P.mat(0.20, 0.62).glow(shadeGlow(L.glow, L.emis * 0.30)).rect(0, 0, TS, TS, L.col2);
    // the bed showing through, dimmed and blue-shifted by the depth above it
    const cr = F.rng(9901);
    P.mat(0.26, 0.30).glow(null);
    for (let i = 0; i < 7; i++) {
      P.a.save(); P.a.globalAlpha = 0.26;
      P.ellipse(cr() * TS, cr() * TS, 2 + cr() * 5, 1.6 + cr() * 3.4,
        F.Col.mix(B.floor[0], L.col, 0.55), cr() * 6.2832);
      P.a.restore();
    }
    // caustics: a crawling net of light, not a field of dots
    P.mat(0.22, 0.7).glow(shadeGlow(L.glow, L.emis * 1.5));
    const cc = F.rng(3313);
    for (let i = 0; i < 7; i++) {
      const bx = cc() * TS, by = cc() * TS, sc = 4 + cc() * 6;
      const x = (bx + phase * TS * 0.6) % TS, y = (by + phase * TS * 0.9) % TS;
      for (const ox of [-TS, 0, TS]) for (const oy of [-TS, 0, TS]) {
        P.a.save(); P.a.globalAlpha = 0.30 + cc() * 0.30;
        for (const g of [P.a, P.hh, P.e]) {
          g.save(); g.lineWidth = 1.1; g.lineCap = 'round'; g.beginPath();
          for (let k = 0; k <= 12; k++) {
            const t = k / 12 * 6.2832;
            const xx = x + ox + Math.cos(t + phase * 3) * sc * (0.7 + 0.3 * Math.sin(t * 3 + i));
            const yy = y + oy + Math.sin(t + phase * 3) * sc * 0.62 * (0.7 + 0.3 * Math.cos(t * 2 + i));
            k === 0 ? g.moveTo(xx, yy) : g.lineTo(xx, yy);
          }
          g.closePath();
          g.strokeStyle = g === P.a ? L.glow : (g === P.e ? shadeGlow(L.glow, L.emis * 1.5) : 'rgb(56,178,0)');
          g.stroke(); g.restore();
        }
        P.a.restore();
      }
    }
    // a slow surface drift so the body is not a frozen pane
    P.mat(0.18, 0.5).glow(null);
    for (let i = 0; i < 4; i++) {
      const y = ((i / 4 - phase) % 1 + 1) % 1 * TS;
      P.a.save(); P.a.globalAlpha = 0.16; P.a.fillStyle = L.col;
      P.a.beginPath();
      for (let x = 0; x <= TS; x += 2) P.a.lineTo(x, y + Math.sin((x / TS + phase) * 6.2832 + i) * 2.4);
      P.a.lineTo(TS, y + 4.5); P.a.lineTo(0, y + 4.5); P.a.closePath(); P.a.fill();
      P.a.restore();
    }
  }

  // ----------------------------------------------------------------- rubble
  function rubble(P, r, B, v) {
    const n = 2 + v;
    for (let i = 0; i < n; i++) {
      const x = 3 + r() * 12, y = 4 + r() * 7, rr = 1.6 + r() * 3;
      P.mat(0.55 + r() * 0.3, 0.16);
      P.dome(x, y, rr, rr * 0.8, B.wall[(r() * B.wall.length) | 0], 0.3, 0.9);
    }
  }

  function aoGrad(P, w, h, dir) {
    const g = P.a;
    let grad;
    if (dir === 'n') grad = g.createLinearGradient(0, 0, 0, h);
    else if (dir === 's') grad = g.createLinearGradient(0, h, 0, 0);
    else if (dir === 'e') grad = g.createLinearGradient(w, 0, 0, 0);
    else grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.60)');
    grad.addColorStop(0.35, 'rgba(0,0,0,0.26)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  }

  /** Emissive colours are authored as a colour + intensity; fold intensity in. */
  // ------------------------------------------------------------------ shores
  // A pool drawn as plain 32px tiles has a staircase silhouette, and a straight
  // run of it is the one thing that gives a tile grid away instantly. A crust of
  // cooled rock with a ragged front, glowing where the liquid laps under it,
  // replaces the cut with a shoreline.
  function shore(P, r, B, dir) {
    const L = B.liquid, H = SHORE_H;
    // Edge space: u runs along the shoreline, d reaches out over the liquid.
    // Each direction maps it into the sprite's own axes, so the baked normals
    // come out right without relying on a flip the batch cannot mirror.
    const m = dir === 'n' ? (u, d) => [u, d]
            : dir === 's' ? (u, d) => [u, H - d]
            : dir === 'w' ? (u, d) => [d, u]
            :               (u, d) => [H - d, u];
    // the crust slopes down into the liquid, so it faces away from the shore
    P.nrm(dir === 'w' ? 0.5 : dir === 'e' ? -0.5 : 0, dir === 'n' ? 0.5 : dir === 's' ? -0.5 : 0);

    // one wobbling front profile, sampled per pixel along the edge
    const a0 = r() * 6.2832, a1 = r() * 6.2832, a2 = r() * 6.2832;
    const front = u => F.U.clamp(
      0.52 + 0.26 * Math.sin(u * 0.33 + a0) + 0.17 * Math.sin(u * 0.74 + a1) + 0.11 * Math.sin(u * 1.51 + a2),
      0.16, 1) * H;

    const rock = F.Col.mix(B.wall[0], L.col2, 0.34);
    // four layers: each reaches a little less far and sits a little lower, so
    // the bank reads as strata rather than one stamped lip
    for (let k = 3; k >= 0; k--) {
      const reach = 1 - k * 0.19;
      P.mat(0.30 + k * 0.10, 0.10).glow(null);
      const col = F.Col.mix(rock, k === 0 ? B.wallGrit[0] : B.crack, k === 0 ? 0.30 : 0.12 * k);
      const pts = [];
      for (let u = 0; u <= TS; u += 2) pts.push(m(u, front(u) * reach));
      for (let u = TS; u >= 0; u -= 2) pts.push(m(u, -2));
      P.poly(pts, col);
    }

    // the liquid lapping under the crust's lip: a hot line along the front,
    // brightest where the crust reaches furthest out
    P.glow(shadeGlow(L.glow, Math.max(0.35, L.emis * 0.9))).mat(0.16, 0.5).nrm(null);
    P.a.save(); P.hh.save(); P.e.save();
    for (const g of [P.a, P.hh, P.e]) { g.lineWidth = 2.2; g.lineJoin = 'round'; g.lineCap = 'round'; }
    P.a.strokeStyle = L.glow; P.e.strokeStyle = shadeGlow(L.glow, Math.max(0.35, L.emis * 0.9));
    P.hh.strokeStyle = 'rgb(41,128,0)';
    for (const g of [P.a, P.hh, P.e]) {
      g.beginPath();
      for (let u = 0; u <= TS; u += 2) {
        const q = m(u, front(u));
        u === 0 ? g.moveTo(q[0], q[1]) : g.lineTo(q[0], q[1]);
      }
      g.globalAlpha = g === P.a ? 0.55 : 1;
      g.stroke();
    }
    P.a.restore(); P.hh.restore(); P.e.restore();

    // cracks: the crust is not watertight, and the glow finds the gaps
    P.nrm(null).mat(0.18, 0.4);
    for (let i = 0; i < 3; i++) {
      const u = 3 + r() * (TS - 6), f = front(u);
      const p0 = m(u, f * 0.15), p1 = m(u + (r() - 0.5) * 7, f * (0.72 + r() * 0.3));
      P.line(p0[0], p0[1], p1[0], p1[1], L.glow, 0.9 + r() * 0.8);
    }
    P.glow(null);
  }

  function shadeGlow(col, amt) {
    const p = F.Col.parse(col), k = Math.min(1, amt === undefined ? 1 : amt);
    return F.Col.hex(p[0] * k, p[1] * k, p[2] * k);
  }
  F.shadeGlow = shadeGlow;

})(window.F2 = window.F2 || {});
