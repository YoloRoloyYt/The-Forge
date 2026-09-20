// ---------------------------------------------------------------------------
// balance.js — a dry run of the economy.
//
// Loads the real tables and the real ore-roll function, simulates clearing a
// mine at each depth, and reports what a player actually earns, how long a
// pickaxe takes to afford, and how the level curve lines up with the gates.
// Run: node tools/balance.js
// ---------------------------------------------------------------------------
'use strict';
const fs = require('fs');
const path = require('path');

// --- a minimal browser shim so the real source files load unchanged
global.window = {};
global.document = { createElement: () => ({ getContext: () => ({}) }) };
const load = f => new Function(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))();
load('src/engine/util.js');
load('src/art/palette.js');
load('src/game/data.js');
load('src/game/forge.js');
const F = global.window.F2;

// the ore roll, lifted verbatim from gen.js
function rollOre(depth, boost, luck) {
  boost = boost || 0; luck = luck || 0;
  const bias = (F.DEPTHS[depth - 1] || F.DEPTHS[0]).oreBias;
  const entries = [];
  for (const id of F.ORE_IDS) {
    const o = F.ORES[id];
    if (depth < o.f[0] || depth > o.f[1]) continue;
    const rareLift = 1 + (boost * 1.6 + bias * 1.3 + luck) * o.tier * 0.85;
    entries.push([id, o.w * rareLift]);
  }
  return F.U.wpick(entries);
}

const NODE_MIX = [['pebble', 34], ['rock', 34], ['boulder', 15], ['vein', 3.5], ['crystal', 1.2]];

/** One full clear of a depth: every ambient node plus the guarded clusters. */
function simulateRun(depth, runs) {
  let ore = {}, oreN = 0, gold = 0, xp = 0, gems = 0;
  for (let r = 0; r < runs; r++) {
    const want = 92 + depth * 16;
    const mix = [['pebble', 34], ['rock', 34], ['boulder', 15 + depth * 2.6],
                 ['vein', 3.5 + depth * 1.5], ['crystal', 1.2 + depth * 0.9]];
    const nodes = [];
    for (let i = 0; i < want; i++) nodes.push(F.U.wpick(mix));
    const clusters = 2 + Math.floor(depth * 0.8);
    for (let c = 0; c < clusters; c++)
      for (let i = 0; i < 5 + depth; i++)
        nodes.push(Math.random() < 0.12 ? 'motherlode' : Math.random() < 0.58 ? 'vein' : 'crystal');
    for (const type of nodes) {
      const D = F.NODES[type];
      const n = F.U.ri(D.drops[0], D.drops[1]);
      for (let i = 0; i < n; i++) {
        const id = rollOre(depth, D.boost);
        ore[id] = (ore[id] || 0) + 1; oreN++;
      }
      xp += D.xp * Math.pow(1.5, depth - 1);
      if (Math.random() < D.gem) gems++;
    }
    // mobs
    const mobs = 9 + Math.floor(depth * 3.4) + (2 + Math.floor(depth * 0.8));
    const D = F.DEPTHS[depth - 1];
    for (let i = 0; i < mobs; i++) {
      const E = F.ENEMIES[D.mobs[i % D.mobs.length]];
      const sc = F.enemyScale(depth);
      gold += (E.gold[0] + E.gold[1]) / 2 * sc;
      xp += E.xp * Math.pow(sc, 0.85);
    }
  }
  for (const k in ore) ore[k] /= runs;
  return { ore, oreN: oreN / runs, gold: gold / runs, xp: xp / runs, gems: gems / runs };
}

function rawValue(ore) { let v = 0; for (const k in ore) v += F.ORES[k].val * ore[k]; return v; }

