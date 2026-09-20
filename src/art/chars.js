'use strict';
// ---------------------------------------------------------------------------
// chars.js — body parts, armour, weapons and pickaxes.
//
// Everything here is painted in NEUTRAL GREYS with real relief baked into the
// height channel, then tinted per draw. That is what lets a chestplate forged
// out of magmite come out orange and a mithral one come out pale green without
// a second sprite existing anywhere.
// ---------------------------------------------------------------------------
(function (F) {

  const A = () => F.Art;
  const G = { hi: '#f2f2f2', mid: '#c8c8c8', low: '#8e8e8e', dark: '#5e5e5e', deep: '#3a3a3a' };

  F.Chars = {
    build() {
      body();
      armour();
      weapons();
      picks();
      enemyParts();
      fx();
    },
  };

  // ------------------------------------------------------------- body parts
  function body() {
    // head, three-quarter front. Anchor at the neck.
    A().define('pc_head', 22, 22, (P) => {
      P.mat(0.55, 0.14).dome(11, 11, 8.5, 9, G.mid, 0.30, 0.98);
      // brow ridge and cheekbones give the face structure under any light
      P.mat(0.82, 0.16).dome(11, 7.5, 7.4, 3.0, G.hi, 0.72, 1.0);
      P.mat(0.62, 0.12).dome(6.5, 12, 2.6, 2.4, G.mid, 0.5, 0.82);
      P.mat(0.62, 0.12).dome(15.5, 12, 2.6, 2.4, G.mid, 0.5, 0.82);
      // eye sockets sit low so the lantern throws a shadow into them
      P.mat(0.30, 0.06).ellipse(7.6, 10.4, 2.2, 1.7, G.deep);
      P.mat(0.30, 0.06).ellipse(14.4, 10.4, 2.2, 1.7, G.deep);
      P.mat(0.48, 0.55).ellipse(7.8, 10.6, 1.1, 1.0, '#ffffff');
      P.mat(0.48, 0.55).ellipse(14.2, 10.6, 1.1, 1.0, '#ffffff');
      P.mat(0.68, 0.12).dome(11, 12.5, 1.5, 2.2, G.mid, 0.6, 0.9);   // nose
    }, { ax: 11, ay: 19, bump: 1.3 });

    A().define('pc_head_back', 22, 22, (P) => {
      P.mat(0.55, 0.14).dome(11, 11, 8.5, 9, G.low, 0.30, 0.95);
      P.mat(0.46, 0.10).dome(11, 13, 7.6, 6.4, G.dark, 0.34, 0.72);
    }, { ax: 11, ay: 19, bump: 1.3 });

    // beard: the miner's whole silhouette hangs off this
    A().define('pc_beard', 22, 18, (P, r) => {
      P.mat(0.62, 0.10);
      P.poly([[3.5, 0], [18.5, 0], [17, 9], [13, 16.5], [9, 16.5], [5, 9]], G.mid);
      P.mat(0.74, 0.12);
      for (let i = 0; i < 16; i++) {
        const x = 4 + r() * 14, y = 2 + r() * 12;
        P.dome(x, y, 1.6 + r() * 1.6, 2.4 + r() * 2.4, r() < 0.5 ? G.hi : G.low, 0.45, 0.9);
      }
      P.mat(0.4, 0.06).ellipse(11, 1.5, 4.2, 2.2, G.dark);          // mouth gap
    }, { ax: 11, ay: 2, bump: 1.4 });

    A().define('pc_hair', 22, 12, (P, r) => {
      P.mat(0.78, 0.12).dome(11, 7, 9, 6.4, G.mid, 0.4, 0.98);
      P.mat(0.88, 0.14);
      for (let i = 0; i < 9; i++) P.dome(3 + r() * 16, 3 + r() * 6, 2.2, 2.6, r() < 0.5 ? G.hi : G.low, 0.5, 1.0);
    }, { ax: 11, ay: 10, bump: 1.3 });

    // torso: anchor at the hips, body rises upward
    A().define('pc_torso', 24, 26, (P) => {
      P.mat(0.62, 0.12);
      P.poly([[5, 26], [19, 26], [21, 8], [18, 1], [6, 1], [3, 8]], G.mid);
      // chest and shoulder volumes
      P.mat(0.86, 0.16).dome(12, 7, 9.5, 5.0, G.hi, 0.66, 1.0);
      P.mat(0.74, 0.14).dome(7.5, 12, 4.2, 5.0, G.mid, 0.58, 0.9);
      P.mat(0.74, 0.14).dome(16.5, 12, 4.2, 5.0, G.mid, 0.58, 0.9);
      P.mat(0.50, 0.10).dome(12, 21, 6.4, 5.0, G.low, 0.36, 0.7);
      P.mat(0.40, 0.06).rect(11, 9, 2, 14, G.dark);                  // sternum shadow
    }, { ax: 12, ay: 26, bump: 1.3 });

    A().define('pc_torso_back', 24, 26, (P) => {
      P.mat(0.62, 0.12);
      P.poly([[5, 26], [19, 26], [21, 8], [18, 1], [6, 1], [3, 8]], G.low);
      P.mat(0.84, 0.14).dome(12, 8, 9.2, 6.0, G.mid, 0.6, 1.0);
      P.mat(0.36, 0.05).rect(11, 4, 2, 19, G.deep);                  // spine
    }, { ax: 12, ay: 26, bump: 1.3 });

    limb('pc_armU', 9, 13, 4.5, 2, 3.6, 3.0);
    limb('pc_armL', 8, 12, 4, 1.5, 3.2, 2.6);
    limb('pc_legU', 10, 14, 5, 2, 4.2, 3.4);
    limb('pc_legL', 9, 13, 4.5, 1.5, 3.6, 2.8);

    A().define('pc_hand', 9, 9, (P) => {
      P.mat(0.72, 0.14).dome(4.5, 4.5, 4, 4.2, G.mid, 0.36, 0.96);
      P.mat(0.5, 0.08).rect(1, 4, 7, 1, G.dark);
    }, { ax: 4.5, ay: 2, bump: 1.4 });

    A().define('pc_foot', 12, 8, (P) => {
      P.mat(0.62, 0.12).dome(5.5, 4.5, 5.2, 3.4, G.mid, 0.3, 0.92);
      P.mat(0.44, 0.08).ellipse(5.5, 7, 5.0, 1.4, G.dark);
    }, { ax: 5, ay: 1.5, bump: 1.3 });
  }

  /** A tapered, rounded limb segment. */
  function limb(key, w, h, ax, ay, rTop, rBot) {
    A().define(key, w, h, (P) => {
      const steps = 8;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const rr = rTop + (rBot - rTop) * t;
        P.mat(0.6 + (1 - Math.abs(t - 0.35) * 1.2) * 0.25, 0.14);
        P.dome(w / 2, ay + t * (h - ay - 1), rr, rr * 1.05, t < 0.5 ? G.mid : G.low, 0.30, 0.95);
      }
    }, { ax, ay, bump: 1.45 });
  }

  // ---------------------------------------------------------------- armour
  // One generator, six bulks. `k` is 0..5 (light .. titanplate).
  function armour() {
    F.ARM_ORDER.forEach((cls, k) => {
      const bulk = k / 5;

      A().define('arm_head_' + cls, 26, 22, (P, r) => {
        const w = 9 + bulk * 3.2;
        P.mat(0.88, 0.32 + bulk * 0.4).dome(13, 8.5, w, 7.5 + bulk * 1.4, G.mid, 0.5, 1.0);
        P.mat(0.96, 0.5 + bulk * 0.35).dome(13, 5.5, w * 0.8, 3.4, G.hi, 0.8, 1.0);
        // brow band
        P.mat(0.92, 0.55).rect(13 - w, 10, w * 2, 2.4, G.low);
        if (k >= 2) { // nose guard
          P.mat(0.95, 0.6).rect(12, 10, 2, 7 + bulk * 3, G.mid);
        }
        if (k >= 3) { // cheek plates
          P.mat(0.86, 0.45).poly([[13 - w, 10], [13 - w + 3, 19], [13 - w + 7, 14]], G.low);
          P.mat(0.86, 0.45).poly([[13 + w, 10], [13 + w - 3, 19], [13 + w - 7, 14]], G.low);
        }
        if (k >= 4) { // crest
          P.mat(1.0, 0.7);
          for (let i = 0; i < 7; i++) P.dome(13, 1 + i * 1.4, 1.6, 1.8, G.hi, 0.7, 1.0);
        }
        P.mat(0.7, 0.5);
        for (let i = 0; i < 5 + k * 2; i++) P.circle(4 + r() * 18, 6 + r() * 12, 0.7, G.low);
        // a dark seam around the shell so the plate has an edge
        P.a.save(); P.a.globalAlpha = 0.5; P.a.strokeStyle = G.deep; P.a.lineWidth = 1.4;
        P.a.beginPath(); P.a.ellipse(13, 8.5, 9 + bulk * 3.2, 7.5 + bulk * 1.4, 0, 0, 7); P.a.stroke();
        P.a.restore();
      }, { ax: 13, ay: 19, bump: 1.35 });

      A().define('arm_chest_' + cls, 30, 28, (P, r) => {
        const sp = 1 + bulk * 3.4;   // pauldron spread
        P.mat(0.80, 0.30 + bulk * 0.4);
        P.poly([[8 - bulk, 28], [22 + bulk, 28], [24 + sp, 9], [20, 1], [10, 1], [6 - sp, 9]], G.mid);
        P.mat(0.94, 0.45 + bulk * 0.35).dome(15, 8, 9.5 + bulk * 1.4, 5.2, G.hi, 0.7, 1.0);
        // pauldrons
        P.mat(0.98, 0.55 + bulk * 0.35).dome(6 - sp + 1, 8, 3.4 + bulk * 2.4, 3.6 + bulk * 1.6, G.hi, 0.6, 1.0);
        P.mat(0.98, 0.55 + bulk * 0.35).dome(24 + sp - 1, 8, 3.4 + bulk * 2.4, 3.6 + bulk * 1.6, G.hi, 0.6, 1.0);
        // belly plates
        for (let i = 0; i < 2 + k; i++) {
          const y = 14 + i * (12 / (2 + k));
          P.mat(0.74 + (i % 2) * 0.1, 0.35).rect(9 - bulk, y, 12 + bulk * 2, 2.6, G.low);
        }
        P.mat(0.5, 0.2);
        for (let i = 0; i < 6 + k * 3; i++) P.circle(7 + r() * 16, 4 + r() * 20, 0.8, G.dark);
        // seams: the plate boundary and the pauldron joins
        P.a.save(); P.a.globalAlpha = 0.55; P.a.strokeStyle = G.deep; P.a.lineWidth = 1.5;
        P.a.beginPath();
        P.a.moveTo(8 - bulk, 28); P.a.lineTo(6 - sp, 9); P.a.lineTo(10, 1);
        P.a.lineTo(20, 1); P.a.lineTo(24 + sp, 9); P.a.lineTo(22 + bulk, 28);
        P.a.stroke();
        P.a.beginPath(); P.a.ellipse(6 - sp + 1, 8, 3.4 + bulk * 2.4, 3.6 + bulk * 1.6, 0, 0, 7); P.a.stroke();
        P.a.beginPath(); P.a.ellipse(24 + sp - 1, 8, 3.4 + bulk * 2.4, 3.6 + bulk * 1.6, 0, 0, 7); P.a.stroke();
        P.a.restore();
      }, { ax: 15, ay: 28, bump: 1.3 });

      A().define('arm_legs_' + cls, 14, 26, (P) => {
        const w = 4.2 + bulk * 1.5;
        // thigh plate tapering to a knee cop, then a shin splint
        P.mat(0.80, 0.30 + bulk * 0.4).dome(7, 6, w, 6.5, G.mid, 0.42, 0.98);
        P.mat(0.94, 0.48).rect(7 - w, 3.4, w * 2, 2.0, G.hi);
        P.mat(0.96, 0.55 + bulk * 0.3).dome(7, 13.5, w * 0.95, 3.6, G.hi, 0.6, 1.0);   // knee
        P.mat(0.84, 0.35 + bulk * 0.3).dome(7, 20, w * 0.82, 6.0, G.mid, 0.4, 0.92);   // shin
        if (k >= 3) { P.mat(0.98, 0.6).poly([[7 - w, 13], [7 - w - 2.5, 16], [7 - w, 17]], G.hi); }
        P.a.save(); P.a.globalAlpha = 0.5; P.a.strokeStyle = G.deep; P.a.lineWidth = 1.3;
        P.a.beginPath(); P.a.ellipse(7, 6, w, 6.5, 0, 0, 7); P.a.stroke();
        P.a.beginPath(); P.a.ellipse(7, 20, w * 0.82, 6.0, 0, 0, 7); P.a.stroke();
        P.a.restore();
      }, { ax: 7, ay: 2, bump: 1.35 });

      A().define('arm_boots_' + cls, 14, 10, (P) => {
        P.mat(0.80, 0.30 + bulk * 0.4).dome(6.5, 5, 6 + bulk, 4, G.mid, 0.35, 0.96);
        P.mat(0.94, 0.5).rect(0.5, 3, 13, 2, G.hi);
        if (k >= 2) P.mat(0.98, 0.6).poly([[1, 6], [4, 2], [4, 6]], G.hi);
        P.a.save(); P.a.globalAlpha = 0.5; P.a.strokeStyle = G.deep; P.a.lineWidth = 1.3;
        P.a.beginPath(); P.a.ellipse(6.5, 5, 6 + bulk, 4, 0, 0, 7); P.a.stroke();
        P.a.restore();
      }, { ax: 5.5, ay: 1.5, bump: 1.3 });

      // shoulder-only overlay used when a chest piece is equipped but hidden
      A().define('arm_pauld_' + cls, 12, 12, (P) => {
        P.mat(0.95, 0.5 + bulk * 0.3).dome(6, 5, 4 + bulk * 2, 4 + bulk * 1.4, G.hi, 0.55, 1.0);
        P.mat(0.78, 0.4).rect(1, 6.5, 10, 2, G.low);
      }, { ax: 6, ay: 2, bump: 1.35 });
    });
  }

  // --------------------------------------------------------------- weapons
  // Two layers per class: a grey metal master (tinted by the item's ore) and a
  // fixed-colour grip. A third, emissive layer carries traits and spells.
  function weapons() {
    const defs = {
      dagger:   { len: 20, wid: 7,  guard: 9,  grip: 8,  taper: 0.45 },
      sword:    { len: 32, wid: 9,  guard: 15, grip: 10, taper: 0.55 },
      axe:      { len: 30, wid: 18, guard: 8,  grip: 14, taper: 0.9, axe: true },
      great:    { len: 44, wid: 13, guard: 21, grip: 15, taper: 0.62 },
      colossal: { len: 56, wid: 18, guard: 26, grip: 19, taper: 0.7 },
      maul:     { len: 46, wid: 26, guard: 10, grip: 22, taper: 1.0, hammer: true },
    };
    for (const cls in defs) {
      const d = defs[cls];
      // an axe head hangs off one side, so it needs a wider canvas than a blade
      const H = d.len + d.grip + 8;
      const W = d.axe ? Math.ceil(d.wid * 2.2) + 8 : Math.max(d.wid, d.guard) + 10;
      const cx = d.axe ? W * 0.36 : W / 2;

      A().define('wpn_' + cls, W, H, (P, r) => {
        const tip = 4, gripTop = H - d.grip;
        if (d.hammer) {
          const hw = d.wid * 0.5, hh = d.wid * 0.62;
          P.mat(0.86, 0.45).rect(cx - 2.6, tip + 6, 5.2, gripTop - tip - 6, G.low);
          // a squared head with a chamfered striking face and a lit top edge
          P.mat(0.88, 0.45).rounded(cx - hw, tip, hw * 2, hh, 2, G.low);
          P.mat(0.96, 0.6).rounded(cx - hw + 1.2, tip + 1.2, hw * 2 - 2.4, hh - 3.4, 1.5, G.mid);
          P.mat(1.0, 0.85).rect(cx - hw + 1.6, tip + 1.6, hw * 2 - 3.2, 2.0, G.hi);
          P.mat(0.78, 0.5).rect(cx - hw, tip + hh - 2.4, hw * 2, 2.4, G.dark);
          P.mat(1.0, 0.7).rect(cx - hw - 1.4, tip + 2, 2.2, hh - 5, G.hi);
          P.mat(1.0, 0.7).rect(cx + hw - 0.8, tip + 2, 2.2, hh - 5, G.hi);
          P.mat(0.92, 0.55).rounded(cx - 4.2, tip + hh - 1, 8.4, 4, 1.5, G.mid);
        } else if (d.axe) {
          P.mat(0.86, 0.4).rect(cx - 2, tip, 4, gripTop - tip, G.low);
          // the bit: a crescent with a bright edge
          P.mat(0.94, 0.55);
          P.poly([[cx, tip + 4], [cx + d.wid * 0.9, tip + 10], [cx + d.wid * 0.75, tip + 24], [cx, tip + 20]], G.mid);
          P.mat(1.0, 0.85);
          P.poly([[cx + d.wid * 0.9, tip + 10], [cx + d.wid * 0.75, tip + 24], [cx + d.wid * 0.55, tip + 21], [cx + d.wid * 0.68, tip + 12]], G.hi);
          P.mat(0.80, 0.45);
          P.poly([[cx, tip + 6], [cx - d.wid * 0.45, tip + 12], [cx - d.wid * 0.38, tip + 20], [cx, tip + 18]], G.low);
        } else {
          // blade: a central ridge with two bevels, which is what makes a blade
          // read as metal under a moving light instead of a grey stick
          const hw = d.wid / 2;
          for (let y = tip; y < gripTop - d.guard * 0.2; y++) {
            const t = (y - tip) / (gripTop - tip);
            const ww = hw * (0.25 + 0.75 * Math.min(1, t * 3)) * (1 - t * 0.18);
            P.mat(0.62, 0.55).rect(cx - ww, y, ww, 1, G.low);
            P.mat(0.80, 0.65).rect(cx, y, ww, 1, G.mid);
            P.mat(1.0, 0.92).rect(cx - 0.9, y, 1.8, 1, G.hi);
            P.mat(0.52, 0.85).rect(cx - ww, y, 0.9, 1, G.mid);
            P.mat(0.52, 0.85).rect(cx + ww - 0.9, y, 0.9, 1, G.mid);
          }
          // guard
          P.mat(0.92, 0.5).rounded(cx - d.guard / 2, gripTop - 4, d.guard, 4.5, 2, G.mid);
          P.mat(1.0, 0.7).rect(cx - d.guard / 2 + 1, gripTop - 4, d.guard - 2, 1.6, G.hi);
        }
        // pommel
        P.mat(0.95, 0.6).dome(cx, H - 2.5, 3.2, 3.0, G.hi, 0.5, 1.0);
      }, { ax: cx, ay: H - d.grip / 2, bump: 1.5 });

      A().define('grip_' + cls, W, H, (P, r) => {
        const gripTop = H - d.grip;
        P.mat(0.78, 0.10).rounded(cx - 2.6, gripTop, 5.2, d.grip - 3, 2, '#3a2a1c');
        P.mat(0.86, 0.14);
        for (let i = 0; i < d.grip / 3; i++) P.rect(cx - 2.6, gripTop + 1 + i * 3, 5.2, 1.4, '#55402a');
      }, { ax: cx, ay: H - d.grip / 2, bump: 1.3 });

      // emissive overlay: runs up the blade for traits and spells
      A().define('wglow_' + cls, W, H, (P) => {
        const tip = 4, gripTop = H - d.grip;
        P.glow('#ffffff').mat(0.9, 0.5);
        if (d.hammer) { P.rect(cx - d.wid * 0.42, tip + 2, d.wid * 0.84, 1.8, '#ffffff'); P.rect(cx - 1.2, tip + 6, 2.4, d.wid * 0.5, '#ffffff'); }
        else if (d.axe) P.poly([[cx + d.wid * 0.9, tip + 10], [cx + d.wid * 0.75, tip + 24], [cx + d.wid * 0.52, tip + 21], [cx + d.wid * 0.66, tip + 12]], '#ffffff');
        else P.rect(cx - 1.1, tip + 2, 2.2, gripTop - tip - 6, '#ffffff');
        P.glow(null);
      }, { ax: cx, ay: H - d.grip / 2, bump: 0 });
    }
  }

  // -------------------------------------------------------------- pickaxes
  function picks() {
    const W = 26, H = 40;
    const cx = 13, top = 4;
    A().define('pick_head', W, H, (P) => {
      // a swept bit one side, a flat poll the other
      P.mat(0.86, 0.26);
      P.poly([[cx - 11, top + 2], [cx - 2, top + 5], [cx + 2, top + 5], [cx + 11, top + 2],
              [cx + 9, top + 8], [cx + 2, top + 9.5], [cx - 2, top + 9.5], [cx - 9, top + 8]], G.mid);
      P.mat(0.98, 0.40).rect(cx - 11, top + 2, 22, 1.3, G.hi);
      P.mat(0.64, 0.18).poly([[cx - 11, top + 2], [cx - 13, top + 5.5], [cx - 9, top + 8]], G.dark);
      P.mat(0.64, 0.18).poly([[cx + 11, top + 2], [cx + 13, top + 5.5], [cx + 9, top + 8]], G.dark);
      P.mat(0.92, 0.32).rounded(cx - 3, top + 1.5, 6, 9.5, 2, G.low);   // eye / collar
      P.mat(0.5, 0.10).speckle(cx - 11, top + 2, 22, 7, [G.dark, G.deep], 22, 0.10);
    }, { ax: cx, ay: 30, bump: 1.5 });

    A().define('pick_haft', W, H, (P) => {
      P.mat(0.78, 0.10).rounded(11.2, 10, 3.8, 29, 1.8, '#3f2c1c');
      P.mat(0.86, 0.12);
      for (let i = 0; i < 8; i++) P.rect(11.2, 12 + i * 3.2, 3.8, 1.1, '#54402a');
      P.mat(0.88, 0.22).rect(10.6, 10, 5, 2.2, '#4a4650');
    }, { ax: cx, ay: 30, bump: 1.3 });

    A().define('pick_glow', W, H, (P) => {
      P.glow('#ffffff').mat(0.9, 0.5);
      P.rect(2, 6, 22, 1.8, '#ffffff');
      P.glow(null);
    }, { ax: cx, ay: 30, bump: 0 });
  }

  // ---------------------------------------------------------- enemy pieces
  function enemyParts() {
    // a heavy, low-slung shell for Stoneshell and Vault Warden
    A().define('en_shell', 40, 34, (P, r) => {
      P.mat(0.60, 0.12).dome(20, 20, 18, 13, G.low, 0.24, 0.94);
      for (let i = 0; i < 9; i++) {
        const x = 5 + r() * 30, y = 6 + r() * 20;
        P.mat(0.7 + r() * 0.28, 0.16).dome(x, y, 3 + r() * 4, 2.6 + r() * 3, r() < 0.5 ? G.mid : G.dark, 0.4, 0.98);
      }
      P.mat(0.9, 0.3);
      for (let i = 0; i < 5; i++) P.poly([[8 + i * 6, 8], [11 + i * 6, 2], [14 + i * 6, 8]], G.hi);
    }, { ax: 20, ay: 30, bump: 1.3 });

    // insectile body for the Blast Beetle
    A().define('en_beetle', 28, 22, (P, r) => {
      P.mat(0.68, 0.30).dome(14, 12, 12, 9, G.mid, 0.28, 0.98);
      P.mat(0.42, 0.20).rect(13, 3, 2, 18, G.deep);
      P.mat(0.86, 0.5).dome(14, 7, 8, 4, G.hi, 0.6, 1.0);
      P.mat(0.3, 0.1).circle(9, 6, 1.6, G.deep).circle(19, 6, 1.6, G.deep);
    }, { ax: 14, ay: 19, bump: 1.4 });

    A().define('en_hood', 24, 22, (P) => {
      P.mat(0.74, 0.10);
      P.poly([[12, 0], [22, 9], [20, 21], [4, 21], [2, 9]], G.mid);
      P.mat(0.30, 0.04).ellipse(12, 13, 5.4, 5.0, '#141018');     // the dark inside
      P.mat(0.86, 0.14).poly([[12, 0], [20, 8], [16, 9], [12, 4], [8, 9], [4, 8]], G.hi);
    }, { ax: 12, ay: 19, bump: 1.3 });

    A().define('en_horns', 26, 14, (P) => {
      P.mat(0.9, 0.35);
      P.poly([[6, 14], [1, 4], [5, 1], [9, 11]], G.mid);
      P.poly([[20, 14], [25, 4], [21, 1], [17, 11]], G.mid);
      P.mat(1.0, 0.55).poly([[1, 4], [5, 1], [5, 5]], G.hi);
      P.mat(1.0, 0.55).poly([[25, 4], [21, 1], [21, 5]], G.hi);
    }, { ax: 13, ay: 13, bump: 1.4 });

    A().define('en_bow', 12, 34, (P) => {
      P.mat(0.82, 0.2);
      P.a.strokeStyle = '#000'; // shape comes from the arc below
      for (let i = 0; i < 26; i++) {
        const t = i / 25, y = 4 + t * 26;
        const x = 6 + Math.sin(t * Math.PI) * 4.5;
        P.dome(x, y, 1.5, 1.5, G.mid, 0.5, 0.95);
      }
      P.mat(0.6, 0.5).line(6, 4, 6, 30, G.hi, 1);
    }, { ax: 6, ay: 17, bump: 1.4 });

    A().define('en_staff', 12, 40, (P) => {
      P.mat(0.78, 0.14).rounded(4.6, 8, 3.2, 31, 1.5, '#3f2e1e');
      P.mat(0.92, 0.7).glow('#ffffff').circle(6, 5, 4.2, '#ffffff');
      P.glow(null);
      P.mat(0.9, 0.4).circle(6, 5, 5.4, G.mid);
    }, { ax: 6, ay: 20, bump: 1.4 });

    A().define('en_club', 14, 30, (P, r) => {
      P.mat(0.80, 0.14).rounded(5, 10, 4, 19, 2, '#3f2e1e');
      P.mat(0.88, 0.2).dome(7, 7, 6, 7, G.low, 0.4, 0.96);
      P.mat(1.0, 0.5);
      for (let i = 0; i < 5; i++) P.poly([[2 + i * 2.6, 6], [4 + i * 2.6, 1], [6 + i * 2.6, 6]], G.hi);
    }, { ax: 7, ay: 15, bump: 1.4 });
  }

  // -------------------------------------------------------------------- fx
  function fx() {
    A().define('lantern', 14, 20, (P) => {
      P.mat(0.86, 0.5).rect(5, 0, 4, 3, '#8a7040');           // bail
      P.mat(0.80, 0.45).rounded(2, 3, 10, 4, 1.5, '#9a7c48'); // cap
      P.mat(0.70, 0.30).rect(3, 6, 8, 10, '#2a2420');         // glass housing
      P.mat(0.92, 0.35).glow('#ffd070').rect(4, 7, 6, 8, '#ffdf9a');
      P.glow('#fff4d0').mat(1.0, 0.4).ellipse(7, 11, 2, 3, '#fffaf0');
      P.glow(null);
      P.mat(0.84, 0.5).rect(2, 16, 10, 3, '#9a7c48');
      P.mat(0.9, 0.55).rect(2.6, 5, 1.4, 12, '#b08c52').rect(10, 5, 1.4, 12, '#b08c52');
    }, { ax: 7, ay: 1, bump: 1.4 });

    A().define('arrow', 20, 5, (P) => {
      P.mat(0.7, 0.3).rect(2, 2, 14, 1.4, '#6b5436');
      P.mat(0.95, 0.8).poly([[16, 0.4], [20, 2.5], [16, 4.6]], G.hi);
      P.mat(0.8, 0.2).poly([[0, 0], [4, 2.5], [0, 5]], '#c8c0b0');
    }, { ax: 10, ay: 2.5 });

    A().define('bolt', 18, 14, (P) => {
      P.glow('#ffffff').mat(0.8, 0.6);
      P.poly([[0, 7], [8, 0], [6, 6], [18, 7], [8, 14], [10, 8]], '#ffffff');
      P.glow(null);
    }, { ax: 9, ay: 7, bump: 0 });

    A().define('dust', 16, 16, (P) => {
      const g = P.a; const rad = g.createRadialGradient(8, 8, 0, 8, 8, 8);
      rad.addColorStop(0, 'rgba(255,255,255,0.85)');
      rad.addColorStop(0.6, 'rgba(255,255,255,0.25)');
      rad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rad; g.fillRect(0, 0, 16, 16);
      P.n.fillStyle = 'rgb(128,128,0)'; P.n.fillRect(0, 0, 16, 16);
    }, { bump: 0 });

    A().define('smoke', 24, 24, (P, r) => {
      const g = P.a;
      for (let i = 0; i < 6; i++) {
        const x = 5 + r() * 14, y = 5 + r() * 14, rr = 4 + r() * 6;
        const rad = g.createRadialGradient(x, y, 0, x, y, rr);
        rad.addColorStop(0, 'rgba(255,255,255,0.5)');
        rad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rad; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
      }
      P.n.fillStyle = 'rgb(128,128,0)'; P.n.fillRect(0, 0, 24, 24);
    }, { bump: 0 });

    A().define('shard', 7, 7, (P) => {
      P.mat(0.8, 0.5).poly([[3.5, 0], [7, 3], [4, 7], [0, 4]], '#ffffff');
    }, { ax: 3.5, ay: 3.5, bump: 1.2 });
  }

})(window.F2 = window.F2 || {});
