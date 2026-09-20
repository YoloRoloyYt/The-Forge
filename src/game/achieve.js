'use strict';
// ---------------------------------------------------------------------------
// achieve.js — milestones. Each grants a shrine spin, which is the only
// currency the shrine takes.
// ---------------------------------------------------------------------------
(function (F) {

  const LIST = F.ACHIEVEMENTS = [
    { id: 'first',      n: 'First Forge',        d: 'Forge anything at all.',                 test: s => s.stats.forged >= 1 },
    { id: 'smith',      n: 'Blacksmith',         d: 'Forge 25 pieces.',                       test: s => s.stats.forged >= 25 },
    { id: 'master',     n: 'Master Forger',      d: 'Forge 100 pieces.',                      test: s => s.stats.forged >= 100 },
    { id: 'flawless',   n: 'Flawless',           d: 'Reach 94 quality.',                      test: s => s.stats.bestQuality >= 94 },
    { id: 'mw',         n: 'Masterwork',         d: 'Forge a Masterwork piece.',              test: s => s.stats.masterworks >= 1 },
    { id: 'mw10',       n: 'Peerless',           d: 'Forge 10 Masterwork pieces.',            test: s => s.stats.masterworks >= 10 },
    { id: 'miner',      n: 'Pit Hand',           d: 'Mine 500 ore.',                          test: s => s.stats.mined >= 500 },
    { id: 'miner2',     n: 'Deepvein',           d: 'Mine 5,000 ore.',                        test: s => s.stats.mined >= 5000 },
    { id: 'miner3',     n: 'The Mine Itself',    d: 'Mine 25,000 ore.',                       test: s => s.stats.mined >= 25000 },
    { id: 'kill100',    n: 'Exterminator',       d: 'Kill 100 things.',                       test: s => s.stats.kills >= 100 },
    { id: 'kill1000',   n: 'Gallery Cleaner',    d: 'Kill 1,000 things.',                     test: s => s.stats.kills >= 1000 },
    { id: 'rich',       n: 'Coinhoard',          d: 'Earn 100,000 gold.',                     test: s => s.stats.goldEarned >= 100000 },
    { id: 'rich2',      n: 'Vaultbreaker',       d: 'Earn 5,000,000 gold.',                   test: s => s.stats.goldEarned >= 5000000 },
    { id: 'd4',         n: 'Down and Down',      d: 'Reach Depth IV.',                        test: s => s.deepest >= 4 },
    { id: 'd8',         n: 'The Heart',          d: 'Reach Depth VIII.',                      test: s => s.deepest >= 8 },
    { id: 'boss1',      n: 'Grovefeller',        d: 'Kill the Ancient Grove Guardian.',       test: s => !!s.bossesDown.grove },
    { id: 'boss3',      n: 'Kingslayer',         d: 'Kill the Infernal King.',                test: s => !!s.bossesDown.infernal },
    { id: 'bossall',    n: 'The Last Forger',    d: 'Kill every boss.',                       test: s => F.BOSS_ORDER.every(b => s.bossesDown[b]) },
    { id: 'lvl20',      n: 'Seasoned',           d: 'Reach level 20.',                        test: s => s.level >= 20 },
    { id: 'lvl40',      n: 'Veteran of the Cut', d: 'Reach level 40.',                        test: s => s.level >= 40 },
    { id: 'quests10',   n: 'Reliable',           d: 'Finish 10 board jobs.',                  test: s => s.questsDone >= 10 },
    { id: 'quests50',   n: 'The Board\'s Own',   d: 'Finish 50 board jobs.',                  test: s => s.questsDone >= 50 },
    { id: 'untouched',  n: 'Untouchable',        d: 'Kill a boss without being hit.',         test: s => !!s.flagNoHitBoss },
    { id: 'collector',  n: 'Collector',          d: 'Hold at least one of every ore.',        test: s => F.ORE_IDS.every(id => (s.ores[id] || 0) > 0) },
  ];

  F.Achieve = {
    check(s) {
      if (!s.achievements) s.achievements = {};
      for (const a of LIST) {
        if (s.achievements[a.id]) continue;
        let ok = false;
        try { ok = a.test(s); } catch (e) { ok = false; }
        if (!ok) continue;
        s.achievements[a.id] = 1;
        s.spins = (s.spins || 0) + 1;
        F.Game.toast('Achievement: ' + a.n, '#ffd23f', 4);
        F.Game.toast('+1 shrine spin', '#b76cff', 4);
      }
    },
    count(s) { let n = 0; for (const a of LIST) if (s.achievements && s.achievements[a.id]) n++; return n; },
    total() { return LIST.length; },
  };

})(window.F2 = window.F2 || {});
