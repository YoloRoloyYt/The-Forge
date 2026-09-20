'use strict';
// ---------------------------------------------------------------------------
// entities.js — derived player stats, Player, Enemy, hotbar helper
// ---------------------------------------------------------------------------

// Recompute everything gear/buffs/runes/spells/race contribute. Level intentionally grants no combat stats.
// opts.base = ignore temporary buffs (potions, powerups); used by the power rating so it only reflects gear and race.
function calcStats(opts) {
  const eq = S.equip;
  const items = { weapon: getItem(eq.weapon), head: getItem(eq.head), chest: getItem(eq.chest), legs: getItem(eq.legs), boots: getItem(eq.boots) };
  const w = items.weapon, rp = k => Race.p(k);
  let hpBonus = 0, def = 0, slow = 0, hpMult = 1, defMult = 1, aura = 0, iceShield = 0;
  const armorTraits = [], weaponTraits = w ? w.traits : [];
  for (const slot of ['head', 'chest', 'legs', 'boots']) {
    const a = items[slot]; if (!a) continue;
    const m = Forge.enhMult(a);
    let pieceHp = a.stats.hp * m, pieceDef = a.stats.def * m;
    for (const t of a.traits) {
      armorTraits.push(t);
      if (t.id === 'volcanic') defMult += 0.25 * t.s;
      // Glass armour trades this piece's own HP bonus for extra defence. It is local to the piece, so wearing
      // more armour can never make you weaker overall.
      if (t.id === 'glass') { pieceDef *= 1 + 0.3 * t.s; pieceHp *= Math.max(0.3, 1 - 0.3 * t.s); }
    }
    hpBonus += pieceHp; def += pieceDef; slow += a.stats.slow;
    if (a.spell === 'fortify') defMult += 0.06;
    if (a.spell === 'vitality') hpMult += 0.06;
    if (a.spell === 'inferno') aura += 4;
    if (a.spell === 'iceshield') iceShield += 0.04;
  }
  const wm = w ? Forge.enhMult(w) : 1;
  const ws0 = w ? w.stats : FISTS.stats;
  let dmg = ws0.dmg * wm, burnAlways = false, burnChance = 0, boom = 0, lifesteal = rp('lifesteal');
  let chain = 0, slowHit = false, voidBonus = 0, aspd = rp('aspd');
  for (const t of weaponTraits) {
    if (t.id === 'volcanic') { dmg *= 1 + 0.10 * t.s; burnChance = Math.max(burnChance, 0.15 * t.s); }
    if (t.id === 'demonic') burnAlways = true;
    if (t.id === 'glass') { dmg *= 1 + 0.4 * t.s; hpMult -= 0.15 * t.s; }
    if (t.id === 'explosive') boom = Math.max(boom, 0.15 * t.s);
  }
  if (w) {
    if (w.rune === 'fire') burnAlways = true;
    if (w.rune === 'life') lifesteal += 0.06;
    if (w.spell === 'flame') burnChance = Math.max(burnChance, 0.25);
    if (w.spell === 'storm') chain = 0.2;
    if (w.spell === 'frost') slowHit = true;
    if (w.spell === 'void') voidBonus = 0.35;
    if (w.spell === 'wind') aspd += 0.15;
  }
  const ws = Object.assign({}, ws0, { cd: +(ws0.cd / (1 + aspd)).toFixed(3), wind: +(ws0.wind / (1 + aspd)).toFixed(3) });
  const b = opts && opts.base ? {} : S.buffs;
  const strBuff = (b.str > 0 ? 1.25 : 1) * (b.berserk > 0 ? 1.4 : 1), protBuff = b.prot > 0 ? 1.3 : 1;
  let mine = PICKS[S.pickaxe].mp * (1 + rp('mine')), yieldMult = 1;
  if (S.pickRune === 'mine') mine *= 1.3;
  if (S.pickRune === 'yield') yieldMult += 0.2;
  if (b.fort > 0) yieldMult += 0.35;
  if (b.haste > 0) mine *= 1.25;
  const reflect = armorTraits.find(t => t.id === 'demonic');
  const armBoom = armorTraits.find(t => t.id === 'explosive');
  hpMult += rp('hp');
  return {
    weapon: w, wstats: ws, dmg: dmg * strBuff,
    maxHp: Math.max(30, Math.round((100 + hpBonus) * Math.max(0.4, hpMult))),
    def: def * defMult * protBuff, moveMult: (1 - Math.min(0.2, slow)) * (1 + rp('move')),
    burnAlways, burnChance, boom, lifesteal, minePower: mine, yieldMult,
    lightR: LANTERNS[S.lantern].r, luck: (b.luck > 0 ? 0.6 : 0) + rp('luck'),
    reflect: reflect ? 6 * reflect.s : 0, armBoom: armBoom ? 0.10 * armBoom.s : 0,
    haste: b.haste > 0, dr: Math.min(0.6, rp('dr')), forgeBonus: rp('forge'),
    chain, slowHit, voidBonus, aura, iceShield,
  };
}
function getItem(id) { return id == null ? null : S.items.find(i => i.id === id) || null; }

