'use strict';
// ---------------------------------------------------------------------------
// shops.js — the six places in Emberhold that take your money.
// ---------------------------------------------------------------------------
(function (F) {

  const P = F.PAL;

  F.openShop = function (id, sc) {
    F.Audio.uiBig();
    F.Game.push(new ShopScene(id, sc));
  };

  const TITLES = {
    smith:    ['The Drill Works',   'Durga Ashfall',     'Pickaxes and lamps. Nothing pretty.'],
    ench:     ['The Rune Hall',     'Veyra Runescribe',  'Runes, enchantments and enhancement.'],
    alch:     ['The Apothecary',    'Hob Tinder',        'Everything here is technically a poison.'],
    merchant: ['The Storehouse',    'Coll Weighpenny',   'I buy ore. I buy your mistakes. I pay less for both.'],
    shrine:   ['The Ancestor Shrine', 'The Ancestor',    'Spin, and see whose blood answers.'],
    board:    ['The Notice Board',  '',                  'Work, and the people who need it done.'],
  };

  class ShopScene {
    constructor(id, world) {
      this.id = id; this.world = world;
      this.tab = 0;
      this.sel = null;
      this.spin = null;
    }
    update(dt) {
      if (F.Input.hit('escape') || F.Input.hit('e')) { if (!this.spin) F.Game.pop(); }
      if (this.spin) {
        this.spin.t += dt;
        if (this.spin.t > this.spin.dur && !this.spin.done) {
          this.spin.done = true;
          F.Game.s.race = this.spin.race;
          F.Game.s.raceTier = this.spin.tier;
          F.Game.s.hp = Math.min(F.Game.s.hp, F.Game.maxHp());
          F.Audio.levelUp();
          F.Game.save();
        }
        if (this.spin.done && this.spin.t > this.spin.dur + 2.2 && F.Input.mclick) this.spin = null;
      }
    }
    draw() {
      const U = F.UI, g = U.g, s = F.Game.s;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      this.tip = null;
      g.fillStyle = 'rgba(4,3,7,0.86)'; g.fillRect(0, 0, U.W, U.H);
      const w = 1060, h = 660, x = (U.W - w) / 2, y = (U.H - h) / 2;
      const T = TITLES[this.id] || ['Shop', '', ''];
      U.panel(x, y, w, h, { title: T[0] });
      if (T[1]) U.text(T[1], x + w / 2, y + 58, { size: 14, weight: '600', align: 'center', col: P.brass });
      U.text(T[2], x + w / 2, y + 78, { size: 13, align: 'center', col: P.textDim });
      // purse
      U.icon('coin', x + w - 150, y + 32, 20, P.gold);
      U.text(F.U.fmt(s.gold), x + w - 132, y + 38, { size: 17, weight: '700', col: P.gold });

      const bx = x + 30, by = y + 100, bw = w - 60, bh = h - 176;
      if (this.id === 'smith') this.smith(bx, by, bw, bh);
      else if (this.id === 'ench') this.ench(bx, by, bw, bh);
      else if (this.id === 'alch') this.alch(bx, by, bw, bh);
      else if (this.id === 'merchant') this.merchant(bx, by, bw, bh);
      else if (this.id === 'shrine') this.shrine(bx, by, bw, bh);
      else this.board(bx, by, bw, bh);

      if (U.btn(x + w - 150, y + h - 58, 120, 42, 'LEAVE', {})) F.Game.pop();
      if (this.tip) F.itemTip(this.tip.x, this.tip.y, this.tip.it, this.tip.cmp);
      if (this.spin) this.drawSpin();
      U.end();
    }

    buy(cost, ok) {
      if (F.Game.s.gold < cost) { F.Audio.error(); F.Game.toast('Not enough gold.', P.bad, 2); return false; }
      F.Game.s.gold -= cost;
      F.Audio.coin();
      ok();
      F.Game.save();
      return true;
    }

    // ------------------------------------------------------------- smith
    smith(x, y, w, h) {
      const U = F.UI, g = U.g, s = F.Game.s;
      this.tab = U.tabs(x, y, w, ['PICKAXES', 'LANTERNS'], this.tab);
      const ly = y + 48;
      if (this.tab === 0) {
        const cols = 2, cw = w / cols;
        for (let i = 0; i < F.PICKS.length; i++) {
          const p = F.PICKS[i];
          const cx = x + (i % cols) * cw, cy = ly + Math.floor(i / cols) * 92;
          const owned = i <= s.pick, next = i === s.pick + 1;
          const can = next && s.level >= p.lvl && s.gold >= p.cost;
          U.row(cx, cy, cw - 16, 84, { key: 'pk' + i, selected: owned });
          const ic = F.PickIcon(i);
          if (ic) { g.save(); g.imageSmoothingEnabled = false; g.globalAlpha = owned || next ? 1 : 0.4;
            g.drawImage(ic, cx + 12, cy + 8, 62, 62 * (ic.height / ic.width)); g.restore(); }
          U.text(p.n, cx + 86, cy + 26, { size: 16, weight: '600', col: owned ? P.good : next ? P.text : P.textFaint });
          U.text('Mine Power ' + p.mp + '   ·   speed x' + p.spd.toFixed(2), cx + 86, cy + 46, { size: 12, col: P.textDim });
          if (owned) U.text(i === s.pick ? 'in your hands' : 'owned', cx + 86, cy + 66, { size: 12, col: P.good });
          else if (s.level < p.lvl) U.text('needs level ' + p.lvl, cx + 86, cy + 66, { size: 12, col: P.bad });
          else if (!next) U.text('buy the one before it first', cx + 86, cy + 66, { size: 12, col: P.textFaint });
          else {
            U.text(F.U.fmt(p.cost) + ' gold', cx + 86, cy + 66, { size: 13, weight: '600', col: can ? P.gold : P.bad });
            if (U.btn(cx + cw - 140, cy + 22, 108, 40, 'BUY', { primary: can, disabled: !can }))
              this.buy(p.cost, () => { s.pick = i; F.Game.toast('New pick: ' + p.n, P.brassHi, 3); });
          }
        }
      } else {
        const cols = 2, cw = w / cols;
        for (let i = 0; i < F.LANTERNS.length; i++) {
          const L = F.LANTERNS[i];
          const cx = x + (i % cols) * cw, cy = ly + Math.floor(i / cols) * 92;
          const owned = i <= s.lantern, next = i === s.lantern + 1;
          const can = next && s.gold >= L.cost;
          U.row(cx, cy, cw - 16, 84, { key: 'ln' + i, selected: owned });
          U.icon('lantern', cx + 42, cy + 42, 54, L.col);
          U.text(L.n, cx + 86, cy + 26, { size: 16, weight: '600', col: owned ? P.good : next ? P.text : P.textFaint });
          U.text('Reach ' + L.r, cx + 86, cy + 46, { size: 12, col: P.textDim });
          if (owned) U.text('owned', cx + 86, cy + 66, { size: 12, col: P.good });
          else if (!next) U.text('buy the one before it first', cx + 86, cy + 66, { size: 12, col: P.textFaint });
          else {
            U.text(F.U.fmt(L.cost) + ' gold', cx + 86, cy + 66, { size: 13, weight: '600', col: can ? P.gold : P.bad });
            if (U.btn(cx + cw - 140, cy + 22, 108, 40, 'BUY', { primary: can, disabled: !can }))
              this.buy(L.cost, () => { s.lantern = i; F.Game.toast('New lamp: ' + L.n, P.brassHi, 3); });
          }
        }
      }
    }

    // ------------------------------------------------------ runes/spells
    ench(x, y, w, h) {
      const U = F.UI, g = U.g, s = F.Game.s;
      this.tab = U.tabs(x, y, w, ['ENHANCE', 'RUNES', 'ENCHANTMENTS'], this.tab);
      const ly = y + 52;
      U.icon('orb', x + w - 260, y - 22, 18, P.magic);
      U.text(s.essence + ' essence', x + w - 246, y - 16, { size: 13, weight: '600', col: P.magic });
      U.icon('frag', x + w - 130, y - 22, 18, P.cool);
      U.text(s.frags + ' fragments', x + w - 116, y - 16, { size: 13, weight: '600', col: P.cool });

      // the piece being worked on
      const lw = 360;
      U.text('CHOOSE A PIECE', x, ly, { size: 12, weight: '700', col: P.textFaint });
      let yy = ly + 16;
      for (const slot of ['weapon', 'head', 'chest', 'legs', 'boots']) {
        const it = F.Game.equipped(slot);
        const over = U.row(x, yy, lw, 48, { key: 'ee' + slot, selected: this.sel === slot });
        U.slot(x + 5, yy + 4, 40, { rarity: it ? F.Forge.gradeColor(it.grade) : null, empty: !it });
        if (it) {
          const ic = F.ItemIcon(it);
          if (ic) { g.save(); g.imageSmoothingEnabled = false; g.drawImage(ic, x + 8, yy + 6, 34, 34 * (ic.height / ic.width)); g.restore(); }
        }
        U.text(it ? it.name : 'nothing worn', x + 54, yy + 22, { size: 13.5, weight: '600', col: it ? it.color : P.textFaint });
        U.text(it ? (it.enh ? '+' + it.enh : 'unworked') + (it.rune ? '  ·  ' + F.RUNES[it.rune].n : '') + (it.spell ? '  ·  ' + F.SPELLS[it.spell].n : '') : '',
          x + 54, yy + 38, { size: 11, col: P.textDim });
        if (over && U.mclick && U.consume() && it) { this.sel = slot; F.Audio.ui(); }
        yy += 52;
      }

      const it = this.sel ? F.Game.equipped(this.sel) : null;
      const rx = x + lw + 30, rw = w - lw - 30;
      if (!it) { U.text('Pick something you are wearing.', rx + rw / 2, ly + 120, { size: 15, align: 'center', col: P.textDim }); return; }

      if (this.tab === 0) {
        const cost = F.Forge.enhCost(it.enh || 0);
        const can = (it.enh || 0) < F.Forge.MAX_ENH && s.gold >= cost.gold && s.essence >= cost.essence && gemCount(s) >= cost.gems;
        U.text(it.name, rx, ly + 16, { size: 19, weight: '700', display: true, col: it.color });
        U.text('Enhancement +' + (it.enh || 0) + '  →  +' + ((it.enh || 0) + 1), rx, ly + 44, { size: 15, col: P.text });
        U.text('Stats x' + F.Forge.enhMult(it).toFixed(2) + '  →  x' + (1 + 0.085 * ((it.enh || 0) + 1)).toFixed(2),
          rx, ly + 68, { size: 14, col: P.brassHi });
        U.rule(rx, ly + 84, rw - 20);
        U.text('Cost', rx, ly + 110, { size: 12, weight: '700', col: P.textFaint });
        let cy2 = ly + 132;
        const costs = [['gold', F.U.fmt(cost.gold) + ' gold', s.gold >= cost.gold, P.gold],
                       ['essence', cost.essence + ' essence', s.essence >= cost.essence, P.magic]];
        if (cost.gems) costs.push(['gem', cost.gems + ' gem' + (cost.gems > 1 ? 's' : ''), gemCount(s) >= cost.gems, P.cool]);
        for (const [, t, ok, c] of costs) {
          U.text(t, rx, cy2, { size: 14, col: ok ? c : P.bad });
          cy2 += 24;
        }
        if ((it.enh || 0) >= F.Forge.MAX_ENH) U.text('This is as far as it goes.', rx, cy2 + 10, { size: 14, col: P.brassHi });
        else if (U.btn(rx, cy2 + 16, 220, 48, 'ENHANCE', { primary: can, disabled: !can, display: true })) {
          this.buy(cost.gold, () => {
            s.essence -= cost.essence;
            if (cost.gems) spendGems(s, cost.gems);
            it.enh = (it.enh || 0) + 1;
            it.value = Math.round(it.value * 1.12);
            F.Audio.forgeHit(0.9);
            F.Game.toast(it.name + ' is now +' + it.enh, P.brassHi, 3);
          });
        }
      } else if (this.tab === 1) {
        const target = it.kind === 'weapon' ? 'weapon' : 'armor';
        let yy2 = ly + 12;
        for (const id in F.RUNES) {
          const R = F.RUNES[id];
          if (R.target !== target && !(R.target === 'pick')) continue;
          if (R.target === 'pick') continue;
          const on = it.rune === id;
          const can = !on && s.frags >= R.frags && s.gold >= R.gold;
          U.row(rx, yy2, rw - 20, 56, { key: 'r' + id, selected: on });
          U.text(R.n, rx + 14, yy2 + 24, { size: 15, weight: '600', col: on ? P.good : P.text });
          U.text(R.desc, rx + 14, yy2 + 42, { size: 12, col: P.textDim });
          U.text(R.frags + ' frags  ·  ' + F.U.fmt(R.gold) + 'g', rx + rw - 150, yy2 + 24, { size: 12, align: 'right', col: can ? P.gold : P.textFaint });
          if (!on && U.btn(rx + rw - 130, yy2 + 10, 100, 36, 'FIT', { primary: can, disabled: !can, size: 14 }))
            this.buy(R.gold, () => { s.frags -= R.frags; it.rune = id; F.Game.toast(R.n + ' fitted', P.cool, 3); });
          yy2 += 60;
        }
        // pick runes live here too
        U.rule(rx, yy2 + 4, rw - 20);
        U.text('FOR THE PICKAXE', rx, yy2 + 28, { size: 12, weight: '700', col: P.textFaint });
        yy2 += 40;
        for (const id in F.RUNES) {
          const R = F.RUNES[id];
          if (R.target !== 'pick') continue;
          const on = s.pickRune === id;
          const can = !on && s.frags >= R.frags && s.gold >= R.gold;
          U.row(rx, yy2, rw - 20, 46, { key: 'pr' + id, selected: on });
          U.text(R.n, rx + 14, yy2 + 20, { size: 14, weight: '600', col: on ? P.good : P.text });
          U.text(R.desc, rx + 14, yy2 + 36, { size: 11, col: P.textDim });
          if (!on && U.btn(rx + rw - 130, yy2 + 5, 100, 34, 'FIT', { primary: can, disabled: !can, size: 13 }))
            this.buy(R.gold, () => { s.frags -= R.frags; s.pickRune = id; F.Game.toast(R.n + ' fitted', P.cool, 3); });
          yy2 += 50;
        }
      } else {
        const target = it.kind === 'weapon' ? 'weapon' : 'armor';
        let yy2 = ly + 12;
        for (const id in F.SPELLS) {
          const S = F.SPELLS[id];
          if (S.target !== target) continue;
          const on = it.spell === id;
          const can = !on && s.gold >= S.cost;
          U.row(rx, yy2, rw - 20, 56, { key: 's' + id, selected: on });
          U.text(S.n, rx + 14, yy2 + 24, { size: 15, weight: '600', col: on ? P.good : S.col });
          U.text(S.desc, rx + 14, yy2 + 42, { size: 12, col: P.textDim });
          U.text(F.U.fmt(S.cost) + 'g', rx + rw - 150, yy2 + 30, { size: 13, align: 'right', col: can ? P.gold : P.textFaint });
          if (!on && U.btn(rx + rw - 130, yy2 + 10, 100, 36, 'CAST', { primary: can, disabled: !can, size: 14 }))
            this.buy(S.cost, () => { it.spell = id; it.glowCol = F.Forge.glowOf(it); F.Game.toast(S.n + ' bound', S.col, 3); });
          yy2 += 60;
        }
      }
    }

    // ------------------------------------------------------------ potions
    alch(x, y, w, h) {
      const U = F.UI, s = F.Game.s;
      const cols = 2, cw = w / cols;
      let i = 0;
      for (const id of F.POTION_ORDER) {
        const pot = F.POTIONS[id];
        const cx = x + (i % cols) * cw, cy = y + 12 + Math.floor(i / cols) * 82;
        i++;
        U.row(cx, cy, cw - 16, 74, { key: 'po' + id });
        F.Hud.potionIcon(U.g, cx + 34, cy + 36, 22, pot.col);
        U.text(pot.n, cx + 66, cy + 26, { size: 15, weight: '600', col: P.text });
        U.text(pot.desc, cx + 66, cy + 44, { size: 12, col: P.textDim });
        U.text('you have ' + (s.potions[id] || 0), cx + 66, cy + 62, { size: 11, col: P.textFaint });
        const can = s.gold >= pot.cost;
        U.text(F.U.fmt(pot.cost) + 'g', cx + cw - 150, cy + 32, { size: 13, align: 'right', col: can ? P.gold : P.bad });
        if (U.btn(cx + cw - 130, cy + 12, 52, 34, 'x1', { primary: can, disabled: !can, size: 13 }))
          this.buy(pot.cost, () => { s.potions[id] = (s.potions[id] || 0) + 1; });
        if (U.btn(cx + cw - 72, cy + 12, 52, 34, 'x5', { disabled: s.gold < pot.cost * 5, size: 13 }))
          this.buy(pot.cost * 5, () => { s.potions[id] = (s.potions[id] || 0) + 5; });
      }
    }

    // ----------------------------------------------------------- merchant
    merchant(x, y, w, h) {
      const U = F.UI, g = U.g, s = F.Game.s;
      this.tab = U.tabs(x, y, w, ['SELL ORE', 'SELL GEAR', 'SELL GEMS'], this.tab);
      const ly = y + 52;
      const mult = F.Game.sellMult();
      if (this.tab === 0) {
        U.text('The merchant pays raw-stock prices. Forging it first pays far better.',
          x + w / 2, ly, { size: 12.5, align: 'center', col: P.textDim });
        const cols = 3, cw = w / cols;
        let i = 0, all = 0;
        for (const id of F.ORE_IDS) {
          const n = s.ores[id] || 0;
          if (!n) continue;
          const O = F.ORES[id];
          const price = Math.round(O.val * 0.62 * mult);
          all += n * price;
          const cx = x + (i % cols) * cw, cy = ly + 22 + Math.floor(i / cols) * 58;
          i++;
          U.row(cx, cy, cw - 14, 50, { key: 'so' + id });
          U.icon('ore_drop', cx + 22, cy + 24, 22, O.col);
          U.text(O.n, cx + 42, cy + 20, { size: 13, weight: '600', col: P.text });
          U.text(n + ' × ' + price + 'g', cx + 42, cy + 36, { size: 11, col: P.gold });
          if (U.btn(cx + cw - 120, cy + 8, 46, 34, 'ALL', { size: 12 })) {
            const got = F.Game.addGold(n * price);
            F.Quests.onEvent(s, 'gold', { n: got });
            s.ores[id] = 0; F.Audio.coin();
          }
          if (U.btn(cx + cw - 68, cy + 8, 46, 34, '10', { size: 12, disabled: n < 1 })) {
            const k = Math.min(10, n);
            const got = F.Game.addGold(k * price);
            F.Quests.onEvent(s, 'gold', { n: got });
            s.ores[id] -= k; F.Audio.coin();
          }
        }
        if (!i) U.text('Nothing to sell.', x + w / 2, ly + 120, { size: 15, align: 'center', col: P.textFaint });
        else U.text('Everything on this page: ' + F.U.fmt(all) + ' gold', x + w / 2, y + h - 6,
          { size: 13, align: 'center', col: P.gold });
      } else if (this.tab === 1) {
        const items = s.items.filter(it => s.equip[it.slot] !== it.id).sort((a, b) => b.value - a.value);
        const gw = 78, cols = Math.floor(w / gw);
        let i = 0;
        for (const it of items) {
          const cx = x + (i % cols) * gw, cy = ly + 14 + Math.floor(i / cols) * gw;
          i++;
          if (cy > y + h - 60) break;
          const over = U.slot(cx, cy, gw - 8, { rarity: F.Forge.gradeColor(it.grade), key: 'sg' + it.id });
          const ic = F.ItemIcon(it);
          if (ic) { g.save(); g.imageSmoothingEnabled = false; g.drawImage(ic, cx + 6, cy + 4, gw - 20, (gw - 20) * (ic.height / ic.width)); g.restore(); }
          U.text(F.U.fmt(Math.round(it.value * mult)), cx + gw / 2 - 4, cy + gw - 14,
            { size: 11, weight: '700', align: 'center', col: P.gold });
          if (over) {
            this.tip = { x: U.mx, y: U.my, it };
            if (U.mclick && U.consume()) {
              const got = F.Game.addGold(Math.round(it.value * mult));
              F.Quests.onEvent(s, 'gold', { n: got });
              F.Game.removeItem(it.id);
              F.Game.toast('+' + F.U.fmt(got) + ' gold', P.gold, 2);
              F.Audio.coin();
            }
          }
        }
        if (!i) U.text('Nothing spare to sell.', x + w / 2, ly + 120, { size: 15, align: 'center', col: P.textFaint });
        else U.text('Click a piece to sell it. Worn gear is not listed.', x + w / 2, y + h - 6,
          { size: 12.5, align: 'center', col: P.textDim });
      } else {
        let i = 0;
        for (const id in F.GEMS) {
          const G = F.GEMS[id], n = s.gems[id] || 0;
          const cy = ly + 20 + i * 62; i++;
          U.row(x, cy, w, 54, { key: 'sgm' + id });
          U.icon('gem_drop', x + 28, cy + 26, 26, G.col);
          U.text(G.n, x + 56, cy + 24, { size: 15, weight: '600', col: n ? G.col : P.textFaint });
          U.text(n + ' × ' + Math.round(G.val * mult) + 'g', x + 56, cy + 42, { size: 12, col: P.gold });
          if (U.btn(x + w - 140, cy + 10, 110, 36, 'SELL ALL', { disabled: !n, size: 13 })) {
            const got = F.Game.addGold(n * Math.round(G.val * mult));
            F.Quests.onEvent(s, 'gold', { n: got });
            s.gems[id] = 0; F.Audio.coin();
          }
        }
        U.text('Gems are worth keeping if you plan to enhance past +5.', x + w / 2, y + h - 6,
          { size: 12.5, align: 'center', col: P.textDim });
      }
    }

    // ------------------------------------------------------------- shrine
    shrine(x, y, w, h) {
      const U = F.UI, g = U.g, s = F.Game.s;
      const race = F.Game.race(), tier = F.RACE_TIERS[s.raceTier] || F.RACE_TIERS[0];
      U.text('YOUR BLOOD', x + w / 2, y + 20, { size: 12, weight: '700', align: 'center', col: P.textFaint });
      U.text(race.n, x + w / 2, y + 66, {
        size: 44, weight: '700', display: true, align: 'center',
        col: tier.col, glow: tier.col, glowBlur: 26,
      });
      U.text(tier.n.toUpperCase(), x + w / 2, y + 92, { size: 14, weight: '700', align: 'center', col: tier.col });
      U.text(race.desc, x + w / 2, y + 124, { size: 17, align: 'center', col: P.text });

      U.rule(x + 120, y + 152, w - 240);
      U.text('Spins come from levels, deeds and dead bosses. You have ' + (s.spins || 0) + '.',
        x + w / 2, y + 184, { size: 14, align: 'center', col: P.textDim });
      const can = (s.spins || 0) > 0 && !this.spin;
      if (U.btn(x + w / 2 - 130, y + 206, 260, 58, 'SPIN', { primary: can, disabled: !can, display: true, size: 22 })) {
        s.spins--;
        this.spin = { t: 0, dur: 2.4, done: false };
        const tierIdx = F.U.wpick(F.RACE_TIERS.map((t, i) => [i, t.w]));
        const pool = F.RACES.map((r, i) => [i, r]).filter(([, r]) => r.t === tierIdx);
        const pick = pool.length ? F.U.pick(pool) : [0, F.RACES[0]];
        this.spin.race = pick[0]; this.spin.tier = tierIdx;
        F.Audio.uiBig();
      }

      // the ladder of tiers
      U.text('WHAT IS IN THERE', x + w / 2, y + 300, { size: 12, weight: '700', align: 'center', col: P.textFaint });
      const tw = w / F.RACE_TIERS.length;
      for (let i = 0; i < F.RACE_TIERS.length; i++) {
        const T = F.RACE_TIERS[i];
        const cx = x + i * tw + tw / 2;
        const pct = (T.w / F.RACE_TIERS.reduce((a, b) => a + b.w, 0) * 100);
        U.text(T.n, cx, y + 328, { size: 13, weight: '600', align: 'center', col: T.col });
        U.text(pct.toFixed(1) + '%', cx, y + 348, { size: 11, align: 'center', col: P.textFaint });
        const names = F.RACES.filter(r => r.t === i).map(r => r.n);
        let ny = y + 372;
        for (const n of names) { U.text(n, cx, ny, { size: 11, align: 'center', col: P.textDim }); ny += 16; }
      }
    }
    drawSpin() {
      const U = F.UI, g = U.g;
      const sp = this.spin;
      const k = F.U.sat(sp.t / sp.dur);
      g.fillStyle = 'rgba(2,1,4,' + (0.55 + k * 0.35) + ')'; g.fillRect(0, 0, U.W, U.H);
      const cx = U.W / 2, cy = U.H / 2;
      if (!sp.done) {
        const idx = Math.floor(sp.t * (30 - k * 26)) % F.RACES.length;
        const r = F.RACES[idx], t = F.RACE_TIERS[r.t];
        U.text(r.n, cx, cy, { size: 54, weight: '700', display: true, align: 'center', col: t.col, alpha: 0.5 + k * 0.5 });
        U.text('...', cx, cy + 50, { size: 20, align: 'center', col: P.textDim });
      } else {
        const T = F.RACE_TIERS[sp.tier], R = F.RACES[sp.race];
        const pop = F.U.ease.outBack(F.U.sat((sp.t - sp.dur) / 0.5));
        g.save();
        g.translate(cx, cy); g.scale(0.7 + pop * 0.3, 0.7 + pop * 0.3); g.translate(-cx, -cy);
        U.text(T.n.toUpperCase(), cx, cy - 60, { size: 20, weight: '700', align: 'center', col: T.col });
        U.text(R.n, cx, cy + 10, { size: 66, weight: '700', display: true, align: 'center', col: T.col, glow: T.col, glowBlur: 40 });
        U.text(R.desc, cx, cy + 56, { size: 19, align: 'center', col: P.text });
        g.restore();
        if (sp.t > sp.dur + 0.9) U.text('click to continue', cx, cy + 130, { size: 14, align: 'center', col: P.textFaint });
      }
    }

    // -------------------------------------------------------------- board
    board(x, y, w, h) {
      const U = F.UI, s = F.Game.s;
      let yy = y + 10;
      for (const q of s.quests || []) {
        U.row(x, yy, w, 100, { key: 'bq' + q.id });
        U.text(q.title, x + 20, yy + 30, { size: 19, weight: '600', display: true, col: q.done ? P.good : P.text });
        U.text(q.desc, x + 20, yy + 52, { size: 13, col: P.textDim });
        let rx = x + 20;
        rx += U.chip(rx, yy + 66, F.U.fmt(q.gold) + ' gold', P.gold) + 8;
        rx += U.chip(rx, yy + 66, F.U.fmt(q.xp) + ' xp', P.xp) + 8;
        rx += U.chip(rx, yy + 66, q.essence + ' essence', P.magic) + 8;
        if (q.frags) U.chip(rx, yy + 66, q.frags + ' frags', P.cool);
        if (q.need > 1) {
          U.bar(x + w - 300, yy + 30, 210, 12, q.prog / q.need, { col: q.done ? P.good : P.brass, glow: false });
          U.text(q.prog + ' / ' + q.need, x + w - 195, yy + 62, { size: 13, align: 'center', col: P.textDim });
        }
        if (q.done && U.btn(x + w - 190, yy + 14, 160, 44, 'HAND IN', { primary: true, display: true }))
          { F.Quests.claim(s, q); F.Audio.uiBig(); }
        yy += 104;
      }
      U.text('Jobs refresh as you claim them.', x + w / 2, y + h - 4, { size: 12.5, align: 'center', col: P.textFaint });
    }
  }

  function gemCount(s) { let n = 0; for (const k in s.gems) n += s.gems[k]; return n; }
  function spendGems(s, n) {
    for (const k in F.GEMS) {
      while (n > 0 && (s.gems[k] || 0) > 0) { s.gems[k]--; n--; }
      if (n <= 0) break;
    }
  }

  F.ShopScene = ShopScene;

})(window.F2 = window.F2 || {});
