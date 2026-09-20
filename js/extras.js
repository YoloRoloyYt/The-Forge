'use strict';
// ---------------------------------------------------------------------------
// extras.js — races, spells, powerups, achievements, power rating, settings
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------- races (GDD A2)
// Permanent stat modifiers from an RNG reroll ("spin"). Seven rarity tiers, common -> relic.
// Passive axes: luck, mine (mining power), forge (quality points), move, aspd (attack speed),
// lifesteal, hp, dr (damage reduction).
const RACE_TIERS = [
  { n: 'Common', w: 45, col: '#c8c8d0' }, { n: 'Uncommon', w: 28, col: '#5ac86a' }, { n: 'Rare', w: 16, col: '#5ea8ff' },
  { n: 'Epic', w: 7, col: '#c070ff' }, { n: 'Legendary', w: 3, col: '#ffb02e' }, { n: 'Mythic', w: 0.9, col: '#ff5a7a' }, { n: 'Relic', w: 0.1, col: '#7ffff0' },
];
const RACES = {
  human:     { n: 'Human',     tier: 0, p: {} },
  dwarf:     { n: 'Dwarf',     tier: 1, p: { mine: 0.10, hp: 0.05 } },
  elf:       { n: 'Elf',       tier: 1, p: { move: 0.06, aspd: 0.05 } },
  gnome:     { n: 'Gnome',     tier: 2, p: { mine: 0.15, forge: 3, luck: 0.10 }, eco: true },
  orc:       { n: 'Orc',       tier: 2, p: { hp: 0.12, dr: 0.05 } },
  halfling:  { n: 'Halfling',  tier: 2, p: { luck: 0.20, move: 0.05 } },
  minotaur:  { n: 'Minotaur',  tier: 3, p: { hp: 0.18, dr: 0.08, aspd: 0.05 } },
  darkelf:   { n: 'Dark Elf',  tier: 3, p: { aspd: 0.12, lifesteal: 0.03, move: 0.05 } },
  golem:     { n: 'Golem',     tier: 3, p: { mine: 0.25, forge: 5, hp: 0.10 }, eco: true },
  dragonkin: { n: 'Dragonkin', tier: 4, p: { dr: 0.12, hp: 0.20, lifesteal: 0.04, aspd: 0.08 } },
  celestial: { n: 'Celestial', tier: 4, p: { forge: 6, luck: 0.30, move: 0.10, hp: 0.10 }, eco: true },
  phoenix:   { n: 'Phoenix',   tier: 5, p: { lifesteal: 0.07, hp: 0.25, dr: 0.12, aspd: 0.10 } },
  voidborn:  { n: 'Voidborn',  tier: 5, p: { aspd: 0.20, move: 0.12, lifesteal: 0.06, dr: 0.08 } },
  titan:     { n: 'Relic Titan', tier: 6, p: { hp: 0.40, dr: 0.20, lifesteal: 0.10, aspd: 0.20, move: 0.12, mine: 0.30, forge: 8, luck: 0.50 } },
};
const RACE_LABEL = { luck: 'Ore luck', mine: 'Mining power', forge: 'Forge quality', move: 'Move speed', aspd: 'Attack speed', lifesteal: 'Lifesteal', hp: 'Max HP', dr: 'Damage reduction' };

const Race = {
  cur() { return RACES[S.race] || RACES.human; },
  p(k) { return this.cur().p[k] || 0; },
  lines(r) {
    const out = [];
    for (const k in r.p) out.push(`${RACE_LABEL[k]} ${k === 'forge' ? '+' + r.p[k] + ' pts' : '+' + Math.round(r.p[k] * 100) + '%'}`);
    return out.length ? out : ['No bonuses'];
  },
  // Soft pity: after 8 rolls without an Epic+ result, Epic-and-better weights climb every roll.
  roll() {
    const boost = 1 + Math.max(0, (S.pity || 0) - 8) * 0.35;
    const tier = U.wpick(RACE_TIERS.map((t, i) => [i, t.w * (i >= 3 ? boost : 1)]));
    return U.pick(Object.keys(RACES).filter(id => RACES[id].tier === tier));
  },
  spin() {
    if ((S.spins || 0) <= 0) return null;
    S.spins--; const id = this.roll();
    S.pity = RACES[id].tier >= 3 ? 0 : (S.pity || 0) + 1;
    return id;
  },
};

// ---------------------------------------------------------------- spells (GDD 11)
const SPELLS = {
  flame:     { n: 'Flame',      kind: 'weapon', gold: 250, ess: 3, desc: '25% chance to burn' },
  storm:     { n: 'Storm',      kind: 'weapon', gold: 400, ess: 5, desc: '20% chance of chain lightning' },
  frost:     { n: 'Frost',      kind: 'weapon', gold: 300, ess: 4, desc: 'Hits slow enemies' },
  void:      { n: 'Void',       kind: 'weapon', gold: 450, ess: 6, desc: '+35% damage to weakened foes' },
  wind:      { n: 'Wind',       kind: 'weapon', gold: 350, ess: 5, desc: '+15% attack speed' },
  fortify:   { n: 'Fortify',    kind: 'armor',  gold: 250, ess: 3, desc: '+6% defence' },
  vitality:  { n: 'Vitality',   kind: 'armor',  gold: 250, ess: 3, desc: '+6% max HP' },
  inferno:   { n: 'Inferno',    kind: 'armor',  gold: 400, ess: 5, desc: 'Burns enemies next to you' },
  iceshield: { n: 'Ice Shield', kind: 'armor',  gold: 450, ess: 6, desc: '4% chance to negate a hit' },
};

