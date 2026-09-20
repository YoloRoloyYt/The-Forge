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

  // shape: how the mass is built. crown/horns/spines/roots/facets are silhouette.
  const KINDS = {
    grove:    { shape: 'bulk',   crown: 'roots',  eyes: 2, eyeCol: '#c8ff6a', rough: 1.0, mossy: true },
    leviath:  { shape: 'coil',   crown: 'fins',   eyes: 3, eyeCol: '#8ff4ff', rough: 0.6, wet: true },
    infernal: { shape: 'bulk',   crown: 'crown',  eyes: 2, eyeCol: '#ffd36a', rough: 0.9, molten: true },
    prism:    { shape: 'facets', crown: 'facets', eyes: 5, eyeCol: '#e0c8ff', rough: 0.2, facet: true },
    bone:     { shape: 'gaunt',  crown: 'horns',  eyes: 2, eyeCol: '#b8ff8a', rough: 0.8, bones: true },
    void:     { shape: 'gaunt',  crown: 'spines', eyes: 4, eyeCol: '#f0a8ff', rough: 0.5, rift: true },
    forger:   { shape: 'bulk',   crown: 'crown',  eyes: 2, eyeCol: '#fff0a8', rough: 0.7, molten: true, plates: true },
  };

  F.BossArt = {
    KINDS,
    build() {
      for (const id in KINDS) {
        const K = KINDS[id];
        A().define('bs_body_' + id, 120, 108, (P, r) => body(P, r, K), { ax: 60, ay: 104, bump: 1.25, seed: hash(id, 'b') });
        A().define('bs_head_' + id, 76, 72, (P, r) => head(P, r, K), { ax: 38, ay: 62, bump: 1.3, seed: hash(id, 'h') });
        A().define('bs_armU_' + id, 34, 52, (P, r) => limb(P, r, K, 34, 52, 13, 9), { ax: 17, ay: 8, bump: 1.4, seed: hash(id, 'au') });
        A().define('bs_armL_' + id, 30, 48, (P, r) => limb(P, r, K, 30, 48, 10, 12), { ax: 15, ay: 6, bump: 1.4, seed: hash(id, 'al') });
        A().define('bs_fist_' + id, 36, 34, (P, r) => fist(P, r, K), { ax: 18, ay: 8, bump: 1.4, seed: hash(id, 'f') });
        A().define('bs_legU_' + id, 36, 46, (P, r) => limb(P, r, K, 36, 46, 14, 11), { ax: 18, ay: 6, bump: 1.4, seed: hash(id, 'lu') });
        A().define('bs_legL_' + id, 32, 44, (P, r) => limb(P, r, K, 32, 44, 11, 13), { ax: 16, ay: 5, bump: 1.4, seed: hash(id, 'll') });
        A().define('bs_crown_' + id, 90, 56, (P, r) => crown(P, r, K), { ax: 45, ay: 50, bump: 1.4, seed: hash(id, 'c') });
        A().define('bs_eyes_' + id, 76, 72, (P) => eyes(P, K), { ax: 38, ay: 62, bump: 0, seed: hash(id, 'e') });
      }
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
    const cx = 60, cy = 104;
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
    P.mat(0.7, 0.14).speckle(8, 8, 104, 94, [G.hi, G.dark], n, 0.18);
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
        P.ellipse(12 + r() * 96, 18 + r() * 84, 3 + r() * 7, 2 + r() * 5, G.dark);
        P.a.restore();
      }
    }
    if (K.wet) {
      P.mat(0.8, 0.85);
      for (let i = 0; i < 16; i++) {
        P.a.save(); P.a.globalAlpha = 0.25;
        P.ellipse(14 + r() * 92, 20 + r() * 78, 2 + r() * 5, 1 + r() * 3, G.hi);
        P.a.restore();
      }
    }
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
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const rr = rTop + (rBot - rTop) * t;
      P.mat(0.55 + (1 - Math.abs(t - 0.3) * 1.1) * 0.35, 0.16);
      P.dome(w / 2, 6 + t * (h - 10), rr, rr * 1.0, t < 0.5 ? G.mid : G.low, 0.26, 0.96);
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
    P.mat(0.72, 0.2).dome(18, 18, 15, 14, G.mid, 0.3, 1.0);
    P.mat(0.9, 0.3);
    for (let i = 0; i < 4; i++) P.dome(7 + i * 7, 12, 3.6, 3.4, G.hi, 0.6, 1.0);
    if (K.bones || K.shape === 'gaunt') {
      P.mat(0.98, 0.5);
      for (let i = 0; i < 4; i++) P.poly([[6 + i * 7, 26], [8 + i * 7, 34], [10 + i * 7, 26]], G.hi);
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
