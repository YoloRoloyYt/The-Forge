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

  const Tiles = F.Tiles = {
    /** Build every tile variant for one biome. */
    FLOOR_V: 8, WALL_V: 6, FACE_V: 6,
    build(id, B) {
      const A = F.Art;
      for (let v = 0; v < 8; v++)
        A.define(id + '_floor' + v, TS, TS, (P, r) => floor(P, r, B, v), { tile: true, bump: 1.15, ax: 0, ay: 0, seed: hash(id, 'f', v) });
      for (let v = 0; v < 6; v++) {
        A.define(id + '_wall' + v, TS, TS, (P, r) => wallTop(P, r, B, v), { tile: true, bump: 0.9, ax: 0, ay: 0, seed: hash(id, 'w', v) });
        A.define(id + '_face' + v, TS, FACE_H, (P, r) => wallFace(P, r, B, v), { bump: 1.0, ax: 0, ay: FACE_H, seed: hash(id, 'e', v) });
      }
      if (B.liquid) for (let v = 0; v < 4; v++)
        A.define(id + '_liq' + v, TS, TS, (P, r) => liquid(P, r, B, v), { tile: true, bump: 0.7, ax: 0, ay: 0, seed: hash(id, 'l', v) });
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
      // crescent slash arc
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
  function paved(P, r, B, v) {
    const base = B.floor[0];
    P.mat(0.22, 0.05).rect(0, 0, TS, TS, F.Col.shade(base, 0.45));   // mortar
    // two or four slabs per tile, offset per variant so courses break up
    const cuts = (v % 2) ? [[0, 0, TS, 15], [0, 17, 15, 15], [17, 17, 15, 15]]
                         : [[0, 0, 15, 15], [17, 0, 15, 15], [0, 17, TS, 15]];
    for (const c of cuts) {
      const shade = 0.90 + r() * 0.20;
      P.mat(0.70, 0.10);
      P.rounded(c[0] + 0.5, c[1] + 0.5, c[2] - 1, c[3] - 1, 1.5, F.Col.shade(base, shade));
      // lit top edge, shaded bottom — makes each slab read as a block
      P.a.save(); P.a.globalAlpha = 0.28;
      P.a.fillStyle = '#ffffff'; P.a.fillRect(c[0] + 1.5, c[1] + 1, c[2] - 3, 1.4);
      P.a.fillStyle = '#000000'; P.a.fillRect(c[0] + 1.5, c[1] + c[3] - 2.4, c[2] - 3, 1.6);
      P.a.restore();
      P.mat(0.68, 0.08).speckle(c[0] + 2, c[1] + 2, c[2] - 4, c[3] - 4, B.grit, 14, 0.06);
      if (r() < 0.4) { P.mat(0.58, 0.05); P.crack(c[0] + r() * c[2], c[1] + r() * c[3], 6, B.crack, r() * 7, 0.7); }
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
    // scattered pebbles catch the light and sell the relief
    for (let i = 0; i < 6; i++) {
      const x = 2 + r() * (TS - 4), y = 2 + r() * (TS - 4), rr = 1.2 + r() * 2.4;
      P.mat(0.5, 0.16).dome(x, y, rr, rr * 0.85, B.grit[(r() * B.grit.length) | 0], 0.40, 0.66);
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
    const dark = F.Col.shade(base, 0.52);
    const lip = F.Col.mix(base, '#ffffff', 0.18);

    // the lip: the top surface rolling over the edge
    P.nrm(0, -0.42).mat(0.99, 0.16).rect(0, 0, TS, LIP, F.Col.mix(base, '#ffffff', 0.10));
    P.mat(0.99, 0.12).speckle(0, 0, TS, LIP - 1, B.wallGrit, 26, 0.04);

    // the face proper: a plane facing the camera and slightly south
    P.nrm(0, 0.68).mat(0.80, 0.09);
    P.ramp(0, LIP, TS, H - LIP, base, 0.84, 0.44, true);
    // vertical striation: columns of slightly different rock
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(r() * TS), w = 1 + Math.floor(r() * 4);
      P.a.save(); P.a.globalAlpha = 0.20 + r() * 0.22;
      P.a.fillStyle = r() < 0.5 ? dark : lip;
      P.a.fillRect(x, LIP, w, H - LIP);
      P.a.restore();
    }
    // horizontal strata lines
    for (let i = 0; i < 4; i++) {
      const y = LIP + 3 + Math.floor(r() * (H - LIP - 6));
      P.a.save(); P.a.globalAlpha = 0.24;
      P.a.fillStyle = B.crack; P.a.fillRect(0, y, TS, 1);
      P.a.fillStyle = lip; P.a.fillRect(0, y + 1, TS, 1);
      P.a.restore();
    }
    P.nrm(null);
    // broken blocks jutting from the face
    for (let i = 0; i < 3; i++) {
      const x = r() * TS, y = LIP + 4 + r() * (H - LIP - 10);
      P.mat(0.72 + r() * 0.2, 0.14).nrm(0, 0.35);
      P.dome(x, y, 3 + r() * 4, 2 + r() * 3, F.Col.mix(base, dark, r() * 0.6), 0.55, 0.85);
      P.nrm(null);
    }
    P.mat(0.6, 0.06).speckle(0, LIP, TS, H - LIP, B.wallGrit, 46, 0.08);
    // the floor meets the wall in a dark contact line
    P.a.save(); P.a.globalAlpha = 0.5; P.a.fillStyle = '#000000'; P.a.fillRect(0, H - 3, TS, 3); P.a.restore();
    if (B.accentAmt && r() < B.accentAmt * 0.7) {
      P.mat(0.85, 0.12).nrm(0, 0.55);
      if (B.accentGlow) P.glow(shadeGlow(B.accentGlow, B.accentEmis * 0.7));
      const x = r() * TS, y = LIP + r() * (H - LIP - 8);
      P.a.save(); P.a.globalAlpha = 0.40;
      P.ellipse(x, y, 2 + r() * 3, 3 + r() * 5, B.accent2);
      P.a.globalAlpha = 0.34;
      P.ellipse(x, y - 1, 1.4 + r() * 1.6, 2 + r() * 3, B.accent);
      P.a.restore(); P.glow(null); P.nrm(null);
    }
  }

  // ----------------------------------------------------------------- liquids
  function liquid(P, r, B, v) {
    const L = B.liquid;
    const phase = v / 4;
    P.mat(0.20, 0.55).glow(shadeGlow(L.glow, L.emis * 0.35)).rect(0, 0, TS, TS, L.col2);
    // flowing bands
    for (let i = 0; i < 6; i++) {
      const y = ((i / 6 + phase) % 1) * TS;
      P.a.save(); P.a.globalAlpha = 0.5;
      P.a.fillStyle = L.col;
      P.a.beginPath();
      for (let x = 0; x <= TS; x += 2) {
        const yy = y + Math.sin((x / TS + phase) * Math.PI * 2 + i) * 2.2;
        x === 0 ? P.a.moveTo(x, yy) : P.a.lineTo(x, yy);
      }
      P.a.lineTo(TS, y + 5); P.a.lineTo(0, y + 5); P.a.closePath(); P.a.fill();
      P.a.restore();
    }
    // bright crust / caustic highlights
    P.glow(shadeGlow(L.glow, L.emis)).mat(0.24, 0.6);
    for (let i = 0; i < 7; i++) {
      const x = r() * TS, y = r() * TS;
      P.a.save(); P.a.globalAlpha = 0.6 + r() * 0.4;
      P.ellipse(x, y, 1 + r() * 3, 0.8 + r() * 1.6, L.glow);
      P.a.restore();
    }
    P.glow(null);
    // gentle surface normal ripple
    for (let i = 0; i < 10; i++) {
      const x = r() * TS, y = r() * TS;
      P.nrm(Math.cos(i + phase * 6) * 0.35, Math.sin(i * 1.7 + phase * 6) * 0.35);
      P.a.save(); P.a.globalAlpha = 0.001; P.ellipse(x, y, 4, 3, '#ffffff'); P.a.restore();
    }
    P.nrm(null);
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
  function shadeGlow(col, amt) {
    const p = F.Col.parse(col), k = Math.min(1, amt === undefined ? 1 : amt);
    return F.Col.hex(p[0] * k, p[1] * k, p[2] * k);
  }
  F.shadeGlow = shadeGlow;

})(window.F2 = window.F2 || {});
