'use strict';
// ---------------------------------------------------------------------------
// forgescene.js — the four-stage forge.
//
//   1  The Crucible   choose the melt. Ore count picks the class, ore kind
//                     picks the stats, the colours and the traits.
//   2  The Bellows    hold the heat inside a moving band.
//   3  The Pour       stop the mould at the right fill.
//   4  The Hammering  land shrinking-ring strikes on the beat.
//
// The three timed stages produce one number, quality, and quality is the
// biggest multiplier the player has any control over.
// ---------------------------------------------------------------------------
(function (F) {

  const P = F.PAL;
  const WEIGHTS = { bellows: 0.30, pour: 0.20, hammer: 0.50 };

  class ForgeScene {
    constructor() {
      this.stage = 0;
      this.t = 0;
      this.ores = {};
      this.kind = 'weapon';
      this.slot = 'chest';
      this.parts = {};
      this.fx = [];
      this.result = null;
      this.shake = 0;
      this.heat = 0;                 // 0..1, drives every colour on screen
      this.oreScroll = 0;
    }

    enter() { F.Audio.ui(); }

    // ------------------------------------------------------------- helpers
    total() { return F.Forge.total(this.ores); }
    add(id, n) {
      const have = F.Game.oreCount(id) - (this.ores[id] || 0);
      n = Math.min(n, have);
      if (n <= 0) { F.Audio.error(); return; }
      this.ores[id] = (this.ores[id] || 0) + n;
      F.Audio.ui();
    }
    remove(id, n) {
      if (!this.ores[id]) return;
      this.ores[id] = Math.max(0, this.ores[id] - n);
      if (!this.ores[id]) delete this.ores[id];
      F.Audio.ui();
    }
    clear() { this.ores = {}; F.Audio.ui(); }

    spark(x, y, n, col, opt) {
      opt = opt || {};
      for (let i = 0; i < n; i++) {
        const a = opt.dir === undefined ? Math.random() * 6.2832 : opt.dir + (Math.random() - 0.5) * (opt.spread || 2.4);
        const sp = F.U.rnd(opt.sp0 || 60, opt.sp1 || 420);
        this.fx.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: F.U.rnd(0.25, 0.9) * (opt.life || 1), max: 1,
          r: F.U.rnd(1.2, 3.4) * (opt.size || 1), col: col || '#ffd08a',
          grav: opt.grav === undefined ? 900 : opt.grav, drag: opt.drag || 1.6,
        });
      }
    }

    // -------------------------------------------------------------- update
    update(dt) {
      this.t += dt;
      this._lastDt = dt;
      this.shake = Math.max(0, this.shake - dt * 6);
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i];
        f.life -= dt;
        if (f.life <= 0) { this.fx.splice(i, 1); continue; }
        const k = Math.exp(-f.drag * dt);
        f.vx *= k; f.vy *= k; f.vy += f.grav * dt;
        f.x += f.vx * dt; f.y += f.vy * dt;
      }
      if (F.Input.hit('escape')) {
        if (this.stage === 0 || this.stage === 4) F.Game.pop();
        else F.Game.push(new F.ConfirmScene('Abandon the melt?', 'The ore goes back in the bin, but the heat is wasted.', () => { F.Game.pop(); }));
      }
      const press = F.Input.mclick || F.Input.hit('space');
      if (this.stage === 1) this.updateBellows(dt, press);
      else if (this.stage === 2) this.updatePour(dt, press);
      else if (this.stage === 3) this.updateHammer(dt, press);
      else if (this.stage === 4) this.result.reveal = Math.min(1, (this.result.reveal || 0) + dt * 0.9);
    }

    begin() {
      if (this.total() < F.Forge.MIN_ORE) { F.Audio.error(); return; }
      // commit the ore now so it cannot be spent twice
      for (const id in this.ores) F.Game.s.ores[id] = (F.Game.s.ores[id] || 0) - this.ores[id];
      this.stage = 1;
      this.bell = {
        t: 0, dur: 9, heat: 0.12, vel: 0, pumping: false,
        band: 0.55, bandW: 0.148, drift: 0.5, score: 0, inT: 0,
      };
      F.Audio.bellows();
    }

    // --------------------------------------------------------- 2. bellows
    updateBellows(dt, press) {
      const b = this.bell;
      const K = F.BELLOWS;
      b.t += dt;
      b.pumping = F.Input.mdown || F.Input.down('space');
      // the melt heats while you pump and loses it when you stop
      const target = b.pumping ? K.up : K.down;
      b.vel += (target - b.heat) * K.gain * dt;
      b.vel *= Math.exp(-K.damp * dt);
      b.heat = F.U.clamp(b.heat + b.vel * dt * K.rate, 0, 1);
      // the band wanders, so you cannot just park the needle
      b.drift += dt * K.drift;
      b.band = 0.52 + Math.sin(b.drift) * 0.23 + Math.sin(b.drift * 2.5) * 0.09;
      b.bandW = K.bandW - Math.min(K.narrow, b.t * K.narrowRate);
      const inBand = Math.abs(b.heat - b.band) < b.bandW / 2;
      if (inBand) { b.score += dt; b.inT += dt; }
      else b.inT = 0;
      this.heat = b.heat;
      if (b.pumping && Math.random() < dt * 34) {
        this.spark(F.UI.W / 2 - 210, 470, 1, '#ffb347', { dir: -1.3, spread: 1.0, sp0: 80, sp1: 260, grav: 500 });
        if (Math.random() < 0.25) F.Audio.bellows();
      }
      if (b.t >= b.dur) {
        // the divisor is what a full score costs in time inside the band; it is
        // the lever that sets how much of the stage a mid-skill player banks
        this.parts.bellows = F.U.sat(b.score / (b.dur * 0.82));
        this.stage = 2;
        this.pourS = { fill: 0, speed: 0.38, stopped: false, target: 0.78 + Math.random() * 0.14, t: 0, wobble: Math.random() * 6 };
        F.Audio.pour();
      }
    }

    // ------------------------------------------------------------ 3. pour
    updatePour(dt, press) {
      const p = this.pourS;
      p.t += dt;
      if (!p.stopped) {
        // the stream speeds up as the crucible empties
        p.fill += (p.speed + p.t * 0.085) * dt;
        this.spark(F.UI.W / 2, 300 + Math.random() * 90, 1, '#ffca6a', { dir: 1.57, spread: 0.3, sp0: 40, sp1: 120, grav: 700, size: 0.8 });
        if (press) {
          p.stopped = true;
          const err = Math.abs(p.fill - p.target);
          this.parts.pour = F.U.sat(1 - err / 0.225);
          F.Audio.quench();
          this.spark(F.UI.W / 2, 560, 26, '#ffd9a0', { sp0: 60, sp1: 320, grav: 600 });
          this.shake = 3;
          setTimeout(() => this.startHammer(), 700);
        } else if (p.fill > 1.25) {
          p.stopped = true;
          this.parts.pour = 0.05;
          F.Audio.error();
          F.Game.toast('Overpoured. Slag everywhere.', P.bad, 2.6);
          setTimeout(() => this.startHammer(), 700);
        }
      }
    }

    startHammer() {
      const n = F.U.clamp(4 + Math.floor(this.total() / 9), 4, 9);
      this.ham = {
        i: 0, n, hits: [], ring: 1.6, speed: 1.0, active: true,
        wait: 0.5, struck: false, best: 0.46,
      };
      this.ham.tol = 0.30;
      this.stage = 3;
    }

    // -------------------------------------------------------- 4. hammering
    updateHammer(dt, press) {
      const h = this.ham;
      if (h.wait > 0) { h.wait -= dt; return; }
      if (h.i >= h.n) return;
      // difficulty ramps: later strikes close faster and want a tighter window
      const spd = 0.94 + h.i * 0.09;
      h.ring -= dt * spd;
      if (press && !h.struck) {
        h.struck = true;
        const err = Math.abs(h.ring - h.best);
        const score = F.U.sat(1 - err / (h.tol || 0.30));
        h.hits.push(score);
        const perfect = score > 0.93, good = score > 0.70;
        F.Audio.forgeHit(score);
        this.shake = 2 + score * 5;
        const cx = F.UI.W / 2, cy = 400;
        this.spark(cx, cy, Math.round(10 + score * 34), perfect ? '#fff0c0' : good ? '#ffca6a' : '#c88a4a',
          { dir: -1.57, spread: 2.1, sp0: 90, sp1: 520 + score * 400, grav: 1100 });
        F.Game.toast(perfect ? 'PERFECT' : good ? 'Good' : score > 0.4 ? 'Off' : 'Bad strike',
          perfect ? P.brassHi : good ? P.good : P.bad, 0.9);
        h.i++; h.ring = 1.6; h.struck = false; h.wait = 0.34;
        if (h.i >= h.n) setTimeout(() => this.finish(), 620);
      } else if (h.ring < 0.04) {
        h.hits.push(0);
        F.Audio.error();
        F.Game.toast('Missed the beat', P.bad, 0.9);
        h.i++; h.ring = 1.6; h.struck = false; h.wait = 0.34;
        if (h.i >= h.n) setTimeout(() => this.finish(), 620);
      }
    }

    finish() {
      const h = this.ham;
      let sum = 0;
      for (const v of h.hits) sum += v;
      this.parts.hammer = h.hits.length ? sum / h.hits.length : 0;

      let q = (this.parts.bellows * WEIGHTS.bellows + this.parts.pour * WEIGHTS.pour + this.parts.hammer * WEIGHTS.hammer) * 100;
      // a floor so a real attempt is never worthless, and the bonuses on top
      q = 14 + q * 0.86;
      q += F.Game.raceMod('quality');
      q += F.Game.s.forgeBonus || 0;
      F.Game.s.forgeBonus = 0;
      q = F.U.clamp(q, 0, 100);

      const it = F.Forge.create({ kind: this.kind, slot: this.slot, ores: this.ores, quality: q }, 0);
      F.Game.addItem(it);
      this.result = { item: it, q, reveal: 0 };
      this.stage = 4;
      F.Audio.quench();
      if (it.master) { F.Audio.levelUp(); F.Game.toast('MASTERWORK', P.brassHi, 5); }
      this.spark(F.UI.W / 2, 380, 60, it.color, { sp0: 60, sp1: 460, grav: 500 });
      F.Game.save();
    }

    // --------------------------------------------------------------- draw
    draw() {
      const U = F.UI, g = U.g;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      const sx = (Math.random() - 0.5) * this.shake * 2, sy = (Math.random() - 0.5) * this.shake * 2;
      g.save();
      g.translate(sx, sy);
      this.backdrop();
      if (this.stage === 0) this.drawCrucible();
      else if (this.stage === 1) this.drawBellows();
      else if (this.stage === 2) this.drawPour();
      else if (this.stage === 3) this.drawHammer();
      else this.drawResult();
      this.drawFx();
      g.restore();
      U.end();
    }

    backdrop() {
      const U = F.UI, g = U.g;
      g.fillStyle = 'rgba(5,3,7,0.90)';
      g.fillRect(-20, -20, U.W + 40, U.H + 40);
      // the furnace mouth behind everything, brightening with the heat
      const heat = this.stage === 1 ? this.heat : this.stage >= 2 ? 0.8 : 0.35;
      const cx = U.W / 2, cy = 300;
      const r = 420 + heat * 140;
      const grad = g.createRadialGradient(cx, cy, 20, cx, cy, r);
      const c0 = F.Col.mix('#3a1206', '#ffd08a', heat);
      grad.addColorStop(0, 'rgba(' + F.Col.parse(c0).join(',') + ',' + (0.30 + heat * 0.42) + ')');
      grad.addColorStop(0.45, 'rgba(120,36,8,' + (0.14 + heat * 0.20) + ')');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, U.W, U.H);
      // stone arch
      g.strokeStyle = 'rgba(199,154,78,0.20)'; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy + 120, 300, Math.PI, 0); g.stroke();
      // stage ribbon
      const names = ['THE CRUCIBLE', 'THE BELLOWS', 'THE POUR', 'THE HAMMERING', ''];
      if (this.stage < 4) {
        U.text(names[this.stage], cx, 62, {
          size: 30, weight: '700', display: true, align: 'center',
          col: P.brassHi, glow: 'rgba(255,150,50,0.45)', glowBlur: 24,
        });
        // progress pips
        for (let i = 0; i < 4; i++) {
          const px = cx - 60 + i * 40;
          g.fillStyle = i < this.stage ? P.brass : i === this.stage ? P.brassHi : '#2e2838';
          g.beginPath(); g.arc(px, 84, i === this.stage ? 6 : 4, 0, 7); g.fill();
        }
      }
    }

    drawFx() {
      const g = F.UI.g;
      for (const f of this.fx) {
        const a = F.U.sat(f.life * 2.2);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.shadowColor = f.col; g.shadowBlur = 10;
        g.fillStyle = f.col; g.globalAlpha = a;
        g.beginPath(); g.arc(f.x, f.y, f.r * (0.4 + a * 0.8), 0, 7); g.fill();
        g.restore();
      }
    }

    // ------------------------------------------------------- 1. crucible
    drawCrucible() {
      const U = F.UI, g = U.g, s = F.Game.s;
      const total = this.total();

      // ---------- left: the ore bins
      const lx = 28, ly = 108, lw = 372, lh = 556;
      U.panel(lx, ly, lw, lh, { title: 'Ore Store' });
      const ids = F.ORE_IDS.filter(id => (s.ores[id] || 0) > 0 || (this.ores[id] || 0) > 0);
      const cols = 2, cw = (lw - 44) / cols, chh = 46;
      let i = 0;
      for (const id of ids) {
        const O = F.ORES[id];
        const cx = lx + 22 + (i % cols) * cw, cy = ly + 56 + Math.floor(i / cols) * chh;
        if (cy > ly + lh - 100) break;
        const have = (s.ores[id] || 0) - (this.ores[id] || 0);
        const over = U.row(cx, cy, cw - 8, chh - 6, { key: 'ore' + id });
        U.icon('ore_drop', cx + 20, cy + 20, 24, O.col);
        U.text(O.n, cx + 38, cy + 18, { size: 13.5, weight: '600', col: have > 0 ? P.text : P.textFaint });
        U.text(ROLE[O.role], cx + 38, cy + 32, { size: 10.5, col: roleCol(O.role) });
        U.text('' + have, cx + cw - 18, cy + 25, { size: 15, weight: '700', align: 'right', col: have > 0 ? P.text : P.textFaint });
        if (over) {
          if (U.mclick && U.consume()) this.add(id, F.Input.down('shift') ? 10 : 1);
          if (F.Input.rclick) this.remove(id, F.Input.down('shift') ? 10 : 1);
          this.tipOre = { id, x: U.mx, y: U.my };
        }
        i++;
      }
      U.text('Click to add   ·   Shift-click for ten   ·   Right-click to take back',
        lx + lw / 2, ly + lh - 22, { size: 11.5, align: 'center', col: P.textFaint });

      // ---------- centre: the crucible
      const cx = U.W / 2, cy = 372;
      const colX = lx + lw + 18, colW = (U.W - 28) - (colX) - 372 - 18;
      this.drawMelt(cx, cy, total);

      // what kind of thing are we making
      const kinds = [['weapon', 'Weapon'], ['head', 'Helm'], ['chest', 'Chest'], ['legs', 'Greaves'], ['boots', 'Boots']];
      const kw = Math.floor(colW / kinds.length);
      const kx = cx - (kinds.length * kw) / 2;
      for (let k = 0; k < kinds.length; k++) {
        const id = kinds[k][0];
        const on = (id === 'weapon') ? this.kind === 'weapon' : (this.kind === 'armor' && this.slot === id);
        if (U.btn(kx + k * kw + 2, 112, kw - 4, 38, kinds[k][1], { primary: on, size: 13 })) {
          if (id === 'weapon') this.kind = 'weapon';
          else { this.kind = 'armor'; this.slot = id; }
        }
      }

      // ---------- right: live preview
      const rx = U.W - 400, ry = 108, rw = 372, rh = 556;
      U.panel(rx, ry, rw, rh, { title: 'What It Will Be' });
      const prev = F.Forge.preview(this.kind, this.slot, this.ores, 70);
      if (!prev) {
        U.text('Put at least ' + F.Forge.MIN_ORE + ' ore in the crucible.', rx + rw / 2, ry + 200,
          { size: 16, align: 'center', col: P.textDim });
        U.para('More ore makes a bigger, heavier thing. Better ore makes a stronger one. Trait ore, at about a fifth of the melt or more, makes it do something.',
          rx + 32, ry + 236, rw - 64, { size: 14, col: P.textFaint, align: 'center' });
      } else {
        const ic = F.ItemIcon(prev);
        if (ic) {
          g.save();
          g.imageSmoothingEnabled = false;         // keep the generated art crisp
          g.shadowColor = prev.color; g.shadowBlur = 22;
          const isz = 160;
          g.drawImage(ic, rx + rw / 2 - isz / 2, ry + 52, isz, isz * (ic.height / ic.width));
          g.restore();
        }
        let yy = ry + 258;
        U.text(className(prev), rx + rw / 2, yy, { size: 22, weight: '700', display: true, align: 'center', col: prev.color });
        yy += 26;
        U.text(F.ORES[prev.mainOre].n + ' · ' + total + ' ore', rx + rw / 2, yy, { size: 13, align: 'center', col: P.textDim });
        yy += 30;
        U.rule(rx + 40, yy, rw - 80); yy += 24;
        if (prev.kind === 'weapon') {
          statLine(rx + 44, yy, rw - 88, 'Damage', prev.stats.dmg.toFixed(1)); yy += 24;
          statLine(rx + 44, yy, rw - 88, 'Swing', prev.stats.cd.toFixed(2) + 's'); yy += 24;
          statLine(rx + 44, yy, rw - 88, 'Reach', '' + prev.stats.range); yy += 24;
          statLine(rx + 44, yy, rw - 88, 'Stamina', '' + prev.stats.sta); yy += 24;
        } else {
          statLine(rx + 44, yy, rw - 88, 'Defence', prev.stats.def.toFixed(1)); yy += 24;
          statLine(rx + 44, yy, rw - 88, 'Health', '+' + prev.stats.hp); yy += 24;
          statLine(rx + 44, yy, rw - 88, 'Weight', (prev.stats.slow * 100).toFixed(1) + '% slower'); yy += 24;
        }
        yy += 8;
        if (prev.traits.length) {
          for (const tr of prev.traits) {
            const T = F.TRAITS[tr.id];
            U.chip(rx + 44, yy, T.n, T.col);
            yy += 28;
            yy += U.para(prev.kind === 'weapon' ? T.wdesc : T.adesc, rx + 44, yy + 4, rw - 88,
              { size: 12, col: P.textDim, lh: 16 }) + 8;
          }
        } else {
          U.text('No trait — add a fifth of the melt in trait ore.', rx + rw / 2, yy + 14,
            { size: 12, align: 'center', col: P.textFaint });
          yy += 28;
        }
        yy = ry + rh - 64;
        U.text('Rough value at Fine quality: ' + F.U.fmt(F.Forge.sellValue(this.ores, 72)) + ' gold',
          rx + rw / 2, yy, { size: 12.5, align: 'center', col: P.gold });
      }

      // ---------- the melt bar and the commit button
      const bw = colW - 16, bx = cx - bw / 2;
      this.drawMeltBar(bx, 530, bw, 20);
      if (U.btn(cx - colW / 2 + 6, 606, colW / 2 - 12, 44, 'EMPTY IT', { disabled: total === 0, size: 15 })) this.clear();
      if (U.btn(cx + 6, 606, colW / 2 - 12, 44, 'HEAT THE MELT', { primary: true, display: true, size: 15, disabled: total < F.Forge.MIN_ORE })) this.begin();
      if (U.btn(cx - colW / 2 + 6, 656, colW - 12, 38, 'LEAVE THE FORGE', { size: 14 })) F.Game.pop();

      if (this.tipOre && U.hot && String(U.hot).indexOf('ore') === 0) {
        const O = F.ORES[this.tipOre.id];
        const lines = [
          { t: O.n, size: 17, weight: '700', col: O.col, display: true },
          { t: ROLE_LONG[O.role], size: 12, col: roleCol(O.role) },
          { gap: 6 },
          { t: 'Stat multiplier ×' + O.mult.toFixed(2), size: 13 },
          { t: 'Worth ' + O.val + ' gold each', size: 13, col: P.gold },
        ];
        if (O.trait) lines.push({ gap: 6 }, { t: F.TRAITS[O.trait].n, size: 13, col: F.TRAITS[O.trait].col },
          { t: this.kind === 'weapon' ? F.TRAITS[O.trait].wdesc : F.TRAITS[O.trait].adesc, size: 12, col: P.textDim });
        U.tip(this.tipOre.x, this.tipOre.y, lines, { frame: O.col });
      }
      this.tipOre = null;
    }

    /** The crucible bowl, with the melt layered by ore. */
    drawMelt(cx, cy, total) {
      const U = F.UI, g = U.g;
      const R = 104;
      g.save();
      // bowl
      g.fillStyle = '#231d24';
      g.beginPath(); g.ellipse(cx, cy, R, R * 0.52, 0, 0, 7); g.fill();
      g.strokeStyle = '#4a4150'; g.lineWidth = 6;
      g.beginPath(); g.ellipse(cx, cy, R, R * 0.52, 0, 0, 7); g.stroke();
      g.strokeStyle = '#6a5f74'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(cx, cy, R - 4, R * 0.52 - 4, 0, 0, 7); g.stroke();
      // the melt: concentric rings, one per ore, sized by share
      if (total > 0) {
        const ids = Object.keys(this.ores).sort((a, b) => this.ores[b] - this.ores[a]);
        let acc = 0;
        const fill = Math.min(1, total / 60) * 0.88 + 0.12;
        for (const id of ids) {
          acc += this.ores[id] / total;
          const rr = (R - 12) * Math.sqrt(acc) * fill;
          const O = F.ORES[id];
          g.save();
          g.shadowColor = O.col; g.shadowBlur = 22;
          const grad = g.createRadialGradient(cx - rr * 0.2, cy - rr * 0.2, 2, cx, cy, Math.max(4, rr));
          grad.addColorStop(0, F.Col.mix(O.col, '#ffffff', 0.35));
          grad.addColorStop(1, O.col2);
          g.fillStyle = grad;
          g.beginPath(); g.ellipse(cx, cy, rr, rr * 0.52, 0, 0, 7); g.fill();
          g.restore();
        }
        // a slow swirl on the surface
        g.save();
        g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.20;
        for (let i = 0; i < 4; i++) {
          const a = this.t * (0.5 + i * 0.2) + i * 1.7;
          const rr = (R - 26) * (0.3 + i * 0.16) * fill;
          g.fillStyle = '#ffd9a0';
          g.beginPath(); g.ellipse(cx + Math.cos(a) * rr * 0.4, cy + Math.sin(a) * rr * 0.2, rr * 0.35, rr * 0.16, 0, 0, 7); g.fill();
        }
        g.restore();
      } else {
        U.text('empty', cx, cy + 6, { size: 16, align: 'center', col: P.textFaint });
      }
      g.restore();
      U.text(total + (total === 1 ? ' piece of ore' : ' pieces of ore'), cx, cy + 92,
        { size: 15, weight: '600', align: 'center', col: total >= F.Forge.MIN_ORE ? P.text : P.bad });
    }

    /** The class ladder, so the player can see the next threshold coming. */
    drawMeltBar(x, y, w, h) {
      const UU = F.UI;
      UU.text('WHAT THE COUNT MAKES', x + w / 2, y - 52, { size: 11, weight: '700', align: 'center', col: F.PAL.textFaint });
      const U = F.UI, g = U.g;
      const total = this.total();
      const order = this.kind === 'weapon' ? F.CLS_ORDER : F.ARM_ORDER;
      const table = this.kind === 'weapon' ? F.CLS : F.ARMOR_CLS;
      const max = table[order[order.length - 1]].min + 14;
      g.fillStyle = 'rgba(0,0,0,0.6)';
      U.roundRect(x, y, w, h, h / 2); g.fill();
      const cur = F.Forge.classFor(order, table, total);
      const f = F.U.sat(total / max);
      const grad = g.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, '#6a4a1a'); grad.addColorStop(1, P.brassHi);
      g.fillStyle = grad;
      U.roundRect(x + 2, y + 2, Math.max(4, (w - 4) * f), h - 4, h / 2); g.fill();
      for (const id of order) {
        const px = x + w * F.U.sat(table[id].min / max);
        g.strokeStyle = total >= table[id].min ? 'rgba(255,240,200,0.8)' : 'rgba(255,255,255,0.22)';
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(px, y - 4); g.lineTo(px, y + h + 4); g.stroke();
        U.text(table[id].n, px, y + h + 14 + (order.indexOf(id) % 2) * 14, {
          size: 10.5, align: 'center', weight: id === cur ? '700' : '500',
          col: id === cur ? P.brassHi : total >= table[id].min ? P.textDim : P.textFaint,
        });
      }
    }

    // -------------------------------------------------------- 2. bellows
    drawBellows() {
      const U = F.UI, g = U.g, b = this.bell;
      const cx = U.W / 2, cy = 372;
      U.para('Hold to pump. Keep the melt inside the band — the band will not hold still.',
        cx - 330, 124, 660, { size: 15, col: P.textDim, align: 'center' });

      // ---- the furnace mouth
      g.save();
      g.fillStyle = '#17121a';
      U.roundRect(cx - 200, cy - 118, 400, 224, 18); g.fill();
      g.strokeStyle = '#3b3346'; g.lineWidth = 8;
      U.roundRect(cx - 200, cy - 118, 400, 224, 18); g.stroke();
      g.strokeStyle = P.brassDim; g.lineWidth = 2;
      U.roundRect(cx - 192, cy - 110, 384, 208, 14); g.stroke();
      // Firebrick inside. A forge that is dark when it is cold reads as an empty
      // box, so the bed never drops below a low burn — what the bellows changes
      // is how violently it burns, not whether it is alight at all.
      g.beginPath(); U.roundRect(cx - 186, cy - 104, 372, 196, 12); g.clip();
      g.fillStyle = '#1b1114'; g.fillRect(cx - 200, cy - 118, 400, 224);
      // the brick courses at the back of the mouth
      g.save(); g.globalAlpha = 0.5;
      for (let row = 0; row < 5; row++) {
        const y = cy - 104 + row * 26, off = (row % 2) * 24;
        for (let i = -1; i < 9; i++) {
          g.fillStyle = row % 2 ? '#2a1f22' : '#241a1d';
          g.fillRect(cx - 186 + off + i * 48, y, 45, 23);
        }
      }
      g.restore();
      const burn = 0.22 + b.heat * 0.78;
      // the glow sits over the bed rather than washing the whole mouth: fill the
      // box with the heat colour at full heat and the firebrick disappears
      const bg = g.createRadialGradient(cx, cy + 52, 10, cx, cy + 52, 210);
      bg.addColorStop(0, 'rgba(' + F.Col.parse(heatColour(Math.max(0.16, b.heat))).join(',') + ',' + (0.22 + burn * 0.40) + ')');
      bg.addColorStop(0.55, 'rgba(' + F.Col.parse(heatColour(Math.max(0.10, b.heat * 0.6))).join(',') + ',' + (0.10 + burn * 0.20) + ')');
      bg.addColorStop(1, 'rgba(20,8,6,0.55)');
      g.fillStyle = bg; g.fillRect(cx - 200, cy - 118, 400, 224);
      // the coal bed
      for (let i = 0; i < 34; i++) {
        const a = (i * 2.399) % 6.2832, rr = 24 + (i % 8) * 21;
        const px = cx + Math.cos(a) * rr, py = cy + 54 + Math.sin(a) * rr * 0.34;
        const gl = F.U.sat(Math.max(0.14, b.heat) * (0.55 + 0.45 * Math.sin(this.t * 3 + i)));
        g.fillStyle = F.Col.mix('#241416', heatColour(gl), 0.88);
        g.beginPath(); g.ellipse(px, py, 7 + (i % 3) * 3, 5 + (i % 3) * 2, 0, 0, 7); g.fill();
        // the seam of live coal between the lumps
        g.save(); g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.25 + burn * 0.4;
        g.fillStyle = heatColour(F.U.sat(gl + 0.18));
        g.beginPath(); g.ellipse(px + 3, py + 2, 3 + (i % 3), 1.6 + (i % 2), 0, 0, 7); g.fill();
        g.restore();
      }
      // flame tongues off the bed, leaning with the blast
      g.save(); g.globalCompositeOperation = 'lighter';
      const lean = b.pumping ? 26 : 0;
      for (let i = 0; i < 13; i++) {
        const ph = this.t * (2.1 + (i % 4) * 0.55) + i * 1.7;
        const fx = cx - 150 + i * 25 + Math.sin(ph * 0.7) * 6;
        const h = (26 + Math.sin(ph) * 12) * (0.35 + burn * 1.25);
        const fy = cy + 52;
        const fg = g.createLinearGradient(fx, fy, fx + lean * 0.4, fy - h);
        fg.addColorStop(0, 'rgba(255,150,40,' + (0.12 + burn * 0.16) + ')');
        fg.addColorStop(0.55, 'rgba(255,90,20,' + (0.07 + burn * 0.11) + ')');
        fg.addColorStop(1, 'rgba(120,20,0,0)');
        g.fillStyle = fg;
        g.beginPath();
        g.moveTo(fx - 10, fy + 4);
        g.quadraticCurveTo(fx - 5 + lean * 0.2, fy - h * 0.6, fx + lean * 0.4, fy - h);
        g.quadraticCurveTo(fx + 6 + lean * 0.2, fy - h * 0.55, fx + 10, fy + 4);
        g.closePath(); g.fill();
      }
      // embers lifting off the bed and dying against the arch
      for (let i = 0; i < 20; i++) {
        const ph = (this.t * (0.35 + (i % 5) * 0.09) + i * 0.137) % 1;
        const ex = cx - 160 + ((i * 97) % 320) + Math.sin(this.t * 1.7 + i) * 9;
        const ey = cy + 58 - ph * 150;
        g.globalAlpha = (1 - ph) * (0.25 + burn * 0.6);
        g.fillStyle = heatColour(0.55 + (i % 3) * 0.15);
        g.beginPath(); g.arc(ex, ey, 1 + (i % 3) * 0.7, 0, 7); g.fill();
      }
      g.restore();
      g.restore();

      // ---- the ingot on the hearth
      const col = heatColour(b.heat);
      g.save();
      g.fillStyle = '#20191f';
      U.roundRect(cx - 92, cy - 30, 184, 58, 9); g.fill();
      g.shadowColor = col; g.shadowBlur = 24 + b.heat * 70;
      g.fillStyle = col; g.globalAlpha = 0.35 + b.heat * 0.65;
      U.roundRect(cx - 86, cy - 26, 172, 50, 8); g.fill();
      g.restore();
      // a hotter core down the middle of the bar
      g.save();
      g.globalCompositeOperation = 'lighter';
      const ig = g.createLinearGradient(0, cy - 26, 0, cy + 24);
      ig.addColorStop(0, 'rgba(255,255,255,' + (0.10 + b.heat * 0.30) + ')');
      ig.addColorStop(0.5, 'rgba(255,220,160,' + (0.06 + b.heat * 0.22) + ')');
      ig.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = ig;
      U.roundRect(cx - 86, cy - 26, 172, 50, 8); g.fill();
      g.restore();
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3;
      U.roundRect(cx - 86, cy - 26, 172, 50, 8); g.stroke();
      // grooves down the bar. They have to deepen as it heats, or a white-hot
      // ingot loses its form entirely and reads as a blank swatch.
      g.save(); g.globalAlpha = 0.22 + b.heat * 0.26; g.fillStyle = '#000';
      for (let i = 0; i < 6; i++) g.fillRect(cx - 76 + i * 28, cy - 22, 3, 42);
      g.globalAlpha = 0.16 + b.heat * 0.20;
      g.fillRect(cx - 86, cy + 14, 172, 10);
      g.restore();

      // the gauge
      const gx = cx + 250, gy = 190, gw = 66, gh = 360;
      g.fillStyle = 'rgba(0,0,0,0.65)';
      U.roundRect(gx, gy, gw, gh, 10); g.fill();
      // the column itself carries the heat scale, so the needle has something
      // to be read against rather than floating in a black slot
      g.save();
      g.beginPath(); U.roundRect(gx + 2, gy + 2, gw - 4, gh - 4, 8); g.clip();
      const cg = g.createLinearGradient(0, gy + gh, 0, gy);
      for (let i = 0; i <= 8; i++) cg.addColorStop(i / 8, heatColour(i / 8));
      g.globalAlpha = 0.22; g.fillStyle = cg;
      g.fillRect(gx + 2, gy + 2, gw - 4, gh - 4);
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(239,230,218,0.30)'; g.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        const y = gy + gh - (i / 10) * gh, lng = i % 5 === 0 ? 16 : 9;
        g.beginPath(); g.moveTo(gx + 2, y); g.lineTo(gx + 2 + lng, y); g.stroke();
        g.beginPath(); g.moveTo(gx + gw - 2, y); g.lineTo(gx + gw - 2 - lng, y); g.stroke();
      }
      g.restore();
      // the band
      const bandY = gy + gh - (b.band + b.bandW / 2) * gh;
      const bandH = b.bandW * gh;
      g.save();
      g.shadowColor = '#6ee787'; g.shadowBlur = 18;
      g.fillStyle = 'rgba(110,231,135,0.28)';
      U.roundRect(gx + 3, bandY, gw - 6, bandH, 6); g.fill();
      g.strokeStyle = '#6ee787'; g.lineWidth = 2;
      U.roundRect(gx + 3, bandY, gw - 6, bandH, 6); g.stroke();
      g.restore();
      // the needle — always visible, even stone cold
      const ny = gy + gh - F.U.clamp(b.heat, 0.008, 1) * gh;
      g.save();
      g.shadowColor = col; g.shadowBlur = 22;
      g.fillStyle = col;
      U.roundRect(gx - 12, ny - 6, gw + 24, 12, 6); g.fill();
      g.restore();
      g.strokeStyle = '#efe6da'; g.lineWidth = 1.6;
      U.roundRect(gx - 12, ny - 6, gw + 24, 12, 6); g.stroke();
      g.fillStyle = '#efe6da';
      g.beginPath(); g.moveTo(gx - 20, ny); g.lineTo(gx - 12, ny - 6); g.lineTo(gx - 12, ny + 6); g.closePath(); g.fill();
      g.strokeStyle = P.brass; g.lineWidth = 1.6;
      U.roundRect(gx, gy, gw, gh, 10); g.stroke();
      U.text('HEAT', gx + gw / 2, gy - 12, { size: 12, weight: '700', align: 'center', col: P.textDim });

      // ---- the bellows: two boards hinged at the nozzle with pleated leather
      // between them. It was a flat pentagon before, which collapsed into a
      // stack of tan rectangles the moment it shut.
      //
      // Built in local space with the hinge at the origin and the body running
      // out along +x, then mirrored into place — so the nozzle ends up pointing
      // at the hearth and the handle at the far end, rather than the reverse.
      const bw = 210, bhh = 132;
      const hx = cx - 232, hy = cy + 6;
      const shut = b.pumping ? 1 : 0;
      b.swing = b.swing === undefined ? 0 : b.swing + (shut - b.swing) * Math.min(1, dtSafe(this) * 9);
      // it never shuts flat: a bellows with no air in it reads as a pair of tongs
      const gap = (bhh / 2) * (1 - b.swing * 0.52);

      g.save();
      g.translate(hx, hy); g.scale(-1, 1);
      // leather between the boards, pleated
      const leather = g.createLinearGradient(0, -gap, 0, gap);
      leather.addColorStop(0, '#5b4029'); leather.addColorStop(0.5, '#3a2817'); leather.addColorStop(1, '#4e3722');
      g.fillStyle = leather;
      g.beginPath();
      g.moveTo(8, -9);
      g.lineTo(bw * 0.92, -gap - 2);
      g.lineTo(bw * 0.92, gap + 2);
      g.lineTo(8, 9);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.42)'; g.lineWidth = 2;
      for (let i = 1; i < 7; i++) {
        const t2 = i / 7, xx = 8 + (bw * 0.92 - 8) * t2;
        const yy = 9 + (gap - 7) * t2;
        g.beginPath(); g.moveTo(xx, -yy); g.lineTo(xx, yy); g.stroke();
      }
      // a highlight down the top of the bag so it has volume
      g.save(); g.globalAlpha = 0.16; g.fillStyle = '#c9a26a';
      g.beginPath();
      g.moveTo(8, -9); g.lineTo(bw * 0.92, -gap - 2);
      g.lineTo(bw * 0.92, -gap + 10); g.lineTo(8, -3);
      g.closePath(); g.fill(); g.restore();
      // the two boards
      for (const dir of [-1, 1]) {
        const tipY = dir * gap;
        const wg = g.createLinearGradient(0, tipY, bw, tipY + dir * 26);
        wg.addColorStop(0, '#4a3422'); wg.addColorStop(0.45, '#6b4e30'); wg.addColorStop(1, '#3f2c1c');
        g.fillStyle = wg;
        g.beginPath();
        g.moveTo(0, dir * 10);
        g.lineTo(bw * 0.26, tipY * 0.90);
        g.lineTo(bw, tipY + dir * 14);
        g.lineTo(bw, tipY + dir * 32);
        g.lineTo(bw * 0.24, tipY * 0.90 + dir * 17);
        g.closePath(); g.fill();
        g.strokeStyle = '#2a1c11'; g.lineWidth = 2; g.stroke();
        g.strokeStyle = '#6d6673'; g.lineWidth = 3;
        g.beginPath();
        g.moveTo(bw * 0.36, tipY * 0.90 + dir * 6);
        g.lineTo(bw * 0.94, tipY + dir * 22);
        g.stroke();
        g.fillStyle = '#9a92a6';
        for (let i = 0; i < 4; i++) {
          const t2 = 0.42 + i * 0.16;
          g.beginPath();
          g.arc(bw * t2, tipY * (0.90 + i * 0.024) + dir * (7 + i * 3.4), 2.1, 0, 7); g.fill();
        }
      }
      // the handle on the top board, out at the far end
      g.fillStyle = '#33240f';
      U.roundRect(bw - 15, -gap - 30, 16, 34, 5); g.fill();
      g.strokeStyle = '#7d5c38'; g.lineWidth = 2;
      U.roundRect(bw - 15, -gap - 30, 16, 34, 5); g.stroke();
      // hinge collar, then the nozzle running out toward the hearth
      g.fillStyle = '#6d6673';
      U.roundRect(-3, -14, 10, 28, 3); g.fill();
      g.fillStyle = '#4a4650';
      U.roundRect(-26, -9, 26, 18, 4); g.fill();
      g.fillStyle = '#5c5766';
      U.roundRect(-30, -11, 8, 22, 3); g.fill();
      g.restore();

      // the blast into the hearth
      if (b.swing > 0.15) {
        g.save(); g.globalCompositeOperation = 'lighter';
        g.globalAlpha = b.swing;
        const grad = g.createLinearGradient(hx + 30, hy, cx - 190, hy);
        grad.addColorStop(0, 'rgba(255,205,140,0.34)');
        grad.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(hx + 30, hy - 8);
        g.lineTo(cx - 186, hy - 34);
        g.lineTo(cx - 186, hy + 34);
        g.lineTo(hx + 30, hy + 8);
        g.closePath(); g.fill();
        g.restore();
      }

      // time and score
      const tw = 420, tx = cx - tw / 2;
      U.bar(tx, 600, tw, 14, 1 - b.t / b.dur, { col: P.brass, glow: false });
      U.text('IN THE BAND  ' + Math.round(F.U.sat(b.score / (b.dur * 0.62)) * 100) + '%',
        cx, 640, { size: 16, weight: '700', align: 'center', col: P.good });
      U.text(F.Input.touch ? 'HOLD ANYWHERE TO PUMP' : 'HOLD LEFT MOUSE OR SPACE', cx, 668,
        { size: 12, align: 'center', col: P.textFaint });
    }

    // ------------------------------------------------------------ 3. pour
    drawPour() {
      const U = F.UI, g = U.g, p = this.pourS;
      const cx = U.W / 2;
      U.para('Stop the pour inside the green. Too little and it is thin; too much and it is slag.',
        cx - 330, 124, 660, { size: 15, col: P.textDim, align: 'center' });

      const mw = 300, mh = 220, mx = cx - mw / 2, my = 400;
      const fh = F.U.clamp(p.fill, 0, 1.3) * mh;
      const surfY = my + mh - fh;

      // ---- the crucible. A rotated ellipse outline reads as a hole in the
      // screen; what makes it a vessel is a lip, a wall thickness, and the
      // melt you can see sitting in it.
      const tilt = p.stopped ? 0.16 : 0.66;
      g.save();
      g.translate(cx - 36, 246);
      g.rotate(tilt);
      // the bail, behind the body
      g.strokeStyle = '#59535f'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.arc(0, -6, 58, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      // body: a tapering crucible seen from the side
      const bodyG = g.createLinearGradient(-70, 0, 70, 0);
      bodyG.addColorStop(0, '#191319'); bodyG.addColorStop(0.42, '#342c38'); bodyG.addColorStop(1, '#17121a');
      g.fillStyle = bodyG;
      g.beginPath();
      g.moveTo(-72, -8); g.lineTo(72, -8);
      g.lineTo(46, 54); g.quadraticCurveTo(0, 68, -46, 54);
      g.closePath(); g.fill();
      g.strokeStyle = '#4a4150'; g.lineWidth = 4; g.stroke();
      // the mouth, and the melt in it
      g.fillStyle = '#120d13';
      g.beginPath(); g.ellipse(0, -8, 72, 22, 0, 0, 7); g.fill();
      const meltG = g.createRadialGradient(-14, -14, 4, 0, -8, 70);
      meltG.addColorStop(0, '#fff2c8'); meltG.addColorStop(0.5, '#ffa832'); meltG.addColorStop(1, '#b83c06');
      g.save(); g.globalAlpha = p.stopped ? 0.35 : 1;
      g.fillStyle = meltG;
      g.beginPath(); g.ellipse(0, -8, 64, 17, 0, 0, 7); g.fill();
      g.restore();
      // the rim the melt runs over
      g.strokeStyle = '#6d6673'; g.lineWidth = 5;
      g.beginPath(); g.ellipse(0, -8, 72, 22, 0, 0, 7); g.stroke();
      g.strokeStyle = '#9a92a6'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, -10, 72, 22, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
      g.restore();

      // ---- the stream, narrowing as it falls and landing in the metal
      if (!p.stopped) {
        // the lip of the tilted crucible, so the stream leaves the metal
        // rather than starting in mid-air below it
        const x0 = cx + 26, y0 = 284;
        g.save();
        g.globalCompositeOperation = 'lighter';
        const wob = (yy) => Math.sin(this.t * 9 + p.wobble + yy * 0.02) * 3;
        const edge = (side) => {
          g.beginPath();
          for (let yy = y0; yy <= surfY; yy += 8) {
            const t2 = (yy - y0) / Math.max(1, surfY - y0);
            const w = 7 - t2 * 2.4;
            const xx = x0 + wob(yy) * (1 - t2 * 0.4) + side * w;
            yy === y0 ? g.moveTo(xx, yy) : g.lineTo(xx, yy);
          }
          return g;
        };
        const grad = g.createLinearGradient(0, y0, 0, surfY);
        grad.addColorStop(0, 'rgba(255,240,190,0.92)');
        grad.addColorStop(1, 'rgba(255,130,34,0.72)');
        g.fillStyle = grad;
        g.beginPath();
        for (let yy = y0; yy <= surfY; yy += 8) {
          const t2 = (yy - y0) / Math.max(1, surfY - y0), w = 7 - t2 * 2.4;
          const xx = x0 + wob(yy) * (1 - t2 * 0.4);
          yy === y0 ? g.moveTo(xx - w, yy) : g.lineTo(xx - w, yy);
        }
        for (let yy = surfY; yy >= y0; yy -= 8) {
          const t2 = (yy - y0) / Math.max(1, surfY - y0), w = 7 - t2 * 2.4;
          const xx = x0 + wob(yy) * (1 - t2 * 0.4);
          g.lineTo(xx + w, yy);
        }
        g.closePath(); g.fill();
        // a white core down the middle
        g.globalAlpha = 0.6; g.strokeStyle = '#fffaf0'; g.lineWidth = 2.6; g.lineCap = 'round';
        g.beginPath();
        for (let yy = y0; yy <= surfY; yy += 8) {
          const xx = x0 + wob(yy);
          yy === y0 ? g.moveTo(xx, yy) : g.lineTo(xx, yy);
        }
        g.stroke();
        g.restore();
      }

      // ---- the mould: a sand box with an iron rim
      g.save();
      const sand = g.createLinearGradient(0, my, 0, my + mh);
      sand.addColorStop(0, '#2a2129'); sand.addColorStop(1, '#171218');
      g.fillStyle = sand;
      U.roundRect(mx, my, mw, mh, 10); g.fill();
      g.restore();
      // target band
      const ty = my + mh - p.target * mh, th = 0.14 * mh;
      g.save();
      g.shadowColor = '#6ee787'; g.shadowBlur = 10;
      g.fillStyle = 'rgba(110,231,135,0.13)';
      g.fillRect(mx + 4, ty - th / 2, mw - 8, th);
      g.strokeStyle = '#6ee787'; g.lineWidth = 2;
      g.strokeRect(mx + 4, ty - th / 2, mw - 8, th);
      g.restore();
      // the metal, with a skin on top that is hotter than the body
      g.save();
      g.beginPath(); U.roundRect(mx, my, mw, mh, 10); g.clip();
      const grad2 = g.createLinearGradient(0, surfY, 0, my + mh);
      grad2.addColorStop(0, '#ffe9b0'); grad2.addColorStop(0.35, '#ff9a3c'); grad2.addColorStop(1, '#c0470a');
      g.fillStyle = grad2;
      g.fillRect(mx + 4, surfY, mw - 8, fh);
      if (fh > 4) {
        // the surface: a lit meniscus, rippling where the stream lands
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(255,248,224,0.30)';
        g.beginPath();
        g.moveTo(mx + 4, surfY + 3);
        for (let xx = mx + 4; xx <= mx + mw - 4; xx += 10) {
          const rip = p.stopped ? 0 : Math.sin(this.t * 7 + (xx - cx) * 0.07) * 2.2
            * Math.exp(-Math.abs(xx - cx) / 90);
          g.lineTo(xx, surfY + rip);
        }
        g.lineTo(mx + mw - 4, surfY + 4); g.lineTo(mx + 4, surfY + 4);
        g.closePath(); g.fill();
        g.globalCompositeOperation = 'source-over';
        // scum drifting on the surface
        g.fillStyle = 'rgba(70,32,14,0.5)';
        for (let i = 0; i < 5; i++) {
          const xx = cx + Math.sin(this.t * 0.6 + i * 2.1) * (mw * 0.32);
          g.beginPath(); g.ellipse(xx, surfY + 4, 12 + i * 4, 2.4, 0, 0, 7); g.fill();
        }
      }
      g.restore();
      g.strokeStyle = P.brass; g.lineWidth = 2;
      U.roundRect(mx, my, mw, mh, 10); g.stroke();
      // the iron rim sits proud of the sand
      g.fillStyle = '#4a4552';
      U.roundRect(mx - 10, my - 10, mw + 20, 16, 5); g.fill();
      g.fillStyle = '#5c5768';
      U.roundRect(mx - 10, my - 10, mw + 20, 6, 3); g.fill();

      U.text(p.stopped ? (this.parts.pour > 0.8 ? 'CLEAN POUR' : this.parts.pour > 0.45 ? 'ACCEPTABLE' : 'WASTEFUL')
        : (F.Input.touch ? 'TAP TO STOP' : 'CLICK OR SPACE TO STOP'),
        cx, 660, { size: 17, weight: '700', align: 'center',
          col: p.stopped ? (this.parts.pour > 0.8 ? P.good : this.parts.pour > 0.45 ? P.warn : P.bad) : P.text });
    }

    // -------------------------------------------------------- 4. hammering
    drawHammer() {
      const U = F.UI, g = U.g, h = this.ham;
      const cx = U.W / 2, cy = 400;
      U.para('Strike when the ring meets the mark. Every strike counts; the last ones come faster.',
        cx - 340, 124, 680, { size: 15, col: P.textDim, align: 'center' });

      // ---- the anvil. Three stacked slabs read as flat-pack shelving; an anvil
      // is a horn, a face, a waist and a foot, and the waist is what says it
      // weighs three hundredweight.
      const faceY = cy + 34;
      g.save();
      const ig2 = g.createLinearGradient(0, faceY, 0, cy + 100);
      ig2.addColorStop(0, '#46414f'); ig2.addColorStop(0.45, '#2c2833'); ig2.addColorStop(1, '#1c1922');
      g.fillStyle = ig2;
      g.beginPath();
      g.moveTo(cx - 150, faceY);                      // heel end of the face
      g.lineTo(cx + 132, faceY);
      g.quadraticCurveTo(cx + 196, faceY + 6, cx + 214, faceY + 22);  // the horn
      g.quadraticCurveTo(cx + 190, faceY + 30, cx + 134, faceY + 30);
      g.lineTo(cx + 96, faceY + 30);
      g.quadraticCurveTo(cx + 66, faceY + 46, cx + 62, faceY + 72);   // waist in
      g.lineTo(cx + 92, faceY + 96);                  // and out to the foot
      g.lineTo(cx + 108, faceY + 116);
      g.lineTo(cx - 126, faceY + 116);
      g.lineTo(cx - 110, faceY + 96);
      g.lineTo(cx - 80, faceY + 72);
      g.quadraticCurveTo(cx - 84, faceY + 46, cx - 114, faceY + 30);
      g.lineTo(cx - 150, faceY + 30);
      g.closePath(); g.fill();
      g.strokeStyle = '#1d1a24'; g.lineWidth = 3; g.stroke();
      // the hardened face, catching the forge
      g.fillStyle = '#585265';
      U.roundRect(cx - 150, faceY - 7, 284, 10, 3); g.fill();
      g.fillStyle = '#7a7389';
      U.roundRect(cx - 150, faceY - 7, 284, 3.5, 2); g.fill();
      // the hardy hole
      g.fillStyle = '#16131c';
      U.roundRect(cx - 128, faceY - 5, 15, 8, 2); g.fill();
      g.restore();

      // the piece taking shape on the anvil, glowing hot
      const prog = h.i / h.n;
      const hot = heatColour(1 - prog * 0.45);
      g.save();
      g.shadowColor = hot; g.shadowBlur = 40;
      g.fillStyle = hot;
      const pw = F.U.lerp(150, 190, prog), ph = F.U.lerp(46, 26, prog);
      U.roundRect(cx - pw / 2, faceY - 7 - ph, pw, ph, F.U.lerp(6, 3, prog)); g.fill();
      g.restore();
      // hammer marks, one per strike landed, so the billet records the work
      g.save();
      g.globalAlpha = 0.30; g.fillStyle = '#5a2a08';
      for (let i = 0; i < h.i && i < h.n; i++) {
        const t2 = (i + 0.5) / h.n;
        g.beginPath();
        g.ellipse(cx - pw / 2 + t2 * pw, faceY - 7 - ph * 0.55, 11, 5.5, 0, 0, 7); g.fill();
      }
      g.restore();

      // ---- the hammer. It falls with the ring, so it lands on the billet at
      // the exact moment the ring meets the mark: the player can read the swing
      // instead of the diagram, which is what a blacksmith would be doing.
      const span = Math.max(0.05, 1.6 - h.best);
      let drop = F.U.sat((1.6 - h.ring) / span);
      if (h.wait > 0) drop = 1 - F.U.sat((0.34 - h.wait) / 0.34);   // the recoil
      const hy = faceY - 7 - ph - 148 + drop * 130;
      const tiltH = -(1 - drop) * 0.85;      // swung back over the shoulder
      g.save();
      g.translate(cx + 6, hy);
      g.rotate(-tiltH);
      // The haft runs UP from the head: a hammer about to fall has its head at
      // the bottom, and drawing it the other way up reads as a lollipop.
      const haft = g.createLinearGradient(0, -140, 0, -6);
      haft.addColorStop(0, '#3f2c1c'); haft.addColorStop(1, '#6b4e30');
      g.fillStyle = haft;
      U.roundRect(-7, -142, 14, 132, 6); g.fill();
      g.strokeStyle = '#2a1c11'; g.lineWidth = 2;
      U.roundRect(-7, -142, 14, 132, 6); g.stroke();
      // the grip at the top of the haft
      g.fillStyle = '#33240f';
      U.roundRect(-9, -142, 18, 30, 6); g.fill();
      // head
      const hg = g.createLinearGradient(-46, 0, 46, 0);
      hg.addColorStop(0, '#2b2732'); hg.addColorStop(0.42, '#6f697c'); hg.addColorStop(1, '#3a3543');
      g.fillStyle = hg;
      U.roundRect(-46, -16, 92, 34, 5); g.fill();
      g.strokeStyle = '#191620'; g.lineWidth = 3;
      U.roundRect(-46, -16, 92, 34, 5); g.stroke();
      g.fillStyle = '#9a93a8';
      U.roundRect(-44, -14, 88, 6, 3); g.fill();
      // the peen end
      g.fillStyle = '#4a4552';
      g.beginPath();
      g.moveTo(46, -12); g.lineTo(66, -4); g.lineTo(66, 6); g.lineTo(46, 14);
      g.closePath(); g.fill();
      g.restore();

      // the ring
      const target = h.best;
      const R = 150;
      g.save();
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy - 120, R * target, 0, 7); g.stroke();
      g.strokeStyle = P.brassHi; g.lineWidth = 3;
      g.setLineDash([6, 8]);
      g.beginPath(); g.arc(cx, cy - 120, R * target, 0, 7); g.stroke();
      g.setLineDash([]);
      if (h.wait <= 0 && h.i < h.n) {
        const rr = Math.max(2, R * h.ring);
        const err = Math.abs(h.ring - target);
        const close = F.U.sat(1 - err / (h.tol || 0.30));
        g.shadowColor = close > 0.9 ? '#fff0c0' : '#ffb347';
        g.shadowBlur = 10 + close * 30;
        g.strokeStyle = close > 0.9 ? '#fff0c0' : close > 0.65 ? '#ffca6a' : '#b08050';
        g.lineWidth = 4 + close * 4;
        g.beginPath(); g.arc(cx, cy - 120, rr, 0, 7); g.stroke();
      }
      g.restore();

      // the strike tally
      const n = h.n, sw = 26;
      const sx = cx - (n * sw) / 2;
      for (let i = 0; i < n; i++) {
        const v = h.hits[i];
        const col = v === undefined ? '#2e2838' : v > 0.93 ? P.brassHi : v > 0.7 ? P.good : v > 0.4 ? P.warn : P.bad;
        g.fillStyle = col;
        g.beginPath(); g.arc(sx + i * sw + sw / 2, 620, v === undefined ? 5 : 8, 0, 7); g.fill();
      }
      U.text('STRIKE ' + Math.min(h.i + 1, n) + ' OF ' + n, cx, 660,
        { size: 15, weight: '700', align: 'center', col: P.textDim });
    }

    // -------------------------------------------------------------- result
    drawResult() {
      const U = F.UI, g = U.g;
      const r = this.result, it = r.item;
      const k = F.U.ease.outCubic(F.U.sat(r.reveal));
      const cx = U.W / 2;
      const shown = r.q * k;

      U.text('QUENCHED', cx, 110, { size: 22, weight: '600', display: true, align: 'center', col: P.textDim, alpha: k });

      const gradeCol = F.Forge.gradeColor(it.grade);
      U.text(Math.round(shown) + '', cx, 220, {
        size: 96, weight: '700', display: true, align: 'center',
        col: gradeCol, glow: gradeCol, glowBlur: 30 + k * 30,
      });
      U.text('QUALITY', cx, 246, { size: 13, weight: '700', align: 'center', col: P.textDim });
      if (k > 0.85) {
        U.text(it.grade.toUpperCase(), cx, 292, {
          size: 34, weight: '700', display: true, align: 'center', col: gradeCol,
          glow: gradeCol, glowBlur: 24, alpha: (k - 0.85) / 0.15,
        });
      }

      // the three parts of the score
      const parts = [['Bellows', this.parts.bellows], ['Pour', this.parts.pour], ['Hammering', this.parts.hammer]];
      let px = cx - 300;
      for (const [name, v] of parts) {
        U.text(name, px + 100, 340, { size: 13, align: 'center', col: P.textDim });
        U.bar(px + 20, 350, 160, 10, (v || 0) * k, { col: P.brass, glow: false });
        U.text(Math.round((v || 0) * 100) + '%', px + 100, 378, { size: 13, weight: '600', align: 'center', col: P.text });
        px += 200;
      }

      // the item card
      const cw = 560, chh = 190, cxx = cx - cw / 2, cyy = 400;
      U.panel(cxx, cyy, cw, chh, { frame: gradeCol });
      const ic = F.ItemIcon(it);
      if (ic) {
        const iw = 150, ih = iw * (ic.height / ic.width);
        const ix = cxx + 20, iy = cyy + (chh - ih) / 2;
        // a plinth and a halo in the ore's own colour: this is the payoff for
        // the whole run, and a small flat sprite on a panel does not say so
        g.save();
        g.beginPath(); U.roundRect(cxx + 3, cyy + 3, cw - 6, chh - 6, 8); g.clip();
        g.globalCompositeOperation = 'lighter';
        // rays, turning slowly. They taper to a point and stay faint; a hard
        // wedge at full width is a sunburst sticker, not light.
        g.translate(ix + iw / 2, iy + ih / 2);
        g.rotate(this.t * 0.11);
        for (let i = 0; i < 12; i++) {
          g.rotate(6.2832 / 12);
          const len = 88 + (i % 3) * 26;
          const rg = g.createLinearGradient(0, 0, len, 0);
          rg.addColorStop(0, F.Col.rgba(it.color, 0.16 * k));
          rg.addColorStop(1, F.Col.rgba(it.color, 0));
          g.fillStyle = rg;
          g.beginPath(); g.moveTo(6, -9); g.lineTo(len, 0); g.lineTo(6, 9);
          g.closePath(); g.fill();
        }
        g.rotate(-this.t * 0.11);
        const hg = g.createRadialGradient(0, 0, 4, 0, 0, 104);
        hg.addColorStop(0, F.Col.rgba(F.Col.mix(it.color, '#ffffff', 0.4), 0.30 * k));
        hg.addColorStop(0.5, F.Col.rgba(it.color, 0.09 * k));
        hg.addColorStop(1, F.Col.rgba(it.color, 0));
        g.fillStyle = hg;
        g.beginPath(); g.arc(0, 0, 104, 0, 7); g.fill();
        g.restore();
        g.save(); g.imageSmoothingEnabled = false;
        g.shadowColor = it.color; g.shadowBlur = 26;
        g.drawImage(ic, ix, iy, iw, ih);
        g.restore();
      }
      U.text(it.name, cxx + 196, cyy + 46, { size: 21, weight: '700', display: true, col: it.color });
      U.text(F.Forge.describe(it), cxx + 196, cyy + 76, { size: 15, col: P.text });
      let ty = cyy + 104;
      for (const tr of it.traits) {
        const T = F.TRAITS[tr.id];
        U.chip(cxx + 196, ty, T.n, T.col);
        ty += 26;
      }
      U.text('Sells for ' + F.U.fmt(it.value) + ' gold', cxx + cw - 24, cyy + chh - 20,
        { size: 13, align: 'right', col: P.gold });

      if (k > 0.98) {
        const bw = 200;
        if (U.btn(cx - bw - 10, 626, bw, 50, 'EQUIP IT', { primary: true, display: true })) {
          F.Game.equip(it);
          F.Game.toast('Equipped ' + it.name, it.color, 3);
          this.reset();
        }
        if (U.btn(cx + 10, 626, bw, 50, 'FORGE AGAIN', { display: true })) this.reset();
        if (U.btn(cx + bw + 30, 626, 150, 50, 'DONE', { display: true })) F.Game.pop();
      }
    }

    reset() {
      this.stage = 0; this.ores = {}; this.parts = {}; this.result = null; this.heat = 0;
    }
  }

  function className(it) {
    return it.kind === 'weapon' ? F.CLS[it.cls].n : F.ARMOR_CLS[it.cls].n + ' ' + F.SLOTS[it.slot].n;
  }
  function statLine(x, y, w, label, val) {
    const U = F.UI;
    U.text(label, x, y, { size: 14, col: P.textDim });
    U.text(val, x + w, y, { size: 15, weight: '600', align: 'right', col: P.text });
  }
  const ROLE = { filler: 'bulk', mult: 'multiplier', trait: 'trait' };
  const ROLE_LONG = { filler: 'Bulk — cheap weight that sets the size', mult: 'Multiplier — raises every stat', trait: 'Trait ore — grants a passive' };
  function roleCol(r) { return r === 'mult' ? P.cool : r === 'trait' ? P.magic : P.textFaint; }

  /** Blackbody-ish ramp: the single most important colour in the game. */
  // The bellows is a damped second-order system driven by a binary hold, so the
  // only thing that decides whether reading the band beats reacting to it is the
  // relationship between these five numbers. They live here so tools/forgecurve
  // can sweep them against an autoplayer instead of being guessed at.
  F.BELLOWS = {
    up: 1.02, down: -0.20,      // what the hold and the release pull toward
    gain: 3.3, damp: 4.6,       // how hard, and how quickly it settles
    rate: 1.7,
    drift: 1.08,                // how fast the band wanders
    bandW: 0.150, narrow: 0.040, narrowRate: 0.0050,
  };

  // draw() has no dt, and the bellows swing needs one to ease. The scene ticks
  // at a fixed step, so the last frame's length is close enough for a lerp.
  function dtSafe(sc) { return Math.min(0.05, sc._lastDt || 1 / 60); }

  function heatColour(h) {
    h = F.U.sat(h);
    if (h < 0.25) return F.Col.mix('#2a1a16', '#8a1c06', h / 0.25);
    if (h < 0.5) return F.Col.mix('#8a1c06', '#ff4a10', (h - 0.25) / 0.25);
    if (h < 0.75) return F.Col.mix('#ff4a10', '#ffaa2a', (h - 0.5) / 0.25);
    return F.Col.mix('#ffaa2a', '#fff6e0', (h - 0.75) / 0.25);
  }
  F.heatColour = heatColour;
  F.ForgeScene = ForgeScene;

})(window.F2 = window.F2 || {});
