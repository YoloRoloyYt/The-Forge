'use strict';
// ---------------------------------------------------------------------------
// forge.js — pure ore-combination and quality maths. No rendering, no DOM,
// fully unit-tested in tests.html.
//
// The two questions the whole game hangs off:
//   how much ore did you put in   -> what KIND of thing you get
//   how well did you forge it     -> how GOOD that thing is
// ---------------------------------------------------------------------------
(function (F) {

  const Forge = F.Forge = {
    MIN_ORE: 3,
    MAX_ORE: 120,

    total(ores) { let t = 0; for (const k in ores) t += ores[k]; return t; },

    /** Item class from ore count. Walks the table backwards to the first fit. */
    classFor(order, table, total) {
      let pick = order[0];
      for (const id of order) if (total >= table[id].min) pick = id;
      return pick;
    },
    weaponClass(total) { return this.classFor(F.CLS_ORDER, F.CLS, total); },
    armorClass(total) { return this.classFor(F.ARM_ORDER, F.ARMOR_CLS, total); },

    /** Average stat multiplier of the melt, weighted by count. */
    avgMult(ores) {
      const t = this.total(ores);
      if (!t) return 0;
      let s = 0;
      for (const k in ores) s += (F.ORES[k] ? F.ORES[k].mult : 0) * ores[k];
      return s / t;
    },
    rawValue(ores) {
      let v = 0;
      for (const k in ores) v += (F.ORES[k] ? F.ORES[k].val : 0) * ores[k];
      return v;
    },

    /**
     * Trait ores grant their passive once they are >=18% of the melt. Strength
     * scales with share, so a token handful is a whisper and half the crucible
     * is the real thing. At most two traits survive — the two largest shares.
     */
    traits(ores) {
      const t = this.total(ores);
      const out = [];
      if (!t) return out;
      for (const k in ores) {
        const o = F.ORES[k];
        if (!o || o.role !== 'trait' || !ores[k]) continue;
        const share = ores[k] / t;
        if (share < 0.18) continue;
        out.push({ id: o.trait, share, s: +Math.min(1.6, share * 2.4).toFixed(2) });
      }
      out.sort((a, b) => b.share - a.share);
      return out.slice(0, 2);
    },

    /** The item's colours come from the ore, as they always have. */
    palette(ores) {
      const present = Object.keys(ores).filter(k => ores[k] > 0 && F.ORES[k]);
      if (!present.length) return { main: '#8d929c', dark: '#585d68', accent: '#8d929c', mainId: 'stone', accentId: 'stone' };
      const byCount = present.slice().sort((a, b) => ores[b] - ores[a]);
      const byValue = present.slice().sort((a, b) => ores[b] * F.ORES[b].val - ores[a] * F.ORES[a].val);
      const main = byCount[0];
      const accent = byValue.find(k => k !== main) || main;
      return {
        main: F.ORES[main].col, dark: F.ORES[main].col2,
        accent: F.ORES[accent].col, mainId: main, accentId: accent,
      };
    },

    /**
     * Quality 0-100 -> stat multiplier.
     * Deliberately steep at the top: the gap between a Fine and a Masterwork is
     * the reward for actually learning the minigame.
     */
    qualityMult(q) {
      q = F.U.clamp(q, 0, 100);
      if (q < 35) return 0.62 + 0.16 * (q / 35);
      if (q < 55) return 0.78 + 0.12 * ((q - 35) / 20);
      if (q < 72) return 0.90 + 0.14 * ((q - 55) / 17);
      if (q < 85) return 1.04 + 0.16 * ((q - 72) / 13);
      if (q < 94) return 1.20 + 0.18 * ((q - 85) / 9);
      if (q < 99) return 1.38 + 0.16 * ((q - 94) / 5);
      return 1.54 + 0.08 * ((q - 99) / 1);
    },
    grade(q) {
      let g = F.GRADES[0];
      for (const t of F.GRADES) if (q >= t.min) g = t;
      return g.n;
    },
    gradeColor(name) {
      for (const t of F.GRADES) if (t.n === name) return t.col;
      return '#ffffff';
    },
    isMasterwork(q) { return q >= 99; },

    /** Build the finished item. spec: { kind, slot, ores, quality } */
    create(spec, id) {
      const total = this.total(spec.ores);
      const q = F.U.clamp(spec.quality, 0, 100);
      const qm = this.qualityMult(q) * (this.isMasterwork(q) ? 1.08 : 1);
      const tierMult = 0.55 + this.avgMult(spec.ores);
      const pal = this.palette(spec.ores);
      const traits = this.traits(spec.ores);
      const grade = this.grade(q);
      const it = {
        id, kind: spec.kind,
        slot: spec.kind === 'weapon' ? 'weapon' : spec.slot,
        ores: Object.assign({}, spec.ores),
        oreCount: total,
        quality: Math.round(q * 10) / 10,
        grade, master: this.isMasterwork(q),
        traits,
        color: pal.main, color2: pal.dark, accent: pal.accent, mainOre: pal.mainId,
        enh: 0, rune: null, spell: null,
        seed: (Math.random() * 1e6) | 0,
      };
      if (spec.kind === 'weapon') {
        const cls = this.weaponClass(total), c = F.CLS[cls];
        it.cls = cls;
        it.stats = {
          dmg: +(c.dmg * tierMult * qm).toFixed(1),
          cd: c.cd, wind: c.wind, range: c.range, arc: c.arc, sta: c.sta,
          knock: c.knock, heavy: c.heavy,
        };
      } else {
        const cls = this.armorClass(total), c = F.ARMOR_CLS[cls], sf = F.SLOTS[spec.slot].f;
        it.cls = cls;
        it.stats = {
          def: +(c.def * sf * tierMult * qm).toFixed(1),
          hp: Math.round(c.hp * sf * tierMult * qm),
          slow: +(c.slow * (sf > 1 ? 1.3 : 0.8)).toFixed(4),
        };
      }
      it.value = this.sellValue(spec.ores, q);
      it.name = this.nameOf(it);
      it.glowCol = this.glowOf(it);
      return it;
    },

    /** Forging skill converts directly into income. */
    sellValue(ores, q) {
      return Math.max(1, Math.round(this.rawValue(ores) * 1.75 * Math.pow(this.qualityMult(q), 2.1)));
    },

    nameOf(it) {
      const base = it.kind === 'weapon' ? F.CLS[it.cls].n : F.SLOTS[it.slot].n;
      const ore = F.ORES[it.mainOre] ? F.ORES[it.mainOre].n : 'Slag';
      const tr = it.traits.length ? F.TRAITS[it.traits[0].id].n + ' ' : '';
      return (it.master ? 'Masterwork ' : '') + tr + ore + ' ' + base;
    },

    /** Glow colour from the strongest trait, a spell, or a luminous ore. */
    glowOf(it) {
      if (it.spell && F.SPELLS[it.spell]) return F.SPELLS[it.spell].col;
      if (it.traits.length) return F.TRAITS[it.traits[0].id].col;
      const o = F.ORES[it.mainOre];
      return (o && o.glow && o.glowAmt >= 0.3) ? o.glow : null;
    },

    hasTrait(it, id) {
      if (!it || !it.traits) return 0;
      for (const t of it.traits) if (t.id === id) return t.s;
      return 0;
    },

    enhMult(it) { return 1 + 0.085 * ((it && it.enh) || 0); },
    enhCost(level) {
      return {
        gold: Math.round(900 * Math.pow(level + 1, 2.35)),
        essence: level + 1,
        gems: level >= 5 ? Math.ceil((level - 3) / 2) : 0,
      };
    },
    MAX_ENH: 12,

    describe(it) {
      if (!it) return '';
      const m = this.enhMult(it);
      if (it.kind === 'weapon')
        return 'DMG ' + (it.stats.dmg * m).toFixed(1) + '   SPD ' + it.stats.cd.toFixed(2) + 's   RNG ' + it.stats.range;
      return 'DEF ' + (it.stats.def * m).toFixed(1) + '   HP +' + Math.round(it.stats.hp * m);
    },

    /** Preview an item without committing it — used by the crucible UI. */
    preview(kind, slot, ores, quality) {
      if (this.total(ores) < this.MIN_ORE) return null;
      return this.create({ kind, slot, ores, quality: quality === undefined ? 70 : quality }, -1);
    },
  };

})(window.F2 = window.F2 || {});
