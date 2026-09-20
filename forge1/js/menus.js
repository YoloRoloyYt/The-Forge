'use strict';
// ---------------------------------------------------------------------------
// menus.js — quests, inventory, shops, enchanter, pause, title
// ---------------------------------------------------------------------------
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '.' : s);

// ---------------------------------------------------------------- quests
const Quests = {
  gen() {
    const opts = ['gather', 'kill', 'forge', 'challenge', 'explore', 'deliver'];
    if (S.stats.bestFloor < MAX_FLOOR) opts.push('floor');
    if (S.level >= 6 && !S.quests.some(q => q.type === 'boss')) opts.push('boss');
    const type = U.pick(opts), id = S.questSeed++, done = false;
    const maxFloor = Math.max(1, Math.min(MAX_FLOOR, [1, 2, 3].filter(f => S.level >= FLOOR_LEVEL[f]).pop() || 1));
    if (type === 'gather') {
      const pool = ORE_IDS.filter(o => ORES[o].f[0] <= maxFloor && ORES[o].tier <= 2 && ORES[o].role !== 'trait');
      const ore = U.pick(pool), need = U.ri(10, 26) - ORES[ore].tier * 4;
      return { id, type, done, target: ore, need, prog: 0, text: `Mine ${need} ${ORES[ore].n}`, reward: { gold: Math.round(need * (ORES[ore].val * 1.8 + 6)), xp: need * 2 } };
    }
    if (type === 'kill') {
      const mob = U.pick(['grunt', 'rogue', 'bomber']), need = U.ri(6, 12);
      return { id, type, done, target: mob, need, prog: 0, text: `Defeat ${need} ${ENEMIES[mob].n}s`, reward: { gold: need * 22, xp: need * 6, frags: Math.random() < 0.4 ? 1 : 0 } };
    }
    if (type === 'forge') {
      const q = U.pick([50, 60, 70, 80]);
      return { id, type, done, target: q, need: 1, prog: 0, text: `Forge an item with ${q}%+ quality`, reward: { gold: 60 + q * 3, xp: 30 + q, gem: q >= 70 ? 'topaz' : null } };
    }
    if (type === 'challenge') {
      const need = U.ri(4, 7);
      return { id, type, done, target: 'any', need, prog: 0, text: `Defeat ${need} enemies unharmed`, reward: { gold: need * 40, xp: need * 12, frags: 1 } };
    }
    if (type === 'explore') {
      const f = U.ri(1, maxFloor);
      return { id, type, done, target: f, need: 1, prog: 0, text: `Find the hidden cavern on Floor ${f}`, reward: { gold: 150 * f, xp: 60 * f, frags: 1, gem: f > 1 ? 'ruby' : 'topaz' } };
    }
    if (type === 'deliver') {
      const cls = U.pick(['dagger', 'sword', 'sword', 'greatsword']), minq = U.pick([50, 60, 70]);
      return { id, type, done, target: cls, minq, need: 1, prog: 0, text: `Deliver a ${CLS[cls].n} (${minq}%+) to the smith`, reward: { gold: 300 + minq * 4 + CLS[cls].tier * 150, xp: 80, frags: 1 } };
    }
    if (type === 'boss') return { id, type, done, target: 'guardian', need: 1, prog: 0, text: 'Defeat the Ancient Grove Guardian', reward: { gold: 600, xp: 400, frags: 3, gem: 'ruby' } };
    const f = Math.min(MAX_FLOOR, S.stats.bestFloor + 1);
    return { id, type: 'floor', done, target: f, need: 1, prog: 0, text: `Reach Mine Floor ${f}`, reward: { gold: 100 * f, xp: 40 * f, frags: 1 } };
  },
  ensure() {
    for (const q of S.quests) if (q.done !== true) q.done = false; // repair quests saved before this field existed
    while (S.quests.length < 3) {
      const q = this.gen();
      if (S.quests.some(o => o.text === q.text)) { if (Math.random() < 0.9) continue; }
      S.quests.push(q);
    }
  },
  event(type, arg, n = 1) {
    for (const q of S.quests) {
      if (q.done) continue;
      if (type === 'kill' && q.type === 'kill' && q.target === arg) q.prog += 1;
      else if (type === 'ore' && q.type === 'gather' && q.target === arg) q.prog += n;
      else if (type === 'forge' && q.type === 'forge' && arg.quality >= q.target) q.prog = 1;
      else if (type === 'floor' && q.type === 'floor' && arg >= q.target) q.prog = 1;
      else if (type === 'kill' && q.type === 'challenge') q.prog += 1;
      else if (type === 'hurt' && q.type === 'challenge') { q.prog = 0; continue; } // streak broken
      else if (type === 'secret' && q.type === 'explore' && q.target === arg) q.prog = 1;
      else if (type === 'boss' && q.type === 'boss') q.prog = 1;
      else continue;
      if (q.prog >= q.need) { q.prog = q.need; q.done = true; Game.toast(`Quest complete: ${q.text}`, '#5aff8a'); Sfx.play('perfect'); }
    }
  },
  // NPC quest: hand an unequipped weapon of the right class and quality to the Blacksmith.
  findDeliverable(q) { return S.items.find(i => i.kind === 'weapon' && i.cls === q.target && i.quality >= q.minq && S.equip.weapon !== i.id) || null; },
  deliver(q) {
    const it = this.findDeliverable(q); if (!it || q.done === true) return;
    S.items = S.items.filter(i => i !== it); q.prog = 1; q.done = true; Game.toast(`Delivered ${it.name}. Quest complete!`, '#5aff8a'); Sfx.play('perfect');
  },
  claim(q) {
    if (q.done !== true || !S.quests.includes(q)) return; // rewards only for finished quests
    const r = q.reward; addGold(r.gold); gainXp(r.xp);
    if (r.frags) S.runeFrags += r.frags; if (r.gem) addGem(r.gem, 1);
    S.quests = S.quests.filter(o => o !== q); this.ensure(); Sfx.play('coin'); Save.save();
  },
};

