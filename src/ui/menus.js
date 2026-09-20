'use strict';
// ---------------------------------------------------------------------------
// menus.js — inventory, jobs, achievements, settings, help.
// ---------------------------------------------------------------------------
(function (F) {

  const P = F.PAL;

  /** Shared chrome: a full-screen dim, a big panel, a close button. */
  function screen(title, w, h, body, onClose) {
    const U = F.UI, g = U.g;
    g.fillStyle = 'rgba(4,3,7,0.86)'; g.fillRect(0, 0, U.W, U.H);
    const x = (U.W - w) / 2, y = (U.H - h) / 2;
    U.panel(x, y, w, h, { title });
    body(x, y, w, h);
    if (U.btn(x + w - 140, y + h - 58, 116, 40, 'CLOSE', {}) || F.Input.hit('escape')) onClose();
    return { x, y, w, h };
  }

  function rarityOf(it) {
    if (!it) return P.rarity[0];
    return F.Forge.gradeColor(it.grade);
  }

  /** The tooltip every item in the game uses. */
  function itemTip(x, y, it, compare) {
    const U = F.UI;
    const lines = [
      { t: it.name, size: 17, weight: '700', display: true, col: it.color },
      { t: it.grade + '  ·  quality ' + it.quality.toFixed(1), size: 12, col: rarityOf(it) },
      { gap: 8 },
    ];
    const m = F.Forge.enhMult(it);
    if (it.kind === 'weapon') {
      lines.push({ t: 'Damage  ' + (it.stats.dmg * m).toFixed(1), size: 14 });
      lines.push({ t: 'Swing   ' + it.stats.cd.toFixed(2) + 's', size: 13, col: P.textDim });
      lines.push({ t: 'Reach   ' + it.stats.range, size: 13, col: P.textDim });
      lines.push({ t: 'Stamina ' + it.stats.sta, size: 13, col: P.textDim });
      lines.push({ t: 'Heavy   x' + it.stats.heavy.toFixed(1), size: 13, col: P.textDim });
    } else {
      lines.push({ t: 'Defence ' + (it.stats.def * m).toFixed(1), size: 14 });
      lines.push({ t: 'Health  +' + Math.round(it.stats.hp * m), size: 14 });
      lines.push({ t: 'Weight  ' + (it.stats.slow * 100).toFixed(1) + '% slower', size: 13, col: P.textDim });
    }
    if (it.enh) lines.push({ gap: 6 }, { t: 'Enhanced +' + it.enh + '  (x' + m.toFixed(2) + ')', size: 13, col: P.brassHi });
    for (const tr of it.traits) {
      const T = F.TRAITS[tr.id];
      lines.push({ gap: 6 }, { t: T.n, size: 13, weight: '700', col: T.col },
        { t: it.kind === 'weapon' ? T.wdesc : T.adesc, size: 12, col: P.textDim });
    }
    if (it.rune) lines.push({ gap: 6 }, { t: F.RUNES[it.rune].n, size: 13, col: P.cool },
      { t: F.RUNES[it.rune].desc, size: 12, col: P.textDim });
    if (it.spell) lines.push({ gap: 6 }, { t: F.SPELLS[it.spell].n + ' enchantment', size: 13, col: F.SPELLS[it.spell].col },
      { t: F.SPELLS[it.spell].desc, size: 12, col: P.textDim });
    if (compare && compare !== it) {
      lines.push({ gap: 8 }, { t: 'vs equipped', size: 11, weight: '700', col: P.textFaint });
      const cm = F.Forge.enhMult(compare);
      const d = it.kind === 'weapon'
        ? [['Damage', it.stats.dmg * m - compare.stats.dmg * cm, 1]]
        : [['Defence', it.stats.def * m - compare.stats.def * cm, 1], ['Health', it.stats.hp * m - compare.stats.hp * cm, 0]];
      for (const [n, v, dec] of d)
        lines.push({ t: n + '  ' + (v >= 0 ? '+' : '') + v.toFixed(dec), size: 13, col: v >= 0 ? P.good : P.bad });
    }
    lines.push({ gap: 8 }, { t: 'Worth ' + F.U.fmt(it.value) + ' gold', size: 12, col: P.gold });
    lines.push({ t: F.ORES[it.mainOre].n + '  ·  ' + it.oreCount + ' ore', size: 11, col: P.textFaint });
    U.tip(x, y, lines, { frame: rarityOf(it), min: 250 });
  }
  F.itemTip = itemTip;

  // ============================================================= inventory
  class InventoryScene {
    constructor(tab) { this.tab = tab || 0; this.sel = null; this.scroll = 0; this.filter = 'all'; }
    update(dt) {
      if (F.Input.hit('t') || F.Input.hit('tab')) F.Game.pop();
      this.scroll = Math.max(0, this.scroll + F.Input.wheel * 44);
    }
    draw() {
      const U = F.UI, g = U.g, s = F.Game.s;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      this.tip = null;
      screen('The Bag', 1140, 660, (x, y, w, h) => {
        this.tab = U.tabs(x + 24, y + 52, w - 48, ['GEAR', 'ORE', 'POTIONS', 'YOU'], this.tab);
        const by = y + 100, bh = h - 170;
        if (this.tab === 0) this.gear(x + 24, by, w - 48, bh);
        else if (this.tab === 1) this.ore(x + 24, by, w - 48, bh);
        else if (this.tab === 2) this.potions(x + 24, by, w - 48, bh);
        else this.you(x + 24, by, w - 48, bh);
      }, () => F.Game.pop());
      if (this.tip) itemTip(this.tip.x, this.tip.y, this.tip.it, this.tip.cmp);
      U.end();
    }

    // --------------------------------------------------------------- gear
    gear(x, y, w, h) {
      const U = F.UI, g = U.g, s = F.Game.s;
      // left: the doll
      const dw = 330;
      U.text('WORN', x + dw / 2, y + 6, { size: 12, weight: '700', align: 'center', col: P.textFaint });
      const slots = [['weapon', 'Weapon'], ['head', 'Helm'], ['chest', 'Chest'], ['legs', 'Greaves'], ['boots', 'Boots']];
      let sy = y + 20;
      for (const [slot, name] of slots) {
        const it = F.Game.equipped(slot);
        const over = U.row(x, sy, dw, 62, { key: 'eq' + slot, selected: this.sel && this.sel.slot === slot && this.sel.equipped });
        U.slot(x + 6, sy + 5, 52, { rarity: it ? rarityOf(it) : null, empty: !it, key: 'eqs' + slot });
        if (it) {
          const ic = F.ItemIcon(it);
          if (ic) { g.save(); g.imageSmoothingEnabled = false; g.drawImage(ic, x + 10, sy + 8, 44, 44 * (ic.height / ic.width)); g.restore(); }
        }
        U.text(name.toUpperCase(), x + 70, sy + 22, { size: 10.5, weight: '700', col: P.textFaint });
        U.text(it ? it.name : 'nothing', x + 70, sy + 40, { size: 14, weight: '600', col: it ? it.color : P.textFaint });
        if (it) U.text(F.Forge.describe(it), x + 70, sy + 55, { size: 11, col: P.textDim });
        if (over) {
          if (it) this.tip = { x: U.mx, y: U.my, it };
          if (U.mclick && U.consume() && it) { F.Game.unequip(slot); F.Audio.ui(); }
        }
        sy += 66;
      }
      // pickaxe and lantern
      sy += 6;
      U.rule(x, sy, dw); sy += 16;
      U.slot(x + 6, sy, 52, { key: 'pick' });
      const pic = F.PickIcon(s.pick);
      if (pic) { g.save(); g.imageSmoothingEnabled = false; g.drawImage(pic, x + 10, sy + 4, 44, 44 * (pic.height / pic.width)); g.restore(); }
      U.text(F.PICKS[s.pick].n, x + 70, sy + 22, { size: 14, weight: '600', col: P.text });
      U.text('Mine Power ' + Math.round(F.Game.minePower()), x + 70, sy + 40, { size: 12, col: P.textDim });
      sy += 62;
      U.slot(x + 6, sy, 52, { key: 'lamp' });
      U.icon('lantern', x + 32, sy + 26, 40, F.LANTERNS[s.lantern].col);
      U.text(F.LANTERNS[s.lantern].n, x + 70, sy + 22, { size: 14, weight: '600', col: P.text });
      U.text('Reach ' + Math.round(F.Game.lightRadius()), x + 70, sy + 40, { size: 12, col: P.textDim });

      // right: everything you own
      const lx = x + dw + 28, lw = w - dw - 28;
      const items = s.items.slice().sort((a, b) => b.value - a.value);
      U.text(items.length + ' FORGED', lx, y + 6, { size: 12, weight: '700', col: P.textFaint });
      const gw = 76, cols = Math.floor(lw / gw);
      g.save();
      g.beginPath(); g.rect(lx, y + 18, lw, h - 26); g.clip();
      let i = 0;
      for (const it of items) {
        const cx = lx + (i % cols) * gw, cy = y + 22 + Math.floor(i / cols) * gw - this.scroll;
        i++;
        if (cy < y - gw || cy > y + h) continue;
        const equipped = s.equip[it.slot] === it.id;
        const over = U.slot(cx, cy, gw - 8, { rarity: rarityOf(it), selected: this.sel === it, key: 'inv' + it.id });
        const ic = F.ItemIcon(it);
        if (ic) { g.save(); g.imageSmoothingEnabled = false; g.drawImage(ic, cx + 6, cy + 4, gw - 20, (gw - 20) * (ic.height / ic.width)); g.restore(); }
        if (equipped) {
          g.fillStyle = P.brassHi;
          g.beginPath(); g.arc(cx + gw - 16, cy + 10, 5, 0, 7); g.fill();
        }
        if (it.master) U.text('MW', cx + 6, cy + gw - 14, { size: 10, weight: '800', col: P.brassHi });
        if (over) {
          this.tip = { x: U.mx, y: U.my, it, cmp: F.Game.equipped(it.slot) };
          if (U.mclick && U.consume()) { this.sel = it; F.Audio.ui(); }
        }
      }
      g.restore();
      // actions on the selected piece
      if (this.sel && s.items.indexOf(this.sel) >= 0) {
        const it = this.sel;
        const by = y + h - 4;
        const eq = s.equip[it.slot] === it.id;
        if (U.btn(lx, by, 150, 42, eq ? 'UNEQUIP' : 'EQUIP', { primary: !eq })) {
          if (eq) F.Game.unequip(it.slot); else F.Game.equip(it);
        }
        if (U.btn(lx + 160, by, 190, 42, 'SELL  ' + F.U.fmt(Math.round(it.value * F.Game.sellMult())), { disabled: eq })) {
          const got = F.Game.addGold(Math.round(it.value * F.Game.sellMult()));
          F.Quests.onEvent(s, 'gold', { n: got });
          F.Game.removeItem(it.id);
          F.Game.toast('+' + F.U.fmt(got) + ' gold', P.gold, 2);
          this.sel = null;
          F.Audio.coin();
        }
      } else {
        U.text('Pick something to equip or sell.', lx, y + h + 22, { size: 13, col: P.textFaint });
      }
    }

    // ---------------------------------------------------------------- ore
    ore(x, y, w, h) {
      const U = F.UI, g = U.g, s = F.Game.s;
      const cols = 4, cw = w / cols, chh = 56;
      let i = 0, totalValue = 0;
      for (const id of F.ORE_IDS) {
        const n = s.ores[id] || 0;
        const O = F.ORES[id];
        totalValue += n * O.val;
        const cx = x + (i % cols) * cw, cy = y + 24 + Math.floor(i / cols) * chh;
        i++;
        const over = U.row(cx, cy, cw - 12, chh - 8, { key: 'o' + id });
        U.icon('ore_drop', cx + 24, cy + 24, 26, O.col);
        U.text(O.n, cx + 46, cy + 20, { size: 14, weight: '600', col: n > 0 ? P.text : P.textFaint });
        U.text(roleName(O) + '  ·  x' + O.mult.toFixed(2), cx + 46, cy + 36, { size: 11, col: P.textDim });
        U.text('' + n, cx + cw - 24, cy + 30, { size: 17, weight: '700', align: 'right', col: n > 0 ? P.text : P.textFaint });
        if (over && n === 0) U.text('Depth ' + F.roman(O.f[0]) + '+', cx + cw - 24, cy + 44, { size: 10, align: 'right', col: P.textFaint });
      }
      const gy = y + 24 + Math.ceil(F.ORE_IDS.length / cols) * chh + 16;
      U.rule(x, gy, w);
      U.text('GEMS', x, gy + 24, { size: 12, weight: '700', col: P.textFaint });
      let gx = x + 70;
      for (const id in F.GEMS) {
        const G = F.GEMS[id], n = s.gems[id] || 0;
        U.icon('gem_drop', gx, gy + 22, 24, G.col);
        U.text('' + n, gx + 18, gy + 28, { size: 14, weight: '700', col: n > 0 ? G.col : P.textFaint });
        gx += 90;
      }
      U.text('Ore in the bag is worth about ' + F.U.fmt(totalValue) + ' gold as raw stock — forged, far more.',
        x + w / 2, y + h + 6, { size: 13, align: 'center', col: P.textDim });
    }

    // ------------------------------------------------------------ potions
    potions(x, y, w, h) {
      const U = F.UI, s = F.Game.s;
      U.text('Assign a potion to a hotbar slot, then press its number in the mine.',
        x + w / 2, y + 12, { size: 13, align: 'center', col: P.textDim });
      const lw = w * 0.56;
      let yy = y + 36;
      for (const id of F.POTION_ORDER) {
        const pot = F.POTIONS[id], n = s.potions[id] || 0;
        const over = U.row(x, yy, lw, 46, { key: 'p' + id, selected: this.selPot === id });
        F.Hud.potionIcon(U.g, x + 26, yy + 23, 15, pot.col);
        U.text(pot.n, x + 52, yy + 20, { size: 14, weight: '600', col: n > 0 ? P.text : P.textFaint });
        U.text(pot.desc, x + 52, yy + 36, { size: 11, col: P.textDim });
        U.text('x' + n, x + lw - 18, yy + 28, { size: 15, weight: '700', align: 'right', col: n > 0 ? pot.col : P.textFaint });
        if (over && U.mclick && U.consume()) { this.selPot = id; F.Audio.ui(); }
        yy += 50;
      }
      const rx = x + lw + 30;
      U.text('HOTBAR', rx, y + 40, { size: 12, weight: '700', col: P.textFaint });
      for (let i = 0; i < 6; i++) {
        const sy = y + 54 + i * 62;
        const id = s.hotbar[i];
        const over = U.row(rx, sy, w - lw - 30, 54, { key: 'hb' + i });
        U.text('' + (i + 3), rx + 16, sy + 34, { size: 20, weight: '700', display: true, col: P.brassHi });
        U.slot(rx + 38, sy + 5, 44, { empty: !id });
        if (id) F.Hud.potionIcon(U.g, rx + 60, sy + 27, 14, F.POTIONS[id].col);
        U.text(id ? F.POTIONS[id].n : 'empty', rx + 94, sy + 26, { size: 14, weight: '600', col: id ? F.POTIONS[id].col : P.textFaint });
        if (id) U.text('x' + (s.potions[id] || 0), rx + 94, sy + 42, { size: 11, col: P.textDim });
        if (over && U.mclick && U.consume()) {
          if (this.selPot) { s.hotbar[i] = this.selPot; this.selPot = null; F.Audio.uiBig(); }
          else { s.hotbar[i] = null; F.Audio.ui(); }
        }
      }
    }

    // ---------------------------------------------------------------- you
    you(x, y, w, h) {
      const U = F.UI, g = U.g, s = F.Game.s;
      const race = F.Game.race(), tier = F.RACE_TIERS[s.raceTier] || F.RACE_TIERS[0];
      const cw = w / 3;
      // column 1: who
      U.text('BLOODLINE', x, y + 16, { size: 12, weight: '700', col: P.textFaint });
      U.text(race.n, x, y + 46, { size: 26, weight: '700', display: true, col: tier.col, glow: tier.col, glowBlur: 14 });
      U.chip(x, y + 58, tier.n, tier.col);
      U.para(race.desc, x, y + 104, cw - 30, { size: 14, col: P.textDim });
      U.text('Level ' + s.level, x, y + 160, { size: 20, weight: '700', display: true, col: P.text });
      U.bar(x, y + 172, cw - 40, 12, s.level >= F.MAX_LEVEL ? 1 : s.xp / F.xpNeeded(s.level), { col: P.xp, glow: false });
      U.text(s.level >= F.MAX_LEVEL ? 'as deep as it goes' : F.U.fmt(s.xp) + ' / ' + F.U.fmt(F.xpNeeded(s.level)) + ' xp',
        x, y + 202, { size: 12, col: P.textDim });
      U.text('Shrine spins: ' + (s.spins || 0), x, y + 226, { size: 13, col: P.magic });

      // column 2: numbers
      const c2 = x + cw;
      U.text('WHAT YOU ARE', c2, y + 16, { size: 12, weight: '700', col: P.textFaint });
      const rows = [
        ['Power', F.U.fmt(F.Game.power()), P.brassHi],
        ['Health', F.U.fmt(F.Game.maxHp()), P.hp],
        ['Attack', F.Game.attackPower().toFixed(1), P.ember],
        ['Defence', F.Game.defense().toFixed(1), P.cool],
        ['Mine Power', F.U.fmt(Math.round(F.Game.minePower())), P.text],
        ['Ore yield', '+' + Math.round((F.Game.oreYield() - 1) * 100) + '%', P.good],
        ['Gold gain', '+' + Math.round((F.Game.goldMult() - 1) * 100) + '%', P.gold],
        ['Lantern', Math.round(F.Game.lightRadius()) + '', P.warn],
        ['Move speed', Math.round(F.Game.moveSpeed()) + '', P.text],
      ];
      let yy = y + 44;
      for (const [n, v, c] of rows) {
        U.text(n, c2, yy, { size: 14, col: P.textDim });
        U.text(v, c2 + cw - 50, yy, { size: 15, weight: '700', align: 'right', col: c });
        yy += 26;
      }

      // column 3: the ledger
      const c3 = x + cw * 2;
      U.text('THE LEDGER', c3, y + 16, { size: 12, weight: '700', col: P.textFaint });
      const st = s.stats;
      const l = [
        ['Ore mined', F.U.fmt(st.mined)],
        ['Things forged', F.U.fmt(st.forged)],
        ['Masterworks', F.U.fmt(st.masterworks)],
        ['Best quality', st.bestQuality.toFixed(1)],
        ['Kills', F.U.fmt(st.kills)],
        ['Deaths', F.U.fmt(st.deaths)],
        ['Gold earned', F.U.fmt(st.goldEarned)],
        ['Jobs finished', F.U.fmt(s.questsDone)],
        ['Deepest', F.DEPTHS[Math.min(7, s.deepest - 1)].name],
        ['Time', formatTime(st.runTime)],
      ];
      yy = y + 44;
      for (const [n, v] of l) {
        U.text(n, c3, yy, { size: 14, col: P.textDim });
        U.text(v, c3 + cw - 50, yy, { size: 14, weight: '600', align: 'right', col: P.text });
        yy += 26;
      }
    }
  }
  F.InventoryScene = InventoryScene;

  function roleName(O) { return O.role === 'filler' ? 'bulk' : O.role === 'mult' ? 'multiplier' : F.TRAITS[O.trait].n.toLowerCase(); }
  function formatTime(t) {
    const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60;
    return h ? h + 'h ' + m + 'm' : m + 'm';
  }

  // ================================================================== jobs
  class QuestScene {
    update(dt) { if (F.Input.hit('j')) F.Game.pop(); }
    draw() {
      const U = F.UI, g = U.g, s = F.Game.s;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      screen('The Notice Board', 900, 620, (x, y, w, h) => {
        U.text('Finished jobs can be handed in anywhere. New ones appear as soon as you claim.',
          x + w / 2, y + 62, { size: 13, align: 'center', col: P.textDim });
        let yy = y + 86;
        for (const q of s.quests || []) {
          const rh = 110;
          U.row(x + 24, yy, w - 48, rh - 10, { key: 'q' + q.id });
          U.text(q.title, x + 44, yy + 30, { size: 19, weight: '600', display: true, col: q.done ? P.good : P.text });
          U.text(q.desc, x + 44, yy + 52, { size: 13, col: P.textDim });
          const rw = 300;
          let rx = x + 44;
          const rew = [['gold', F.U.fmt(q.gold), P.gold], ['xp', F.U.fmt(q.xp) + ' xp', P.xp],
                       ['essence', q.essence + ' essence', P.magic]];
          if (q.frags) rew.push(['frag', q.frags + ' fragments', P.cool]);
          for (const [, t, c] of rew) { rx += U.chip(rx, yy + 66, t, c) + 8; }
          if (q.need > 1) {
            U.bar(x + w - 280, yy + 34, 200, 12, q.prog / q.need, { col: q.done ? P.good : P.brass, glow: false });
            U.text(q.prog + ' / ' + q.need, x + w - 180, yy + 66, { size: 13, align: 'center', col: P.textDim });
          }
          if (q.done && U.btn(x + w - 230, yy + 18, 170, 44, 'HAND IN', { primary: true, display: true })) {
            F.Quests.claim(s, q);
            F.Audio.uiBig();
            F.Game.toast('Job done', P.good, 2.5);
          }
          yy += rh;
        }
      }, () => F.Game.pop());
      U.end();
    }
  }
  F.QuestScene = QuestScene;

  // ========================================================== achievements
  class AchieveScene {
    update(dt) { if (F.Input.hit('k')) F.Game.pop(); }
    draw() {
      const U = F.UI, s = F.Game.s;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      screen('Deeds', 1020, 660, (x, y, w, h) => {
        U.text(F.Achieve.count(s) + ' of ' + F.Achieve.total() + '  ·  each one is a shrine spin',
          x + w / 2, y + 62, { size: 14, align: 'center', col: P.textDim });
        const cols = 2, cw = (w - 60) / cols, chh = 50;
        let i = 0;
        for (const a of F.ACHIEVEMENTS) {
          const got = !!(s.achievements && s.achievements[a.id]);
          const cx = x + 28 + (i % cols) * cw, cy = y + 84 + Math.floor(i / cols) * chh;
          i++;
          U.row(cx, cy, cw - 12, chh - 6, { key: 'a' + a.id });
          const g = U.g;
          g.fillStyle = got ? P.brassHi : '#2e2838';
          g.beginPath(); g.arc(cx + 22, cy + 22, 9, 0, 7); g.fill();
          if (got) { g.strokeStyle = '#1a1420'; g.lineWidth = 2.4;
            g.beginPath(); g.moveTo(cx + 18, cy + 22); g.lineTo(cx + 21, cy + 26); g.lineTo(cx + 27, cy + 17); g.stroke(); }
          U.text(a.n, cx + 42, cy + 20, { size: 14, weight: '600', col: got ? P.text : P.textFaint });
          U.text(a.d, cx + 42, cy + 36, { size: 11, col: got ? P.textDim : P.textFaint });
        }
      }, () => F.Game.pop());
      U.end();
    }
  }
  F.AchieveScene = AchieveScene;

  // ============================================================== settings
  class SettingsScene {
    update(dt) {}
    draw() {
      const U = F.UI, g = U.g, st = F.Game.settings;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      screen('Settings', 620, 560, (x, y, w, h) => {
        let yy = y + 76;
        const slider = (label, key, min, max, fmt, apply) => {
          U.text(label, x + 44, yy, { size: 15, col: P.text });
          U.text(fmt(st[key]), x + w - 44, yy, { size: 14, weight: '600', align: 'right', col: P.brassHi });
          const bx = x + 44, bw = w - 88, by = yy + 12;
          const f = (st[key] - min) / (max - min);
          U.bar(bx, by, bw, 12, f, { col: P.brass, glow: false });
          if (U.hitRect(bx - 6, by - 8, bw + 12, 28) && U.mdown) {
            st[key] = F.U.clamp(min + (U.mx - bx) / bw * (max - min), min, max);
            if (apply) apply(st[key]);
            F.Save.settings(st);
          }
          yy += 56;
        };
        slider('Sound', 'volume', 0, 1, v => Math.round(v * 100) + '%', v => F.Audio.setVolume(v));
        slider('Music', 'music', 0, 1, v => Math.round(v * 100) + '%', v => F.Audio.setMusicVolume(v));
        slider('Screen shake', 'shake', 0, 1.5, v => Math.round(v * 100) + '%');
        slider('Film grain', 'grain', 0, 2, v => Math.round(v * 100) + '%', () => { F.Render.grain = 0.030 * st.grain; });
        slider('Bloom', 'bloom', 0, 2, v => Math.round(v * 100) + '%', () => { F.Render.bloomAmt = 0.58 * st.bloom; });

        const tog = (label, key, apply) => {
          U.text(label, x + 44, yy + 6, { size: 15, col: P.text });
          if (U.btn(x + w - 160, yy - 16, 116, 36, st[key] ? 'ON' : 'OFF', { primary: !!st[key] })) {
            st[key] = st[key] ? 0 : 1;
            if (apply) apply(st[key]);
            F.Save.settings(st);
          }
          yy += 52;
        };
        tog('Mute everything', 'muted', v => F.Audio.setMuted(!!v));
        tog('Cast shadows', 'shadows', v => { F.Render.shadowSteps = v ? 22 : 0; });
        tog('Show hints', 'hints');
      }, () => F.Game.pop());
      U.end();
    }
  }
  F.SettingsScene = SettingsScene;

  // ================================================================== help
  class HelpScene {
    constructor() { this.tab = 0; }
    update(dt) {}
    draw() {
      const U = F.UI, g = U.g;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      screen('How To Play', 980, 660, (x, y, w, h) => {
        this.tab = U.tabs(x + 24, y + 52, w - 48, ['CONTROLS', 'THE LOOP', 'FORGING', 'FIGHTING'], this.tab);
        const bx = x + 40, by = y + 110, bw = w - 80;
        if (this.tab === 0) {
          const keys = [
            ['WASD / arrows', 'Move'], ['Shift', 'Sprint (costs stamina)'],
            ['Left click', 'Attack, or swing the pick at rock'], ['Right click / R', 'Heavy attack'],
            ['Q', 'Dash — you are untouchable through it'], ['F', 'Parry — guards a cone where you point'],
            ['1 / 2 / wheel', 'Hold the pickaxe or the weapon'], ['3-8', 'Drink the potion in that slot'],
            ['E', 'Use, talk, take, descend'], ['T / Tab', 'The bag'], ['J', 'Jobs'], ['K', 'Deeds'],
            ['M', 'Map'], ['Esc', 'Pause'],
          ];
          let yy = by + 10;
          for (const [k, v] of keys) {
            U.row(bx, yy - 16, bw, 30, { key: 'k' + k });
            U.text(k, bx + 14, yy + 4, { size: 14, weight: '700', col: P.brassHi });
            U.text(v, bx + 260, yy + 4, { size: 14, col: P.text });
            yy += 34;
          }
        } else if (this.tab === 1) {
          para(bx, by, bw, [
            ['The loop', 'Go down. Break rock. Come back up. Melt what you found into something better than what you went down with. Then go further down.'],
            ['Ore', 'Every node carries one kind of ore, rolled fresh each time the mine is generated. Rare seams are guarded by something with a name.'],
            ['Depths', 'Eight of them. Each is deeper, richer and considerably worse for your health. Some are locked behind a boss.'],
            ['Emberhold', 'The hub. Smith for pickaxes, Runemaker for runes and enchantments, Alchemist for potions, Merchant for selling, Shrine for your bloodline, Board for work.'],
            ['Dying', 'Costs you a slice of your gold. Nothing else. The mine is patient.'],
          ]);
        } else if (this.tab === 2) {
          para(bx, by, bw, [
            ['1 · The Crucible', 'How MUCH ore you use decides what class of thing comes out — a dagger or a titan maul, a light helm or titanplate. WHICH ore decides how strong it is, what colour it is, and whether it does anything special.'],
            ['Trait ore', 'Once one trait ore is about a fifth of the melt, its passive comes with the item. Two traits at most, the two biggest shares.'],
            ['2 · The Bellows', 'Hold to pump. Keep the heat inside the band. The band moves and narrows.'],
            ['3 · The Pour', 'Stop the stream inside the green. Overpour and you get slag.'],
            ['4 · The Hammering', 'Strike as the ring crosses the mark. Later strikes come faster.'],
            ['Quality', 'The three timed stages become one number from 0 to 100. A Masterwork at 99 is worth about two and a half times a Botched one, and sells for far more than that.'],
          ]);
        } else {
          para(bx, by, bw, [
            ['Stamina', 'Sprinting, dashing and swinging all cost it. Mining costs a little. It comes back fast when you stop.'],
            ['Heavy attacks', 'Slower, rooted, and worth roughly double. They also break ore nodes caught in the arc.'],
            ['Dash', 'Short, cheap, and gives real invulnerability. It is the answer to almost everything.'],
            ['Parry', 'Guards a cone toward your cursor for a moment. Anything that hits it takes nothing, is stunned, and takes extra damage for a while. Arrows come back.'],
            ['Traits', 'Volcanic burns, Glass trades health for damage, Explosive detonates, Demonic ignites, Frost chills, Leeching heals you, Void ignores armour, Eternal does a bit of everything.'],
          ]);
        }
      }, () => F.Game.pop());
      U.end();
    }
  }
  function para(x, y, w, items) {
    const U = F.UI;
    let yy = y;
    for (const [h, b] of items) {
      U.text(h, x, yy, { size: 17, weight: '700', display: true, col: P.brassHi });
      yy += 24;
      yy += U.para(b, x, yy, w, { size: 14, col: P.textDim, lh: 21 }) + 18;
    }
  }
  F.HelpScene = HelpScene;

})(window.F2 = window.F2 || {});
