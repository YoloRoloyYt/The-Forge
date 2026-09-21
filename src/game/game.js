'use strict';
// ---------------------------------------------------------------------------
// game.js — the run: player state, inventory, progression, the scene stack.
// ---------------------------------------------------------------------------
(function (F) {

  const G = F.Game = {
    time: 0, dt: 0, paused: false,
    stack: [], toasts: [], floaters: [],
    shake: 0, shakeX: 0, shakeY: 0, hitStop: 0,
    settings: { volume: 0.7, music: 0.45, muted: false, shake: 1, grain: 1, bloom: 1, shadows: 1, hints: 1 },

    // ------------------------------------------------------------ the run
    newRun() {
      this.s = {
        version: 1,
        name: 'Ashen',
        level: 1, xp: 0,
        gold: 120, essence: 0, frags: 0, spins: 1,
        gems: {},
        hp: 100, maxHpBase: 100,
        ores: {},
        items: [],            // every forged item still owned
        nextItemId: 1,
        equip: { weapon: null, head: null, chest: null, legs: null, boots: null },
        pick: 0, lantern: 0,
        potions: {}, hotbar: [null, null, null, null, null, null],
        race: 0, raceTier: 0,
        depth: 1, deepest: 1,
        bossesDown: {},
        quests: [], questsDone: 0, questSeed: 1,
        achievements: {},
        stats: { mined: 0, forged: 0, kills: 0, deaths: 0, bestQuality: 0, goldEarned: 0, masterworks: 0, runTime: 0 },
        seen: {},             // tutorial hints already shown
        forgeBonus: 0,        // from a Forgemaster Dram
        buffs: {},
      };
      this.s.hp = this.maxHp();
      F.Quests.reroll(this.s, true);
      return this.s;
    },

    load() {
      const v = F.Save.read();
      if (!v || v.version !== 1) return false;
      this.s = v;
      // defensive: fill anything a future version might have added
      const d = this.newRunTemplate();
      for (const k in d) if (this.s[k] === undefined) this.s[k] = d[k];
      return true;
    },
    newRunTemplate() {
      const keep = this.s;
      this.newRun();
      const t = this.s;
      this.s = keep;
      return t;
    },
    save() { if (this.s) F.Save.write(this.s); },

    // ------------------------------------------------------- derived stats
    race() { return F.RACES[this.s.race] || F.RACES[0]; },
    raceMod(k) { const m = this.race().mods; return m[k] || 0; },

    equipped(slot) {
      const id = this.s.equip[slot];
      if (id === null || id === undefined) return null;
      return this.itemById(id);
    },
    itemById(id) {
      const list = this.s.items;
      for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    weapon() { return this.equipped('weapon') || F.FISTS; },

    armorPieces() {
      const out = [];
      for (const s of F.ARMOR_SLOTS) { const it = this.equipped(s); if (it) out.push(it); }
      return out;
    },

    maxHp() {
      let hp = this.s.maxHpBase + (this.s.level - 1) * 14;
      let glassPenalty = 0, vitality = 0;
      for (const it of this.armorPieces()) {
        const m = F.Forge.enhMult(it);
        let add = it.stats.hp * m;
        const glass = F.Forge.hasTrait(it, 'glass');
        if (glass) add *= 0.5;
        if (it.rune === 'vigor') vitality += 0.20;
        if (it.spell === 'vitality') vitality += 0.18;
        hp += add;
      }
      const w = this.weapon();
      if (F.Forge.hasTrait(w, 'glass')) glassPenalty += 0.18;
      hp *= (1 + vitality + this.raceMod('hp') - glassPenalty);
      if (this.buff('prot')) hp *= 1.0;
      return Math.max(20, Math.round(hp));
    },

    defense() {
      let def = 0, mult = 1;
      for (const it of this.armorPieces()) {
        const m = F.Forge.enhMult(it);
        let d = it.stats.def * m;
        const volc = F.Forge.hasTrait(it, 'volcanic');
        const glass = F.Forge.hasTrait(it, 'glass');
        if (volc) d *= 1 + 0.22 * volc;
        if (glass) d *= 1 + 0.34 * glass;
        if (it.rune === 'ward') d *= 1.15;
        if (it.spell === 'fortify') d *= 1.18;
        def += d;
      }
      mult += this.raceMod('def');
      if (this.buff('prot')) mult += 0.35;
      return def * mult;
    },
    /** Damage taken is scaled by this. Diminishing, never zero. */
    damageTaken(raw) {
      const def = this.defense();
      return raw * (120 / (120 + def));
    },

    attackPower() {
      const w = this.weapon();
      let dmg = w.stats.dmg * F.Forge.enhMult(w);
      let mult = 1 + this.raceMod('dmg');
      const volc = F.Forge.hasTrait(w, 'volcanic');
      const glass = F.Forge.hasTrait(w, 'glass');
      const etern = F.Forge.hasTrait(w, 'eternal');
      if (volc) mult += 0.12 * volc;
      if (glass) mult += 0.45 * glass;
      if (etern) mult += 0.25 * etern;
      if (w.spell === 'flame') mult += 0.18;
      if (this.buff('str')) mult += 0.30;
      if (this.s.buffs.berserk) mult += 0.60;
      return dmg * mult;
    },

    minePower() {
      const p = F.PICKS[this.s.pick];
      let mp = p.mp;
      let mult = 1 + this.raceMod('mine');
      if (this.s.pickRune === 'mine') mult += 0.35;
      if (this.buff('haste')) mult += 0.15;
      if (this.s.buffs.frenzy) mult += 1.0;
      return mp * mult;
    },
    mineSpeed() {
      let s = F.PICKS[this.s.pick].spd * (1 + this.raceMod('mspd'));
      if (this.s.pickRune === 'swift') s *= 1.25;
      if (this.buff('haste')) s *= 1.25;
      return s;
    },
    oreYield() {
      let y = 1 + this.raceMod('yield');
      if (this.s.pickRune === 'yield') y += 0.25;
      if (this.buff('fort')) y += 0.45;
      return y;
    },
    luck() {
      let l = 0;
      if (this.buff('luck')) l += 0.8;
      return l;
    },
    goldMult() {
      let g = 1 + this.raceMod('gold');
      if (this.s.buffs.goldRush) g += 1.0;
      return g;
    },
    sellMult() { return 1 + this.raceMod('sell'); },
    lightRadius() {
      const L = F.LANTERNS[this.s.lantern];
      return L.r * (1 + this.raceMod('light'));
    },
    moveSpeed() {
      let s = 96 * (1 + this.raceMod('spd'));
      for (const it of this.armorPieces()) s *= (1 - it.stats.slow);
      if (this.buff('haste')) s *= 1.08;
      return s;
    },

    // ------------------------------------------------------------- buffs
    buff(id) { const b = this.s.buffs[id]; return b && b > 0 ? b : 0; },
    addBuff(id, dur) { this.s.buffs[id] = Math.max(this.s.buffs[id] || 0, dur); },
    tickBuffs(dt) {
      const b = this.s.buffs;
      for (const k in b) { b[k] -= dt; if (b[k] <= 0) delete b[k]; }
    },

    // -------------------------------------------------------- progression
    addXp(n) {
      if (this.s.level >= F.MAX_LEVEL) return;
      this.s.xp += Math.round(n);
      let gained = 0;
      while (this.s.level < F.MAX_LEVEL && this.s.xp >= F.xpNeeded(this.s.level)) {
        this.s.xp -= F.xpNeeded(this.s.level);
        this.s.level++; gained++;
        this.s.spins++;
      }
      if (gained) {
        this.s.hp = this.maxHp();
        F.Audio.levelUp();
        this.toast('Level ' + this.s.level, '#ffd23f', 3);
        this.toast('+' + gained + ' shrine spin' + (gained > 1 ? 's' : ''), '#b76cff', 3);
      }
    },
    addGold(n) {
      n = Math.round(n * this.goldMult());
      this.s.gold += n;
      this.s.stats.goldEarned += n;
      return n;
    },
    addOre(id, n) {
      this.s.ores[id] = (this.s.ores[id] || 0) + n;
      this.s.stats.mined += n;
      F.Quests.onEvent(this.s, 'mine', { ore: id, n });
    },
    addGem(id, n) { this.s.gems[id] = (this.s.gems[id] || 0) + (n || 1); },
    oreCount(id) { return this.s.ores[id] || 0; },
    totalOre() { let t = 0; for (const k in this.s.ores) t += this.s.ores[k]; return t; },

    addItem(it) {
      it.id = this.s.nextItemId++;
      this.s.items.push(it);
      this.s.stats.forged++;
      if (it.quality > this.s.stats.bestQuality) this.s.stats.bestQuality = it.quality;
      if (it.master) this.s.stats.masterworks++;
      F.Quests.onEvent(this.s, 'forge', { item: it });
      F.Achieve.check(this.s);
      return it;
    },
    removeItem(id) {
      const i = this.s.items.findIndex(x => x.id === id);
      if (i < 0) return null;
      const it = this.s.items[i];
      this.s.items.splice(i, 1);
      for (const slot in this.s.equip) if (this.s.equip[slot] === id) this.s.equip[slot] = null;
      return it;
    },
    equip(it) {
      if (!it) return;
      this.s.equip[it.slot] = it.id;
      this.s.hp = Math.min(this.s.hp, this.maxHp());
    },
    unequip(slot) { this.s.equip[slot] = null; this.s.hp = Math.min(this.s.hp, this.maxHp()); },

    depthUnlocked(d) {
      const D = F.DEPTHS[d - 1];
      if (!D) return false;
      if (this.s.level < D.gate) return false;
      if (D.boss && !this.s.bossesDown[D.boss]) return false;
      return true;
    },
    depthLock(d) {
      const D = F.DEPTHS[d - 1];
      if (!D) return 'Sealed';
      if (this.s.level < D.gate) return 'Requires level ' + D.gate;
      if (D.boss && !this.s.bossesDown[D.boss]) return 'Defeat ' + F.BOSSES[D.boss].n;
      return null;
    },
    bossUnlocked(id) {
      const B = F.BOSSES[id];
      if (!B) return false;
      const idx = F.BOSS_ORDER.indexOf(id);
      if (idx > 0 && !this.s.bossesDown[F.BOSS_ORDER[idx - 1]]) return false;
      return this.s.deepest >= B.after;
    },
    /** Rough measure of how strong the player is, for boss gates. */
    power() {
      const w = this.weapon();
      const atk = this.attackPower() / Math.max(0.2, w.stats.cd);
      return Math.round(atk * 8 + this.maxHp() * 1.2 + this.defense() * 6 + this.s.level * 20);
    },

    // ------------------------------------------------------------ feedback
    toast(text, col, dur) {
      this.toasts.push({ text, col: col || F.PAL.text, t: dur || 2.4, max: dur || 2.4 });
      if (this.toasts.length > 7) this.toasts.shift();
    },
    floater(x, y, text, col, opt) {
      opt = opt || {};
      this.floaters.push({
        x, y, text, col: col || '#ffffff', t: opt.life || 0.9, max: opt.life || 0.9,
        vy: opt.vy === undefined ? -30 : opt.vy, vx: opt.vx || 0,
        size: opt.size || 1, crit: !!opt.crit,
      });
      if (this.floaters.length > 90) this.floaters.shift();
    },
    kick(amount, stop) {
      this.shake = Math.max(this.shake, amount * this.settings.shake);
      if (stop) this.hitStop = Math.max(this.hitStop, stop);
    },
    flash(col, amount, dur) {
      F.Render.flashCol = F.Col.lin(col || '#ffffff', 1);
      this._flash = amount; this._flashT = dur || 0.2; this._flashMax = dur || 0.2;
    },

    // -------------------------------------------------------- scene stack
    push(sc) {
      if (this.top() && this.top().pause) this.top().pause();
      this.stack.push(sc);
      if (sc.enter) sc.enter();
      return sc;
    },
    pop() {
      const sc = this.stack.pop();
      if (sc && sc.exit) sc.exit();
      const t = this.top();
      if (t && t.resume) t.resume();
      return sc;
    },
    replace(sc) {
      while (this.stack.length) { const s = this.stack.pop(); if (s.exit) s.exit(); }
      return this.push(sc);
    },
    top() { return this.stack[this.stack.length - 1]; },
    /** The topmost scene that draws the world, used by overlays. */
    world() {
      for (let i = this.stack.length - 1; i >= 0; i--) if (this.stack[i].isWorld) return this.stack[i];
      return null;
    },

    update(dt) {
      this.time += dt;
      if (this.s) this.s.stats.runTime += dt;
      for (let i = this.toasts.length - 1; i >= 0; i--) { this.toasts[i].t -= dt; if (this.toasts[i].t <= 0) this.toasts.splice(i, 1); }
      for (let i = this.floaters.length - 1; i >= 0; i--) {
        const f = this.floaters[i];
        f.t -= dt; f.y += f.vy * dt; f.x += f.vx * dt; f.vy += 42 * dt;
        if (f.t <= 0) this.floaters.splice(i, 1);
      }
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * (8 + this.shake * 5));
        const a = Math.random() * 6.283;
        this.shakeX = Math.cos(a) * this.shake; this.shakeY = Math.sin(a) * this.shake;
      } else { this.shakeX = this.shakeY = 0; }
      if (this._flashT > 0) {
        this._flashT -= dt;
        F.Render.flash = this._flash * F.U.sat(this._flashT / this._flashMax);
      } else F.Render.flash = 0;
    },
  };

})(window.F2 = window.F2 || {});