// ---------------------------------------------------------------- shared scaffold
class MenuScene {
  constructor(title, w = 400, h = 230) { this.title = title; this.w = w; this.h = h; this.x = Math.round((VW - w) / 2); this.y = Math.round((VH - h) / 2); this.tip = null; this.closeKeys = ['Escape']; }
  // Dim the world, draw the frame, and lay out the footer (gold + close).
  drawFrame() {
    ctx.fillStyle = 'rgba(4,2,8,0.66)'; ctx.fillRect(0, 0, VW, VH);
    UI.panel(this.x, this.y, this.w, this.h, this.title);
    this.tip = null;
    const fy = this.y + this.h - 19;
    UI.divider(this.x + 6, fy - 3, this.w - 12);
    // gold purse in the footer
    const gs = U.fmt(S.gold);
    ctx.fillStyle = '#8a6a1a'; ctx.beginPath(); ctx.arc(this.x + 13, fy + 7, 5, 0, 6.3); ctx.fill();
    ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(this.x + 13, fy + 7, 4, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(this.x + 11, fy + 4, 2, 1);
    UI.text(gs, this.x + 22, fy + 4, PAL.gold);
    if (UI.btn(this.x + this.w - 44, fy + 1, 38, 15, 'Close') || Input.hit.apply(Input, this.closeKeys)) Game.pop();
  }
  // Call at the very end of draw() so tooltips sit above everything.
  drawTip() { if (this.tip) UI.tip(this.tip.lines, this.tip.x, this.tip.y, this.tip.col); }
  setTip(lines, col) { this.tip = { lines, x: Input.mx + 10, y: Input.my + 10, col }; }
  tabs(names, cur, x, y) { const i = UI.tabs(names, cur, x, y); if (i >= 0) this.tab = i; }
}

// Lines describing an item, shared by tooltips across screens.
function itemTip(it) {
  const m = Forge.enhMult(it);
  const lines = [it.name + (it.enh ? ` +${it.enh}` : '')];
  lines.push(`${it.grade} \u2014 ${it.quality.toFixed(1)}% quality`);
  if (it.kind === 'weapon') {
    lines.push(`Damage ${(it.stats.dmg * m).toFixed(1)}   Swing ${it.stats.cd}s`);
    lines.push(`Reach ${it.stats.range}   Arc ${it.stats.arc}\u00b0`);
  } else {
    lines.push(`Defence ${(it.stats.def * m).toFixed(1)}   Health +${Math.round(it.stats.hp * m)}`);
    lines.push(`${ARMOR_CLS[it.cls].n} armour`);
  }
  for (const t of it.traits) lines.push(TRAITS[t.id].n + ': ' + (it.kind === 'weapon' ? TRAITS[t.id].wdesc : TRAITS[t.id].adesc));
  if (it.spell) lines.push('Spell: ' + SPELLS[it.spell].n + ' \u2014 ' + SPELLS[it.spell].desc);
  if (it.rune) lines.push('Rune: ' + RUNES[it.rune].n);
  lines.push(`Sells for ${U.fmt(it.value)}g`);
  return lines;
}

// ---------------------------------------------------------------- inventory
class InventoryScene extends MenuScene {
  constructor() { super('INVENTORY', 464, 250); this.tab = 0; this.scroll = 0; this.closeKeys = ['Escape', 'KeyT', 'Tab', 'KeyI']; }
  draw() {
    this.drawFrame();
    const x = this.x, y = this.y, st = calcStats();
    const LW = 168;
    UI.header('EQUIPPED', x + 8, y + 19, LW - 8);
    let ey = y + 31;
    for (const slot of ['weapon', 'head', 'chest', 'legs', 'boots']) {
      const it = getItem(S.equip[slot]);
      const rowH = 20;
      UI.row(x + 8, ey, LW - 12, rowH, 0, it ? 'on' : null);
      UI.slot(x + 10, ey + 2, 17, 17, { edge: it ? Forge.gradeColor(it.grade) : '#332b42' });
      if (it) {
        ItemArt.icon(it, x + 11, ey + 3, 15);
        UI.text(trunc(it.name, 15), x + 31, ey + 3, Forge.gradeColor(it.grade), 'left', 7);
        UI.text(it.kind === 'weapon' ? `${(it.stats.dmg * Forge.enhMult(it)).toFixed(0)} dmg` : `${(it.stats.def * Forge.enhMult(it)).toFixed(0)} def`, x + 31, ey + 12, PAL.dim, 'left', 7);
        if (UI.hover(x + 8, ey, LW - 12, rowH)) this.setTip(itemTip(it), Forge.gradeColor(it.grade));
        if (UI.btn(x + LW - 25, ey + 5, 12, 11, 'x')) { S.equip[slot] = null; Save.save(); }
      } else {
        // empty slot: show which piece belongs here
        ctx.globalAlpha = 0.35; UI.text(slot === 'weapon' ? 'W' : SLOTS[slot].n[0], x + 18, ey + 6, PAL.faint, 'center'); ctx.globalAlpha = 1;
        UI.text(slot === 'weapon' ? 'Weapon' : SLOTS[slot].n, x + 31, ey + 3, PAL.faint, 'left', 7);
        UI.text(slot === 'weapon' ? 'bare fists' : 'empty', x + 31, ey + 12, '#4f4860', 'left', 7);
      }
      ey += rowH + 1;
    }
    // ---- character stats
    ey += 4;
    UI.header('CHARACTER', x + 8, ey, LW - 8); ey += 12;
    const dr = Math.round(100 - 10000 / (100 + st.def * 2));
    const stat = (label, val, col) => { UI.text(label, x + 10, ey, PAL.faint, 'left', 7); UI.text(val, x + LW - 14, ey, col, 'right', 7); ey += 9; };
    stat('Health', String(st.maxHp), '#ff9a9a');
    stat('Defence', `${st.def.toFixed(0)}  (${dr}%)`, '#8fb0ff');
    stat('Damage', `${st.dmg.toFixed(1)} / ${st.wstats.cd}s`, '#ffb066');
    stat('Power', String(playerPower()), PAL.gold);
    stat('Mine power', st.minePower.toFixed(1), '#c8e8a0');
    stat('Race', Race.cur().n, RACE_TIERS[Race.cur().tier].col);
    // currencies
    UI.divider(x + 8, ey + 1, LW - 12); ey += 5;
    UI.text(`${S.essence} essence`, x + 10, ey, '#b58cff', 'left', 7);
    UI.text(`${S.runeFrags} frags`, x + LW - 14, ey, '#ff9a5a', 'right', 7);

    // ---- right pane
    const rx = x + LW + 4;
    this.tabs(['Bag', 'Materials', 'Potions'], this.tab, rx, y + 17);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(rx, y + 33, this.w - LW - 14, this.h - 56);
    if (this.tab === 0) this.bag(rx + 2, y + 36);
    else if (this.tab === 1) this.materials(rx + 6, y + 40);
    else this.potions(rx + 2, y + 36);
    this.drawTip();
  }
  bag(rx, ry) {
    const items = S.items.slice().reverse(), W = 282;
    const rows = 12; this.scroll = U.clamp(this.scroll + UI.wheel, 0, Math.max(0, items.length - rows)); UI.wheel = 0;
    if (!items.length) { UI.text('Your bag is empty.', rx + 6, ry + 8, PAL.faint); UI.text('Forge something at the Blacksmith!', rx + 6, ry + 20, PAL.faint); return; }
    items.slice(this.scroll, this.scroll + rows).forEach((it, i) => {
      const y = ry + i * 15, worn = S.equip[it.slot] === it.id;
      UI.row(rx, y, W, 14, i, worn ? 'on' : null);
      ItemArt.icon(it, rx + 1, y, 13);
      UI.text(trunc(it.name, 19) + (it.enh ? ` +${it.enh}` : ''), rx + 16, y + 3, Forge.gradeColor(it.grade), 'left', 7);
      UI.text(it.kind === 'weapon' ? `${(it.stats.dmg * Forge.enhMult(it)).toFixed(0)}dmg` : `${(it.stats.def * Forge.enhMult(it)).toFixed(0)}def`, rx + 142, y + 3, PAL.text, 'left', 7);
      UI.text(`${it.quality.toFixed(0)}%`, rx + 180, y + 3, Forge.gradeColor(it.grade), 'left', 7);
      if (UI.hover(rx, y, W, 14)) this.setTip(itemTip(it), Forge.gradeColor(it.grade));
      if (UI.btn(rx + 206, y + 1, 38, 12, worn ? 'Worn' : 'Equip', !worn, worn ? PAL.btnGreen : PAL.btn)) { S.equip[it.slot] = it.id; Sfx.play('ui'); Save.save(); }
      if (UI.btn(rx + 246, y + 1, 34, 12, 'Sell', !worn, PAL.btnGold)) { addGold(it.value); S.items = S.items.filter(o => o !== it); Sfx.play('coin'); Save.save(); }
    });
    if (items.length > rows) UI.text(`${this.scroll + 1}-${Math.min(items.length, this.scroll + rows)} of ${items.length}  (scroll)`, rx + W, ry + rows * 15 + 2, PAL.faint, 'right', 7);
  }
  materials(rx, ry) {
    let y = ry;
    UI.header('ORE', rx, y, 270); y += 12;
    let col = 0, any = false;
    for (const id of ORE_IDS) {
      const n = S.ores[id]; if (!n) continue; any = true;
      const cx = rx + col * 92;
      oreIcon(id, cx, y); UI.text(ORES[id].n, cx + 11, y, ORES[id].col, 'left', 7); UI.text(String(n), cx + 84, y, PAL.text, 'right', 7);
      col++; if (col === 3) { col = 0; y += 12; }
    }
    if (!any) UI.text('No ore yet. Mine some in the cave!', rx, y, PAL.faint);
    if (col) y += 12;
    y += 8; UI.header('GEMS', rx, y, 270); y += 12; col = 0; let anyG = false;
    for (const id in GEMS) {
      const n = S.gems[id]; if (!n) continue; anyG = true;
      const cx = rx + col * 92;
      gemIcon(id, cx, y); UI.text(GEMS[id].n, cx + 11, y, GEMS[id].col, 'left', 7); UI.text(String(n), cx + 84, y, PAL.text, 'right', 7);
      col++; if (col === 3) { col = 0; y += 12; }
    }
    if (!anyG) UI.text('No gems. Crystals and veins sometimes hold them.', rx, y, PAL.faint);
    UI.text('Ore only comes from mining.', rx, ry + 168, PAL.faint, 'left', 7);
  }
  potions(rx, ry) {
    let y = ry, any = false;
    POTION_ORDER.forEach((id, i) => {
      const n = S.potions[id] || 0, p = POTIONS[id]; if (!n) return; any = true;
      const slot = S.hotbar.indexOf(id);
      UI.row(rx, y, 282, 20, i, slot >= 0 ? 'on' : null);
      potionIcon(id, rx + 3, y + 5);
      UI.text(`${p.n}`, rx + 16, y + 3, p.col, 'left', 7);
      UI.text(trunc(p.desc, 22), rx + 16, y + 11, PAL.dim, 'left', 7);
      UI.text(`x${n}`, rx + 154, y + 6, PAL.text, 'left', 7);
      if (UI.btn(rx + 176, y + 4, 44, 12, slot >= 0 ? `Slot ${slot + 3}` : 'To bar', true, slot >= 0 ? PAL.btnGreen : PAL.btn)) { if (!Hotbar.toggle(id)) Game.toast('Hotbar is full (slots 3-7).', PAL.bad); Save.save(); }
      if (UI.btn(rx + 224, y + 4, 40, 12, 'Use', true, PAL.btnGold)) usePotion(id, Game.stack[0]);
      y += 22;
    });
    if (!any) { UI.text('No potions.', rx + 6, ry + 8, PAL.faint); UI.text('The Alchemist in the hub sells them.', rx + 6, ry + 20, PAL.faint); }
    UI.text('Add potions to the bar, then press 3-7.', rx, ry + 172, PAL.faint, 'left', 7);
  }
}
// ---------------------------------------------------------------- descend
class DescendScene extends MenuScene {
  constructor(world) { super('THE MINE', 372, 210); this.world = world; }
  // Travel to a level. Coming back up puts you at the lower level's shaft; going down starts at its entrance.
  travel(target) {
    const w = this.world, from = w.floor;
    Game.pop();
    if (target === 0) w.goto(0, 'spawn');
    else w.goto(target, target < from);
  }
  draw() {
    this.drawFrame();
    const W = this.w - 16, rx = this.x + 8, here = this.world.floor;
    UI.text('Deeper floors: richer ore, tougher mobs, darker caves.', rx, this.y + 20, PAL.dim, 'left', 7);
    const rows = [{ f: 0, name: 'The Hub', sub: 'Shops, forge, quest board', col: '#7fe08a' }];
    const info = [
      { name: 'Shallow Tunnels', sub: 'Stone, copper, iron. Levels 1-5', col: '#c8c8d0' },
      { name: 'Magma Veins', sub: 'Trait ores and lava. Levels 5-9', col: '#ff9a4a' },
      { name: 'Deep Dark', sub: 'Titanium, cobalt. Levels 9-13', col: '#c070ff' },
    ];
    for (let f = 1; f <= MAX_FLOOR; f++) rows.push({ f, name: info[f - 1].name, sub: info[f - 1].sub, col: info[f - 1].col });
    let y = this.y + 34;
    rows.forEach((r, i) => {
      const cur = r.f === here, need = r.f ? FLOOR_LEVEL[r.f] : 1, unlocked = S.level >= need;
      const best = r.f && S.stats.bestFloor >= r.f;
      UI.row(rx, y, W, 30, i, cur ? 'on' : null);
      ctx.fillStyle = unlocked ? r.col : '#3a3448'; ctx.fillRect(rx, y, 3, 30);
      // depth marker: a tiny stack of stone layers, one per floor
      for (let k = 0; k < 3; k++) { ctx.fillStyle = r.f && k < r.f ? U.shade(r.col, 0.9) : '#2a2436'; ctx.fillRect(rx + 9, y + 6 + k * 6, 10, 4); }
      if (!r.f) { ctx.fillStyle = '#7fe08a'; ctx.fillRect(rx + 9, y + 6, 10, 16); ctx.fillStyle = '#3a8a48'; ctx.fillRect(rx + 9, y + 6, 10, 3); }
      UI.text(r.f ? `Floor ${r.f}  \u2014  ${r.name}` : r.name, rx + 26, y + 6, unlocked ? PAL.text : PAL.faint, 'left', 8);
      UI.text(unlocked ? r.sub : `Requires level ${need}  (you are ${S.level})`, rx + 26, y + 17, unlocked ? PAL.dim : PAL.bad, 'left', 7);
      if (cur) UI.chip('YOU ARE HERE', rx + W - 84, y + 10, PAL.good);
      else {
        if (best) UI.chip('VISITED', rx + W - 128, y + 10, PAL.faint);
        const label = r.f ? (r.f > here ? 'Descend' : 'Ascend') : 'Leave';
        if (UI.btn(rx + W - 60, y + 8, 54, 14, label, unlocked, r.f === 0 ? PAL.btnGreen : PAL.btnGold)) this.travel(r.f);
      }
      y += 34;
    });
    UI.text('Ore and mobs reset in the hub.', rx + W - 50, this.y + this.h - 15, PAL.faint, 'right', 7);
  }
}
// ---------------------------------------------------------------- merchant
class MerchantScene extends MenuScene {
  constructor() { super('MERCHANT', 400, 256); this.tab = 0; this.scroll = 0; }
  draw() {
    this.drawFrame();
    this.tabs(['Ore', 'Items', 'Gems'], this.tab, this.x + 8, this.y + 17);
    const rx = this.x + 8, W = this.w - 16, ROW = 15;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(rx, this.y + 33, W, this.h - 58);
    let y = this.y + 38;
    if (this.tab === 0) {
      UI.text('Raw ore sells at 60% of its worth.', rx + 6, y, PAL.dim, 'left', 7); y += 12;
      let total = 0; for (const id of ORE_IDS) total += (S.ores[id] || 0);
      let i = 0;
      for (const id of ORE_IDS) {
        const n = S.ores[id]; if (!n) continue; const price = Math.max(1, Math.floor(ORES[id].val * 0.6));
        UI.row(rx + 4, y, W - 8, 14, i++);
        oreIcon(id, rx + 8, y + 3); UI.text(ORES[id].n, rx + 20, y + 4, ORES[id].col, 'left', 7);
        UI.text(`x${n}`, rx + 82, y + 4, PAL.text, 'left', 7);
        UI.text(`${U.fmt(price)}g ea`, rx + 112, y + 4, PAL.gold, 'left', 7);
        UI.text(`= ${U.fmt(price * n)}g`, rx + 170, y + 4, PAL.dim, 'left', 7);
        if (UI.btn(rx + 262, y + 1, 44, 12, 'Sell 1')) { S.ores[id]--; if (!S.ores[id]) delete S.ores[id]; addGold(price); Sfx.play('coin'); }
        if (UI.btn(rx + 310, y + 1, 58, 12, 'Sell all', true, PAL.btnGold)) { addGold(price * n); delete S.ores[id]; Sfx.play('coin'); }
        y += ROW;
      }
      if (!total) UI.text('No ore to sell.', rx + 8, y + 4, PAL.faint);
    } else if (this.tab === 1) {
      const items = S.items.filter(i => S.equip[i.slot] !== i.id).reverse(), rows = 12;
      this.scroll = U.clamp(this.scroll + UI.wheel, 0, Math.max(0, items.length - rows)); UI.wheel = 0;
      // sell-everything sits on the tab row, well clear of the footer buttons
      if (items.length) {
        const tot = items.reduce((s, it) => s + it.value, 0), lbl = `Sell all (${U.fmt(tot)}g)`, bw = UI.width(lbl) + 14;
        if (UI.btn(rx + W - bw, this.y + 17, bw, 13, lbl, true, PAL.btnGold)) { for (const it of items) addGold(it.value); S.items = S.items.filter(i => S.equip[i.slot] === i.id); Sfx.play('coin'); Save.save(); }
      }
      if (!items.length) UI.text('Nothing to sell. Worn gear is never listed.', rx + 8, y + 4, PAL.faint);
      items.slice(this.scroll, this.scroll + rows).forEach((it, i) => {
        UI.row(rx + 4, y, W - 8, 14, i);
        ItemArt.icon(it, rx + 5, y, 13);
        UI.text(trunc(it.name, 26), rx + 21, y + 4, Forge.gradeColor(it.grade), 'left', 7);
        UI.text(`${it.quality.toFixed(0)}%`, rx + 186, y + 4, Forge.gradeColor(it.grade), 'left', 7);
        UI.text(`${U.fmt(it.value)}g`, rx + 218, y + 4, PAL.gold, 'left', 7);
        if (UI.hover(rx + 4, y, W - 8, 14)) this.setTip(itemTip(it), Forge.gradeColor(it.grade));
        if (UI.btn(rx + 318, y + 1, 46, 12, 'Sell', true, PAL.btnGold)) { addGold(it.value); S.items = S.items.filter(o => o !== it); Sfx.play('coin'); Save.save(); }
        y += ROW;
      });
      if (items.length > rows) UI.text(`${this.scroll + 1}-${Math.min(items.length, this.scroll + rows)} of ${items.length}`, rx + W - 6, this.y + this.h - 33, PAL.faint, 'right', 7);
    } else {
      UI.text('Gems are also used for +6 and higher enhancing.', rx + 6, y, PAL.dim, 'left', 7); y += 12;
      let i = 0;
      for (const id in GEMS) {
        const n = S.gems[id]; if (!n) continue; const price = Math.floor(GEMS[id].val * 0.8);
        UI.row(rx + 4, y, W - 8, 14, i++);
        gemIcon(id, rx + 8, y + 3); UI.text(GEMS[id].n, rx + 20, y + 4, GEMS[id].col, 'left', 7);
        UI.text(`x${n}`, rx + 82, y + 4, PAL.text, 'left', 7);
        UI.text(`${U.fmt(price)}g ea`, rx + 112, y + 4, PAL.gold, 'left', 7);
        if (UI.btn(rx + 262, y + 1, 44, 12, 'Sell 1')) { S.gems[id]--; if (!S.gems[id]) delete S.gems[id]; addGold(price); Sfx.play('coin'); }
        if (UI.btn(rx + 310, y + 1, 58, 12, 'Sell all', true, PAL.btnGold)) { addGold(price * n); delete S.gems[id]; Sfx.play('coin'); }
        y += ROW;
      }
      if (!Object.keys(S.gems).length) UI.text('No gems. Crystals and veins sometimes hold them.', rx + 8, y + 4, PAL.faint);
    }
    this.drawTip();
  }
  exit() { Save.save(); }
}
// ---------------------------------------------------------------- pickaxe smith
class SmithScene extends MenuScene {
  constructor() { super('PICKAXE SMITH', 400, 244); }
  draw() {
    this.drawFrame();
    const rx = this.x + 8, W = this.w - 16; let y = this.y + 20;
    UI.header('PICKAXES', rx, y, 150); UI.text('Mine Power = damage per swing', rx + 160, y, PAL.faint, 'left', 7); y += 12;
    PICKS.forEach((p, i) => {
      const owned = S.pickaxe >= i, equipped = S.pickaxe === i, next = S.pickaxe + 1 === i, okLvl = S.level >= p.lvl;
      UI.row(rx, y, W, 17, i, equipped ? 'on' : null);
      const sp = Sprites.pick(i);
      ctx.save(); ctx.translate(rx + 11, y + 9); ctx.rotate(Math.PI / 4); ctx.scale(0.72, 0.72); ctx.drawImage(sp, -sp.width / 2, -sp.height / 2); ctx.restore();
      UI.text(p.n, rx + 24, y + 5, equipped ? PAL.good : owned ? '#6f9a78' : PAL.text, 'left', 7);
      UI.text(`MP ${p.mp}`, rx + 132, y + 5, '#ffb066', 'left', 7);
      if (equipped) UI.text('in use', rx + 198, y + 5, PAL.good, 'left', 7);
      else if (owned) UI.text('owned', rx + 198, y + 5, PAL.faint, 'left', 7);
      else {
        UI.text(`Lv ${p.lvl}`, rx + 198, y + 5, okLvl ? PAL.faint : PAL.bad, 'left', 7);
        UI.text(`${U.fmt(p.cost)}g`, rx + 246, y + 5, S.gold >= p.cost ? PAL.gold : PAL.bad, 'left', 7);
        if (UI.btn(rx + W - 54, y + 2, 50, 13, 'Buy', next && okLvl && S.gold >= p.cost, PAL.btnGold)) { S.gold -= p.cost; S.pickaxe = i; Sfx.play('coin'); Game.toast(`Bought ${p.n}`, PAL.gold); Save.save(); }
      }
      y += 18;
    });
    y += 6; UI.header('LANTERNS', rx, y, 150); UI.text('light reveals rare ore', rx + 160, y, PAL.faint, 'left', 7); y += 12;
    LANTERNS.forEach((l, i) => {
      const owned = S.lantern >= i, equipped = S.lantern === i, next = S.lantern + 1 === i;
      UI.row(rx, y, W, 16, i, equipped ? 'on' : null);
      // little lantern glyph, brighter with tier
      const gx = rx + 11, gy = y + 8, glow = ['#8a6a3a', '#ffca6a', '#ffe08a', '#bff0ff'][Math.min(i, 3)];
      ctx.fillStyle = '#3a3a48'; ctx.fillRect(gx - 4, gy - 5, 8, 3); ctx.fillRect(gx - 4, gy + 2, 8, 2);
      ctx.fillStyle = glow; ctx.fillRect(gx - 3, gy - 3, 6, 5); ctx.fillStyle = '#fff6d8'; ctx.fillRect(gx - 1, gy - 2, 2, 3);
      UI.text(l.n, rx + 24, y + 4, equipped ? PAL.good : owned ? '#6f9a78' : PAL.text, 'left', 7);
      UI.text(`Radius ${l.r}`, rx + 132, y + 4, '#ffb066', 'left', 7);
      if (equipped) UI.text('in use', rx + 198, y + 4, PAL.good, 'left', 7);
      else if (owned) UI.text('owned', rx + 198, y + 4, PAL.faint, 'left', 7);
      else {
        UI.text(`${U.fmt(l.cost)}g`, rx + 246, y + 4, S.gold >= l.cost ? PAL.gold : PAL.bad, 'left', 7);
        if (UI.btn(rx + W - 54, y + 2, 50, 12, 'Buy', next && S.gold >= l.cost, PAL.btnGold)) { S.gold -= l.cost; S.lantern = i; Sfx.play('coin'); Game.toast(`Bought ${l.n}`, PAL.gold); Save.save(); }
      }
      y += 17;
    });
  }
}

// ---------------------------------------------------------------- alchemist
class AlchemistScene extends MenuScene {
  constructor() { super('ALCHEMIST', 390, 228); }
  draw() {
    this.drawFrame();
    const rx = this.x + 8, W = this.w - 16; let y = this.y + 20;
    UI.text('Potions help but never replace good gear.', rx, y, PAL.dim, 'left', 7); y += 13;
    POTION_ORDER.forEach((id, i) => {
      const p = POTIONS[id], have = S.potions[id] || 0, afford = S.gold >= p.cost;
      UI.row(rx, y, W, 21, i, have ? 'on' : null);
      potionIcon(id, rx + 4, y + 5);
      UI.text(p.n, rx + 18, y + 3, p.col, 'left', 7);
      UI.text(p.desc, rx + 18, y + 12, PAL.dim, 'left', 7);
      if (have) UI.text(`have ${have}`, rx + 232, y + 7, PAL.good, 'left', 7);
      UI.text(`${p.cost}g`, rx + 286, y + 7, afford ? PAL.gold : PAL.bad, 'left', 7);
      if (UI.btn(rx + W - 50, y + 4, 46, 13, 'Buy', afford, PAL.btnGold)) { S.gold -= p.cost; S.potions[id] = have + 1; Hotbar.auto(id); Sfx.play('coin'); Save.save(); }
      y += 23;
    });
  }
}
// ---------------------------------------------------------------- enchanter (enhance + runes + spells)
class EnchanterScene extends MenuScene {
  constructor() { super('ENCHANTER', 424, 250); this.tab = 0; }
  // Rows of equipped gear are shared by all three tabs.
  gearRows(cb, emptyMsg) {
    const rx = this.x + 8, W = this.w - 16; let y = this.y + 52, i = 0, any = false;
    for (const slot of ['weapon', 'head', 'chest', 'legs', 'boots']) {
      const it = getItem(S.equip[slot]); if (!it) continue;
      any = true;
      const h = cb.height;
      UI.row(rx, y, W, h, i++);
      UI.slot(rx + 3, y + 3, 18, 18, { edge: Forge.gradeColor(it.grade) });
      ItemArt.icon(it, rx + 4, y + 4, 16);
      UI.text(trunc(it.name, 22) + (it.enh ? ` +${it.enh}` : ''), rx + 25, y + 4, Forge.gradeColor(it.grade), 'left', 7);
      cb.row(it, rx, y, W);
      y += h + 2;
    }
    if (!any) { UI.text(emptyMsg, rx + 8, y + 6, PAL.faint); }
    return y;
  }
  draw() {
    this.drawFrame();
    this.tabs(['Enhance', 'Runes', 'Spells'], this.tab, this.x + 8, this.y + 17);
    const rx = this.x + 8, W = this.w - 16;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(rx, this.y + 33, W, this.h - 56);
    const blurb = ['+8% stats per level, max +10. Gold, essence, gem from +6.',
      'Permanent once installed \u2014 a rune can never be removed.',
      'One spell per item. Casting a new one replaces it.'][this.tab];
    UI.text(blurb, rx + 6, this.y + 39, PAL.dim, 'left', 7);
    if (this.tab === 0) this.enhance();
    else if (this.tab === 1) this.runes();
    else this.spells();
    // resource strip along the bottom
    UI.text(`${S.essence} essence`, rx + 90, this.y + this.h - 15, '#b58cff', 'left', 7);
    UI.text(`${S.runeFrags} rune frags`, rx + 168, this.y + this.h - 15, '#ff9a5a', 'left', 7);
    const gems = Object.keys(GEMS).filter(g => S.gems[g]).length;
    UI.text(`${gems} gem type${gems === 1 ? '' : 's'}`, rx + 262, this.y + this.h - 15, gems ? '#bff3ff' : PAL.faint, 'left', 7);
    this.drawTip();
  }
  enhance() {
    this.gearRows({
      height: 24,
      row: (it, rx, y, W) => {
        UI.text(Forge.describeStats(it), rx + 25, y + 13, PAL.text, 'left', 7);
        if (UI.hover(rx, y, W, 24)) this.setTip(itemTip(it), Forge.gradeColor(it.grade));
        if (it.enh >= 10) { UI.chip('MAX +10', rx + W - 62, y + 8, PAL.gold); return; }
        const c = Forge.enhCost(it.enh), gem = c.gems ? Object.keys(GEMS).find(g => S.gems[g]) : null;
        const ok = S.gold >= c.gold && S.essence >= c.essence && (!c.gems || gem);
        UI.text(`${U.fmt(c.gold)}g`, rx + 214, y + 4, S.gold >= c.gold ? PAL.gold : PAL.bad, 'left', 7);
        UI.text(`${c.essence} ess${c.gems ? ' + gem' : ''}`, rx + 214, y + 13, ok ? '#b58cff' : PAL.bad, 'left', 7);
        if (UI.btn(rx + W - 64, y + 6, 60, 13, `Enhance`, ok, PAL.btnGreen)) {
          S.gold -= c.gold; S.essence -= c.essence;
          if (c.gems) { S.gems[gem]--; if (!S.gems[gem]) delete S.gems[gem]; }
          it.enh++; Sfx.play('levelup'); Game.toast(`${it.name} is now +${it.enh}`, PAL.good); Save.save();
        }
      },
    }, 'Equip something first.');
  }
  runes() {
    const rx = this.x + 8, W = this.w - 16; let y = this.y + 52, i = 0;
    const w = getItem(S.equip.weapon);
    for (const id in RUNES) {
      const r = RUNES[id];
      const onWeapon = r.target === 'weapon';
      const installed = onWeapon ? (w && w.rune === id) : S.pickRune === id;
      const targetOk = onWeapon ? (!!w && !w.rune) : !S.pickRune;
      const ok = targetOk && S.runeFrags >= r.frags && S.gold >= r.gold;
      UI.row(rx, y, W, 24, i++, installed ? 'on' : null);
      // rune stone glyph
      const gx = rx + 12, gy = y + 12;
      ctx.fillStyle = PAL.ink; ctx.fillRect(gx - 7, gy - 8, 14, 16);
      ctx.fillStyle = installed ? '#3a5a3a' : '#3a3450'; ctx.fillRect(gx - 6, gy - 7, 12, 14);
      ctx.fillStyle = installed ? PAL.good : '#ff9a5a';
      ctx.fillRect(gx - 2, gy - 5, 2, 10); ctx.fillRect(gx - 4, gy - 3, 2, 2); ctx.fillRect(gx + 1, gy + 1, 3, 2);
      UI.text(r.n, rx + 25, y + 4, installed ? PAL.good : '#ff9a5a', 'left', 7);
      UI.text(r.desc, rx + 25, y + 13, PAL.dim, 'left', 7);
      UI.text(onWeapon ? 'weapon' : 'pickaxe', rx + 210, y + 4, PAL.faint, 'left', 7);
      if (installed) UI.chip('INSTALLED', rx + W - 74, y + 8, PAL.good);
      else {
        UI.text(`${r.frags} frags`, rx + 210, y + 13, S.runeFrags >= r.frags ? '#ff9a5a' : PAL.bad, 'left', 7);
        UI.text(`${r.gold}g`, rx + 270, y + 8, S.gold >= r.gold ? PAL.gold : PAL.bad, 'left', 7);
        const lbl = !targetOk ? (onWeapon ? (w ? 'Has rune' : 'No weapon') : 'Has rune') : 'Install';
        if (UI.btn(rx + W - 64, y + 6, 60, 13, lbl, ok, PAL.btnGold)) {
          S.runeFrags -= r.frags; S.gold -= r.gold;
          if (onWeapon) w.rune = id; else S.pickRune = id;
          Sfx.play('levelup'); Game.toast(`${r.n} installed`, '#ff9a5a'); Save.save();
        }
      }
      y += 26;
    }
  }
  spells() {
    let hovered = null;
    const endY = this.gearRows({
      height: 30,
      row: (it, rx, y, W) => {
        UI.text(it.spell ? SPELLS[it.spell].n : 'no spell', rx + 196, y + 4, it.spell ? PAL.info : PAL.faint, 'left', 7);
        const kind = it.kind === 'weapon' ? 'weapon' : 'armor';
        let bx = rx + 25;
        for (const id of Object.keys(SPELLS).filter(k => SPELLS[k].kind === kind)) {
          const sp = SPELLS[id], on = it.spell === id, ok = S.gold >= sp.gold && S.essence >= sp.ess && !on;
          if (UI.hover(bx, y + 14, 66, 13)) hovered = sp;
          if (UI.btn(bx, y + 14, 66, 13, sp.n, ok || on, on ? PAL.btnGreen : PAL.btn)) {
            if (!on) { S.gold -= sp.gold; S.essence -= sp.ess; it.spell = id; Sfx.play('levelup'); Game.toast(`${sp.n} cast on ${it.name}`, PAL.info); Save.save(); }
          }
          bx += 70;
        }
      },
    }, 'Equip something to enchant.');
    if (hovered) UI.text(`${hovered.n}: ${hovered.desc}   (${hovered.gold}g + ${hovered.ess} essence)`, this.x + 8, this.y + this.h - 15, PAL.gold, 'left', 7);
  }
}

// ---------------------------------------------------------------- quest cards (shared)
const QUEST_ICON = { kill: '#ff7a7a', gather: '#c8a878', forge: '#ff9a4a', floor: '#9a8cff', challenge: '#ffd23f', explore: '#7fd0ff', deliver: '#7fe08a', boss: '#ff5a7a' };
function questWhere(q) {
  if (q.type === 'kill') return `Hunt ${ENEMIES[q.target].n}s in the mine`;
  if (q.type === 'gather') return `Mine ${ORES[q.target].n} (floor ${ORES[q.target].f[0]}+)`;
  if (q.type === 'forge') return 'Forge at the Blacksmith';
  if (q.type === 'floor') return 'Descend the mine shaft';
  if (q.type === 'challenge') return 'Streak resets if you take damage';
  if (q.type === 'explore') return 'Find a cracked rock and mine it open';
  if (q.type === 'deliver') return 'Forge it, then hand it in here';
  if (q.type === 'boss') return 'Enter the Grove Gate in the hub';
  return '';
}
// Draws one quest card and returns its height.
function questCard(q, x, y, w, i) {
  const h = 34, done = q.done === true;
  UI.row(x, y, w, h, i, done ? 'on' : null);
  // coloured type stripe
  ctx.fillStyle = QUEST_ICON[q.type] || PAL.dim; ctx.fillRect(x, y, 3, h);
  UI.text(q.text, x + 8, y + 4, done ? PAL.good : PAL.text, 'left', 7);
  UI.text(questWhere(q), x + 8, y + 24, PAL.faint, 'left', 7);
  UI.bar(x + 8, y + 14, 140, 6, q.prog / q.need, done ? PAL.good : PAL.info);
  UI.text(done ? 'COMPLETE' : `${Math.min(q.prog, q.need)} / ${q.need}`, x + 154, y + 13, done ? PAL.good : PAL.dim, 'left', 7);
  const r = q.reward, parts = [`${r.gold}g`, `${r.xp}xp`];
  if (r.frags) parts.push(`${r.frags} frag${r.frags > 1 ? 's' : ''}`);
  if (r.gem) parts.push(GEMS[r.gem].n);
  UI.text(parts.join(' '), x + 220, y + 4, PAL.gold, 'left', 7);
  return h;
}

// ---------------------------------------------------------------- quest board
class BoardScene extends MenuScene {
  constructor() { super('QUEST BOARD', 410, 214); Quests.ensure(); }
  draw() {
    this.drawFrame();
    const rx = this.x + 8, W = this.w - 16; let y = this.y + 20;
    for (let i = 0; i < S.quests.length; i++) {
      const q = S.quests[i];
      const h = questCard(q, rx, y, W, i);
      if (q.type === 'deliver' && q.done !== true) {
        const it = Quests.findDeliverable(q);
        if (UI.btn(rx + W - 64, y + 11, 60, 14, 'Deliver', !!it, PAL.btnGold)) Quests.deliver(q);
        if (!it) UI.text('need one in your bag', rx + W - 64, y + 27, PAL.faint, 'left', 7);
      } else if (UI.btn(rx + W - 64, y + 11, 60, 14, 'Claim', q.done === true, PAL.btnGreen)) this.claimed = q;
      y += h + 4;
    }
    if (this.claimed) { Quests.claim(this.claimed); this.claimed = null; }
    UI.text('New work appears as you finish jobs.', rx + W - 50, this.y + this.h - 15, PAL.faint, 'right', 7);
  }
}
// ---------------------------------------------------------------- pause
class PauseScene extends MenuScene {
  constructor() { super('PAUSED', 268, 236); }
  draw() {
    ctx.fillStyle = 'rgba(4,2,8,0.66)'; ctx.fillRect(0, 0, VW, VH);
    UI.panel(this.x, this.y, this.w, this.h, this.title);
    const bx = this.x + 30, bw = this.w - 60;
    let y = this.y + 24;
    if (UI.btn(bx, y, bw, 19, 'Resume', true, PAL.btnGreen) || Input.hit('Escape')) { Game.pop(); return; } y += 23;
    if (UI.btn(bx, y, bw, 19, 'Save game')) { Save.save(); Game.toast('Game saved.', PAL.good); } y += 23;
    if (UI.btn(bx, y, bw, 19, 'Achievements  [K]')) Game.push(new AchievementsScene()); y += 23;
    if (UI.btn(bx, y, bw, 19, 'Settings')) Game.push(new SettingsScene()); y += 23;
    if (UI.btn(bx, y, bw, 19, 'Save & quit to title', true, PAL.btnRed)) { Save.save(); Game.replaceAll(new TitleScene()); } y += 27;
    UI.divider(this.x + 12, y - 6, this.w - 24);
    // run summary
    const cx = this.x + this.w / 2;
    const st = (label, val, col, yy) => { UI.text(label, this.x + 18, yy, PAL.faint, 'left', 7); UI.text(val, this.x + this.w - 18, yy, col, 'right', 7); };
    st('Race', Race.cur().n, RACE_TIERS[Race.cur().tier].col, y); y += 10;
    st('Power', String(playerPower()), PAL.gold, y); y += 10;
    st('Forged / Perfect', `${S.stats.forged} / ${S.stats.perfect}`, PAL.text, y); y += 10;
    st('Kills / Deaths', `${S.stats.kills} / ${S.stats.deaths}`, PAL.text, y); y += 10;
    st('Achievements', `${Ach.count()} / ${ACH.length}`, PAL.info, y); y += 10;
    st('Play time', `${Math.floor(S.stats.playTime / 60)}m`, PAL.dim, y);
  }
}

// ---------------------------------------------------------------- title
class TitleScene {
  constructor() { this.t = 0; this.confirm = false; this.has = !!Save.load(); this.embers = []; }
  update(dt) {
    this.t += dt;
    if (Math.random() < 0.6) FX.spark(U.rnd(120, 360), VH + 4, U.pick(['#ff9a2a', '#ffd23f', '#ff6a1a']), 1, 26, 2.8, 1, -26);
    FX.update(dt);
  }
  draw() {
    // night sky over a forge glow
    ctx.fillStyle = '#0a0713'; ctx.fillRect(0, 0, VW, VH);
    const g = ctx.createLinearGradient(0, VH, 0, 40);
    g.addColorStop(0, 'rgba(255,120,20,0.42)'); g.addColorStop(0.45, 'rgba(140,40,12,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    // stars
    for (let i = 0; i < 40; i++) {
      const r = mulberry32(i * 7717)();
      const sx = Math.floor(r * VW), sy = Math.floor(mulberry32(i * 331)() * 90);
      ctx.fillStyle = Math.sin(this.t * 2 + i) > 0.6 ? '#fff6d8' : '#6a6a90'; ctx.fillRect(sx, sy, 1, 1);
    }
    FX.draw(0, 0);
    // anvil on a stump, backlit
    const ax = VW / 2, ay = 214;
    ctx.fillStyle = 'rgba(255,140,40,0.16)'; ctx.beginPath(); ctx.ellipse(ax, ay + 6, 78, 26, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#2a1f14'; ctx.fillRect(ax - 26, ay + 16, 52, 14);
    ctx.fillStyle = '#12101a'; ctx.fillRect(ax - 44, ay - 12, 88, 12); ctx.fillRect(ax - 30, ay, 60, 10); ctx.fillRect(ax - 40, ay + 10, 80, 7);
    ctx.fillStyle = '#231f30'; ctx.fillRect(ax - 44, ay - 12, 88, 3);
    ctx.fillStyle = 'rgba(255,150,50,0.5)'; ctx.fillRect(ax - 44, ay - 13, 88, 1);
    // title
    UI.text('THE FORGE', VW / 2 + 3, 47, '#3a1408', 'center', 34);
    UI.text('THE FORGE', VW / 2, 44, '#ffb02a', 'center', 34);
    UI.text('THE FORGE', VW / 2, 43, '#ffd23f', 'center', 34);
    ctx.fillStyle = PAL.edge; ctx.fillRect(VW / 2 - 96, 80, 192, 1);
    ctx.fillStyle = PAL.edgeHi; ctx.fillRect(VW / 2 - 40, 80, 80, 1);
    UI.text('M I N E   \u00b7   F O R G E   \u00b7   F I G H T', VW / 2, 88, '#e8d8b8', 'center', 9);
    let y = 118;
    if (this.confirm) {
      UI.text('Start over? This erases your saved game.', VW / 2, y, PAL.bad, 'center'); y += 18;
      if (UI.btn(VW / 2 - 92, y, 88, 20, 'Yes, erase', true, PAL.btnRed)) { Save.clear(); this.start(true); }
      if (UI.btn(VW / 2 + 4, y, 88, 20, 'Cancel')) this.confirm = false;
    } else {
      if (this.has) {
        if (UI.btn(VW / 2 - 76, y, 152, 22, 'Continue', true, PAL.btnGold)) this.start(false);
        y += 27;
      }
      if (UI.btn(VW / 2 - 76, y, 152, 22, 'New Game', true, this.has ? PAL.btn : PAL.btnGold)) { if (this.has) this.confirm = true; else this.start(true); }
    }
    UI.text('WASD move  1 pickaxe  2 weapon  Q dash  F parry', VW / 2, VH - 30, '#8a809c', 'center', 7);
    UI.text('Art is procedural placeholder \u2014 drop PNGs into /assets to replace it.', VW / 2, VH - 18, '#5a5068', 'center', 7);
  }
  start(fresh) {
    if (fresh) S = newState(); else { const s = Save.load(); S = Object.assign(newState(), s); S.stats = Object.assign(newState().stats, S.stats); S.settings = Object.assign(newState().settings, S.settings); }
    applySettings(); Quests.ensure(); Hotbar.sync(); FX.clear(); Sfx.unlock();
    Game.replaceAll(new WorldScene());
  }
}

// ---------------------------------------------------------------- controls list
class ControlsScene extends MenuScene {
  constructor() { super('CONTROLS', 330, 250); this.closeKeys = ['Escape', 'KeyH']; }
  draw() {
    this.drawFrame();
    const groups = [
      ['MOVE & SURVIVE', [
        ['WASD', 'Move'], ['Shift', 'Sprint (uses stamina)'], ['Q', 'Dash \u2014 brief invulnerability'],
        ['F', `Parry ${SHIELD_TIME}s toward the mouse (${SHIELD_CD}s cooldown)`],
      ]],
      ['ACT', [
        ['1', 'Hold pickaxe \u2014 needed to mine'], ['2', 'Hold weapon \u2014 needed to fight'],
        ['3-7', 'Drink the potion in that slot'], ['Wheel', 'Swap pickaxe / weapon'],
        ['Click', 'Light attack toward the cursor'], ['R / RMB', 'Heavy attack'],
        ['E', 'Interact; hold beside a rock to mine'],
      ]],
      ['SCREENS', [
        ['T / Tab', 'Inventory and hotbar setup'], ['J', 'Quest log'], ['K', 'Achievements'],
        ['H', 'This list'], ['Esc', 'Pause / close'],
      ]],
    ];
    let y = this.y + 20;
    for (const [head, rows] of groups) {
      UI.header(head, this.x + 10, y, this.w - 20); y += 12;
      for (const r of rows) {
        UI.text(r[0], this.x + 16, y, PAL.gold, 'left', 7);
        UI.text(r[1], this.x + 88, y, PAL.text, 'left', 7);
        y += 10;
      }
      y += 5;
    }
  }
}

// ---------------------------------------------------------------- quest log (view only)
class QuestLogScene extends MenuScene {
  constructor() { super('YOUR QUESTS', 410, 200); Quests.ensure(); this.closeKeys = ['Escape', 'KeyJ']; }
  draw() {
    this.drawFrame();
    const rx = this.x + 8, W = this.w - 16; let y = this.y + 20;
    for (let i = 0; i < S.quests.length; i++) {
      const q = S.quests[i];
      questCard(q, rx, y, W, i);
      if (q.done === true) UI.chip('CLAIM AT BOARD', rx + W - 8 - (UI.width('CLAIM AT BOARD', 7) + 6), y + 12, PAL.good);
      y += 38;
    }
    UI.text('Turn quests in at the Quest Board.', rx + W - 50, this.y + this.h - 15, PAL.faint, 'right', 7);
  }
}