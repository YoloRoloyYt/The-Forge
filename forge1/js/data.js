'use strict';
// ---------------------------------------------------------------------------
// data.js — all content tables. Adding content should mostly mean editing this file.
// ---------------------------------------------------------------------------

// role: filler (cheap weight) | mult (raises stats) | trait (grants a passive)
// tier: rarity 0 common .. 3 epic. f: [minFloor,maxFloor]. w: drop weight.
const ORES = {
  stone:     { n: 'Stone',     role: 'filler', mult: 0.20, val: 1,   tier: 0, w: 60, f: [1, 9], col: '#8d929c', col2: '#5f6470' },
  copper:    { n: 'Copper',    role: 'filler', mult: 0.35, val: 3,   tier: 0, w: 42, f: [1, 9], col: '#d1804f', col2: '#8e4e2c' },
  iron:      { n: 'Iron',      role: 'filler', mult: 0.50, val: 6,   tier: 0, w: 32, f: [1, 9], col: '#b9c0cf', col2: '#7b8296' },
  aurite:    { n: 'Aurite',    role: 'filler', mult: 0.80, val: 14,  tier: 1, w: 12, f: [1, 9], col: '#f0cb4b', col2: '#a8862a' },
  platinum:  { n: 'Platinum',  role: 'mult',   mult: 1.20, val: 30,  tier: 2, w: 10, f: [2, 9], col: '#dfe9f2', col2: '#93a6b8' },
  titanium:  { n: 'Titanium',  role: 'mult',   mult: 1.50, val: 55,  tier: 2, w: 7,  f: [3, 9], col: '#7fb4d9', col2: '#41708f' },
  cobalt:    { n: 'Cobalt',    role: 'mult',   mult: 1.80, val: 90,  tier: 3, w: 4,  f: [3, 9], col: '#3d6bff', col2: '#1c3aa8' },
  magmite:   { n: 'Magmite',   role: 'trait',  mult: 0.90, val: 40,  tier: 2, w: 8,  f: [2, 9], col: '#ff6a2a', col2: '#7a1f0a', trait: 'volcanic' },
  glassite:  { n: 'Glassite',  role: 'trait',  mult: 1.10, val: 45,  tier: 2, w: 6,  f: [2, 9], col: '#9fe8ff', col2: '#4aa6c8', trait: 'glass' },
  volatite:  { n: 'Volatite',  role: 'trait',  mult: 0.90, val: 45,  tier: 2, w: 6,  f: [2, 9], col: '#b7ff4a', col2: '#5a9418', trait: 'explosive' },
  demonite:  { n: 'Demonite',  role: 'trait',  mult: 1.00, val: 70,  tier: 3, w: 4,  f: [3, 9], col: '#c23bff', col2: '#5b1590', trait: 'demonic' },
};
const ORE_IDS = Object.keys(ORES);

const TRAITS = {
  volcanic:  { n: 'Volcanic',  wdesc: 'Attacks may ignite foes; +10% damage', adesc: '+25% defence' },
  demonic:   { n: 'Demonic',   wdesc: 'Every hit burns the target',           adesc: 'Burns attackers who hit you' },
  glass:     { n: 'Glass',     wdesc: '+40% damage, -15% max HP',              adesc: '+30% defence, but halves the HP bonus' },
  explosive: { n: 'Explosive', wdesc: '15% chance of an explosion on hit',     adesc: 'Sometimes explodes when you are hit' },
};

const GEMS = {
  topaz:   { n: 'Topaz',   val: 60,  col: '#f2c14e', w: 50 },
  ruby:    { n: 'Ruby',    val: 120, col: '#e0344f', w: 30 },
  emerald: { n: 'Emerald', val: 200, col: '#3fd17a', w: 15 },
  diamond: { n: 'Diamond', val: 400, col: '#bff3ff', w: 5 },
};

