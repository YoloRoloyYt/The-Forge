'use strict';
// ---------------------------------------------------------------------------
// hubart.js — Emberhold's furniture: the Great Forge, braziers, benches,
// crates, plaques and the Deep Gate.
// ---------------------------------------------------------------------------
(function (F) {

  const A = () => F.Art;

  F.HubArt = {
    build() {
      // The Great Forge: a stone drum with a molten heart. Built as a real
      // cylinder — a top ellipse plus a side wall whose normals fan outward —
      // because a flat disc with a hole in it reads as a flying saucer.
      A().define('forgedrum', 200, 180, (P, r) => {
        const cx = 100, rimY = 58, baseY = 126, rx = 74, ry = 26;

        // scorched apron of brick
        P.mat(0.26, 0.05).ellipse(cx, baseY + 12, 94, 32, '#241710');
        P.mat(0.30, 0.06).ellipse(cx, baseY + 10, 80, 26, '#33211a');
        P.mat(0.34, 0.08).speckle(cx - 78, baseY - 8, 156, 36, ['#432a20', '#2a1a14'], 150, 0.06);

        // ---- the side wall, shaded like a cylinder
        for (let x = cx - rx; x <= cx + rx; x++) {
          const t = (x - cx) / rx;                    // -1 .. 1 across the barrel
          const drop = Math.sqrt(Math.max(0, 1 - t * t));
          const yTop = rimY + ry * (1 - drop) * 0.0 + ry * 0 + 0;
          const yBot = baseY + 14 * drop;
          // outward-fanning normal is what makes it round under a moving light
          P.nrm(t * 0.92, 0.22);
          // a key from the upper left, so the barrel has a lit face and a dark one
          const shade = 0.42 + (1 - Math.abs(t + 0.34)) * 0.80;
          P.mat(0.74 - Math.abs(t) * 0.18, 0.14);
          // cool stone against warm brick: the separation is what makes it solid
          P.a.fillStyle = F.Col.shade('#5d5670', F.U.clamp(shade, 0.30, 1.22));
          P.a.fillRect(x, yTop, 1, yBot - yTop);
          P.hh.fillStyle = P.hs(); P.hh.fillRect(x, yTop, 1, yBot - yTop);
          P.n.fillStyle = P._n; P.n.fillRect(x, yTop, 1, yBot - yTop);
        }
        P.nrm(null);
        P.mat(0.70, 0.10).speckle(cx - rx + 3, rimY + 4, rx * 2 - 6, baseY - rimY, ['#7d7389', '#4a4354'], 340, 0.08);
        // the barrel sits on the ground; without a contact shadow it floats
        P.a.save();
        const cg = P.a.createLinearGradient(0, baseY - 22, 0, baseY + 16);
        cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(0,0,0,0.62)');
        P.a.fillStyle = cg; P.a.fillRect(cx - rx, baseY - 22, rx * 2, 38);
        P.a.restore();

        // ---- iron bands wrapping the barrel
        for (const by of [rimY + 24, baseY - 10]) {
          for (let x = cx - rx; x <= cx + rx; x++) {
            const t = (x - cx) / rx;
            const drop = Math.sqrt(Math.max(0, 1 - t * t));
            const y = by + 12 * (1 - drop);
            P.nrm(t * 0.9, 0.2);
            P.mat(0.86, 0.34);
            const lit = F.U.clamp(0.5 + (1 - Math.abs(t + 0.34)) * 0.9, 0.35, 1.25);
            P.a.fillStyle = F.Col.shade('#3f3a48', lit); P.a.fillRect(x, y, 1, 9);
            P.a.fillStyle = F.Col.shade('#847c94', lit); P.a.fillRect(x, y, 1, 2.4);
            P.a.fillStyle = 'rgba(0,0,0,0.45)'; P.a.fillRect(x, y + 7.5, 1, 1.5);
            P.hh.fillStyle = P.hs(); P.hh.fillRect(x, y, 1, 9);
            P.n.fillStyle = P._n; P.n.fillRect(x, y, 1, 9);
          }
        }
        P.nrm(null);
        // rivets along the top band
        P.mat(0.96, 0.5);
        for (let i = 0; i < 11; i++) {
          const t = -1 + (i / 10) * 2;
          const drop = Math.sqrt(Math.max(0, 1 - t * t));
          P.dome(cx + t * rx, rimY + 28 + 12 * (1 - drop), 2.8, 2.8, '#9a92aa', 0.6, 1.0);
        }

        // ---- the top face: a raised stone rim around a recessed throat
        P.nrm(0, -0.55);
        P.mat(0.99, 0.16).ellipse(cx, rimY, rx, ry, '#7a7188');
        P.mat(0.99, 0.14).speckle(cx - rx + 6, rimY - ry + 4, rx * 2 - 12, ry * 2 - 8, ['#8b8299', '#5a5366'], 170, 0.05);
        P.nrm(null);
        // the throat, cut down into it
        P.mat(0.70, 0.10).ellipse(cx, rimY + 1, rx - 13, ry - 8, '#2a2330');
        P.nrm(0, 0.5).mat(0.60, 0.08).ellipse(cx, rimY + 3, rx - 17, ry - 11, '#1a1018');
        P.nrm(null);
        P.mat(0.52, 0.16).glow('#8a2c06').ellipse(cx, rimY + 4, rx - 24, ry - 14, '#93380f');
        P.glow('#c2501a').mat(0.50, 0.16).ellipse(cx, rimY + 4, rx - 34, ry - 17, '#b84a16');
        P.glow('#e08a30').mat(0.48, 0.16).ellipse(cx, rimY + 5, rx - 46, ry - 19, '#d4792a');
        P.glow(null);
        // coals in the throat
        P.mat(0.50, 0.2);
        for (let i = 0; i < 16; i++) {
          const a = r() * 6.2832, rr = r() * (rx - 30);
          P.glow(F.shadeGlow('#ff7a20', 0.35 + r() * 0.5));
          P.ellipse(cx + Math.cos(a) * rr, rimY + 4 + Math.sin(a) * rr * 0.30, 2 + r() * 3, 1.2 + r() * 1.6, '#c2501a');
        }
        P.glow(null);

        // ---- an anvil on the apron, in front
        P.mat(0.95, 0.5).rect(cx - 16, baseY + 14, 32, 7, '#3f3b46');
        P.mat(0.99, 0.6).poly([[cx - 23, baseY + 14], [cx + 23, baseY + 14], [cx + 14, baseY + 7], [cx - 14, baseY + 7]], '#4e4a58');
        P.mat(1.0, 0.7).rect(cx - 22, baseY + 7, 44, 2, '#6e6a78');
        P.mat(0.9, 0.4).rect(cx - 8, baseY + 21, 16, 8, '#33303a');
        P.mat(0.86, 0.3).ellipse(cx, baseY + 29, 13, 4, '#2a2730');
      }, { ax: 100, ay: 128, bump: 1.05, outline: '#140e16' });

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

      // ---- trade fittings. Each room is supposed to look like somebody works there.
      A().define('trough', 44, 26, (P, r) => {
        P.mat(0.72, 0.14).rounded(0, 4, 44, 20, 3, '#3f2e1e');
        P.mat(0.80, 0.16).rounded(1.5, 5.5, 41, 5, 2, '#5a4229');
        P.mat(0.30, 0.55).glow('#0e2430').rounded(3, 9, 38, 13, 2, '#17394a');
        P.glow('#2a6a86').mat(0.28, 0.6);
        for (let i = 0; i < 7; i++) P.ellipse(6 + r() * 32, 12 + r() * 8, 1.5 + r() * 3, 0.9 + r(), '#3f8fae');
        P.glow(null);
        P.mat(0.85, 0.35).rect(0, 4, 2.5, 20, '#4a4650').rect(41.5, 4, 2.5, 20, '#4a4650');
      }, { ax: 22, ay: 24, bump: 1.2, outline: '#120c08' });

      A().define('rack', 40, 34, (P, r) => {
        P.mat(0.86, 0.14).rect(0, 0, 40, 4, '#4a3524');
        P.mat(0.80, 0.12).rect(1, 28, 38, 4, '#4a3524');
        // hanging tools
        for (let i = 0; i < 4; i++) {
          const x = 6 + i * 9;
          P.mat(0.72, 0.16).rect(x, 4, 2.4, 18, '#3f2e1e');
          P.mat(0.94, 0.45);
          if (i % 2) P.rounded(x - 3, 20, 8.5, 6, 1.5, '#6e6a78');
          else { P.poly([[x - 4, 20], [x + 6, 20], [x + 1.2, 27]], '#6e6a78'); }
        }
      }, { ax: 20, ay: 32, bump: 1.25, outline: '#120c08' });

      A().define('cauldron', 40, 36, (P, r) => {
        P.mat(0.62, 0.20).dome(20, 22, 16, 12, '#2f2b34', 0.25, 0.9);
        P.mat(0.86, 0.34).rounded(3, 10, 34, 6, 3, '#413c48');
        P.mat(0.34, 0.30).glow('#1e5a34').ellipse(20, 12, 14, 4.6, '#2f8f52');
        P.glow('#4fd88a').mat(0.32, 0.3);
        for (let i = 0; i < 6; i++) P.circle(9 + r() * 22, 10 + r() * 4, 0.9 + r() * 1.6, '#6ee7a0');
        P.glow(null);
        P.mat(0.80, 0.28).rect(6, 28, 4, 8, '#33303a').rect(30, 28, 4, 8, '#33303a');
      }, { ax: 20, ay: 34, bump: 1.25, outline: '#0e1410' });

      A().define('shelf', 44, 34, (P, r) => {
        P.mat(0.84, 0.12).rect(0, 0, 44, 3.5, '#4a3524');
        P.mat(0.84, 0.12).rect(0, 16, 44, 3.5, '#4a3524');
        P.mat(0.70, 0.10).rect(0, 30, 44, 3.5, '#3f2e1e');
        const cols = ['#e0344f', '#4aa6ff', '#6ee787', '#f0cb4b', '#b76cff', '#ff8a3d'];
        for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
          const x = 3 + i * 7, y = row * 16;
          const c = cols[(i + row * 3) % cols.length];
          P.mat(0.68, 0.30).glow(F.shadeGlow(c, 0.30));
          P.rounded(x, y + 6, 4.4, 9, 1.6, c);
          P.glow(null);
          P.mat(0.74, 0.2).rect(x + 1.2, y + 4, 2, 2.4, '#5a4229');
        }
      }, { ax: 22, ay: 32, bump: 1.2, outline: '#120c08' });

      A().define('pedestal', 32, 46, (P) => {
        P.mat(0.62, 0.16).rounded(4, 30, 24, 14, 2, '#413c48');
        P.mat(0.74, 0.18).rounded(8, 14, 16, 18, 2, '#4e4856');
        P.mat(0.88, 0.30).rounded(5, 10, 22, 6, 2, '#5c5668');
        // the rune, floating just above it
        P.mat(0.95, 0.5).glow('#6a2ab0');
        P.poly([[16, 0], [24, 6], [21, 15], [11, 15], [8, 6]], '#8f3bff');
        P.glow('#c98bff').mat(1.0, 0.6).rect(15, 4, 2, 8, '#d8b0ff');
        P.glow(null);
      }, { ax: 16, ay: 44, bump: 1.3, outline: '#0c0812' });

      A().define('noticeboard', 56, 46, (P, r) => {
        P.mat(0.70, 0.12).rect(6, 38, 5, 8, '#3f2e1e').rect(45, 38, 5, 8, '#3f2e1e');
        P.mat(0.82, 0.14).rounded(0, 0, 56, 40, 2, '#4a3524');
        P.mat(0.74, 0.10).rect(3, 3, 50, 34, '#2e2118');
        for (let i = 0; i < 7; i++) {
          const x = 5 + r() * 40, y = 5 + r() * 26;
          P.mat(0.80, 0.16).rect(x, y, 8 + r() * 6, 7 + r() * 5, r() < 0.5 ? '#cfc4a6' : '#b8ac8e');
          P.mat(0.9, 0.4).circle(x + 3, y + 1.5, 1, '#c79a4e');
        }
      }, { ax: 28, ay: 44, bump: 1.25, outline: '#120c08' });

      A().define('shrinestone', 54, 62, (P, r) => {
        P.mat(0.55, 0.12).ellipse(27, 57, 22, 6, '#2c2836');
        P.mat(0.86, 0.14);
        P.poly([[27, 2], [46, 20], [43, 56], [11, 56], [8, 20]], '#4e4856');
        P.speckle(10, 6, 34, 48, ['#5c5668', '#3a3544'], 130, 0.10);
        // carved ancestor face
        P.mat(0.60, 0.08).ellipse(19, 24, 4, 5.5, '#2a2634');
        P.mat(0.60, 0.08).ellipse(35, 24, 4, 5.5, '#2a2634');
        P.glow('#2a7f9e').mat(0.7, 0.4).ellipse(19, 24, 2.2, 3, '#7ef9ff');
        P.glow('#2a7f9e').mat(0.7, 0.4).ellipse(35, 24, 2.2, 3, '#7ef9ff');
        P.glow(null);
        P.mat(0.5, 0.06).rect(18, 38, 18, 2.5, '#2a2634');
        P.mat(0.92, 0.26);
        for (let i = 0; i < 4; i++) P.rect(12 + i * 9, 46, 6, 2, '#6a6478');
      }, { ax: 27, ay: 58, bump: 1.3, outline: '#0a0810' });

      A().define('barrel', 26, 30, (P) => {
        P.mat(0.80, 0.12).rounded(1, 3, 24, 26, 5, '#4e3a24');
        P.mat(0.86, 0.16).ellipse(13, 5, 11, 3.6, '#63492c');
        P.mat(0.92, 0.30).rect(1, 9, 24, 2.6, '#4a4650').rect(1, 20, 24, 2.6, '#4a4650');
        P.mat(0.70, 0.10).rect(12, 3, 1.6, 26, '#3a2a19');
      }, { ax: 13, ay: 28, bump: 1.2, outline: '#120c08' });

      A().define('plaque', 62, 26, (P) => {
        P.mat(0.88, 0.18).rounded(0, 0, 62, 22, 3, '#3a3544');
        P.mat(0.94, 0.40).rounded(2, 2, 58, 18, 2, '#4e4856');
        P.mat(0.99, 0.55).rect(4, 4, 54, 1.8, '#7a7288');
        P.mat(0.6, 0.3).glow('#ffffff').rect(8, 9, 46, 5, '#ffffff');
        P.glow(null);
        P.mat(0.95, 0.5).circle(5, 11, 1.8, '#8a8298').circle(57, 11, 1.8, '#8a8298');
      }, { ax: 31, ay: 24, bump: 1.25 });

      A().define('anvil', 34, 24, (P) => {
        P.mat(0.95, 0.5).poly([[2, 8], [32, 8], [26, 2], [8, 2]], '#4e4a58');
        P.mat(0.99, 0.6).rect(2, 7, 30, 2, '#6e6a78');
        P.mat(0.86, 0.35).rect(12, 10, 10, 8, '#3f3b46');
        P.mat(0.9, 0.4).rect(7, 18, 20, 5, '#4a4650');
      }, { ax: 17, ay: 22, bump: 1.3 });
    },
  };

})(window.F2 = window.F2 || {});
