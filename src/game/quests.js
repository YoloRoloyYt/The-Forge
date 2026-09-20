'use strict';
// ---------------------------------------------------------------------------
// quests.js — the notice board. Generated, not authored, so the board is
// always relevant to where the player actually is.
// ---------------------------------------------------------------------------
(function (F) {

  const TYPES = ['gather', 'kill', 'forge', 'depth', 'quality', 'sell', 'boss', 'explore'];

  const Q = F.Quests = {
    SLOTS: 4,

    /** Refill the board. `all` wipes unfinished ones too. */
    reroll(s, all) {
      if (!s.quests) s.quests = [];
      if (all) s.quests = [];
      s.quests = s.quests.filter(q => !q.done || q.claimed === false);
      while (s.quests.length < this.SLOTS) s.quests.push(this.make(s));
      return s.quests;
    },

    make(s) {
      const d = Math.max(1, Math.min(s.deepest, F.MAX_DEPTH));
      const lvl = s.level;
      const pool = TYPES.filter(t => {
        if (t === 'boss') return F.BOSS_ORDER.some(b => !s.bossesDown[b] && F.Game.bossUnlocked(b));
        if (t === 'depth') return d < F.MAX_DEPTH;
        if (t === 'quality') return s.stats.forged >= 3;
        return true;
      });
      const type = F.U.pick(pool);
      const scale = Math.pow(1.85, d - 1);
      const q = { id: (s.questSeed = (s.questSeed || 1) + 1), type, prog: 0, done: false, claimed: false };

      switch (type) {
        case 'gather': {
          const cands = F.ORE_IDS.filter(id => {
            const o = F.ORES[id];
            return d >= o.f[0] && d <= o.f[1] + 1 && o.tier <= Math.min(5, Math.floor(d / 1.6) + 1);
          });
          q.ore = F.U.pick(cands.length ? cands : ['stone']);
          const o = F.ORES[q.ore];
          q.need = Math.max(5, Math.round((30 / (1 + o.tier * 1.6)) * (1 + d * 0.25)));
          q.title = 'Bring back ' + q.need + ' ' + o.n;
          q.desc = 'The stores are short. Mine it and hand it in.';
          q.gold = Math.round(o.val * q.need * 1.5 + 60 * scale);
          break;
        }
        case 'kill': {
          const D = F.DEPTHS[d - 1];
          q.mob = F.U.pick(D.mobs);
          q.need = 6 + Math.floor(Math.random() * 8) + Math.floor(d * 1.5);
          q.title = 'Cull ' + q.need + ' ' + F.ENEMIES[q.mob].n;
          q.desc = 'They are breeding in the lower galleries.';
          q.gold = Math.round(F.ENEMIES[q.mob].gold[1] * q.need * 1.6 * scale * 0.6 + 80 * scale);
          break;
        }
        case 'forge': {
          q.need = 2 + Math.floor(Math.random() * 3);
          q.title = 'Forge ' + q.need + ' pieces';
          q.desc = 'Anything counts. The forge wants using.';
          q.gold = Math.round(180 * scale);
          break;
        }
        case 'quality': {
          q.target = [72, 85, 94][Math.min(2, Math.floor(Math.random() * 3))];
          q.need = 1;
          q.title = 'Forge something at ' + q.target + '+ quality';
          q.desc = 'Sloppy work is worse than none.';
          q.gold = Math.round(340 * scale * (q.target / 72));
          break;
        }
        case 'depth': {
          q.depth = Math.min(F.MAX_DEPTH, d + 1);
          q.need = 1;
          q.title = 'Reach ' + F.DEPTHS[q.depth - 1].name;
          q.desc = 'Nobody has come back from that shaft this season.';
          q.gold = Math.round(420 * scale);
          break;
        }
        case 'sell': {
          q.need = Math.round(600 * scale);
          q.title = 'Earn ' + F.U.fmt(q.need) + ' gold';
          q.desc = 'Sell, loot, however you like.';
          q.gold = Math.round(q.need * 0.35);
          break;
        }
        case 'boss': {
          const avail = F.BOSS_ORDER.filter(b => !s.bossesDown[b] && F.Game.bossUnlocked(b));
          q.boss = avail.length ? avail[0] : F.BOSS_ORDER[0];
          q.need = 1;
          q.title = 'Kill ' + F.BOSSES[q.boss].n;
          q.desc = F.BOSSES[q.boss].sub;
          q.gold = Math.round(F.BOSSES[q.boss].gold[0] * 0.5);
          break;
        }
        default: {
          q.need = 1;
          q.title = 'Find a sealed cavern';
          q.desc = 'Look for a cracked, glowing rock and break it open.';
          q.gold = Math.round(300 * scale);
        }
      }
      q.xp = Math.round(q.gold * 0.5 + 40 * lvl);
      q.essence = 1 + Math.floor(d / 2);
      q.frags = Math.random() < 0.45 ? 1 + Math.floor(d / 3) : 0;
      return q;
    },

    onEvent(s, kind, data) {
      if (!s.quests) return;
      for (const q of s.quests) {
        if (q.done) continue;
        let hit = 0;
        if (kind === 'mine' && q.type === 'gather' && data.ore === q.ore) hit = data.n;
        else if (kind === 'kill' && q.type === 'kill' && data.type === q.mob) hit = 1;
        else if (kind === 'forge' && q.type === 'forge') hit = 1;
        else if (kind === 'forge' && q.type === 'quality' && data.item.quality >= q.target) hit = 1;
        else if (kind === 'depth' && q.type === 'depth' && data.depth >= q.depth) hit = 1;
        else if (kind === 'gold' && q.type === 'sell') hit = data.n;
        else if (kind === 'boss' && q.type === 'boss' && data.id === q.boss) hit = 1;
        else if (kind === 'secret' && q.type === 'explore') hit = 1;
        if (!hit) continue;
        q.prog = Math.min(q.need, q.prog + hit);
        if (q.prog >= q.need && !q.done) {
          q.done = true;
          F.Game.toast('Quest ready: ' + q.title, F.PAL.good, 3.2);
        }
      }
    },

    claim(s, q) {
      if (!q.done || q.claimed) return false;
      q.claimed = true;
      F.Game.addGold(q.gold);
      F.Game.addXp(q.xp);
      s.essence += q.essence;
      s.frags += q.frags;
      s.questsDone++;
      const i = s.quests.indexOf(q);
      if (i >= 0) s.quests[i] = this.make(s);
      return true;
    },
  };

})(window.F2 = window.F2 || {});