// Weapon classes (chosen by total ore count). range in px, arc in degrees.
const CLS = {
  dagger:     { n: 'Dagger',         dmg: 8,  cd: 0.35, wind: 0.09, range: 24, arc: 70,  sta: 8,  tier: 0 },
  sword:      { n: 'Sword',          dmg: 15, cd: 0.55, wind: 0.16, range: 32, arc: 100, sta: 12, tier: 1 },
  greatsword: { n: 'Great Sword',    dmg: 28, cd: 0.85, wind: 0.28, range: 42, arc: 150, sta: 18, tier: 2 },
  colossal:   { n: 'Colossal Sword', dmg: 48, cd: 1.20, wind: 0.45, range: 58, arc: 180, sta: 26, tier: 3 },
};
const FISTS = { cls: 'fists', name: 'Bare Fists', stats: { dmg: 5, cd: 0.4, wind: 0.1, range: 18, arc: 90, sta: 6 }, traits: [], color: '#d9b08c', color2: '#a07850', enh: 0 };

const ARMOR_CLS = {
  light:   { n: 'Light',   def: 4,  hp: 2,  slow: 0,     tier: 0 },
  medium:  { n: 'Medium',  def: 9,  hp: 8,  slow: 0.010, tier: 1 },
  heavy:   { n: 'Heavy',   def: 16, hp: 18, slow: 0.035, tier: 2 },
  bulwark: { n: 'Bulwark', def: 26, hp: 32, slow: 0.050, tier: 3 },
};
const SLOTS = {
  head:  { n: 'Helmet',     f: 0.9 },
  chest: { n: 'Chestplate', f: 1.5 },
  legs:  { n: 'Greaves',    f: 1.1 },
  boots: { n: 'Boots',      f: 0.7 },
};

const PICKS = [
  { n: 'Rusty Pickaxe',  mp: 6,  cost: 0,     lvl: 1 },
  { n: 'Copper Pickaxe', mp: 10, cost: 150,   lvl: 1 },
  { n: 'Iron Pickaxe',   mp: 16, cost: 600,   lvl: 2 },
  { n: 'Steel Pickaxe',  mp: 26, cost: 2200,  lvl: 4 },
  { n: 'Cobalt Pickaxe', mp: 40, cost: 7500,  lvl: 7 },
  { n: 'Titan Pickaxe',  mp: 60, cost: 22000, lvl: 10 },
];
const LANTERNS = [
  { n: 'Torch',          r: 60,  cost: 0 },
  { n: 'Lantern',        r: 95,  cost: 120 },
  { n: 'Bright Lantern', r: 130, cost: 700 },
  { n: 'Crystal Lantern', r: 170, cost: 3500 },
];

// Node types. hp is scaled by floor. drops = [min,max] ore items; boost raises rare-ore odds.
const NODES = {
  pebble:  { n: 'Pebble',  hp: 24,  drops: [1, 2], boost: 0,   xp: 1,  gemChance: 0,    rare: false, r: 6 },
  rock:    { n: 'Rock',    hp: 70,  drops: [2, 3], boost: 0,   xp: 3,  gemChance: 0,    rare: false, r: 7 },
  boulder: { n: 'Boulder', hp: 170, drops: [3, 5], boost: 0.3, xp: 7,  gemChance: 0.03, rare: false, r: 8 },
  vein:    { n: 'Vein',    hp: 240, drops: [4, 7], boost: 1.0, xp: 12, gemChance: 0.08, rare: true,  r: 8 },
  crystal: { n: 'Crystal', hp: 300, drops: [2, 4], boost: 1.6, xp: 18, gemChance: 0.45, rare: true,  r: 8 },
  // A cracked rock sealing a hidden cavern. Drops nothing; mining it opens the way.
  seal:    { n: 'Sealed Rock', hp: 140, drops: [0, 0], boost: 0, xp: 10, gemChance: 0, rare: false, r: 8, seal: true },
};