/** What that ore is worth once it has been through the forge. */
function forgedValue(ore, quality) {
  // melt it in batches of 25, best ore first, which is how a player plays
  const ids = Object.keys(ore).sort((a, b) => F.ORES[b].val - F.ORES[a].val);
  let total = 0, batch = {}, n = 0;
  for (const id of ids) {
    let left = Math.floor(ore[id]);
    while (left > 0) {
      const take = Math.min(left, 25 - n);
      batch[id] = (batch[id] || 0) + take;
      n += take; left -= take;
      if (n >= 25) { total += F.Forge.sellValue(batch, quality); batch = {}; n = 0; }
    }
  }
  if (n >= F.Forge.MIN_ORE) total += F.Forge.sellValue(batch, quality);
  return total;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
F.roman = n => ROMAN[n] || String(n);
const pad = (s, n) => String(s).padEnd(n);
const num = (v, n) => String(Math.round(v).toLocaleString('en-US')).padStart(n || 11);

console.log('\n=== THE FORGE II — BALANCE REPORT ===\n');

console.log(pad('DEPTH', 26) + 'ORE'.padStart(7) + 'RAW g'.padStart(12) + 'FORGED g'.padStart(12) +
            'MOB g'.padStart(10) + 'XP'.padStart(12) + '   BEST ORE');
console.log('-'.repeat(95));
const runData = [];
for (let d = 1; d <= F.MAX_DEPTH; d++) {
  const r = simulateRun(d, 60);
  const raw = rawValue(r.ore);
  const forged = forgedValue(r.ore, 78);
  const best = Object.keys(r.ore).sort((a, b) => F.ORES[b].val - F.ORES[a].val)[0];
  runData.push({ d, r, raw, forged, total: forged + r.gold });
  console.log(pad('  ' + F.roman(d) + '  ' + F.DEPTHS[d - 1].name, 26) +
    num(r.oreN, 7) + num(raw, 12) + num(forged, 12) + num(r.gold, 10) + num(r.xp, 12) +
    '  ' + pad(F.ORES[best].n, 12));
}

console.log('\n--- how many runs each upgrade costs -------------------------------');
console.log(pad('PICKAXE', 20) + num('COST', 12) + '   at its intended depth');
for (let i = 1; i < F.PICKS.length; i++) {
  const p = F.PICKS[i];
  // the depth a player is plausibly running when this becomes affordable
  const d = Math.min(F.MAX_DEPTH, Math.max(1, Math.round(i * 0.9)));
  const income = runData[d - 1].total;
  console.log(pad('  ' + p.n, 20) + num(p.cost, 12) + '   ' + (p.cost / income).toFixed(1) +
    ' runs at depth ' + F.roman(d) + '   (needs lv ' + p.lvl + ')');
}

console.log('\n--- levelling ------------------------------------------------------');
let xp = 0, lvl = 1;
const gateAt = {};
for (const D of F.DEPTHS) gateAt[D.gate] = D.name;
console.log(pad('RUNS', 8) + pad('DEPTH', 10) + pad('LEVEL', 8) + 'unlocks');
for (let run = 1; run <= 60; run++) {
  const d = Math.min(F.MAX_DEPTH, Math.max(1, ...F.DEPTHS.filter(D => D.gate <= lvl).map(D => D.id)));
  xp += runData[d - 1].r.xp;
  let gained = '';
  while (lvl < F.MAX_LEVEL && xp >= F.xpNeeded(lvl)) {
    xp -= F.xpNeeded(lvl); lvl++;
    if (gateAt[lvl]) gained += gateAt[lvl] + ' ';
  }
  if (run % 5 === 0 || gained)
    console.log(pad(run, 8) + pad(F.roman(d), 10) + pad(lvl, 8) + gained);
  if (lvl >= F.MAX_LEVEL) break;
}

console.log('\n--- ore value ladder -----------------------------------------------');
let last = 0;
for (let d = 1; d <= F.MAX_DEPTH; d++) {
  const avail = F.ORE_IDS.filter(i => d >= F.ORES[i].f[0] && d <= F.ORES[i].f[1]);
  const best = avail.sort((a, b) => F.ORES[b].val - F.ORES[a].val)[0];
  const v = F.ORES[best].val;
  const fresh = F.ORE_IDS.filter(i => F.ORES[i].f[0] === d).map(i => F.ORES[i].n);
  console.log(pad('  ' + F.roman(d), 8) + pad(F.ORES[best].n, 14) + num(v, 8) +
    '   x' + (last ? (v / last).toFixed(2) : '—') + '   new: ' + (fresh.join(', ') || '—'));
  last = v;
}

console.log('\n--- boss gates -----------------------------------------------------');
for (const id of F.BOSS_ORDER) {
  const B = F.BOSSES[id];
  console.log(pad('  ' + B.n, 32) + num(B.power, 10) + '   after depth ' + F.roman(B.after) +
    '   hp ' + B.hp.toLocaleString('en-US'));
}
console.log('');
