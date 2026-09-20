'use strict';
// ---------------------------------------------------------------------------
// forgelogic.js — pure ore-combination + quality maths (no DOM). Unit-tested in tests.html
// ---------------------------------------------------------------------------
const Forge = {
  MIN_ORE: 3,

  total(ores) { let t = 0; for (const k in ores) t += ores[k]; return t; },

  // Item class is decided by how much ore goes into the crucible.
  weaponClass(total) { return total <= 9 ? 'dagger' : total <= 25 ? 'sword' : total <= 39 ? 'greatsword' : 'colossal'; },
  armorClass(total) { return total <= 9 ? 'light' : total <= 25 ? 'medium' : total <= 39 ? 'heavy' : 'bulwark'; },

  avgMult(ores) {
    const t = this.total(ores); if (!t) return 0;
    let s = 0; for (const k in ores) s += ORES[k].mult * ores[k];
    return s / t;
  },
  rawValue(ores) { let v = 0; for (const k in ores) v += ORES[k].val * ores[k]; return v; },

  // Trait ores grant their passive once they make up >=20% of the melt; strength scales with share.
  traits(ores) {
    const t = this.total(ores), out = [];
    if (!t) return out;
    for (const k in ores) {
      const o = ORES[k];
      if (o.role !== 'trait') continue;
      const share = ores[k] / t;
      if (share >= 0.2) out.push({ id: o.trait, s: Math.min(1.5, +(share * 2.5).toFixed(2)) });
    }
    return out;
  },

  // Dominant + accent ore give the item its generated palette.
  palette(ores) {
    const ids = Object.keys(ores).filter(k => ores[k] > 0).sort((a, b) => ores[b] * ORES[b].val - ores[a] * ORES[a].val);
    // weight by count first, value second, so a handful of rare ore still shows through
    const byCount = Object.keys(ores).filter(k => ores[k] > 0).sort((a, b) => ores[b] - ores[a]);
    const main = byCount[0], accent = ids.find(k => k !== main) || main;
    return { main: ORES[main].col, dark: ORES[main].col2, accent: ORES[accent].col, mainId: main, accentId: accent };
  },

  // Quality (0-100) -> stat multiplier. Meaningful: Perfect ~1.4-1.5x a Good item.
  qualityMult(q) {
    if (q < 40) return 0.70 + 0.25 * (q / 40);
    if (q < 70) return 0.95 + 0.15 * ((q - 40) / 30);
    if (q < 95) return 1.10 + 0.20 * ((q - 70) / 25);
    return 1.40 + 0.10 * ((q - 95) / 5);
  },
  grade(q) { return q < 40 ? 'Poor' : q < 70 ? 'Good' : q < 95 ? 'Great' : 'Perfect'; },
  gradeColor(g) { return { Poor: '#9a8f8f', Good: '#e8e4d8', Great: '#5ec8ff', Perfect: '#ffd23f' }[g]; },
  isMasterwork(q) { return q >= 98; },

  // Build the final item from a melt + quality. spec: {kind:'weapon'|'armor', slot, ores, quality}
  create(spec, id) {
    const total = this.total(spec.ores);
    const q = U.clamp(spec.quality, 0, 100);
    const qm = this.qualityMult(q) * (this.isMasterwork(q) ? 1.06 : 1);
    const tierMult = 0.6 + this.avgMult(spec.ores);
    const pal = this.palette(spec.ores);
    const traits = this.traits(spec.ores);
    const grade = this.grade(q);
    const it = {
      id, kind: spec.kind, slot: spec.kind === 'weapon' ? 'weapon' : spec.slot,
      ores: Object.assign({}, spec.ores), quality: Math.round(q * 10) / 10, grade,
      master: this.isMasterwork(q), traits, color: pal.main, color2: pal.dark, accent: pal.accent,
      mainOre: pal.mainId, enh: 0, rune: null, seed: Math.floor(Math.random() * 1e6),
    };
    if (spec.kind === 'weapon') {
      const cls = this.weaponClass(total), c = CLS[cls];
      it.cls = cls;
      it.stats = { dmg: +(c.dmg * tierMult * qm).toFixed(1), cd: c.cd, wind: c.wind, range: c.range, arc: c.arc, sta: c.sta };
    } else {
      const cls = this.armorClass(total), c = ARMOR_CLS[cls], sf = SLOTS[spec.slot].f;
      it.cls = cls;
      it.stats = { def: +(c.def * sf * tierMult * qm).toFixed(1), hp: Math.round(c.hp * sf * tierMult * qm), slow: +(c.slow * (sf > 1 ? 1.3 : 0.8)).toFixed(4) };
    }
    it.value = this.sellValue(spec.ores, q);
    it.name = this.nameOf(it);
    return it;
  },

  // Forging skill converts directly into income.
  sellValue(ores, q) {
    return Math.max(1, Math.round(this.rawValue(ores) * 1.6 * Math.pow(this.qualityMult(q), 2)));
  },

  nameOf(it) {
    const base = it.kind === 'weapon' ? CLS[it.cls].n : SLOTS[it.slot].n;
    const ore = ORES[it.mainOre].n;
    const tr = it.traits.length ? TRAITS[it.traits[0].id].n + ' ' : '';
    return `${it.master ? 'Masterwork ' : ''}${tr}${ore} ${base}`;
  },

  enhMult(it) { return 1 + 0.08 * (it.enh || 0); },
  enhCost(level) { return { gold: Math.round(60 * Math.pow(level + 1, 1.7)), essence: level + 1, gems: level >= 5 ? 1 : 0 }; },

  describeStats(it) {
    const m = this.enhMult(it);
    if (it.kind === 'weapon') return `DMG ${(it.stats.dmg * m).toFixed(1)}  SPD ${it.stats.cd}s  RNG ${it.stats.range}`;
    return `DEF ${(it.stats.def * m).toFixed(1)}  HP +${Math.round(it.stats.hp * m)}`;
  },
};