// Enemies. Mobs drop Gold, essence and rune fragments — never crafting ore.
const ENEMIES = {
  grunt:  { n: 'Cave Grunt', hp: 42, dmg: 12, spd: 36, r: 6, aggro: 100, range: 20, wind: 0.75, rec: 0.6, xp: 10, gold: [3, 8] },
  rogue:  { n: 'Cave Rogue', hp: 28, dmg: 14, spd: 68, r: 5, aggro: 120, range: 84, wind: 0.5, rec: 0.6, xp: 14, gold: [4, 10] },
  bomber: { n: 'Bomber',     hp: 22, dmg: 32, spd: 44, r: 5, aggro: 110, range: 30, wind: 1.1, rec: 0, xp: 16, gold: [5, 12] },
  // Area boss (multi-phase, see boss.js). fixedHp ignores level scaling.
  guardian: { n: 'Ancient Grove Guardian', boss: true, fixedHp: 1500, hp: 1500, dmg: 24, spd: 22, r: 18, aggro: 600, range: 60, wind: 1, rec: 0.5, xp: 600, gold: [500, 700] },
};
const BOSS_FLOOR = 99;      // internal floor id of the boss arena
const BOSS_LEVEL = 12;      // guardian level (damage scaling and name tag)
const BOSS_POWER = 600;     // recommended power (GDD 25)

const POTIONS = {
  heal:    { n: 'Health Potion',      cost: 40,  dur: 0,   col: '#e0344f', desc: 'Restore 60 HP.' },
  str:     { n: 'Strength Potion',    cost: 120, dur: 120, col: '#ff8a3d', desc: '+25% damage for 2 min.' },
  prot:    { n: 'Protection Potion',  cost: 120, dur: 120, col: '#4aa6ff', desc: '+30% defence for 2 min.' },
  fort:    { n: 'Fortune Potion',     cost: 150, dur: 180, col: '#f0cb4b', desc: '+35% ore yield for 3 min.' },
  luck:    { n: 'Luck Potion',        cost: 180, dur: 180, col: '#3fd17a', desc: 'Rarer ore and gems for 3 min.' },
  haste:   { n: 'Haste Potion',       cost: 140, dur: 120, col: '#c8f2ff', desc: 'Faster forging and mining for 2 min.' },
  forgem:  { n: 'Forgemaster Potion', cost: 200, dur: 0,   col: '#c23bff', desc: 'Next forge gains +5% quality.' },
};
const POTION_ORDER = ['heal', 'str', 'prot', 'fort', 'luck', 'haste', 'forgem'];

const RUNES = {
  life:  { n: 'Lifesteal Rune',  target: 'weapon', frags: 8, gold: 400, desc: 'Heal 6% of damage dealt.' },
  fire:  { n: 'Fire Rune',       target: 'weapon', frags: 5, gold: 250, desc: 'Every hit ignites the target.' },
  mine:  { n: 'Miner Rune',      target: 'pick',   frags: 5, gold: 300, desc: '+30% Mine Power.' },
  yield: { n: 'Prospector Rune', target: 'pick',   frags: 6, gold: 350, desc: '+20% ore yield.' },
};

// Level thresholds: xp needed to go from level L to L+1.
const xpNeeded = L => Math.round(28 + L * L * 9);
// Floor gates (cave depth): level required to descend to each floor.
const FLOOR_LEVEL = { 1: 1, 2: 3, 3: 6 };
const MAX_FLOOR = 3;
// Parry (F): a fixed-length window. Anything that hits you from the guarded side deals no damage and is stunned
// for PARRY_STUN seconds (and takes bonus damage). Then SHIELD_CD seconds before it can be used again.
const SHIELD_TIME = 1, SHIELD_CD = 10, PARRY_STUN = 2;
// The parry guards a cone toward the mouse angle at activation; PARRY_ARC is its half-width in radians (50 deg).
const PARRY_ARC = 50 * Math.PI / 180;
// Hotbar: slot 1 pickaxe, slot 2 weapon, slots 3-7 hold potions the player assigns.
const HOTBAR_SLOTS = 7;
