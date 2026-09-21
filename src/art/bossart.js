'use strict';
// ---------------------------------------------------------------------------
// bossart.js — the seven things at the bottom of the shafts.
//
// Each is a massive body, a head and a pair of arms, driven by the same
// skeleton the player uses, at four times the scale. The generators take a
// palette and a handful of silhouette flags, so a Grove Guardian and a Void
// Sovereign share their bones and share nothing else.
// ---------------------------------------------------------------------------
(function (F) {

  const A = () => F.Art;

  // Keyed by boss id, exactly. These used to be short nicknames, which meant
  // three of the seven bosses quietly rendered as nothing at all — a missing
  // sprite is skipped silently by the rig. tests.html now checks the mapping.
  // shape: how the mass is built. crown/horns/spines/roots/facets are silhouette.
  const KINDS = {
    grove:    { shape: 'bulk',   crown: 'roots',  eyes: 2, eyeCol: '#c8ff6a', rough: 1.0, mossy: true,  mantle: 'stone' },
    leviath:  { shape: 'coil',   crown: 'fins',   eyes: 3, eyeCol: '#8ff4ff', rough: 0.6, wet: true,    mantle: 'coral' },
    infernal: { shape: 'bulk',   crown: 'crown',  eyes: 2, eyeCol: '#ffd36a', rough: 0.9, molten: true, mantle: 'slag' },
    prism:    { shape: 'facets', crown: 'facets', eyes: 5, eyeCol: '#e0c8ff', rough: 0.2, facet: true,  mantle: 'shards' },
    sovereign_bone: { shape: 'gaunt', crown: 'horns',  eyes: 2, eyeCol: '#b8ff8a', rough: 0.8, bones: true, mantle: 'ribs' },
    voidlord: { shape: 'gaunt',  crown: 'spines', eyes: 4, eyeCol: '#f0a8ff', rough: 0.5, rift: true,   mantle: 'rift' },
    firstforger: { shape: 'bulk',  crown: 'crown',  eyes: 2, eyeCol: '#fff0a8', rough: 0.7, molten: true, plates: true, mantle: 'anvil' },
  };

  F.BossArt = {
    KINDS,
    build() {
      for (const id in KINDS) {
        const K = KINDS[id];
        A().define('bs_body_' + id, 152, 124, (P, r) => body(P, r, K), { ax: 76, ay: 120, bump: 1.25, seed: hash(id, 'b') });
        A().define('bs_head_' + id, 76, 72, (P, r) => head(P, r, K), { ax: 38, ay: 62, bump: 1.3, seed: hash(id, 'h') });
        A().define('bs_armU_' + id, 34, 52, (P, r) => limb(P, r, K, 34, 52, 13, 9), { ax: 17, ay: 8, bump: 1.4, seed: hash(id, 'au') });
        A().define('bs_armL_' + id, 30, 48, (P, r) => limb(P, r, K, 30, 48, 10, 12), { ax: 15, ay: 6, bump: 1.4, seed: hash(id, 'al') });
        A().define('bs_fist_' + id, 36, 34, (P, r) => fist(P, r, K), { ax: 18, ay: 8, bump: 1.4, seed: hash(id, 'f') });
        A().define('bs_legU_' + id, 36, 46, (P, r) => limb(P, r, K, 36, 46, 14, 11), { ax: 18, ay: 6, bump: 1.4, seed: hash(id, 'lu') });
        A().define('bs_legL_' + id, 32, 44, (P, r) => limb(P, r, K, 32, 44, 11, 13), { ax: 16, ay: 5, bump: 1.4, seed: hash(id, 'll') });
        A().define('bs_crown_' + id, 90, 56, (P, r) => crown(P, r, K), { ax: 45, ay: 50, bump: 1.4, seed: hash(id, 'c') });
        A().define('bs_eyes_' + id, 76, 72, (P) => eyes(P, K), { ax: 38, ay: 62, bump: 0, seed: hash(id, 'e') });
        A().define('bs_core_' + id, 152, 124, (P) => core(P, K), { ax: 76, ay: 120, bump: 0.4, seed: hash(id, 'k') });
      }
      // The arena floor. A boss fight in an unlit circle of rock is a fight in
      // a void; a sigil under it gives the stage a centre, a scale reference
      // and somewhere for the phase changes to flare from.
      A().define('arena_sigil', 448, 448, (P, r) => {
        const g = P.a, c = 224;
        P.n.fillStyle = 'rgb(128,128,0)'; P.n.fillRect(0, 0, 448, 448);
        const ring = (rad, wdt, al) => {
          for (const q of [g, P.e]) {
            q.save(); q.globalAlpha = al * (q === g ? 1 : 0.5);
            q.strokeStyle = '#ffffff'; q.lineWidth = wdt;
            q.beginPath(); q.arc(c, c, rad, 0, 6.2832); q.stroke(); q.restore();
          }
        };
        ring(206, 5, 0.42); ring(196, 2, 0.26); ring(150, 3, 0.30); ring(64, 2, 0.24);
        // radial ticks around the outer band
        for (let i = 0; i < 48; i++) {
          const a = i / 48 * 6.2832, long = i % 4 === 0;
          const r0 = long ? 176 : 186, r1 = 200;
          for (const q of [g, P.e]) {
            q.save(); q.globalAlpha = (long ? 0.45 : 0.22) * (q === g ? 1 : 0.5);
            q.strokeStyle = '#ffffff'; q.lineWidth = long ? 4 : 2;
            q.beginPath(); q.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
            q.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); q.stroke(); q.restore();
          }
        }
        // a broken inner figure: chords struck between points on the mid ring
        for (let i = 0; i < 7; i++) {
          const a0 = i / 7 * 6.2832, a1 = a0 + 6.2832 * 3 / 7;
          for (const q of [g, P.e]) {
            q.save(); q.globalAlpha = 0.20 * (q === g ? 1 : 0.5);
            q.strokeStyle = '#ffffff'; q.lineWidth = 2.5;
            q.beginPath(); q.moveTo(c + Math.cos(a0) * 150, c + Math.sin(a0) * 150);
            q.lineTo(c + Math.cos(a1) * 150, c + Math.sin(a1) * 150); q.stroke(); q.restore();
          }
        }
        // scorch: the floor of a place where this has happened before
        for (let i = 0; i < 26; i++) {
          const a = r() * 6.2832, rad = 40 + r() * 165;
          const x = c + Math.cos(a) * rad, y = c + Math.sin(a) * rad, rr = 14 + r() * 34;
          const grad = g.createRadialGradient(x, y, 0, x, y, rr);
          grad.addColorStop(0, 'rgba(255,255,255,0.10)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = grad; g.beginPath(); g.ellipse(x, y, rr, rr * 0.8, 0, 0, 7); g.fill();
        }
      }, { ax: 224, ay: 224, bump: 0, seed: 9182 });

      // shared boss effects
      A().define('telegraph', 128, 128, (P) => {
        const g = P.a;
        g.strokeStyle = '#ffffff'; g.lineWidth = 4;
        g.beginPath(); g.arc(64, 64, 60, 0, 7); g.stroke();
        g.globalAlpha = 0.28; g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
        P.n.fillStyle = 'rgb(128,128,0)'; P.n.fillRect(0, 0, 128, 128);
      }, { bump: 0 });
      A().define('warnline', 128, 24, (P) => {
        const g = P.a;
        const grad = g.createLinearGradient(0, 0, 0, 24);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.75)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.fillRect(0, 0, 128, 24);
        P.n.fillStyle = 'rgb(128,128,0)'; P.n.fillRect(0, 0, 128, 24);
      }, { ax: 0, ay: 12, bump: 0 });
    },
  };

  const G = { hi: '#efefef', mid: '#c2c2c2', low: '#8a8a8a', dark: '#575757', deep: '#333333' };
  function hash(a, b) { return F.Art.hashStr('boss|' + a + '|' + b); }

  function body(P, r, K) {
    const cx = 76, cy = 120;
    if (K.shape === 'gaunt') {
      P.mat(0.62, 0.12);
      P.poly([[cx - 26, cy], [cx - 34, cy - 58], [cx - 16, cy - 96], [cx + 16, cy - 96], [cx + 34, cy - 58], [cx + 26, cy]], G.mid);
      P.mat(0.88, 0.2).dome(cx, cy - 74, 22, 18, G.hi, 0.6, 1.0);
      // ribs
      P.mat(0.5, 0.1);
      for (let i = 0; i < 5; i++) {
        P.a.save(); P.a.globalAlpha = 0.5;
        P.rect(cx - 24 + i * 2, cy - 56 + i * 9, 48 - i * 4, 2.5, G.deep);
        P.a.restore();
      }
    } else if (K.shape === 'coil') {
      P.mat(0.58, 0.16).dome(cx, cy - 26, 52, 28, G.mid, 0.2, 0.9);
      P.mat(0.72, 0.2).dome(cx, cy - 58, 42, 26, G.mid, 0.4, 0.98);
      P.mat(0.86, 0.24).dome(cx, cy - 84, 30, 20, G.hi, 0.6, 1.0);
      // scale rows
      P.mat(0.8, 0.3);
      for (let row = 0; row < 6; row++) for (let i = 0; i < 9; i++) {
        const y = cy - 12 - row * 15, w = 44 - row * 5;
        const x = cx - w + (i / 8) * w * 2;
        P.a.save(); P.a.globalAlpha = 0.35;
        P.dome(x, y, 5, 4, i % 2 ? G.hi : G.low, 0.5, 0.9);
        P.a.restore();
      }
    } else if (K.shape === 'facets') {
      P.mat(0.70, 0.75);
      P.poly([[cx - 40, cy], [cx - 46, cy - 52], [cx - 18, cy - 98], [cx + 18, cy - 98], [cx + 46, cy - 52], [cx + 40, cy]], G.mid);
      // big crystal facets catching the light differently
      const fac = [[[cx - 40, cy], [cx - 46, cy - 52], [cx - 10, cy - 40], [cx - 6, cy]],
                   [[cx - 10, cy - 40], [cx - 18, cy - 98], [cx + 18, cy - 98], [cx + 10, cy - 40]],
                   [[cx + 6, cy], [cx + 10, cy - 40], [cx + 46, cy - 52], [cx + 40, cy]]];
      const shades = [G.low, G.hi, G.mid];
      fac.forEach((f, i) => { P.mat(0.6 + i * 0.16, 0.85); P.poly(f, shades[i]); });
    } else {
      // bulk: a waist, a deep chest, and two shoulders that read separately
      P.mat(0.56, 0.14).dome(cx, cy - 16, 34, 18, G.low, 0.2, 0.82);
      P.mat(0.66, 0.15).dome(cx, cy - 40, 40, 24, G.mid, 0.34, 0.92);
      P.mat(0.82, 0.17).dome(cx, cy - 66, 44, 26, G.mid, 0.5, 0.99);
      P.mat(0.96, 0.22).dome(cx - 34, cy - 82, 20, 15, G.hi, 0.62, 1.0);
      P.mat(0.96, 0.22).dome(cx + 34, cy - 82, 20, 15, G.hi, 0.62, 1.0);
      // a dark trough between the shoulders where the neck goes
      P.mat(0.48, 0.08).dome(cx, cy - 90, 15, 9, G.dark, 0.30, 0.52);
    }
    // surface
    const n = Math.round(150 * K.rough);
    P.mat(0.7, 0.14).speckle(cx - 52, cy - 96, 104, 94, [G.hi, G.dark], n, 0.18);
    if (K.plates) {
      P.mat(0.95, 0.5);
      for (let i = 0; i < 4; i++) P.rounded(cx - 30, cy - 70 + i * 16, 60, 10, 3, G.low);
    }
    if (K.molten) {
      P.glow('#ffffff').mat(0.4, 0.3);
      for (let i = 0; i < 9; i++) P.crack(cx + (r() - 0.5) * 70, cy - 20 - r() * 70, 16, '#ffffff', r() * 7, 0.9);
      P.glow(null);
    }
    if (K.rift) {
      P.glow('#ffffff').mat(0.3, 0.2);
      for (let i = 0; i < 4; i++) {
        const x = cx + (r() - 0.5) * 50, y = cy - 30 - r() * 50;
        P.a.save(); P.a.globalAlpha = 0.85;
        P.ellipse(x, y, 3 + r() * 5, 10 + r() * 12, '#ffffff', r() * 3);
        P.a.restore();
      }
      P.glow(null);
    }
    if (K.mossy) {
      P.mat(0.66, 0.1);
      for (let i = 0; i < 26; i++) {
        P.a.save(); P.a.globalAlpha = 0.30;
        P.ellipse(cx - 48 + r() * 96, cy - 102 + r() * 84, 3 + r() * 7, 2 + r() * 5, G.dark);
        P.a.restore();
      }
    }
    if (K.wet) {
      P.mat(0.8, 0.85);
      for (let i = 0; i < 16; i++) {
        P.a.save(); P.a.globalAlpha = 0.25;
        P.ellipse(cx - 46 + r() * 92, cy - 100 + r() * 78, 2 + r() * 5, 1 + r() * 3, G.hi);
        P.a.restore();
      }
    }
    mantle(P, r, K, cx, cy);
    // the core socket is cut here; the light that sits in it is a separate
    // plate, because the body's tint is dark enough to swallow an emissive
    P.mat(0.30, 0.10).ellipse(cx, cy - 58, 13, 14, G.deep);
  }

  /**
   * The mantle is what actually tells two bosses apart at a glance. Three of
   * the seven share the 'bulk' body, and without something growing off the
   * shoulders they are the same monster in different paint.
   */
  function mantle(P, r, K, cx, cy) {
    const sy = cy - 84;                       // shoulder line
    const M = K.mantle;
    if (M === 'stone') {
      // slabs of the cavern still stuck to it, furred with moss
      for (const s of [-1, 1]) {
        // three broken plates rather than one slab, so the edge is not a line
        const plate = [[0, 0, 1], [6, 9, 0.82], [-4, 18, 0.7]];
        for (const [ox, oy, k] of plate) {
          P.mat(0.80 + k * 0.12, 0.10);
          P.poly([[cx + s * (20 + ox), sy + 12 + oy], [cx + s * (40 + ox) * k, sy - 14 + oy],
                  [cx + s * (62 + ox) * k, sy + 2 + oy], [cx + s * (54 + ox) * k, sy + 22 + oy],
                  [cx + s * (28 + ox), sy + 26 + oy]], k > 0.9 ? G.mid : G.low);
          P.mat(0.92 + k * 0.06, 0.12);
          P.poly([[cx + s * (38 + ox) * k, sy - 11 + oy], [cx + s * (56 + ox) * k, sy + 1 + oy],
                  [cx + s * (44 + ox) * k, sy + 6 + oy]], G.hi);
        }
        // the rind of grit along the broken faces
        P.mat(0.62, 0.06);
        for (let i = 0; i < 22; i++) {
          P.a.save(); P.a.globalAlpha = 0.4;
          P.ellipse(cx + s * (24 + r() * 38), sy - 8 + r() * 36, 1.6 + r() * 2.4, 1.2 + r() * 1.8, G.dark);
          P.a.restore();
        }
      }
      P.mat(0.58, 0.08);
      for (let i = 0; i < 16; i++) {
        const s = i % 2 ? 1 : -1;
        let x = cx + s * (26 + r() * 30), y = sy + 22, a = 1.57 + (r() - 0.5) * 0.8;
        for (let k = 0; k < 7; k++) {
          P.dome(x, y, 2.2 - k * 0.2, 2.2 - k * 0.2, k % 2 ? G.low : G.dark, 0.4, 0.8);
          a += (r() - 0.5) * 0.5; x += Math.cos(a) * 4; y += Math.sin(a) * 4;
        }
      }
    } else if (M === 'slag') {
      // chimneys: the heat has to go somewhere
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const x = cx + s * (30 + i * 13), h = 26 - i * 6;
          P.mat(0.90 - i * 0.06, 0.16);
          P.poly([[x - 7, sy + 10], [x - 5, sy - h], [x + 5, sy - h], [x + 7, sy + 10]], G.low);
          P.glow('#ffffff').mat(0.5, 0.4);
          P.a.save(); P.a.globalAlpha = 0.9;
          P.ellipse(x, sy - h + 2, 4.4, 2.2, '#ffffff'); P.a.restore();
          P.glow(null);
        }
      }
    } else if (M === 'coral') {
      // swept fins, thin and barbed
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const t = i / 3;
          P.mat(0.6 + t * 0.3, 0.55);
          P.poly([[cx + s * 22, sy + 14 - i * 6], [cx + s * (44 + t * 22), sy - 16 - i * 8],
                  [cx + s * (34 + t * 14), sy + 8 - i * 5]], i % 2 ? G.hi : G.mid);
        }
      }
    } else if (M === 'shards') {
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const a = -0.4 - i * 0.42, len = 30 + (i % 2) * 16;
          const x0 = cx + s * 30, y0 = sy + 6 - i * 4;
          const x1 = x0 + s * Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
          P.mat(0.8 + (i % 2) * 0.18, 0.92);
          P.poly([[x0, y0 + 7], [x1, y1], [x0 + s * 9, y0 - 6]], i % 2 ? G.hi : G.mid);
        }
      }
    } else if (M === 'ribs') {
      // a cage that grew outward instead of in
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          let x = cx + s * 24, y = sy + 4 + i * 11, a = -0.2 + i * 0.16;
          P.mat(0.9 - i * 0.05, 0.22);
          for (let k = 0; k < 9; k++) {
            const rr = 4.4 - k * 0.35;
            P.dome(x, y, rr, rr, k > 6 ? G.hi : G.mid, 0.42, 0.98);
            a += 0.17; x += s * Math.cos(a) * 5.2; y += Math.sin(a) * 4.4;
          }
        }
      }
    } else if (M === 'rift') {
      // plates that are not attached to anything
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const x = cx + s * (38 + i * 9), y = sy - 10 + i * 20, w = 9 - i * 1.5, h = 20 - i * 3;
          P.mat(0.72, 0.3).poly([[x, y - h], [x + s * w, y], [x, y + h], [x - s * w, y]], G.mid);
          P.glow('#ffffff').mat(0.4, 0.3);
          P.a.save(); P.a.globalAlpha = 0.7;
          P.ellipse(x, y, w * 0.35, h * 0.45, '#ffffff'); P.a.restore();
          P.glow(null);
        }
      }
    } else if (M === 'anvil') {
      // it wears its own trade
      P.mat(0.94, 0.42);
      P.poly([[cx - 58, sy + 4], [cx - 46, sy - 14], [cx + 46, sy - 14], [cx + 58, sy + 4],
              [cx + 44, sy + 16], [cx - 44, sy + 16]], G.mid);
      P.mat(1.0, 0.6);
      P.poly([[cx - 46, sy - 14], [cx + 46, sy - 14], [cx + 40, sy - 8], [cx - 40, sy - 8]], G.hi);
      P.mat(0.5, 0.2);
      for (let i = 0; i < 6; i++) P.circle(cx - 40 + i * 16, sy + 8, 2.6, G.deep);
    }
  }

  /** The lit core on the chest: a focal point that survives at any size. */
  function core(P, K) {
    const cx = 76, y = 120 - 58;
    P.glow('#ffffff').mat(0.52, 0.55);
    P.a.save(); P.a.globalAlpha = 0.85;
    P.ellipse(cx, y, 8.5, 9.5, '#ffffff');
    P.a.restore();
    P.mat(0.62, 0.70).ellipse(cx, y - 1.5, 4, 4.6, '#ffffff');
    // short filaments feeding it, so it belongs to the body. Any longer and the
    // core stops being a socket in a chest and becomes a cartoon sun.
    P.mat(0.44, 0.35);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * 6.2832 + 0.3;
      P.a.save(); P.a.globalAlpha = 0.22;
      P.line(cx + Math.cos(a) * 8, y + Math.sin(a) * 9,
        cx + Math.cos(a) * 12.5, y + Math.sin(a) * 14, '#ffffff', 1.1);
      P.a.restore();
    }
    P.glow(null);
  }

  function head(P, r, K) {
    const cx = 38, cy = 36;
    if (K.shape === 'facets') {
      P.mat(0.85, 0.85);
      P.poly([[cx, 4], [cx + 26, cy], [cx + 14, 66], [cx - 14, 66], [cx - 26, cy]], G.mid);
      P.mat(0.98, 0.95).poly([[cx, 4], [cx + 10, cy], [cx, 60], [cx - 10, cy]], G.hi);
    } else if (K.shape === 'gaunt') {
      P.mat(0.80, 0.2).dome(cx, cy, 24, 26, G.mid, 0.4, 1.0);
      P.mat(0.55, 0.1).poly([[cx - 14, cy + 14], [cx + 14, cy + 14], [cx + 9, 68], [cx - 9, 68]], G.low);
      P.mat(0.4, 0.08).ellipse(cx, cy + 22, 12, 6, G.deep);
    } else {
      P.mat(0.82, 0.18).dome(cx, cy + 2, 27, 25, G.mid, 0.38, 1.0);
      P.mat(0.92, 0.24).dome(cx, cy - 10, 24, 12, G.hi, 0.7, 1.0);
      P.mat(0.62, 0.12).dome(cx, cy + 24, 20, 12, G.low, 0.4, 0.8);
    }
    // the jaw
    P.mat(0.35, 0.06).ellipse(cx, cy + 26, 15, 6, G.deep);
    P.mat(0.9, 0.5);
    for (let i = 0; i < 7; i++) P.poly([[cx - 13 + i * 4.4, cy + 22], [cx - 11 + i * 4.4, cy + 30], [cx - 9 + i * 4.4, cy + 22]], G.hi);
    // sockets; the light in them is a separate plate so a dark body tint
    // cannot swallow it
    P.mat(0.30, 0.05);
    const n = K.eyes;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ex = cx + (t - 0.5) * 34, ey = cy + (n > 3 ? Math.sin(i * 2.1) * 7 : 0) - 2;
      P.ellipse(ex, ey, 6, 5, G.deep);
    }
  }

  function eyes(P, K) {
    const cx = 38, cy = 36, n = K.eyes;
    P.glow('#ffffff').mat(0.55, 0.5);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ex = cx + (t - 0.5) * 34, ey = cy + (n > 3 ? Math.sin(i * 2.1) * 7 : 0) - 2;
      P.ellipse(ex, ey, 4.2, 3.4, '#ffffff');
      P.mat(0.6, 0.6).ellipse(ex, ey, 2.0, 1.6, '#ffffff');
      P.mat(0.55, 0.5);
    }
    P.glow(null);
  }

  function limb(P, r, K, w, h, rTop, rBot) {
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      // swell at the shoulder, pinch at the joint, swell again at the elbow —
      // a straight taper reads as a sausage at this size
      const swell = 1 + Math.sin(t * Math.PI) * 0.16 - Math.pow(Math.max(0, 1 - Math.abs(t - 0.62) * 6), 2) * 0.22;
      const rr = (rTop + (rBot - rTop) * t) * swell;
      P.mat(0.52 + (1 - Math.abs(t - 0.28) * 1.05) * 0.40, 0.16);
      P.dome(w / 2, 6 + t * (h - 10), rr, rr * 1.02, t < 0.45 ? G.mid : t < 0.75 ? G.low : G.dark, 0.26, 0.97);
    }
    // a lit ridge down the outer edge
    P.mat(0.92, 0.28);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const rr = (rTop + (rBot - rTop) * t) * 0.34;
      P.dome(w / 2 - (rTop + (rBot - rTop) * t) * 0.52, 8 + t * (h - 14), rr, rr * 1.3, G.hi, 0.6, 1.0);
    }
    if (K.molten) {
      P.glow('#ffffff').mat(0.35, 0.25);
      for (let i = 0; i < 3; i++) P.crack(w / 2 + (r() - 0.5) * 10, 10 + r() * (h - 16), 10, '#ffffff', 1.57, 0.7);
      P.glow(null);
    }
    if (K.shape === 'facets') {
      P.mat(0.92, 0.9);
      for (let i = 0; i < 3; i++) P.poly([[w / 2, 8 + i * 12], [w / 2 + 8, 16 + i * 12], [w / 2, 24 + i * 12], [w / 2 - 8, 16 + i * 12]], G.hi);
    }
  }

  function fist(P, r, K) {
    P.mat(0.66, 0.18).dome(18, 17, 15.5, 14.5, G.low, 0.26, 0.96);
    // knuckles
    P.mat(0.94, 0.30);
    for (let i = 0; i < 4; i++) P.dome(6.5 + i * 7.2, 11, 4.0, 3.8, G.hi, 0.62, 1.0);
    // curled fingers under them
    P.mat(0.74, 0.20);
    for (let i = 0; i < 4; i++) P.dome(6.5 + i * 7.2, 20, 3.4, 4.4, G.mid, 0.4, 0.86);
    P.mat(0.40, 0.08);
    for (let i = 0; i < 3; i++) P.rect(9.8 + i * 7.2, 15, 1.2, 10, G.deep);
    // claws on the things that should have claws
    if (K.bones || K.shape === 'gaunt' || K.shape === 'facets') {
      P.mat(0.99, 0.55);
      for (let i = 0; i < 4; i++) P.poly([[4.6 + i * 7.2, 25], [6.4 + i * 7.2, 33.5], [8.6 + i * 7.2, 25]], G.hi);
    }
    if (K.molten) {
      P.glow('#ffffff').mat(0.4, 0.3);
      for (let i = 0; i < 3; i++) P.crack(8 + r() * 20, 10 + r() * 16, 8, '#ffffff', r() * 7, 0.9);
      P.glow(null);
    }
  }

  function crown(P, r, K) {
    const cx = 45, base = 50;
    const kind = K.crown;
    P.mat(0.92, 0.35);
    if (kind === 'horns') {
      P.poly([[cx - 16, base], [cx - 36, base - 30], [cx - 28, base - 44], [cx - 8, base - 12]], G.mid);
      P.poly([[cx + 16, base], [cx + 36, base - 30], [cx + 28, base - 44], [cx + 8, base - 12]], G.mid);
      P.mat(1.0, 0.5).poly([[cx - 36, base - 30], [cx - 28, base - 44], [cx - 26, base - 32]], G.hi);
      P.mat(1.0, 0.5).poly([[cx + 36, base - 30], [cx + 28, base - 44], [cx + 26, base - 32]], G.hi);
    } else if (kind === 'crown') {
      P.rounded(cx - 26, base - 16, 52, 14, 3, G.mid);
      for (let i = 0; i < 5; i++) {
        const x = cx - 24 + i * 12;
        P.mat(0.96, 0.45).poly([[x, base - 16], [x + 5, base - 16 - (i % 2 ? 22 : 34)], [x + 10, base - 16]], G.hi);
      }
      P.glow('#ffffff').mat(0.6, 0.4);
      for (let i = 0; i < 5; i++) P.circle(cx - 19 + i * 12, base - 10, 2.4, '#ffffff');
      P.glow(null);
    } else if (kind === 'spines') {
      for (let i = 0; i < 7; i++) {
        const t = i / 6, x = cx + (t - 0.5) * 68;
        const hgt = 20 + Math.sin(t * Math.PI) * 26;
        P.mat(0.88, 0.3).poly([[x - 4, base], [x, base - hgt], [x + 4, base]], G.mid);
        P.glow('#ffffff').mat(0.95, 0.4).poly([[x - 1.4, base - hgt * 0.35], [x, base - hgt], [x + 1.4, base - hgt * 0.35]], '#ffffff');
        P.glow(null);
      }
    } else if (kind === 'fins') {
      for (let i = 0; i < 5; i++) {
        const t = i / 4, x = cx + (t - 0.5) * 72;
        const hgt = 14 + Math.sin(t * Math.PI) * 24;
        P.mat(0.7, 0.5).poly([[x - 7, base], [x, base - hgt], [x + 7, base]], G.low);
        P.mat(0.86, 0.6).poly([[x - 2, base], [x, base - hgt], [x + 2, base]], G.hi);
      }
    } else if (kind === 'facets') {
      for (let i = 0; i < 6; i++) {
        const t = i / 5, x = cx + (t - 0.5) * 74;
        const hgt = 16 + Math.sin(t * Math.PI + 0.4) * 28;
        P.mat(0.8 + (i % 2) * 0.18, 0.9);
        P.poly([[x - 5, base], [x, base - hgt], [x + 5, base]], i % 2 ? G.hi : G.mid);
      }
    } else {
      // roots: thin tapering antlers, not a hedge
      P.mat(0.82, 0.16);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i / 6 - 0.5) * 2.1;
        let x = cx, y = base, ang = a;
        for (let k = 0; k < 11; k++) {
          const rr = Math.max(0.8, 3.4 - k * 0.3);
          P.dome(x, y, rr, rr, k > 7 ? G.hi : k % 2 ? G.mid : G.low, 0.4, 0.96);
          ang += (r() - 0.5) * 0.55;
          x += Math.cos(ang) * 4.6; y += Math.sin(ang) * 4.6;
          if (y < 2 || x < 2 || x > 88) break;
        }
      }
    }
  }

})(window.F2 = window.F2 || {});