// ---------------------------------------------------------------------------
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.r = 5;
    this.face = 0; this.dir = 1; this.stats = calcStats();
    this.hp = this.stats.maxHp; this.sta = 100;
    this.state = 'idle'; this.t = 0; this.stateDur = 0;
    this.staDelay = 0; this.iframes = 0; this.dashCd = 0; this.stun = 0;
    this.atk = null; this.mineT = 0; this.mineTarget = null; this.blocking = false; this.shieldT = 0; this.shieldCd = 0; this.parryAng = 0; this.walk = 0;
    this.sprint = false; this.exhausted = false; this.regenDelay = 0; this.dead = false;
    this.barrier = 0; this.fireCharges = 0; this.auraT = 0;
  }
  useSta(n) { this.sta = Math.max(0, this.sta - n); this.regenDelay = 0.55; }
}

// ---------------------------------------------------------------------------
class Enemy {
  constructor(type, x, y, floor, elite = false, level = null) {
    const d = ENEMIES[type];
    // Level rises with mine floor (and with how deep into a floor the mob lives); stats follow level.
    level = level || (1 + (floor - 1) * 4 + (elite ? 2 : 0));
    const hs = 1 + 0.14 * (level - 1), ds = 1 + 0.09 * (level - 1);
    this.level = level; this.boss = !!d.boss;
    this.type = type; this.d = d; this.floor = floor; this.elite = elite;
    this.x = x; this.y = y; this.home = { x, y };
    this.maxHp = d.fixedHp || Math.round(d.hp * hs * (elite ? 3 : 1)); this.hp = this.maxHp;
    this.dmg = d.dmg * ds * (elite ? 2 : 1);
    this.spd = d.spd * (elite ? 0.9 : 1); this.r = d.r * (elite ? 1.5 : 1);
    this.state = 'idle'; this.t = 0; this.face = 0; this.hitFlash = 0;
    this.kx = 0; this.ky = 0; this.burn = 0; this.burnDps = 0; this.slow = 0; this.stun = 0;
    this.wander = { x, y, t: 0 }; this.dead = false; this.dirX = 0; this.dirY = 0; this.hitDone = false; this.bob = Math.random() * 6;
  }
}

// Potion hotbar assignment (slots 3-7). Slot data lives in S.hotbar (array of potion ids / null).
const Hotbar = {
  has(id) { return S.hotbar.includes(id); },
  auto(id) { if (this.has(id)) return true; const i = S.hotbar.indexOf(null); if (i < 0) return false; S.hotbar[i] = id; return true; },
  toggle(id) {
    const i = S.hotbar.indexOf(id);
    if (i >= 0) { S.hotbar[i] = null; return true; }
    return this.auto(id);
  },
  sync() { if (!Array.isArray(S.hotbar) || S.hotbar.length !== HOTBAR_SLOTS - 2) S.hotbar = ['heal', null, null, null, null]; for (const id of POTION_ORDER) if (S.potions[id]) this.auto(id); },
};