// ---------------------------------------------------------------- powerups (GDD 27)
const POWERUPS = {
  health:   { n: 'Health',       col: '#ff5a7a', w: 30, desc: 'Restores 35% health' },
  berserk:  { n: 'Berserk',      col: '#ff8a2a', w: 20, dur: 12, desc: '+40% damage for 12s' },
  barrier:  { n: 'Barrier',      col: '#7fd8ff', w: 20, desc: 'Absorbs the next 3 hits' },
  inferno:  { n: 'Inferno',      col: '#ff4a2a', w: 15, desc: 'Next 6 attacks deal bonus fire damage' },
  goldrush: { n: 'Gold Rush',    col: '#ffd23f', w: 15, dur: 30, desc: 'Double gold for 30s' },
  frenzy:   { n: 'Forge Frenzy', col: '#c23bff', w: 8,  desc: 'Next forge has larger Perfect zones' },
};
const BUFF_NAMES = { berserk: 'Berserk', goldrush: 'Gold Rush' };

// ---------------------------------------------------------------- power rating (GDD 25)
// Power = offence + survivability, from gear/race/spells only (no temporary buffs).
//   dps = damage per second; ehp = max HP divided by the share of damage that gets through your armour.
function powerBreakdown() {
  const st = calcStats({ base: true });
  const dps = st.dmg / st.wstats.cd;
  const taken = Math.max(0.05, 100 / (100 + st.def * 2) * (1 - st.dr));
  const ehp = st.maxHp / taken;
  return { dps, ehp, power: Math.round(dps * 6 + ehp * 0.9) };
}
function playerPower() { return powerBreakdown().power; }

// ---------------------------------------------------------------- achievements (GDD 32)
const ACH = [
  { id: 'first_forge', n: 'First Forge', title: 'Apprentice', desc: 'Forge your first item.', test: s => s.stats.forged >= 1 },
  { id: 'blacksmith', n: 'Blacksmith', title: 'Blacksmith', desc: 'Forge 100 items.', test: s => s.stats.forged >= 100, prog: s => [s.stats.forged, 100] },
  { id: 'master_forger', n: 'Master Forger', title: 'Master Forger', desc: 'Forge a 100% quality item.', test: s => (s.stats.master100 || 0) >= 1 },
  { id: 'perfectionist', n: 'Perfectionist', title: 'Perfectionist', desc: 'Forge 10 Perfect items.', test: s => s.stats.perfect >= 10, prog: s => [s.stats.perfect, 10] },
  { id: 'delver', n: 'Delver', title: 'Delver', desc: 'Reach the third mine floor.', test: s => s.stats.bestFloor >= 3 },
  { id: 'hunter', n: 'Hunter', title: 'Hunter', desc: 'Defeat 100 enemies.', test: s => s.stats.kills >= 100, prog: s => [s.stats.kills, 100] },
  { id: 'collector', n: 'Collector', title: 'Collector', desc: 'Mine every ore found on the first floor.', test: s => ['stone', 'copper', 'iron', 'aurite'].every(o => (s.stats.seen || {})[o]), prog: s => [['stone', 'copper', 'iron', 'aurite'].filter(o => (s.stats.seen || {})[o]).length, 4] },
  { id: 'prospector', n: 'Prospector', title: 'Prospector', desc: 'Find a hidden cavern.', test: s => (s.stats.secrets || 0) >= 1 },
  { id: 'rich', n: 'Well Off', title: 'The Wealthy', desc: 'Hold 10,000 gold at once.', test: s => s.gold >= 10000, prog: s => [Math.min(s.gold, 10000), 10000] },
  { id: 'lucky', n: 'Lucky Spin', title: 'The Lucky', desc: 'Roll an Epic or better race.', test: s => (RACES[s.race] || RACES.human).tier >= 3 },
  { id: 'kingslayer', n: 'Kingslayer', title: 'Kingslayer', desc: 'Defeat your first area boss.', test: s => (s.bossKills || 0) >= 1 },
  { id: 'untouchable', n: 'Untouchable', title: 'The Untouchable', desc: 'Defeat a boss without taking damage.', test: s => (s.stats.bossNoHit || 0) >= 1 },
];
const Ach = {
  t: 0,
  check() {
    if (!S.ach) S.ach = {};
    for (const a of ACH) {
      if (S.ach[a.id] || !a.test(S)) continue;
      S.ach[a.id] = true;
      S.gold += 100; S.spins = (S.spins || 0) + 1;
      Game.toast(`Achievement: ${a.n}  (+100g, +1 spin)`, '#ffd23f'); Sfx.play('levelup');
    }
  },
  count() { return ACH.filter(a => (S.ach || {})[a.id]).length; },
};

// ---------------------------------------------------------------- settings
function applySettings() {
  const st = S.settings || (S.settings = { vol: 0.25, mute: false, shake: true });
  Sfx.vol = st.mute ? 0 : st.vol;
}
