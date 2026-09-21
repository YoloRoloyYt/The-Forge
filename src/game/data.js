'use strict';
// ---------------------------------------------------------------------------
// data.js — every content table in The Forge 2.
//
// Balance philosophy (a full pass over The Forge 1's numbers):
//  * Ore value grows super-linearly with depth, but so does the risk, so the
//    "one more floor" pull never goes away.
//  * Quality is the biggest single multiplier a player controls (0.62x .. 1.62x),
//    which keeps the forge minigame the heart of progression rather than a tax.
//  * Weapon class comes from ore COUNT and stats come from ore QUALITY, so a
//    huge pile of stone is a big bad sword and a small pile of starsteel is a
//    small great one. Both are valid; neither is dominant.
//  * Every depth roughly doubles enemy HP and damage; player power from gear
//    roughly 2.2x per tier, so gearing up outpaces the curve slightly.
// ---------------------------------------------------------------------------
(function (F) {

  // ------------------------------------------------------------------- ores
  // role:  filler — cheap bulk, sets the item class
  //        mult   — raises every stat
  //        trait  — grants a passive once it is >= 18% of the melt
  // f: [minDepth, maxDepth]   w: base drop weight   tier: rarity 0..5
  const ORES = F.ORES = {
    // ---- the common run of the mine, present from the first cut
    stone:      { n: 'Stone',      role: 'filler', mult: 0.20, val: 1,    tier: 0, w: 100, f: [1, 8], col: '#8d929c', col2: '#585d68' },
    coal:       { n: 'Coal',       role: 'filler', mult: 0.28, val: 3,    tier: 0, w: 62,  f: [1, 6], col: '#3a3640', col2: '#201d26', glow: '#ff4a10', glowAmt: 0.10 },
    copper:     { n: 'Copper',     role: 'filler', mult: 0.40, val: 6,    tier: 0, w: 58,  f: [1, 6], col: '#d1804f', col2: '#82462a' },
    iron:       { n: 'Iron',       role: 'filler', mult: 0.58, val: 13,   tier: 1, w: 44,  f: [1, 7], col: '#b9c0cf', col2: '#6f7688' },
    // ---- II, the Copper Hollows
    silver:     { n: 'Silver',     role: 'filler', mult: 0.76, val: 26,   tier: 1, w: 26,  f: [2, 8], col: '#cfdae8', col2: '#8595a6' },
    aurite:     { n: 'Aurite',     role: 'filler', mult: 0.94, val: 44,   tier: 2, w: 17,  f: [2, 8], col: '#f0cb4b', col2: '#9d7c22' },
    // ---- III, the Drowned Gallery: cold, clear, brittle
    platinum:   { n: 'Platinum',   role: 'mult',   mult: 1.22, val: 78,   tier: 2, w: 13,  f: [3, 8], col: '#c6d4e2', col2: '#7e90a4' },
    glassite:   { n: 'Glassite',   role: 'trait',  mult: 1.18, val: 112,  tier: 2, w: 9,   f: [3, 8], col: '#9fe8ff', col2: '#3f92b4', trait: 'glass',     glow: '#63d8ff', glowAmt: 0.30 },
    // ---- IV, the Magma Vents: everything here burns
    titanium:   { n: 'Titanium',   role: 'mult',   mult: 1.48, val: 165,  tier: 3, w: 9,   f: [4, 8], col: '#7fb4d9', col2: '#3b6b8c' },
    magmite:    { n: 'Magmite',    role: 'trait',  mult: 1.02, val: 190,  tier: 3, w: 8,   f: [4, 8], col: '#ff6a2a', col2: '#7a1f0a', trait: 'volcanic',  glow: '#ff5a18', glowAmt: 0.60 },
    volatite:   { n: 'Volatite',   role: 'trait',  mult: 1.02, val: 230,  tier: 3, w: 7,   f: [4, 8], col: '#b7ff4a', col2: '#4f8a14', trait: 'explosive', glow: '#a8ff3a', glowAmt: 0.35 },
    // ---- V, the Crystal Cathedral
    cobalt:     { n: 'Cobalt',     role: 'mult',   mult: 1.74, val: 340,  tier: 3, w: 6.5, f: [5, 8], col: '#4a74ff', col2: '#1f3aa8' },
    rimeite:    { n: 'Rimeite',    role: 'trait',  mult: 1.14, val: 460,  tier: 4, w: 5,   f: [5, 8], col: '#bfe8ff', col2: '#5a8fc0', trait: 'frost',     glow: '#8fd4ff', glowAmt: 0.32 },
    // ---- VI, the Bone Quarry: what the dead leave behind
    mithral:    { n: 'Mithral',    role: 'mult',   mult: 2.05, val: 640,  tier: 4, w: 4.4, f: [6, 8], col: '#b9ffe4', col2: '#4e9c84', glow: '#6affd0', glowAmt: 0.18 },
    soulquartz: { n: 'Soul Quartz',role: 'trait',  mult: 1.24, val: 800,  tier: 4, w: 3.4, f: [6, 8], col: '#d8ffd0', col2: '#5f9c5a', trait: 'leeching',  glow: '#7dff9a', glowAmt: 0.45 },
    demonite:   { n: 'Demonite',   role: 'trait',  mult: 1.14, val: 950,  tier: 4, w: 3.2, f: [6, 8], col: '#c23bff', col2: '#571390', trait: 'demonic',   glow: '#b02bff', glowAmt: 0.50 },
    // ---- VII, the Voidshear Rift
    adamant:    { n: 'Adamant',    role: 'mult',   mult: 2.42, val: 1500, tier: 5, w: 2.8, f: [7, 8], col: '#c8425e', col2: '#6a1428' },
    voidstone:  { n: 'Voidstone',  role: 'trait',  mult: 1.32, val: 2000, tier: 5, w: 2.2, f: [7, 8], col: '#a44dff', col2: '#3d1070', trait: 'void',      glow: '#9438ff', glowAmt: 0.70 },
    // ---- VIII, the Heart of the Forge
    starsteel:  { n: 'Starsteel',  role: 'mult',   mult: 2.95, val: 3400, tier: 5, w: 1.5, f: [8, 8], col: '#d2e6ff', col2: '#6f8fd0', glow: '#9fd8ff', glowAmt: 0.40 },
    emberheart: { n: 'Emberheart', role: 'trait',  mult: 1.72, val: 4400, tier: 5, w: 1.1, f: [8, 8], col: '#ffc24a', col2: '#c04a08', trait: 'eternal',   glow: '#ffb02e', glowAmt: 1.00 },
  };
  F.ORE_IDS = Object.keys(ORES);

  const TRAITS = F.TRAITS = {
    volcanic:  { n: 'Volcanic',  col: '#ff6a2a', wdesc: '+12% damage; hits may set the target alight',  adesc: '+22% defence; fire cannot burn you' },
    glass:     { n: 'Glass',     col: '#9fe8ff', wdesc: '+45% damage, but -18% of your max health',     adesc: '+34% defence, but the health bonus is halved' },
    explosive: { n: 'Explosive', col: '#b7ff4a', wdesc: '18% of hits detonate for splash damage',       adesc: 'Being struck sometimes detonates around you' },
    demonic:   { n: 'Demonic',   col: '#c23bff', wdesc: 'Every hit burns for 6s',                        adesc: 'Attackers take burning damage back' },
    frost:     { n: 'Frost',     col: '#bfe8ff', wdesc: 'Hits chill: -35% enemy speed for 3s',           adesc: 'Attackers are chilled on contact' },
    leeching:  { n: 'Leeching',  col: '#7dff9a', wdesc: 'Heal for 7% of the damage you deal',            adesc: 'Slowly regenerate out of combat' },
    void:      { n: 'Void',      col: '#a44dff', wdesc: 'Hits ignore 30% of enemy armour',               adesc: '12% chance to void a hit entirely' },
    eternal:   { n: 'Eternal',   col: '#ffc24a', wdesc: '+25% damage and your strikes never miss',       adesc: 'Once a minute, survive a lethal blow at 1 HP' },
  };

  const GEMS = F.GEMS = {
    topaz:    { n: 'Topaz',    val: 90,   col: '#f2c14e', w: 50 },
    ruby:     { n: 'Ruby',     val: 200,  col: '#e0344f', w: 28 },
    emerald:  { n: 'Emerald',  val: 380,  col: '#3fd17a', w: 14 },
    sapphire: { n: 'Sapphire', val: 620,  col: '#4a8cff', w: 6 },
    diamond:  { n: 'Diamond',  val: 1200, col: '#bff3ff', w: 2 },
  };

  // --------------------------------------------------------- weapon classes
  // Chosen by total ore in the crucible. min is inclusive.
  const CLS = F.CLS = {
    dagger:  { n: 'Dagger',         min: 3,  dmg: 9,   cd: 0.30, wind: 0.07, range: 30, arc: 62,  sta: 7,  knock: 30,  tier: 0, heavy: 1.9 },
    sword:   { n: 'Sword',          min: 9,  dmg: 17,  cd: 0.48, wind: 0.13, range: 40, arc: 96,  sta: 11, knock: 60,  tier: 1, heavy: 2.0 },
    axe:     { n: 'War Axe',        min: 18, dmg: 28,  cd: 0.62, wind: 0.19, range: 44, arc: 118, sta: 15, knock: 95,  tier: 2, heavy: 2.2 },
    great:   { n: 'Great Sword',    min: 28, dmg: 44,  cd: 0.80, wind: 0.26, range: 54, arc: 148, sta: 20, knock: 130, tier: 3, heavy: 2.3 },
    colossal:{ n: 'Colossal Sword', min: 39, dmg: 70,  cd: 1.05, wind: 0.38, range: 68, arc: 176, sta: 27, knock: 175, tier: 4, heavy: 2.4 },
    maul:    { n: 'Titan Maul',     min: 53, dmg: 110, cd: 1.38, wind: 0.52, range: 76, arc: 200, sta: 36, knock: 250, tier: 5, heavy: 2.6 },
  };
  F.CLS_ORDER = ['dagger', 'sword', 'axe', 'great', 'colossal', 'maul'];

  const ARMOR_CLS = F.ARMOR_CLS = {
    light:  { n: 'Light',      min: 3,  def: 5,  hp: 4,  slow: 0.000, tier: 0 },
    medium: { n: 'Medium',     min: 9,  def: 11, hp: 11, slow: 0.008, tier: 1 },
    heavy:  { n: 'Heavy',      min: 18, def: 19, hp: 22, slow: 0.020, tier: 2 },
    bulwark:{ n: 'Bulwark',    min: 28, def: 30, hp: 38, slow: 0.032, tier: 3 },
    aegis:  { n: 'Aegis',      min: 39, def: 46, hp: 60, slow: 0.044, tier: 4 },
    titan:  { n: 'Titanplate', min: 53, def: 68, hp: 92, slow: 0.058, tier: 5 },
  };
  F.ARM_ORDER = ['light', 'medium', 'heavy', 'bulwark', 'aegis', 'titan'];

  const SLOTS = F.SLOTS = {
    head:  { n: 'Helm',       f: 0.85 },
    chest: { n: 'Chestplate', f: 1.55 },
    legs:  { n: 'Greaves',    f: 1.10 },
    boots: { n: 'Boots',      f: 0.70 },
  };
  F.ARMOR_SLOTS = ['head', 'chest', 'legs', 'boots'];

  F.FISTS = {
    cls: 'fists', kind: 'weapon', name: 'Bare Hands', id: -1,
    stats: { dmg: 6, cd: 0.34, wind: 0.08, range: 24, arc: 84, sta: 5, knock: 20 },
    traits: [], color: '#d9b08c', color2: '#9b7450', accent: '#e8c9a8', enh: 0, quality: 0, grade: 'Poor', ores: {},
  };

  // -------------------------------------------------------------- pickaxes
  // mp = Mine Power (damage per swing against a node's hidden HP)
  const PICKS = F.PICKS = [
    { n: 'Rusted Pick',     mp: 8,    cost: 0,        lvl: 1,  spd: 1.00, col: '#6d5c4a', col2: '#3d332a' },
    { n: 'Copper Pick',     mp: 14,   cost: 2200,     lvl: 1,  spd: 1.04, col: '#d1804f', col2: '#82462a' },
    { n: 'Iron Pick',       mp: 24,   cost: 9500,     lvl: 4,  spd: 1.08, col: '#b9c0cf', col2: '#6f7688' },
    { n: 'Steel Pick',      mp: 42,   cost: 36000,    lvl: 8,  spd: 1.12, col: '#cfd8e6', col2: '#7d879b' },
    { n: 'Silvered Pick',   mp: 72,   cost: 105000,   lvl: 13, spd: 1.16, col: '#cfdae8', col2: '#8595a6' },
    { n: 'Cobalt Pick',     mp: 120,  cost: 260000,   lvl: 18, spd: 1.20, col: '#4a74ff', col2: '#1f3aa8' },
    { n: 'Titan Pick',      mp: 200,  cost: 620000,   lvl: 24, spd: 1.26, col: '#7fb4d9', col2: '#3b6b8c' },
    { n: 'Mithral Pick',    mp: 330,  cost: 1500000,  lvl: 30, spd: 1.32, col: '#b9ffe4', col2: '#4e9c84' },
    { n: 'Adamant Pick',    mp: 540,  cost: 3600000,  lvl: 36, spd: 1.38, col: '#c8425e', col2: '#6a1428' },
    { n: 'Forgeheart Pick', mp: 900,  cost: 9000000,  lvl: 42, spd: 1.50, col: '#ffc24a', col2: '#c04a08', glow: '#ffb02e' },
  ];

  const LANTERNS = F.LANTERNS = [
    { n: 'Tallow Candle',   r: 155, cost: 0,        col: '#ffb265', i: 3.4 },
    { n: 'Miner\'s Lamp',   r: 205, cost: 1400,     col: '#ffbe72', i: 3.7 },
    { n: 'Brass Lantern',   r: 255, cost: 7000,     col: '#ffca80', i: 4.0 },
    { n: 'Bright Lantern',  r: 310, cost: 34000,    col: '#ffd59a', i: 4.3 },
    { n: 'Crystal Lantern', r: 375, cost: 170000,   col: '#cfe6ff', i: 4.6 },
    { n: 'Sunstone Lamp',   r: 450, cost: 900000,   col: '#ffe6b0', i: 5.0 },
  ];

  // ------------------------------------------------------------- ore nodes
  // hp is multiplied by the depth curve. boost raises rare-ore odds.
  const NODES = F.NODES = {
    pebble:  { n: 'Pebble',      hp: 26,  drops: [1, 2], boost: 0,    xp: 2,  gem: 0,    rare: false, r: 9,  sz: 0.62 },
    rock:    { n: 'Rock',        hp: 80,  drops: [2, 4], boost: 0.1,  xp: 5,  gem: 0.01, rare: false, r: 11, sz: 0.85 },
    boulder: { n: 'Boulder',     hp: 190, drops: [4, 7], boost: 0.35, xp: 11, gem: 0.04, rare: false, r: 13, sz: 1.05 },
    vein:    { n: 'Ore Vein',    hp: 270, drops: [6, 10], boost: 1.1, xp: 20, gem: 0.10, rare: true,  r: 13, sz: 1.0 },
    crystal: { n: 'Crystal',     hp: 360, drops: [4, 7], boost: 1.8,  xp: 30, gem: 0.50, rare: true,  r: 13, sz: 1.0 },
    motherlode: { n: 'Motherlode', hp: 900, drops: [16, 26], boost: 2.4, xp: 90, gem: 0.85, rare: true, r: 17, sz: 1.35 },
    seal:    { n: 'Sealed Rock', hp: 200, drops: [0, 0], boost: 0,    xp: 14, gem: 0,    rare: false, r: 13, sz: 1.1, seal: true },
  };

  // ------------------------------------------------------------- the depths
  // Each is one mine level. `gate` is the level needed; `boss` is the boss you
  // must have beaten first (null = open).
  const DEPTHS = F.DEPTHS = [
    { id: 1, biome: 'greenwood', name: 'The Greenwood Cut',      sub: 'Depth I',    gate: 1,  boss: null,      danger: 1.00, oreBias: 0.0,  mobs: ['grunt', 'rogue'], elites: ['brute'] },
    { id: 2, biome: 'copper',    name: 'The Copper Hollows',     sub: 'Depth II',   gate: 5,  boss: null,      danger: 1.55, oreBias: 0.1,  mobs: ['grunt', 'rogue', 'bomber'], elites: ['brute', 'archer'] },
    { id: 3, biome: 'drowned',   name: 'The Drowned Gallery',    sub: 'Depth III',  gate: 10, boss: 'grove',   danger: 2.40, oreBias: 0.2,  mobs: ['grunt', 'rogue', 'bomber', 'archer'], elites: ['brute', 'mage'] },
    { id: 4, biome: 'magma',     name: 'The Magma Vents',        sub: 'Depth IV',   gate: 16, boss: 'leviath', danger: 3.70, oreBias: 0.3,  mobs: ['grunt', 'bomber', 'archer', 'mage'], elites: ['brute', 'tank'] },
    { id: 5, biome: 'crystal',   name: 'The Crystal Cathedral',  sub: 'Depth V',    gate: 22, boss: 'infernal',danger: 5.60, oreBias: 0.4,  mobs: ['rogue', 'archer', 'mage', 'healer'], elites: ['tank', 'warden'] },
    { id: 6, biome: 'bone',      name: 'The Bone Quarry',        sub: 'Depth VI',   gate: 28, boss: 'prism',   danger: 8.40, oreBias: 0.5,  mobs: ['grunt', 'tank', 'archer', 'healer'], elites: ['tank', 'warden'] },
    { id: 7, biome: 'void',      name: 'The Voidshear Rift',     sub: 'Depth VII',  gate: 34, boss: 'sovereign_bone', danger: 12.5, oreBias: 0.62, mobs: ['rogue', 'mage', 'tank', 'healer'], elites: ['warden', 'wraith'] },
    { id: 8, biome: 'eternal',   name: 'The Heart of the Forge', sub: 'Depth VIII', gate: 40, boss: 'voidlord',danger: 18.0, oreBias: 0.78, mobs: ['tank', 'mage', 'wraith', 'healer'], elites: ['wraith', 'warden'] },
  ];
  F.MAX_DEPTH = 8;

  // ---------------------------------------------------------------- enemies
  // Base stats at depth 1; scaled by DEPTHS[].danger and the enemy's level.
  const ENEMIES = F.ENEMIES = {
    grunt:  { n: 'Cave Grunt',   hp: 52,  dmg: 11, spd: 40, r: 11, aggro: 150, range: 26,  wind: 0.62, rec: 0.55, xp: 12,  gold: [4, 10],  ai: 'melee',  col: '#7a6a52' },
    rogue:  { n: 'Tunnel Rogue', hp: 36,  dmg: 14, spd: 82, r: 10, aggro: 190, range: 24,  wind: 0.36, rec: 0.40, xp: 17,  gold: [6, 14],  ai: 'dash',   col: '#6a5a7a' },
    bomber: { n: 'Blast Beetle', hp: 30,  dmg: 34, spd: 52, r: 10, aggro: 170, range: 34,  wind: 0.95, rec: 0,    xp: 21,  gold: [8, 18],  ai: 'suicide',col: '#7a7a3a' },
    archer: { n: 'Shalebow',     hp: 40,  dmg: 13, spd: 46, r: 10, aggro: 240, range: 190, wind: 0.75, rec: 0.9,  xp: 24,  gold: [9, 20],  ai: 'ranged', col: '#5a6a7a' },
    tank:   { n: 'Stoneshell',   hp: 190, dmg: 22, spd: 28, r: 15, aggro: 150, range: 32,  wind: 1.05, rec: 0.9,  xp: 48,  gold: [18, 34], ai: 'melee',  col: '#6a6a6a', armor: 0.35 },
    mage:   { n: 'Gloomcaster',  hp: 54,  dmg: 20, spd: 40, r: 11, aggro: 260, range: 210, wind: 1.10, rec: 1.1,  xp: 44,  gold: [16, 32], ai: 'caster', col: '#5a3a7a' },
    healer: { n: 'Fungal Priest',hp: 70,  dmg: 9,  spd: 38, r: 11, aggro: 230, range: 150, wind: 1.0,  rec: 1.4,  xp: 40,  gold: [15, 30], ai: 'healer', col: '#3a6a5a' },
    brute:  { n: 'Deep Brute',   hp: 150, dmg: 26, spd: 44, r: 14, aggro: 210, range: 34,  wind: 0.80, rec: 0.7,  xp: 56,  gold: [24, 46], ai: 'charger',col: '#7a4a3a' },
    warden: { n: 'Vault Warden', hp: 300, dmg: 34, spd: 36, r: 16, aggro: 240, range: 40,  wind: 0.95, rec: 0.8,  xp: 110, gold: [46, 88], ai: 'charger',col: '#4a5a8a', armor: 0.30 },
    wraith: { n: 'Rift Wraith',  hp: 170, dmg: 40, spd: 70, r: 12, aggro: 300, range: 30,  wind: 0.45, rec: 0.5,  xp: 130, gold: [55, 100],ai: 'blink',  col: '#6a3a8a' },
  };

  // ----------------------------------------------------------------- bosses
  // Every boss runs the same 4-phase framework with its own move table.
  const BOSSES = F.BOSSES = {
    grove: {
      id: 'grove', n: 'The Ancient Grove Guardian', sub: 'Warden of the First Cut',
      biome: 'greenwood', hp: 2600, dmg: 26, spd: 26, r: 32, power: 620, lvl: 10,
      xp: 1400, gold: [700, 1100], after: 2,
      col: '#6d5a3c', col2: '#3a3124', glow: '#9ce04a',
      moves: ['slam', 'thorns', 'summon', 'sweep'],
      intro: 'Roots older than the shaft close behind you.',
    },
    leviath: {
      id: 'leviath', n: 'The Tidewrought Leviathan', sub: 'It drank the gallery dry',
      biome: 'drowned', hp: 5200, dmg: 38, spd: 30, r: 37, power: 1500, lvl: 15,
      xp: 3400, gold: [1600, 2400], after: 3,
      col: '#3f6f86', col2: '#17313f', glow: '#5fe0ff',
      moves: ['slam', 'wave', 'summon', 'whirl'],
      intro: 'The flooded dark exhales, and something in it turns to face you.',
    },
    infernal: {
      id: 'infernal', n: 'The Infernal King', sub: 'Crowned in slag',
      biome: 'magma', hp: 9800, dmg: 54, spd: 34, r: 37, power: 3400, lvl: 21,
      xp: 7600, gold: [3600, 5200], after: 4,
      col: '#4e2c1e', col2: '#23110b', glow: '#ff7a20',
      moves: ['slam', 'firewall', 'meteor', 'charge'],
      intro: 'He was a smith once. The vents kept the coal hot and took the rest.',
    },
    prism: {
      id: 'prism', n: 'The Prism Warden', sub: 'Every facet is watching',
      biome: 'crystal', hp: 17500, dmg: 72, spd: 40, r: 34, power: 6800, lvl: 27,
      xp: 15000, gold: [7000, 10000], after: 5,
      col: '#8f86c4', col2: '#413a68', glow: '#cdb4ff',
      moves: ['beam', 'shards', 'mirror', 'nova'],
      intro: 'The cathedral refracts you into a hundred smaller, frightened people.',
    },
    sovereign_bone: {
      id: 'sovereign_bone', n: 'The Bone Sovereign', sub: 'Quarried from the fallen',
      biome: 'bone', hp: 31000, dmg: 96, spd: 38, r: 39, power: 12500, lvl: 33,
      xp: 30000, gold: [14000, 20000], after: 6,
      col: '#b8ae90', col2: '#5e5645', glow: '#b8ff8a',
      moves: ['slam', 'bonestorm', 'summon', 'grave'],
      intro: 'Everyone who dug too deep is here. All of them, at once.',
    },
    voidlord: {
      id: 'voidlord', n: 'The Void Sovereign', sub: 'The rift wears a shape for you',
      biome: 'void', hp: 56000, dmg: 128, spd: 46, r: 37, power: 22000, lvl: 38,
      xp: 62000, gold: [28000, 40000], after: 7,
      col: '#42306a', col2: '#1c1030', glow: '#cf5bff',
      moves: ['blinkstrike', 'riftlines', 'shards', 'collapse'],
      intro: 'It has no face until it needs one. It needs one now.',
    },
    firstforger: {
      id: 'firstforger', n: 'The First Forger', sub: 'As a child, he yearned for the mines',
      biome: 'eternal', hp: 110000, dmg: 170, spd: 44, r: 42, power: 40000, lvl: 44,
      xp: 150000, gold: [70000, 100000], after: 8, final: true,
      col: '#5c4526', col2: '#2b1f12', glow: '#ffc447',
      moves: ['slam', 'firewall', 'meteor', 'nova', 'summon'],
      intro: 'He struck the first ore. He never stopped striking.',
    },
  };
  F.BOSS_ORDER = ['grove', 'leviath', 'infernal', 'prism', 'sovereign_bone', 'voidlord', 'firstforger'];

  // ---------------------------------------------------------------- potions
  const POTIONS = F.POTIONS = {
    heal:   { n: 'Health Draught',    cost: 1100,   dur: 0,   col: '#e0344f', desc: 'Restore 45% of your maximum health.' },
    regen:  { n: 'Regeneration Tonic',cost: 950,  dur: 60,  col: '#ff7a8c', desc: 'Recover health steadily for 60s.' },
    str:    { n: 'Strength Philtre',  cost: 200,  dur: 150, col: '#ff8a3d', desc: '+30% damage for 2m30s.' },
    prot:   { n: 'Ironhide Brew',     cost: 200,  dur: 150, col: '#4aa6ff', desc: '+35% defence for 2m30s.' },
    fort:   { n: 'Fortune Elixir',    cost: 260,  dur: 210, col: '#f0cb4b', desc: '+45% ore yield for 3m30s.' },
    luck:   { n: 'Prospector\'s Luck',cost: 1400,  dur: 210, col: '#3fd17a', desc: 'Far rarer ore and gems for 3m30s.' },
    haste:  { n: 'Quickfire Tonic',   cost: 1000,  dur: 150, col: '#c8f2ff', desc: '+25% mining and attack speed for 2m30s.' },
    forgem: { n: 'Forgemaster Dram',  cost: 1500,  dur: 0,   col: '#c23bff', desc: 'Your next forge gains +8 quality.' },
    stone:  { n: 'Stoneblood',        cost: 1800,  dur: 120, col: '#9c8f7a', desc: 'Lava and burning do not hurt you for 2m.' },
  };
  F.POTION_ORDER = ['heal', 'regen', 'str', 'prot', 'fort', 'luck', 'haste', 'forgem', 'stone'];

  // ------------------------------------------------------------------ runes
  const RUNES = F.RUNES = {
    life:   { n: 'Lifesteal Rune',   target: 'weapon', frags: 10, gold: 3800,   desc: 'Heal 7% of the damage you deal.' },
    fire:   { n: 'Fire Rune',        target: 'weapon', frags: 7,  gold: 2200,   desc: 'Every hit sets the target alight.' },
    cleave: { n: 'Cleaving Rune',    target: 'weapon', frags: 14, gold: 9000,  desc: 'Attacks hit a 40% wider arc.' },
    pierce: { n: 'Sundering Rune',   target: 'weapon', frags: 18, gold: 18000,  desc: 'Ignore 25% of enemy armour.' },
    mine:   { n: 'Miner Rune',       target: 'pick',   frags: 7,  gold: 2800,   desc: '+35% Mine Power.' },
    yield:  { n: 'Prospector Rune',  target: 'pick',   frags: 9,  gold: 4500,   desc: '+25% ore yield.' },
    swift:  { n: 'Swiftpick Rune',   target: 'pick',   frags: 12, gold: 8200,  desc: '+25% mining speed, -20% stamina cost.' },
    ward:   { n: 'Warding Rune',     target: 'armor',  frags: 10, gold: 5000,   desc: '+15% defence.' },
    vigor:  { n: 'Vigour Rune',      target: 'armor',  frags: 14, gold: 10000,  desc: '+20% maximum health.' },
  };

  // ----------------------------------------------------------------- spells
  const SPELLS = F.SPELLS = {
    flame:   { n: 'Flame',      target: 'weapon', cost: 5000,    col: '#ff6a2a', desc: 'Attacks deal +18% damage as fire.' },
    storm:   { n: 'Storm',      target: 'weapon', cost: 9000,   col: '#8fd4ff', desc: 'Hits chain lightning to a nearby foe.' },
    frost:   { n: 'Frost',      target: 'weapon', cost: 9000,   col: '#bfe8ff', desc: 'Hits slow the target by 30%.' },
    voidsp:  { n: 'Void',       target: 'weapon', cost: 34000,   col: '#a44dff', desc: '+25% damage against anything above half health.' },
    wind:    { n: 'Wind',       target: 'weapon', cost: 17000,   col: '#d8ffe8', desc: '+20% attack speed.' },
    fortify: { n: 'Fortify',    target: 'armor',  cost: 6800,   col: '#f0cb4b', desc: '+18% defence.' },
    vitality:{ n: 'Vitality',   target: 'armor',  cost: 6800,   col: '#6ee787', desc: '+18% maximum health.' },
    inferno: { n: 'Inferno',    target: 'armor',  cost: 22000,  col: '#ff8a3d', desc: 'Burn everything that stands next to you.' },
    iceward: { n: 'Ice Shield', target: 'armor',  cost: 22000,  col: '#9fe8ff', desc: 'Every 20s, absorb one hit completely.' },
  };

  // ------------------------------------------------------------------ races
  // A permanent bonus rerolled at the Ancestor Shrine. Higher tiers are rarer.
  const RACES = F.RACES = [
    { n: 'Hollowkin',   t: 0, desc: 'No blessing, no burden.',            mods: {} },
    { n: 'Pitborn',     t: 0, desc: '+8% Mine Power.',                    mods: { mine: 0.08 } },
    { n: 'Cinderborn',  t: 1, desc: '+10% damage.',                       mods: { dmg: 0.10 } },
    { n: 'Stonewrought',t: 1, desc: '+12% maximum health.',               mods: { hp: 0.12 } },
    { n: 'Lampwise',    t: 1, desc: '+25% lantern reach.',                mods: { light: 0.25 } },
    { n: 'Coinhanded',  t: 2, desc: '+20% gold from everything.',         mods: { gold: 0.20 } },
    { n: 'Deepvein',    t: 2, desc: '+18% ore yield.',                    mods: { yield: 0.18 } },
    { n: 'Swiftfoot',   t: 2, desc: '+14% move and dodge speed.',         mods: { spd: 0.14 } },
    { n: 'Emberlung',   t: 3, desc: '+25% Mine Power, +12% mining speed.',mods: { mine: 0.25, mspd: 0.12 } },
    { n: 'Hammerblood', t: 3, desc: '+6 forge quality on every strike.',  mods: { quality: 6 } },
    { n: 'Ironhide',    t: 3, desc: '+25% defence.',                      mods: { def: 0.25 } },
    { n: 'Starlit',     t: 4, desc: '+22% damage, +15% health.',          mods: { dmg: 0.22, hp: 0.15 } },
    { n: 'Goldtongue',  t: 4, desc: '+45% gold, +20% sell price.',        mods: { gold: 0.45, sell: 0.20 } },
    { n: 'Voidtouched', t: 5, desc: '+30% damage, -10% health.',          mods: { dmg: 0.30, hp: -0.10 } },
    { n: 'Forgeblood',  t: 5, desc: '+12 forge quality, +25% ore yield.', mods: { quality: 12, yield: 0.25 } },
    { n: 'Firstborn',   t: 6, desc: 'Everything, a little: +15% to all.', mods: { dmg: 0.15, hp: 0.15, def: 0.15, mine: 0.15, yield: 0.15, gold: 0.15 } },
  ];
  F.RACE_TIERS = [
    { n: 'Common',    col: '#b8b2ad', w: 460 },
    { n: 'Uncommon',  col: '#6fd17f', w: 260 },
    { n: 'Rare',      col: '#5aa9ff', w: 150 },
    { n: 'Epic',      col: '#b76cff', w: 80 },
    { n: 'Legendary', col: '#ff9d3c', w: 34 },
    { n: 'Mythic',    col: '#ff5d6c', w: 13 },
    { n: 'Primordial',col: '#7ef9ff', w: 3 },
  ];

  // ------------------------------------------------------------- progression
  /** XP required to go from level L to L+1. */
  // Solved against simulated income per depth (see tools/balance.js): the cubic
  // term is what stops the last five levels falling out of a single deep run.
  F.xpNeeded = L => Math.round(80 * Math.pow(L, 1.60) + 240 * L + 0.8 * L * L * L);
  F.MAX_LEVEL = 45;

  /** Node HP scaling by depth — roughly matches Mine Power growth. */
  F.nodeHpScale = d => Math.pow(2.02, d - 1);
  /** Ore sale value scaling — depth 8 ore is worth ~40x depth 1 ore. */
  F.enemyScale = d => (F.DEPTHS[d - 1] || F.DEPTHS[0]).danger;

  // parry / dodge
  F.PARRY_TIME = 0.85; F.PARRY_CD = 7.5; F.PARRY_STUN = 2.2; F.PARRY_ARC = 55 * Math.PI / 180;
  F.DASH_TIME = 0.20; F.DASH_CD = 0.75; F.DASH_DIST = 120; F.DASH_STA = 18;
  F.HOTBAR_SLOTS = 8;

  // --------------------------------------------------------------- quality
  F.GRADES = [
    { min: 0,  n: 'Botched',    col: '#8a7f7f' },
    { min: 35, n: 'Poor',       col: '#b8b2ad' },
    { min: 55, n: 'Fair',       col: '#e8e4d8' },
    { min: 72, n: 'Fine',       col: '#6fd17f' },
    { min: 85, n: 'Superb',     col: '#5aa9ff' },
    { min: 94, n: 'Flawless',   col: '#b76cff' },
    { min: 99, n: 'Masterwork', col: '#ffd23f' },
  ];

})(window.F2 = window.F2 || {});
