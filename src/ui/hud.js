'use strict';
// ---------------------------------------------------------------------------
// hud.js — everything drawn over the world while you are playing.
// ---------------------------------------------------------------------------
(function (F) {

  const P = F.PAL;

  const Hud = F.Hud = {
    draw(sc) {
      const U = F.UI, g = U.g, s = F.Game.s, p = sc.player;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);

      this.floaters(sc);
      this.vitals(sc);
      if (!sc.bossBar) this.depthPlate(sc);
      this.purse(sc);
      this.hotbar(sc);
      this.buffs(sc);
      this.questTrack(sc);
      this.minimap(sc);
      this.prompt(sc);
      this.crosshair(sc);
      if (sc.bossBar) this.bossBar(sc);
      this.toasts();
      this.intro(sc);
      if (F.Touch && F.Touch.active) F.Touch.draw(U);
      U.end();
    },

    // ------------------------------------------------------- world labels
    floaters(sc) {
      const U = F.UI, cam = sc.cam;
      for (const f of F.Game.floaters) {
        const x = (f.x - cam.x) * 2, y = (f.y - cam.y) * 2;
        if (x < -80 || x > U.W + 80 || y < -40 || y > U.H + 40) continue;
        const k = f.t / f.max;
        const size = (f.crit ? 27 : 20) * f.size * (1 + (1 - k) * 0.12);
        U.text(f.text, x, y, {
          size, align: 'center', weight: f.crit ? '800' : '700', display: f.crit,
          col: f.col, alpha: Math.min(1, k * 2.2),
          glow: f.crit ? f.col : null, glowBlur: 18, shadowD: 2, shadowA: 0.85,
        });
      }
    },

    // ------------------------------------------------------------ vitals
    vitals(sc) {
      const U = F.UI, g = U.g, s = F.Game.s;
      const x = 26, y = 24;
      const maxHp = F.Game.maxHp();

      // level medallion
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 14;
      const mg = g.createRadialGradient(x + 27, y + 21, 3, x + 27, y + 27, 30);
      mg.addColorStop(0, '#4a3a1c'); mg.addColorStop(1, '#1a1420');
      g.fillStyle = mg;
      g.beginPath(); g.arc(x + 27, y + 27, 27, 0, 7); g.fill();
      g.restore();
      g.strokeStyle = P.brass; g.lineWidth = 2.4;
      g.beginPath(); g.arc(x + 27, y + 27, 26, 0, 7); g.stroke();
      g.strokeStyle = 'rgba(255,230,180,0.30)'; g.lineWidth = 1;
      g.beginPath(); g.arc(x + 27, y + 27, 23, 0, 7); g.stroke();
      U.text('' + s.level, x + 27, y + 36, { size: 26, weight: '700', align: 'center', display: true, col: P.brassHi, glow: 'rgba(240,203,126,0.55)' });
      U.text('LEVEL', x + 27, y + 62, { size: 9.5, weight: '700', align: 'center', col: P.textDim });

      const bx = x + 64, bw = 288;
      U.bar(bx, y + 6, bw, 22, s.hp / maxHp, { col: P.hp, label: Math.max(0, Math.ceil(s.hp)) + ' / ' + maxHp });
      U.bar(bx, y + 32, bw * 0.78, 12, sc.player.stam / sc.player.maxStam, { col: P.stam, glow: false });
      const xpNeed = F.xpNeeded(s.level);
      U.bar(bx, y + 48, bw * 0.78, 7, s.level >= F.MAX_LEVEL ? 1 : s.xp / xpNeed, { col: P.xp, glow: false, frame: 'rgba(99,199,255,0.35)' });

      // parry / dash readiness pips
      const px = bx + bw * 0.78 + 12;
      this.pip(px, y + 32, 1 - sc.player.dashCool / F.DASH_CD, 'Q', P.cool);
      this.pip(px + 30, y + 32, 1 - sc.player.parryCool / F.PARRY_CD, 'F', P.brassHi);
    },
    pip(x, y, frac, label, col) {
      const U = F.UI, g = U.g;
      const r = 12;
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.beginPath(); g.arc(x + r, y + r, r, 0, 7); g.fill();
      if (frac < 1) {
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.beginPath(); g.moveTo(x + r, y + r);
        g.arc(x + r, y + r, r - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * F.U.sat(frac));
        g.closePath(); g.fill();
      }
      g.strokeStyle = frac >= 1 ? col : 'rgba(255,255,255,0.18)'; g.lineWidth = 1.6;
      g.beginPath(); g.arc(x + r, y + r, r - 1, 0, 7); g.stroke();
      U.text(label, x + r, y + r + 5, { size: 13, weight: '700', align: 'center', col: frac >= 1 ? col : P.textFaint });
    },

    // ------------------------------------------------------------- plates
    depthPlate(sc) {
      const U = F.UI;
      const lv = sc.lv;
      const name = lv.name || (lv.B ? lv.B.name : '');
      const sub = lv.sub || '';
      U.text(name, U.W / 2, 34, { size: 19, weight: '600', display: true, align: 'center', col: P.brassHi, alpha: 0.9 });
      if (sub) U.text(sub, U.W / 2, 52, { size: 12, weight: '600', align: 'center', col: P.textDim, alpha: 0.85 });
    },

    purse(sc) {
      const U = F.UI, g = U.g, s = F.Game.s;
      const x = U.W - 26, y = 26;
      const items = [
        { icon: 'coin', col: P.gold, v: F.U.fmt(s.gold) },
        { icon: 'orb', col: P.magic, v: F.U.fmt(s.essence) },
        { icon: 'frag', col: P.cool, v: F.U.fmt(s.frags) },
      ];
      let cy = y;
      for (const it of items) {
        U.icon(it.icon, x - 116, cy + 10, 22, it.col);
        U.text(it.v, x - 96, cy + 17, { size: 16, weight: '700', col: it.col });
        cy += 26;
      }
      const totalOre = F.Game.totalOre();
      U.icon('ore_drop', x - 116, cy + 10, 20, '#b9c0cf');
      U.text(F.U.fmt(totalOre) + ' ore', x - 96, cy + 17, { size: 14, weight: '600', col: P.textDim });
    },

    // ------------------------------------------------------------ hotbar
    hotbar(sc) {
      const U = F.UI, g = U.g, s = F.Game.s, p = sc.player;
      const n = 2 + 6, sz = 52, gap = 7;
      const w = n * sz + (n - 1) * gap;
      const x0 = (U.W - w) / 2, y = U.H - sz - 22;

      for (let i = 0; i < n; i++) {
        const x = x0 + i * (sz + gap);
        const sel = (i === 0 && p.holding === 'pick') || (i === 1 && p.holding === 'weapon');
        const over = U.slot(x, y, sz, { selected: sel, empty: i >= 2 && !s.hotbar[i - 2] });
        if (i === 0) {
          const ic = F.PickIcon(s.pick);
          if (ic) g.drawImage(ic, x + 6, y + 4, sz - 12, sz - 8);
        } else if (i === 1) {
          const w2 = F.Game.equipped('weapon');
          if (w2) { const ic = F.ItemIcon(w2); if (ic) g.drawImage(ic, x + 5, y + 3, sz - 10, sz - 6); }
          else U.text('fists', x + sz / 2, y + sz / 2 + 4, { size: 11, align: 'center', col: P.textFaint });
        } else {
          const pid = s.hotbar[i - 2];
          if (pid) {
            const pot = F.POTIONS[pid];
            this.potionIcon(g, x + sz / 2, y + sz / 2, 17, pot.col);
            const cnt = s.potions[pid] || 0;
            U.text('' + cnt, x + sz - 6, y + sz - 6, { size: 13, weight: '700', align: 'right', col: cnt > 0 ? P.text : P.bad });
            if (cnt <= 0) { g.fillStyle = 'rgba(0,0,0,0.55)'; U.roundRect(x, y, sz, sz, 6); g.fill(); }
          }
        }
        U.text(i === 0 ? '1' : i === 1 ? '2' : '' + (i + 1), x + 5, y + 15, { size: 12, weight: '700', col: sel ? P.brassHi : P.textFaint });
        if (over && U.mclick && U.consume()) {
          if (i === 0) p.setHold('pick');
          else if (i === 1) p.setHold('weapon');
          else F.usePotion(i - 2);
        }
      }
      // what you are holding, named
      const held = p.holding === 'pick' ? F.PICKS[s.pick].n : (F.Game.equipped('weapon') ? F.Game.equipped('weapon').name : 'Bare Hands');
      U.text(held, U.W / 2, y - 12, { size: 14, weight: '600', align: 'center', col: P.textDim });
    },
    potionIcon(g, cx, cy, r, col) {
      g.save();
      g.shadowColor = col; g.shadowBlur = 12;
      g.fillStyle = 'rgba(10,8,14,0.9)';
      g.beginPath(); g.roundRect(cx - r * 0.62, cy - r * 0.9, r * 1.24, r * 1.8, r * 0.5); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.roundRect(cx - r * 0.48, cy - r * 0.15, r * 0.96, r * 1.0, r * 0.4); g.fill();
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.roundRect(cx - r * 0.34, cy + r * 0.05, r * 0.22, r * 0.5, r * 0.11); g.fill();
      g.fillStyle = '#6b5436';
      g.beginPath(); g.roundRect(cx - r * 0.26, cy - r * 1.06, r * 0.52, r * 0.34, 2); g.fill();
    },

    buffs(sc) {
      const U = F.UI, s = F.Game.s;
      let x = 26, y = 100;
      for (const id in s.buffs) {
        const pot = F.POTIONS[id];
        const col = pot ? pot.col : P.magic;
        const name = pot ? pot.n.split(' ')[0] : id;
        const t = s.buffs[id];
        const w = U.chip(x, y, name + '  ' + Math.ceil(t) + 's', col);
        x += w + 7;
        if (x > 420) { x = 26; y += 26; }
      }
    },

    questTrack(sc) {
      const U = F.UI, s = F.Game.s;
      const active = (s.quests || []).filter(q => !q.claimed).slice(0, 3);
      if (!active.length) return;
      const x = U.W - 300, y = 140;
      U.text('JOBS', x + 270, y, { size: 11, weight: '700', align: 'right', col: P.textFaint });
      let yy = y + 18;
      for (const q of active) {
        const col = q.done ? P.good : P.textDim;
        U.text(q.title, x + 270, yy, { size: 13.5, weight: '600', align: 'right', col, alpha: 0.95 });
        if (!q.done && q.need > 1) {
          U.bar(x + 170, yy + 6, 100, 5, q.prog / q.need, { col: P.brass, glow: false });
          U.text(q.prog + '/' + q.need, x + 162, yy + 11, { size: 11, align: 'right', col: P.textFaint });
        } else if (q.done) {
          U.text('ready to hand in', x + 270, yy + 15, { size: 11, align: 'right', col: P.good, alpha: 0.8 });
        }
        yy += q.done ? 36 : 30;
      }
    },

    // ----------------------------------------------------------- minimap
    minimap(sc) {
      const U = F.UI, g = U.g, lv = sc.lv;
      if (lv.noMap) return;
      const S = 168, x = U.W - S - 26, y = U.H - S - 26;
      g.save();
      g.globalAlpha = 0.9;
      U.panel(x, y, S, S, { r: 8, rivets: false });
      g.restore();
      const px = 3, iw = lv.w, ih = lv.h;
      const sx = (S - 14) / iw, sy = (S - 14) / ih;
      const s = Math.min(sx, sy);
      const ox = x + 7 + ((S - 14) - iw * s) / 2, oy = y + 7 + ((S - 14) - ih * s) / 2;
      if (!lv._mapCache) lv._mapCache = buildMap(lv);
      g.save();
      g.globalAlpha = 0.85;
      g.imageSmoothingEnabled = false;
      g.drawImage(lv._mapCache, ox, oy, iw * s, ih * s);
      g.restore();
      // exits
      for (const ex of lv.exits) {
        g.fillStyle = ex.kind === 'down' ? '#ffb347' : '#63c7ff';
        g.beginPath(); g.arc(ox + ex.x / F.TS * s, oy + ex.y / F.TS * s, 3, 0, 7); g.fill();
      }
      // the player
      const p = sc.player;
      g.save();
      g.shadowColor = '#ffffff'; g.shadowBlur = 8;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(ox + p.x / F.TS * s, oy + p.y / F.TS * s, 2.6, 0, 7); g.fill();
      g.restore();
    },

    prompt(sc) {
      const U = F.UI;
      if (!sc.prompt) return;
      const y = U.H - 132;
      const label = sc.prompt.label;
      const w = U.width(label, 16, '600') + 84;
      const x = (U.W - w) / 2;
      U.panel(x, y, w, 40, { r: 20, rivets: false });
      U.text('E', x + 24, y + 26, { size: 16, weight: '800', align: 'center', col: P.brassHi });
      const g = U.g;
      g.strokeStyle = P.brass; g.lineWidth = 1.4;
      U.roundRect(x + 11, y + 10, 26, 21, 5); g.stroke();
      U.text(label, x + 50, y + 26, { size: 16, weight: '600', col: P.text });
    },

    crosshair(sc) {
      const U = F.UI, g = U.g;
      if (F.Input.touch) return;
      const x = F.Input.mx * 2, y = F.Input.my * 2;
      const p = sc.player;
      const col = p.holding === 'pick' ? '#9fd8ff' : '#ffd8a0';
      g.save();
      g.globalAlpha = 0.85;
      g.strokeStyle = col; g.lineWidth = 1.6;
      g.beginPath(); g.arc(x, y, 7, 0, 7); g.stroke();
      g.beginPath();
      g.moveTo(x - 13, y); g.lineTo(x - 9, y);
      g.moveTo(x + 9, y); g.lineTo(x + 13, y);
      g.moveTo(x, y - 13); g.lineTo(x, y - 9);
      g.moveTo(x, y + 9); g.lineTo(x, y + 13);
      g.stroke();
      g.restore();
    },

    bossBar(sc) {
      const U = F.UI, g = U.g, b = sc.bossBar;
      const w = 760, x = (U.W - w) / 2, y = 96;
      U.text(b.name, U.W / 2, y - 16, { size: 26, weight: '700', display: true, align: 'center', col: P.brassHi, glow: 'rgba(255,90,40,0.5)' });
      U.bar(x, y, w, 20, b.hp / b.max, { col: '#c8324a', col2: '#ff6a7a', segs: b.phases || 4 });
      if (b.sub) U.text(b.sub, U.W / 2, y + 40, { size: 12.5, align: 'center', col: P.textDim, alpha: 0.9 });
      if (b.shield > 0) U.bar(x, y + 48, w, 6, b.shield, { col: P.cool, glow: false });
    },

    toasts() {
      const U = F.UI;
      let y = F.Game.world() && F.Game.world().bossBar ? 170 : 96;
      for (const t of F.Game.toasts) {
        const k = Math.min(1, t.t / 0.35);
        const a = Math.min(1, t.t / 0.4) * Math.min(1, (t.max - t.t) / 0.18);
        U.text(t.text, U.W / 2, y, { size: 19, weight: '700', display: true, align: 'center', col: t.col, alpha: a, glow: t.col, glowBlur: 12 });
        y += 28;
      }
    },

    intro(sc) {
      const U = F.UI;
      if (sc.introT <= 0 || sc.bossBar) return;
      const k = F.U.sat(sc.introT / 2.6);
      const a = Math.min(1, k * 2.4) * Math.min(1, (1 - k) * 6 + 0.3);
      const lv = sc.lv;
      U.text(lv.sub || '', U.W / 2, U.H / 2 - 34, { size: 15, weight: '600', align: 'center', col: P.textDim, alpha: a });
      U.text(lv.name || '', U.W / 2, U.H / 2 + 6, { size: 46, weight: '700', display: true, align: 'center', col: P.brassHi, alpha: a, glow: 'rgba(240,203,126,0.5)', glowBlur: 26 });
      U.rule(U.W / 2 - 180, U.H / 2 + 22, 360, 'rgba(199,154,78,' + (a * 0.7) + ')');
    },
  };

  /** Bake the level into a tiny bitmap once; redraw is then a single blit. */
  function buildMap(lv) {
    const c = document.createElement('canvas');
    c.width = lv.w; c.height = lv.h;
    const g = c.getContext('2d');
    const img = g.createImageData(lv.w, lv.h);
    const d = img.data;
    const floor = F.Col.parse(lv.B.floor[0]);
    const wall = F.Col.parse(F.Col.shade(lv.B.wall[0], 0.45));
    const liq = lv.B.liquid ? F.Col.parse(lv.B.liquid.col) : floor;
    for (let i = 0; i < lv.w * lv.h; i++) {
      const t = lv.tiles[i];
      const c2 = t === F.T.WALL ? wall : t === F.T.LIQUID ? liq : floor;
      d[i * 4] = c2[0]; d[i * 4 + 1] = c2[1]; d[i * 4 + 2] = c2[2];
      d[i * 4 + 3] = t === F.T.VOID ? 0 : 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  /** Drink whatever is in hotbar slot i. */
  F.usePotion = function (i) {
    const s = F.Game.s;
    const id = s.hotbar[i];
    if (!id) return;
    const n = s.potions[id] || 0;
    if (n <= 0) { F.Audio.error(); return; }
    const pot = F.POTIONS[id];
    s.potions[id] = n - 1;
    F.Audio.uiBig();
    const sc = F.Game.world();
    if (id === 'heal') {
      if (sc) sc.player.heal(F.Game.maxHp() * 0.45);
      else s.hp = Math.min(F.Game.maxHp(), s.hp + F.Game.maxHp() * 0.45);
    } else if (id === 'forgem') {
      s.forgeBonus = 8;
      F.Game.toast('The next forge will run true.', pot.col, 3);
    } else {
      F.Game.addBuff(id, pot.dur);
      F.Game.toast(pot.n, pot.col, 2.4);
    }
    if (sc) F.Particles.burst(sc.player.x, sc.player.y - 16, 14, {
      sprite: 'spark', col: pot.col, size: 3.4, size1: 0, life: 0.6,
      speed0: 10, speed1: 70, emis: 2.8, drag: 3, grav: -60,
    });
  };

})(window.F2 = window.F2 || {});
