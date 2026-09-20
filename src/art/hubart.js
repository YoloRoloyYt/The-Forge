'use strict';
// ---------------------------------------------------------------------------
// hubart.js — Emberhold's furniture: the Great Forge, braziers, benches,
// crates, plaques and the Deep Gate.
// ---------------------------------------------------------------------------
(function (F) {

  const A = () => F.Art;

  F.HubArt = {
    build() {
      // The Great Forge: a stone drum, banded with iron, with a molten throat.
      A().define('forgedrum', 200, 180, (P, r) => {
        const cx = 100, cy = 104;
        // scorched apron
        P.mat(0.30, 0.06).ellipse(cx, cy + 34, 92, 36, '#2a1c16');
        P.mat(0.32, 0.07).ellipse(cx, cy + 34, 76, 29, '#3a251b');
        // the drum
        P.mat(0.86, 0.14).ellipse(cx, cy, 74, 52, '#4a4149');
        P.mat(0.92, 0.16).ellipse(cx, cy - 8, 70, 46, '#585060');
        P.speckle(cx - 68, cy - 48, 136, 92, ['#635a6c', '#413a4a'], 260, 0.10);
        // iron bands
        P.mat(0.96, 0.42);
        for (let i = 0; i < 3; i++) {
          P.a.save(); P.a.globalAlpha = 0.9;
          P.ellipse(cx, cy - 6 + i * 16, 70 - i * 3, 44 - i * 3, '#3a3640');
          P.a.restore();
        }
        P.mat(0.99, 0.55);
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * 6.2832;
          P.dome(cx + Math.cos(a) * 66, cy - 6 + Math.sin(a) * 42, 3, 3, '#6e6a78', 0.6, 1.0);
        }
        // the molten throat: small, deep-set, and mostly shadow
        P.mat(0.44, 0.10).ellipse(cx, cy - 12, 34, 22, '#1a0c08');
        P.mat(0.40, 0.18).glow('#7a1e04').ellipse(cx, cy - 12, 28, 18, '#8a3410');
        P.glow('#b03c08').mat(0.38, 0.2).ellipse(cx, cy - 12, 19, 12, '#c2501a');
        P.glow('#d87a20').mat(0.36, 0.2).ellipse(cx, cy - 13, 10, 6, '#e08a30');
        P.glow(null);
        // an anvil on the apron
        P.mat(0.95, 0.5).rect(cx - 16, cy + 34, 32, 8, '#3f3b46');
        P.mat(0.99, 0.6).poly([[cx - 22, cy + 34], [cx + 22, cy + 34], [cx + 14, cy + 28], [cx - 14, cy + 28]], '#4e4a58');
        P.mat(0.9, 0.4).rect(cx - 8, cy + 42, 16, 7, '#33303a');
      }, { ax: 100, ay: 128, bump: 1.1 });

      A().define('brazier', 30, 46, (P, r) => {
        P.mat(0.62, 0.20).poly([[6, 46], [24, 46], [20, 30], [10, 30]], '#3f3b46');
        P.mat(0.9, 0.4).rect(3, 22, 24, 9, '#4e4a58');
        P.mat(0.96, 0.55).rect(2, 21, 26, 3, '#6e6a78');
        P.mat(0.5, 0.2).glow('#a83a08').ellipse(15, 22, 9, 3.4, '#c2501a');
        P.glow(null);
        P.mat(0.95, 0.45);
        for (let i = 0; i < 4; i++) P.rect(4 + i * 7, 31, 2, 14, '#33303a');
      }, { ax: 15, ay: 44, bump: 1.2 });

      A().define('bench', 40, 30, (P, r) => {
        P.mat(0.74, 0.12).rect(2, 8, 36, 12, '#4a3524');
        P.mat(0.84, 0.16).rect(1, 6, 38, 4, '#5e442c');
        P.mat(0.62, 0.10).rect(4, 20, 4, 9, '#39281a').rect(32, 20, 4, 9, '#39281a');
        P.mat(0.9, 0.5);
        for (let i = 0; i < 5; i++) P.dome(6 + r() * 28, 8 + r() * 8, 2 + r() * 2, 1.6 + r(), '#8a8290', 0.5, 0.95);
      }, { ax: 20, ay: 28, bump: 1.2 });

      A().define('crate', 28, 26, (P, r) => {
        P.mat(0.80, 0.12).rect(2, 4, 24, 21, '#4e3a24');
        P.mat(0.88, 0.14).rect(2, 3, 24, 4, '#63492c');
        P.mat(0.68, 0.10).rect(4, 8, 20, 2, '#3a2a19').rect(4, 17, 20, 2, '#3a2a19');
        P.mat(0.9, 0.3).rect(12, 4, 4, 21, '#6e5433');
      }, { ax: 14, ay: 24, bump: 1.2, outline: '#160d08' });

      A().define('sign', 52, 22, (P) => {
        P.mat(0.86, 0.16).rounded(1, 1, 50, 18, 3, '#4a3524');
        P.mat(0.94, 0.4).rounded(3, 3, 46, 14, 2, '#5e442c');
        P.mat(0.98, 0.6).rect(3, 3, 46, 1.6, '#8a6a42');
        P.mat(0.9, 0.5).circle(6, 10, 1.6, '#a8896a').circle(46, 10, 1.6, '#a8896a');
      }, { ax: 26, ay: 20, bump: 1.2 });

      // The Deep Gate: a carved arch with a curtain of violet light.
      A().define('gate', 96, 110, (P, r) => {
        P.mat(0.95, 0.20).rect(2, 10, 18, 100, '#4a4149');
        P.mat(0.95, 0.20).rect(76, 10, 18, 100, '#4a4149');
        P.mat(0.98, 0.24);
        P.poly([[2, 14], [94, 14], [86, 0], [10, 0]], '#585060');
        P.speckle(2, 0, 92, 108, ['#635a6c', '#3d3746'], 220, 0.10);
        // runes down the jambs
        P.mat(0.99, 0.6).glow('#4a1a80');
        for (let i = 0; i < 6; i++) {
          P.rect(7, 22 + i * 14, 8, 2, '#b76cff');
          P.rect(81, 22 + i * 14, 8, 2, '#b76cff');
        }
        P.glow(null);
        // the veil
        P.mat(0.30, 0.1).glow('#2a0a50');
        P.rect(20, 12, 56, 98, '#3a1070');
        P.glow('#4a1a90').mat(0.28, 0.1);
        for (let i = 0; i < 14; i++) {
          P.a.save(); P.a.globalAlpha = 0.35;
          P.rect(20 + r() * 52, 12, 1 + r() * 3, 98, '#6a28c0');
          P.a.restore();
        }
        P.glow(null);
      }, { ax: 48, ay: 104, bump: 1.1 });

      A().define('anvil', 34, 24, (P) => {
        P.mat(0.95, 0.5).poly([[2, 8], [32, 8], [26, 2], [8, 2]], '#4e4a58');
        P.mat(0.99, 0.6).rect(2, 7, 30, 2, '#6e6a78');
        P.mat(0.86, 0.35).rect(12, 10, 10, 8, '#3f3b46');
        P.mat(0.9, 0.4).rect(7, 18, 20, 5, '#4a4650');
      }, { ax: 17, ay: 22, bump: 1.3 });
    },
  };

})(window.F2 = window.F2 || {});
