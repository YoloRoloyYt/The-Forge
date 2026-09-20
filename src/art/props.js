'use strict';
// ---------------------------------------------------------------------------
// props.js — ore nodes, mine furniture and scenery.
//
// Ore nodes are drawn in two pieces: a grey rock body (4 shape variants per
// node type) and a white ore-inclusion overlay that is tinted at draw time by
// whatever ore the node happens to be carrying. One set of art, twenty ores.
// ---------------------------------------------------------------------------
(function (F) {

  const A = () => F.Art;

  const NODE_SIZE = {
    pebble: [22, 18], rock: [30, 26], boulder: [38, 34],
    vein: [38, 34], crystal: [36, 42], motherlode: [52, 46], seal: [36, 34],
  };

  F.Props = {
    build() {
      buildNodes();
      buildFurniture();
      buildScenery();
      buildPickups();
    },
    NODE_SIZE,
  };

  // ------------------------------------------------------------- ore nodes
  function buildNodes() {
    for (const type in NODE_SIZE) {
      const [w, h] = NODE_SIZE[type];
      for (let v = 0; v < 4; v++) {
        A().define('node_' + type + v, w, h, (P, r) => nodeBody(P, r, type, w, h, v),
          { ax: w / 2, ay: h - 4, bump: 1.25, seed: F.Art.hashStr(type + v) });
        A().define('ore_' + type + v, w, h, (P, r) => nodeOre(P, r, type, w, h, v),
          { ax: w / 2, ay: h - 4, bump: 1.4, seed: F.Art.hashStr(type + v) });
      }
    }
  }

  // Node bodies are painted in neutral mid-greys and tinted to the biome's own
  // rock at draw time, so a boulder in the magma vents is basalt, not granite.
  const ROCK = ['#a8a2ae', '#8e8898', '#bdb6c4', '#78717f'];

  function nodeBody(P, r, type, w, h, v) {
    const cx = w / 2, cy = h - 4;
    if (type === 'crystal') {
      // a spire of stone that the crystal grows out of
      P.mat(0.55, 0.12).dome(cx, cy - 4, w * 0.38, 7, ROCK[1], 0.2, 0.75);
      P.mat(0.8, 0.16);
      const pts = [[cx, 3], [cx + w * 0.22, h * 0.45], [cx + w * 0.16, h - 6], [cx - w * 0.16, h - 6], [cx - w * 0.22, h * 0.45]];
      P.poly(pts, ROCK[2]);
      return;
    }
    if (type === 'seal') {
      P.mat(0.78, 0.14).dome(cx, cy - 7, w * 0.44, h * 0.40, '#635a68', 0.30, 0.96);
      P.mat(0.5, 0.05);
      for (let i = 0; i < 5; i++) P.crack(cx + (r() - 0.5) * 12, cy - 8 + (r() - 0.5) * 12, 12, '#2a2230', r() * 7, 0.8);
      return;
    }
    const lumps = type === 'pebble' ? 2 : type === 'rock' ? 3 : type === 'motherlode' ? 7 : 5;
    for (let i = 0; i < lumps; i++) {
      const t = i / Math.max(1, lumps - 1);
      const rx = w * (0.20 + r() * 0.16), ry = h * (0.17 + r() * 0.13);
      const x = cx + (t - 0.5) * w * 0.52 + (r() - 0.5) * 4;
      const y = cy - ry * 0.7 - r() * h * 0.36;
      P.mat(0.52 + r() * 0.34, 0.14);
      P.dome(x, y, rx, ry, ROCK[(r() * ROCK.length) | 0], 0.24, 0.92);
    }
    P.mat(0.62, 0.10).speckle(2, 2, w - 4, h - 6, ['#7e7684', '#4c4653'], Math.floor(w * h * 0.10), 0.22);
    for (let i = 0; i < 3; i++) { P.mat(0.44, 0.04); P.crack(cx + (r() - 0.5) * w * 0.6, cy - h * 0.35 + (r() - 0.5) * h * 0.4, 8 + r() * 7, '#2b2430', r() * 7, 1.0); }
    // a rim, so a boulder is still a boulder against a floor of the same rock
    P.outline('#150f18', 0.62);
  }

  /** White-on-transparent ore inclusions; tinted per ore at draw time. */
  function nodeOre(P, r, type, w, h, v) {
    const cx = w / 2, cy = h - 4;
    P.glow('#ffffff');
    if (type === 'crystal') {
      P.mat(0.95, 0.42);
      const tip = 3 + r() * 2;
      P.poly([[cx, tip - 2], [cx + w * 0.17, h * 0.48], [cx + w * 0.10, h - 8], [cx - w * 0.10, h - 8], [cx - w * 0.17, h * 0.48]], '#ffffff');
      P.mat(1.0, 0.55).poly([[cx, tip], [cx + w * 0.07, h * 0.50], [cx, h - 9], [cx - w * 0.07, h * 0.50]], '#ffffff');
      // side shards
      for (let i = 0; i < 2; i++) {
        const s = i ? 1 : -1;
        P.mat(0.85, 0.40).poly([[cx + s * w * 0.20, h * 0.42], [cx + s * w * 0.34, h * 0.66], [cx + s * w * 0.20, h - 8]], '#ffffff');
      }
      P.glow(null); return;
    }
    if (type === 'seal') {
      // a cracked glow escaping the sealed rock
      P.mat(0.82, 0.30);
      for (let i = 0; i < 4; i++) P.crack(cx + (r() - 0.5) * 10, cy - 8 + (r() - 0.5) * 10, 11, '#ffffff', r() * 7, 0.9);
      P.glow(null); return;
    }
    // Ore in rock is faceted and it threads: round domes read as golf balls
    // glued to a boulder, which is exactly what these used to look like.
    const n = type === 'pebble' ? 3 : type === 'rock' ? 5 : type === 'vein' ? 11 : type === 'motherlode' ? 18 : 7;
    const pockets = [];
    for (let i = 0; i < (type === 'motherlode' ? 3 : 2); i++)
      pockets.push([cx + (r() - 0.5) * w * 0.42, cy - h * 0.34 + (r() - 0.5) * h * 0.30]);

    // the threads first, so the facets sit on top of their own vein
    P.mat(0.74, 0.26);
    for (const pk of pockets) {
      const strands = type === 'vein' || type === 'motherlode' ? 3 : 2;
      for (let i = 0; i < strands; i++) {
        P.a.save(); P.a.globalAlpha = 0.5 + r() * 0.35;
        P.crack(pk[0] + (r() - 0.5) * 6, pk[1] + (r() - 0.5) * 6, 7 + r() * 9, '#ffffff', r() * 7, 0.7);
        P.a.restore();
      }
    }

    for (let i = 0; i < n; i++) {
      const pk = pockets[(r() * pockets.length) | 0];
      const ang = r() * 6.2832, rad = r() * r() * w * 0.24;
      const x = pk[0] + Math.cos(ang) * rad, y = pk[1] + Math.sin(ang) * rad * 0.7;
      const rr = ((type === 'vein' || type === 'motherlode') ? 1.0 : 0.85) * (1 + r() * 1.5);
      const rot = r() * 6.2832, sides = 4 + ((r() * 2) | 0);
      const face = (k, lift) => {
        const pts = [];
        for (let j = 0; j < sides; j++) {
          const t = rot + j / sides * 6.2832;
          const q = rr * k * (0.72 + r() * 0.5);
          pts.push([x + Math.cos(t) * q + lift, y + Math.sin(t) * q * 0.82 + lift]);
        }
        return pts;
      };
      P.mat(0.80 + r() * 0.14, 0.30);
      P.poly(face(1, 0), '#d8d8d8');
      // one lit facet catching the light, which is what makes it read as crystal
      P.mat(0.92, 0.55);
      P.poly(face(0.52, -rr * 0.24), '#ffffff');
      // a dark rim keeps each fleck a fleck instead of a smear
      P.a.save(); P.a.globalAlpha = 0.45; P.a.strokeStyle = '#000000'; P.a.lineWidth = 0.9;
      P.a.beginPath();
      const rim = face(1.02, 0);
      P.a.moveTo(rim[0][0], rim[0][1]);
      for (let j = 1; j < rim.length; j++) P.a.lineTo(rim[j][0], rim[j][1]);
      P.a.closePath(); P.a.stroke(); P.a.restore();
    }
    P.glow(null);
  }

  // ------------------------------------------------------------- furniture
  function buildFurniture() {
    // wall torch: bracket + flame (the flame itself is emissive)
    A().define('torch', 14, 26, (P) => {
      P.mat(0.6, 0.2).rect(5, 10, 4, 15, '#4a3c2e');
      P.mat(0.75, 0.5).rect(3, 8, 8, 4, '#6b5436');
      P.mat(0.9, 0.3).glow('#ff8a20').ellipse(7, 6, 4, 6, '#ffb54a');
      P.glow('#fff0b0').ellipse(7, 6, 2, 3.5, '#fff6d0');
      P.glow(null);
    }, { ax: 7, ay: 24 });

    A().define('lantern_post', 16, 40, (P) => {
      P.mat(0.55, 0.2).rect(6, 14, 4, 26, '#3f3730');
      P.mat(0.8, 0.5).rect(3, 6, 10, 3, '#7a6034');
      P.mat(0.85, 0.6).rounded(4, 8, 8, 10, 2, '#8a6e3c');
      P.mat(0.9, 0.3).glow('#ffc862').rect(5, 10, 6, 7, '#ffd98a');
      P.glow(null);
    }, { ax: 8, ay: 38 });

    // the way out: a ladder set into the rock
    A().define('ladder', 30, 46, (P) => {
      P.mat(0.3, 0.05).rect(0, 0, 30, 46, '#120e12');
      P.mat(0.62, 0.22).rect(4, 0, 5, 46, '#6b5436').rect(21, 0, 5, 46, '#6b5436');
      for (let i = 0; i < 7; i++) P.mat(0.7, 0.28).rect(4, 4 + i * 6, 22, 3, '#8a6e44');
    }, { ax: 15, ay: 44 });

    // the way down: a black shaft with a rope
    A().define('shaft', 52, 44, (P, r) => {
      P.mat(0.15, 0.02).ellipse(26, 24, 24, 18, '#080609');
      P.mat(0.3, 0.05).ellipse(26, 22, 20, 14, '#0d0a10');
      P.mat(0.7, 0.25);
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * 6.283;
        P.dome(26 + Math.cos(a) * 24, 24 + Math.sin(a) * 18, 4, 3.4, '#5e5766', 0.4, 0.9);
      }
      P.mat(0.6, 0.3).rect(25, 0, 2, 20, '#8a7450');
    }, { ax: 26, ay: 34 });

    A().define('chest', 34, 30, (P) => {
      P.mat(0.55, 0.2).rounded(2, 10, 30, 18, 2, '#6b4a2a');
      P.mat(0.8, 0.3).rounded(2, 4, 30, 12, 4, '#7d5730');
      P.mat(0.9, 0.7).rect(2, 14, 30, 3, '#a8813e');
      P.mat(0.92, 0.8).rect(14, 12, 6, 8, '#d4b066');
      P.mat(0.6, 0.2).speckle(3, 11, 28, 16, ['#5d4126', '#7d5730'], 26, 0.12);
      P.mat(0.86, 0.6).rect(4, 5, 3, 22, '#c79a4e').rect(27, 5, 3, 22, '#c79a4e');
    }, { ax: 17, ay: 28, outline: '#160d08' });

    A().define('chest_open', 34, 32, (P) => {
      P.mat(0.55, 0.2).rounded(2, 12, 30, 18, 2, '#6b4a2a');
      P.mat(0.8, 0.3).rounded(2, 0, 30, 10, 3, '#5d4126');
      P.mat(0.3, 0.1).glow('#ffd98a').rect(5, 12, 24, 5, '#ffcf70');
      P.glow(null);
    }, { ax: 17, ay: 30, outline: '#160d08' });
  }

  // -------------------------------------------------------------- scenery
  function buildScenery() {
    for (let v = 0; v < 3; v++) {
      A().define('p_stalagmite' + v, 22, 40, (P, r) => {
        const hgt = 26 + v * 6, base = 6 + r() * 2;
        P.mat(0.45, 0.10).dome(11, 37, 9, 3.5, '#6f6876', 0.25, 0.60);
        // stacked domes down the spire give it a real round cross-section
        const steps = 9;
        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          const y = 38 - t * hgt;
          const wdt = base * (1 - t * 0.92) + 0.8;
          P.mat(0.40 + t * 0.55, 0.14 + t * 0.18);
          P.dome(11, y, wdt, wdt * 0.9, F.Col.mix('#6b6373', '#9a92a6', t * 0.7), 0.22 + t * 0.4, 0.55 + t * 0.44);
        }
        P.mat(0.9, 0.35);
        for (let i = 0; i < 5; i++) P.rect(9 + r() * 4, 38 - r() * hgt, 1, 1 + r() * 2, '#a49bb0');
      }, { ax: 11, ay: 38, seed: 500 + v });

      A().define('p_rubble' + v, 24, 16, (P, r) => {
        for (let i = 0; i < 3 + v; i++) {
          const x = 4 + r() * 16, y = 6 + r() * 8, rr = 1.6 + r() * 3;
          P.mat(0.45 + r() * 0.3, 0.14).dome(x, y, rr, rr * 0.75, ['#6e6773', '#5b5462', '#7e7684'][(r() * 3) | 0], 0.25, 0.85);
        }
      }, { ax: 12, ay: 13, seed: 600 + v });

      A().define('p_bones' + v, 28, 20, (P, r) => {
        P.mat(0.5, 0.3);
        for (let i = 0; i < 3 + v; i++) {
          const x = 4 + r() * 18, y = 6 + r() * 10, a = r() * 3.14, len = 5 + r() * 8;
          P.line(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, '#b3a98d', 2.4);
          P.mat(0.62, 0.35).circle(x, y, 1.8, '#c4b99b').circle(x + Math.cos(a) * len, y + Math.sin(a) * len, 1.8, '#c4b99b');
          P.mat(0.5, 0.3);
        }
        if (v === 2) { P.mat(0.7, 0.35).dome(20, 12, 5, 4, '#c4b99b', 0.4, 0.9); P.mat(0.2, 0.05).circle(18, 11, 1.4, '#2e2a22').circle(22, 11, 1.4, '#2e2a22'); }
      }, { ax: 14, ay: 17, seed: 700 + v });

      A().define('p_mushroom' + v, 22, 26, (P, r) => {
        const cap = ['#4fd8a8', '#63c7ff', '#b76cff'][v];
        P.mat(0.55, 0.15).rect(9, 12, 4, 13, '#d8d0c0');
        P.mat(0.85, 0.35).glow(F.shadeGlow(cap, 0.55));
        P.dome(11, 11, 8 - v, 6, cap, 0.4, 1.0);
        P.glow(F.shadeGlow(cap, 0.9)).mat(0.9, 0.5);
        for (let i = 0; i < 4; i++) P.circle(6 + r() * 10, 9 + r() * 4, 1.1, '#ffffff');
        P.glow(null);
      }, { ax: 11, ay: 24, seed: 800 + v });

      A().define('p_timber' + v, 40, 46, (P, r) => {
        const wood = '#463522', woodHi = '#5a4429', woodLo = '#2e2216';
        P.mat(0.72, 0.10).ramp(2, 6, 7, 40, wood, 0.80, 0.52, false);
        P.mat(0.72, 0.10).ramp(31, 6, 7, 40, wood, 0.80, 0.52, false);
        P.mat(0.84, 0.12).ramp(0, 0, 40, 9, woodHi, 0.92, 0.62, true);
        // grain
        P.mat(0.6, 0.06);
        for (let i = 0; i < 26; i++) {
          const x = r() * 40, y = r() * 46;
          P.a.save(); P.a.globalAlpha = 0.35;
          P.rect(x, y, 1, 3 + r() * 7, r() < 0.5 ? woodLo : woodHi);
          P.a.restore();
        }
        // iron straps and bolts
        P.mat(0.9, 0.42).rect(1, 12, 9, 2, '#4a4650').rect(30, 12, 9, 2, '#4a4650');
        P.mat(0.95, 0.6).circle(4, 3, 1.3, '#6e6a78').circle(35, 3, 1.3, '#6e6a78');
      }, { ax: 20, ay: 44, seed: 900 + v });

      A().define('p_crystalcluster' + v, 30, 36, (P, r) => {
        P.mat(0.42, 0.10).dome(15, 33, 11, 4, '#8a8290', 0.24, 0.58);
        for (let i = 0; i < 3 + v; i++) {
          const x = 6 + r() * 18, hgt = 12 + r() * 18, wd = 2.5 + r() * 3;
          const top = 34 - hgt;
          // a lit face and a shaded face so each shard has an edge to catch light
          P.mat(0.72, 0.70).glow('#8f8f8f');
          P.poly([[x, top], [x + wd, 33], [x - wd, 33]], '#c8c8c8');
          P.mat(0.95, 0.95).glow('#ffffff');
          P.poly([[x, top], [x + wd * 0.35, 33], [x - wd * 0.15, 33]], '#ffffff');
          P.glow(null);
        }
      }, { ax: 15, ay: 33, seed: 1000 + v });
    }
  }

  // --------------------------------------------------------------- pickups
  function buildPickups() {
    A().define('ore_drop', 14, 14, (P, r) => {
      P.mat(0.8, 0.5).glow('#ffffff');
      P.poly([[7, 1], [13, 6], [10, 13], [4, 13], [1, 6]], '#ffffff');
      P.mat(0.95, 0.8).poly([[7, 1], [10, 6], [7, 11], [4, 6]], '#ffffff');
      P.glow(null);
    }, { ax: 7, ay: 11 });

    A().define('gem_drop', 16, 18, (P) => {
      P.mat(0.9, 0.95).glow('#ffffff');
      P.poly([[8, 0], [15, 6], [8, 18], [1, 6]], '#ffffff');
      P.mat(1.0, 1.0).poly([[8, 0], [11, 6], [8, 12], [5, 6]], '#ffffff');
      P.glow(null);
    }, { ax: 8, ay: 15 });

    A().define('coin', 12, 12, (P) => {
      P.mat(0.8, 0.9).glow('#a87a1e').circle(6, 6, 5.5, '#f4cf5a');
      P.mat(0.95, 1.0).glow('#c79a2e').circle(5, 5, 3, '#ffe9a0');
      P.glow(null);
    }, { ax: 6, ay: 9 });

    A().define('orb', 20, 20, (P) => {
      P.mat(0.9, 0.7).glow('#ffffff').circle(10, 10, 8, '#ffffff');
      P.mat(1.0, 1.0).circle(8, 8, 3.2, '#ffffff');
      P.glow(null);
    }, { ax: 10, ay: 10 });

    A().define('frag', 12, 12, (P) => {
      P.mat(0.8, 0.6).glow('#ffffff').poly([[6, 0], [12, 5], [8, 12], [2, 9], [0, 3]], '#ffffff');
      P.glow(null);
    }, { ax: 6, ay: 9 });
  }

})(window.F2 = window.F2 || {});
