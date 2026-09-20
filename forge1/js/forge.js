'use strict';
// ---------------------------------------------------------------------------
// forge.js — the four-stage forging scene:
//   1 Crucible (choose ore)  2 Bellows (heat)  3 Pour  4 Hammering  -> quench + result
// ---------------------------------------------------------------------------
function heatColor(h) {
  h = U.clamp(h, 0, 1);
  const stops = ['#4a4a55', '#b0281c', '#ff8a1a', '#fff08a'];
  const p = h * 3, i = Math.min(2, Math.floor(p));
  return U.mix(stops[i], stops[i + 1], p - i);
}

const READY_TIME = 2.4;   // seconds of "get ready" before each minigame stage
const RESULT_LOCK = 1.3;  // seconds before the result buttons accept clicks

class ForgeScene {
  constructor() {
    this.stage = 'setup'; this.kind = 'weapon'; this.slot = 'chest'; this.sel = {};
    this.q = { bellows: 0, pour: 0, hammer: 0 }; this.item = null; this.t = 0; this.msgs = [];
    this.locked = null; this.heat = 0.1;
  }
  enter() { FX.clear(); }
  exit() { FX.clear(); }

  update(dt) {
    this.t += dt; FX.update(Math.min(dt, 0.05));
    // Breather at the start of every minigame stage so a stray click can't ruin it.
    if (this.ready > 0) { this.ready -= dt; return; }
    const s = this['u_' + this.stage]; if (s) s.call(this, Math.min(dt, 0.05));
  }
  draw() {
    const s = this['d_' + this.stage]; if (s) s.call(this);
    FX.draw(0, 0);
    if (this.ready > 0) this.drawReady();
  }
  drawReady() {
    const tip = { bellows: 'Keep the heat marker inside the moving green zone.', pour: 'Release the moment the metal reaches the rim line.', hammer: 'Strike each circle exactly as its ring closes.' }[this.stage];
    if (!tip) return;
    // dim everything, then a single focused countdown
    ctx.fillStyle = 'rgba(8,5,12,0.7)'; ctx.fillRect(0, 35, VW, VH - 51);
    const n = Math.max(1, Math.ceil(this.ready / READY_TIME * 3));
    const k = 1 - ((this.ready / READY_TIME * 3) % 1);     // 0..1 within the current tick
    UI.text(tip, VW / 2, 104, PAL.text, 'center', 9);
    // expanding ring around the number
    ctx.strokeStyle = `rgba(255,210,63,${0.7 - k * 0.6})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(VW / 2, 146, 16 + k * 16, 0, 6.3); ctx.stroke();
    ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(VW / 2, 146, 15, 0, 6.3); ctx.fill();
    ctx.strokeStyle = PAL.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(VW / 2, 146, 15, 0, 6.3); ctx.stroke();
    UI.text(String(n), VW / 2, 137, '#ffffff', 'center', 20);
    UI.text('GET READY', VW / 2, 170, PAL.dim, 'center', 8);
  }

  // ---------------------------------------------------------------- 1. crucible
  total() { return Forge.total(this.sel); }
  // A throwaway item built from the current selection, so the player can see what they are making.
  preview() {
    const sig = this.kind + this.slot + JSON.stringify(this.sel);
    if (sig !== this._sig) {
      this._sig = sig;
      for (const k in Art.gen) if (k.indexOf('item_-7_') === 0) delete Art.gen[k];
      this._prev = this.total() >= Forge.MIN_ORE ? Forge.create({ kind: this.kind, slot: this.kind === 'weapon' ? 'weapon' : this.slot, ores: this.sel, quality: 70 }, -7) : null;
    }
    return this._prev;
  }
  d_setup() {
    ctx.fillStyle = 'rgba(4,2,8,0.82)'; ctx.fillRect(0, 0, VW, VH);
    UI.panel(6, 4, VW - 12, VH - 8, 'THE CRUCIBLE');
    const total = this.total(), ok = total >= Forge.MIN_ORE;
    const LX = 14, LW = 268;
    UI.text('Amount sets the class. The ores set power and traits.', LX, 20, PAL.dim, 'left', 7);

    // ---- ore list
    UI.header('YOUR ORE', LX, 32, LW);
    let y = 44, i = 0, anyOre = false;
    for (const id of ORE_IDS) {
      const have = S.ores[id] || 0, n = this.sel[id] || 0;
      if (have <= 0 && n <= 0) continue;
      anyOre = true;
      const o = ORES[id];
      UI.row(LX, y, LW, 16, i++, n > 0 ? 'on' : null);
      oreIcon(id, LX + 4, y + 4);
      UI.text(o.n, LX + 16, y + 5, o.col, 'left', 7);
      const roleCol = o.role === 'trait' ? '#ffb066' : o.role === 'mult' ? PAL.info : PAL.faint;
      UI.text(o.role === 'trait' ? 'trait' : o.role === 'mult' ? 'power' : 'filler', LX + 74, y + 5, roleCol, 'left', 7);
      UI.text(String(have - n), LX + 112, y + 5, (have - n) ? PAL.text : PAL.faint, 'left', 7);
      if (UI.btn(LX + 136, y + 2, 13, 12, '-', n > 0)) this.sel[id] = n - 1;
      UI.text(String(n), LX + 160, y + 5, n ? PAL.gold : PAL.faint, 'center', 7);
      if (UI.btn(LX + 170, y + 2, 13, 12, '+', have - n > 0)) this.sel[id] = n + 1;
      if (UI.btn(LX + 186, y + 2, 20, 12, '+5', have - n >= 5)) this.sel[id] = n + 5;
      if (UI.btn(LX + 209, y + 2, 25, 12, 'All', have - n > 0)) this.sel[id] = have;
      if (UI.btn(LX + 236, y + 2, 32, 12, 'None', n > 0)) this.sel[id] = 0;
      y += 18;
    }
    if (!anyOre) { UI.text('You have no ore.', LX + 4, y + 6, PAL.bad); UI.text('Head into the mine and swing that pickaxe!', LX + 4, y + 18, PAL.faint); }

    // ---- what it will become
    const RX = 292, RW = VW - RX - 16;
    UI.header('RESULT', RX, 32, RW);
    let ry = 44;
    // kind toggle
    if (UI.btn(RX, ry, RW / 2 - 2, 14, 'Weapon', true, this.kind === 'weapon' ? PAL.btnGold : PAL.btn)) this.kind = 'weapon';
    if (UI.btn(RX + RW / 2 + 2, ry, RW / 2 - 2, 14, 'Armour', true, this.kind === 'armor' ? PAL.btnGold : PAL.btn)) this.kind = 'armor';
    ry += 17;
    if (this.kind === 'armor') {
      let sx = RX, k = 0;
      for (const key in SLOTS) {
        if (UI.btn(sx, ry, RW / 4 - 2, 13, SLOTS[key].n.slice(0, 5), true, this.slot === key ? PAL.btnGold : PAL.btn)) this.slot = key;
        sx += RW / 4; k++;
      }
      ry += 16;
    }
    // preview slot
    const pv = this.preview();
    UI.slot(RX, ry, 52, 52, { edge: pv ? PAL.edge : '#332b42' });
    if (pv) {
      const sp = ItemArt.sprite(pv), sc = Math.min(44 / sp.width, 44 / sp.height);
      ctx.drawImage(sp, Math.round(RX + 26 - sp.width * sc / 2), Math.round(ry + 26 - sp.height * sc / 2), Math.round(sp.width * sc), Math.round(sp.height * sc));
    } else { UI.text('?', RX + 26, ry + 16, '#3f3752', 'center', 22); }
    // numbers beside the preview
    const ix = RX + 58;
    UI.text(`${total} ore`, ix, ry + 2, ok ? PAL.text : PAL.bad, 'left', 7);
    UI.text(`min ${Forge.MIN_ORE}`, ix + 46, ry + 2, PAL.faint, 'left', 7);
    if (total > 0) {
      const cls = this.kind === 'weapon' ? Forge.weaponClass(total) : Forge.armorClass(total);
      const nm = this.kind === 'weapon' ? CLS[cls].n : ARMOR_CLS[cls].n + ' ' + SLOTS[this.slot].n;
      UI.text(nm, ix, ry + 13, PAL.info, 'left', 8);
      UI.text(`Ore power  x${(0.6 + Forge.avgMult(this.sel)).toFixed(2)}`, ix, ry + 25, PAL.text, 'left', 7);
      const pal = Forge.palette(this.sel);
      UI.text('Colour', ix, ry + 36, PAL.dim, 'left', 7);
      ctx.fillStyle = PAL.ink; ctx.fillRect(ix + 40, ry + 34, 26, 10);
      ctx.fillStyle = pal.main; ctx.fillRect(ix + 41, ry + 35, 12, 8);
      ctx.fillStyle = pal.accent; ctx.fillRect(ix + 53, ry + 35, 12, 8);
    }
    ry += 58;
    // class ladder, so the player learns where the thresholds are
    UI.text('CLASS BY AMOUNT', RX, ry, PAL.edge, 'left', 7); ry += 10;
    const bands = this.kind === 'weapon'
      ? [['3-9', 'Dagger'], ['10-25', 'Sword'], ['26-39', 'Great'], ['40+', 'Colos.']]
      : [['3-9', 'Light'], ['10-25', 'Medium'], ['26-39', 'Heavy'], ['40+', 'Bulw.']];
    const curIdx = total <= 9 ? 0 : total <= 25 ? 1 : total <= 39 ? 2 : 3;
    bands.forEach((b, k) => {
      const bw = RW / 4, bx = RX + k * bw, on = total > 0 && k === curIdx;
      ctx.fillStyle = on ? '#4a3a12' : '#1d1729'; ctx.fillRect(bx, ry, bw - 2, 20);
      ctx.fillStyle = on ? PAL.gold : '#2f2842'; ctx.fillRect(bx, ry, bw - 2, 1); ctx.fillRect(bx, ry + 19, bw - 2, 1);
      UI.text(b[0], bx + bw / 2 - 1, ry + 3, on ? PAL.gold : PAL.faint, 'center', 7);
      UI.text(b[1], bx + bw / 2 - 1, ry + 11, on ? PAL.text : PAL.faint, 'center', 7);
    });
    ry += 26;
    // traits
    const tr = Forge.traits(this.sel);
    UI.text('TRAITS', RX, ry, PAL.edge, 'left', 7); ry += 10;
    if (!tr.length) UI.text('none (trait ore: 20% of melt)', RX, ry, PAL.faint, 'left', 7);
    for (const t of tr) {
      UI.text(`${TRAITS[t.id].n}  x${t.s}`, RX, ry, '#ffb066', 'left', 7); ry += 9;
      for (const l of UI.wrap(this.kind === 'weapon' ? TRAITS[t.id].wdesc : TRAITS[t.id].adesc, 27)) { UI.text(l, RX + 4, ry, PAL.dim, 'left', 7); ry += 9; }
    }

    // ---- footer
    const fy = VH - 30;
    UI.text(`Ore value ${U.fmt(Forge.rawValue(this.sel))}g`, LX, fy + 5, PAL.gold, 'left', 7);
    if (S.forgeFrenzy) UI.chip('FORGE FRENZY READY', LX + 108, fy + 4, '#c23bff');
    if (UI.btn(LX + 230, fy + 1, 52, 16, 'Clear', total > 0)) this.sel = {};
    if (UI.btn(RX, fy + 1, 60, 16, 'Close')) Game.pop();
    if (UI.btn(RX + 66, fy + 1, RW - 66, 16, ok ? 'BEGIN FORGING' : `Need ${Forge.MIN_ORE - total} more`, ok, ok ? '#7a3a10' : PAL.btn)) this.begin();
    if (Input.hit('Escape')) Game.pop();
  }
  begin() {
    // commit the ore
    this.ores = Object.assign({}, this.sel);
    for (const id in this.ores) { S.ores[id] -= this.ores[id]; if (S.ores[id] <= 0) delete S.ores[id]; }
    const total = this.total();
    this.tier = this.kind === 'weapon' ? CLS[Forge.weaponClass(total)].tier : ARMOR_CLS[Forge.armorClass(total)].tier;
    const pal = Forge.palette(this.ores); this.pal = pal;
    this.sel = {};
    this.frenzy = !!S.forgeFrenzy; S.forgeFrenzy = false; // Forge Frenzy powerup: larger Perfect zones for this forge
    this.startBellows();
    Save.save();
  }

  // ---------------------------------------------------------------- shared visuals
  bg(heat, label, help) {
    const t = this.t;
    ctx.fillStyle = '#120d16'; ctx.fillRect(0, 0, VW, VH);
    // stone block wall
    for (let y = 0; y < 206; y += 14) {
      for (let x = ((y / 14) % 2) * 15; x < VW; x += 30) {
        ctx.fillStyle = '#231b2c'; ctx.fillRect(x + 1, y + 1, 28, 12);
        ctx.fillStyle = '#2b2236'; ctx.fillRect(x + 1, y + 1, 28, 9);
        ctx.fillStyle = '#332942'; ctx.fillRect(x + 2, y + 2, 26, 2);
      }
    }
    // tools hung on the wall
    ctx.fillStyle = '#4a3018'; ctx.fillRect(360, 40, 3, 34); ctx.fillStyle = '#6b6478'; ctx.fillRect(352, 34, 19, 8);
    ctx.fillStyle = '#4a3018'; ctx.fillRect(398, 44, 3, 28); ctx.fillStyle = '#6b6478'; ctx.fillRect(392, 38, 15, 7);
    ctx.fillStyle = '#3a3040'; ctx.fillRect(424, 36, 22, 26); ctx.fillStyle = '#4e4458'; ctx.fillRect(426, 38, 18, 20);
    // furnace
    const glow = 0.18 + heat * 0.55 + Math.sin(t * 9) * 0.03;
    ctx.fillStyle = '#1a1420'; ctx.fillRect(10, 34, 82, 116);
    ctx.fillStyle = '#2b2236'; ctx.fillRect(14, 38, 74, 108);
    ctx.fillStyle = '#100c14'; ctx.fillRect(24, 58, 54, 64);
    ctx.fillStyle = `rgba(255,${90 + heat * 110 | 0},20,${glow + 0.32})`; ctx.fillRect(28, 76, 46, 42);
    ctx.fillStyle = `rgba(255,210,90,${glow})`; ctx.fillRect(36, 92, 30, 22);
    ctx.fillStyle = `rgba(255,245,190,${glow * 0.85})`; ctx.fillRect(44, 100, 14, 10);
    // coals
    for (let i = 0; i < 7; i++) { ctx.fillStyle = Math.sin(t * 6 + i) > 0 ? '#ff8a2a' : '#c0421a'; ctx.fillRect(30 + i * 6, 116, 4, 3); }
    ctx.fillStyle = '#3a3040'; ctx.fillRect(10, 30, 82, 6); ctx.fillStyle = '#4e4458'; ctx.fillRect(10, 30, 82, 2);
    // warm light spill over the room
    ctx.fillStyle = `rgba(255,120,30,${glow * 0.2})`; ctx.fillRect(0, 0, VW, VH);
    // floor
    ctx.fillStyle = '#241d2c'; ctx.fillRect(0, 206, VW, VH - 206);
    ctx.fillStyle = '#2e2637'; ctx.fillRect(0, 206, VW, 3);
    for (let x = 0; x < VW; x += 22) { ctx.fillStyle = '#1e1826'; ctx.fillRect(x, 209, 1, VH - 209); }
    // anvil on its stump
    ctx.fillStyle = '#1a1420'; ctx.fillRect(196, 232, 88, 16);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(200, 226, 80, 12); ctx.fillStyle = '#4a3624'; ctx.fillRect(200, 226, 80, 4);
    ctx.fillStyle = '#15121b'; ctx.fillRect(146, 194, 188, 14);
    ctx.fillStyle = '#4a4a56'; ctx.fillRect(148, 196, 184, 11);
    ctx.fillStyle = '#62626e'; ctx.fillRect(148, 196, 184, 3);
    ctx.fillStyle = '#6e6e7c'; ctx.fillRect(148, 196, 60, 1);
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(204, 207, 72, 20);
    ctx.fillStyle = '#44444f'; ctx.fillRect(204, 207, 6, 20);
    // header
    ctx.fillStyle = 'rgba(8,5,12,0.72)'; ctx.fillRect(0, 0, VW, 34);
    ctx.fillStyle = PAL.edgeLo; ctx.fillRect(0, 34, VW, 1);
    UI.text(label, VW / 2, 5, PAL.gold, 'center', 13);
    UI.text(help, VW / 2, 21, PAL.text, 'center', 8);
    // stage tracker
    const names = ['Crucible', 'Bellows', 'Pour', 'Hammer', 'Quench'];
    const cur = { bellows: 1, pour: 2, hammer: 3, quench: 4, result: 5 }[this.stage] ?? 0;
    ctx.fillStyle = 'rgba(8,5,12,0.72)'; ctx.fillRect(0, VH - 16, VW, 16);
    names.forEach((n, i) => {
      const cx = 64 + i * 88, done = i < cur, now = i === cur;
      if (i < names.length - 1) { ctx.fillStyle = done ? PAL.edge : '#3a3448'; ctx.fillRect(cx + 26, VH - 9, 36, 1); }
      ctx.fillStyle = now ? PAL.gold : done ? PAL.edge : '#3a3448';
      ctx.fillRect(cx - 4, VH - 12, 7, 7);
      if (now) { ctx.fillStyle = '#fff3b0'; ctx.fillRect(cx - 2, VH - 10, 3, 3); }
      UI.text(n, cx + 8, VH - 12, now ? PAL.gold : done ? PAL.edge : '#5a5068', 'left', 7);
    });
  }
  ingot(x, y, w, h, heat, tint) {
    const col = tint || heatColor(heat);
    ctx.fillStyle = PAL.ink; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = U.shade(col, 0.7); ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, w, h - 4);
    ctx.fillStyle = U.shade(col, 1.4); ctx.fillRect(x + 3, y + 2, w - 6, 3);
    ctx.fillStyle = U.shade(col, 1.7); ctx.fillRect(x + 6, y + 2, w / 3, 1);
    // heat haze above very hot metal
    if (heat > 0.6) {
      ctx.globalAlpha = (heat - 0.6) * 0.5;
      ctx.fillStyle = '#ff9a3a';
      for (let i = 0; i < 6; i++) ctx.fillRect(x + 10 + i * (w / 7), y - 4 - (Math.sin(this.t * 5 + i) + 1) * 2, 2, 3);
      ctx.globalAlpha = 1;
    }
  }
  // ---------------------------------------------------------------- 2. bellows
  startBellows() {
    this.stage = 'bellows'; this.ready = READY_TIME;
    this.b = { t: 0, dur: (S.buffs.haste > 0 ? 8 : 10), heat: 0.15, inZone: 0, ph: Math.random() * 6, pump: 0, over: 0 };
    this.b.w = (0.2 - 0.025 * this.tier) * (this.frenzy ? 1.5 : 1);
  }
  bcenter(t) { return U.clamp(0.5 + 0.28 * Math.sin(t * 0.8 + this.b.ph) + 0.08 * Math.sin(t * 2.3), 0.2, 0.82); }
  u_bellows(dt) {
    const b = this.b, press = Input.key('Space') || Input.mdown[0];
    b.t += dt; b.pump = U.lerp(b.pump, press ? 1 : 0, dt * 10);
    b.heat = U.clamp(b.heat + (press ? 0.62 : -0.42) * dt, 0, 1);
    b.c = this.bcenter(b.t);
    const inZ = Math.abs(b.heat - b.c) <= b.w / 2;
    if (inZ) { b.inZone += dt; if (Math.random() < 0.5) FX.spark(240 + U.rnd(-60, 60), 176, '#ffd23f', 1, 40, 0.5, 1, -30); }
    if (b.heat >= 0.995) { b.over += dt; if (Math.random() < 0.3) FX.spark(240, 170, '#ffffff', 2, 60, 0.3); }
    this.heat = b.heat;
    if (b.t >= b.dur) { this.q.bellows = U.clamp(b.inZone / b.dur, 0, 1); this.startPour(); }
  }
  d_bellows() {
    const b = this.b;
    this.bg(b.heat, 'BELLOWS', 'Hold SPACE or click to pump. Keep the heat marker inside the moving green zone.');
    // gauge
    const gx = 400, gy = 50, gh = 140;
    ctx.fillStyle = '#000'; ctx.fillRect(gx - 1, gy - 1, 22, gh + 2);
    for (let i = 0; i < gh; i++) { ctx.fillStyle = heatColor(1 - i / gh); ctx.fillRect(gx, gy + i, 20, 1); }
    const c = b.c ?? this.bcenter(b.t);
    ctx.fillStyle = 'rgba(40,255,120,0.55)'; ctx.fillRect(gx - 4, gy + gh * (1 - c - b.w / 2), 28, gh * b.w);
    ctx.strokeStyle = '#2aff78'; ctx.lineWidth = 1; ctx.strokeRect(gx - 4.5, gy + gh * (1 - c - b.w / 2) + 0.5, 28, gh * b.w);
    ctx.fillStyle = '#fff'; ctx.fillRect(gx - 8, gy + gh * (1 - b.heat) - 1, 36, 3);
    UI.text('HEAT', gx + 10, gy - 12, '#ffd23f', 'center');
    // progress + score
    UI.bar(150, 40, 180, 6, b.t / b.dur, '#c9a24b');
    UI.text(`In zone: ${Math.round(100 * b.inZone / Math.max(0.001, b.t))}%`, 240, 50, '#5aff8a', 'center');
    // bellows sprite
    const sq = 1 - b.pump * 0.35;
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(92, 130, 48 * sq + 12, 16); ctx.fillStyle = '#7a5a2a'; ctx.fillRect(92, 130, 48 * sq + 12, 3);
    ctx.fillStyle = '#3a3a44'; ctx.fillRect(84, 136, 10, 5);
    this.ingot(170, 170, 140, 24, b.heat);
    if (b.over > 0.05) UI.text('OVERHEATING!', 240, 150, '#ff4a4a', 'center', 10);
  }

  // ---------------------------------------------------------------- 3. pour
  startPour() { this.stage = 'pour'; this.ready = READY_TIME; this.p = { state: 'wait', fill: 0, t: 0, done: 0, score: 0 }; this.heat = 0.9; }
  u_pour(dt) {
    const p = this.p, press = Input.key('Space') || Input.mdown[0];
    p.t += dt;
    if (p.state === 'wait') { if (!press) p.armed = true; if (press && p.armed) { p.state = 'pour'; Sfx.play('steam'); } }
    else if (p.state === 'pour') {
      p.fill += (0.26 + 0.05 * this.tier) * (1 + 1.5 * p.fill * p.fill) * dt;
      if (Math.random() < 0.6) FX.spark(240, 100 + 90 * (1 - p.fill), '#ffb02a', 1, 30, 0.4, 1, 60);
      if (!press || p.fill > 1.35) {
        p.state = 'done'; p.done = 0;
        const f = p.fill; const fz = this.frenzy ? 0.65 : 1; p.score = U.clamp(f <= 1 ? 1 - (1 - f) * 3.2 * fz : 1 - (f - 1) * 4.5 * fz, 0, 1);
        this.q.pour = p.score; Sfx.play(p.score > 0.9 ? 'perfect' : p.score > 0.4 ? 'clang' : 'bad');
      }
    } else { p.done += dt; if (p.done > 1.2) this.startHammer(); }
  }
  d_pour() {
    const p = this.p;
    this.bg(0.9, 'THE POUR', p.state === 'wait' ? 'Press and HOLD SPACE/click to pour, release as the mould reaches the rim.' : 'Release at the rim line!');
    const mx = 200, my = 100, mw = 80, mh = 90;
    ctx.fillStyle = '#000'; ctx.fillRect(mx - 3, my - 1, mw + 6, mh + 4);
    ctx.fillStyle = '#3a3040'; ctx.fillRect(mx, my, mw, mh);
    const fh = Math.min(mh + 10, mh * p.fill);
    ctx.fillStyle = heatColor(0.85); ctx.fillRect(mx + 2, my + mh - fh, mw - 4, fh);
    ctx.fillStyle = heatColor(1); ctx.fillRect(mx + 2, my + mh - fh, mw - 4, 2);
    ctx.fillStyle = '#5ec8ff'; ctx.fillRect(mx - 8, my + 2, mw + 16, 2);
    UI.text('RIM', mx + mw + 12, my - 3, '#5ec8ff');
    if (p.state === 'pour') { ctx.fillStyle = heatColor(0.95); ctx.fillRect(238, 40, 5, my + mh - fh - 40 + 4); }
    ctx.fillStyle = '#4a4a56'; ctx.fillRect(220, 34, 40, 8);
    if (p.state === 'done') {
      const g = p.score > 0.9 ? 'PERFECT POUR!' : p.score > 0.6 ? 'Good pour' : p.score > 0.3 ? 'Sloppy pour' : (p.fill > 1 ? 'OVERFLOW!' : 'UNDERFILLED');
      UI.text(g, 240, 76, p.score > 0.6 ? '#5aff8a' : '#ff6a6a', 'center', 12);
      UI.text(`${Math.round(p.score * 100)}%`, 240, 90, '#e8e0c8', 'center');
    }
  }

  // ---------------------------------------------------------------- 4. hammer
  startHammer() {
    this.stage = 'hammer'; this.ready = READY_TIME; const t = this.tier;
    this.h = { n: 6 + 2 * t, spawned: 0, next: 0.6, t: 0, circles: [], pw: (0.075 - 0.01 * t) * (this.frenzy ? 1.5 : 1), gw: (0.17 - 0.015 * t) * (this.frenzy ? 1.5 : 1), life: 0.95 - 0.08 * t, gap: 0.62 - 0.05 * t, pts: 0, res: { perfect: 0, good: 0, miss: 0 }, end: 0 };
    this.heat = 0.8; this.hx = 0;
  }
  u_hammer(dt) {
    const h = this.h; h.t += dt; this.heat = Math.max(0.35, this.heat - dt * 0.015);
    if (h.spawned < h.n && h.t >= h.next) {
      h.circles.push({ x: U.rnd(180, 300), y: U.rnd(150, 182), age: 0, s: 'active' }); h.spawned++; h.next += h.gap * U.rnd(0.85, 1.2);
    }
    for (const c of h.circles) {
      if (c.s !== 'active') { c.fade = (c.fade || 0) + dt; continue; }
      c.age += dt;
      if (c.age > h.life + h.gw + 0.05) { c.s = 'miss'; h.res.miss++; this.strike(c, 'MISS', '#ff5a5a', false); }
    }
    const click = Input.mpressed[0] || Input.hit('Space');
    if (click) {
      const usingMouse = Input.mpressed[0];
      let target = null;
      for (const c of h.circles) if (c.s === 'active' && (!usingMouse || Math.hypot(c.x - Input.mx, c.y - Input.my) < 16 + 12)) { if (!target || c.age > target.age) target = c; }
      if (target) {
        const err = Math.abs(target.age - h.life);
        if (err <= h.pw) { target.s = 'perfect'; h.res.perfect++; this.strike(target, 'PERFECT', '#ffd23f', true); }
        else if (err <= h.gw) { target.s = 'good'; h.res.good++; this.strike(target, 'good', '#5ec8ff', true); }
        else { target.s = 'miss'; h.res.miss++; this.strike(target, target.age < h.life ? 'early' : 'late', '#ff5a5a', false); }
      }
    }
    if (h.spawned >= h.n && h.circles.every(c => c.s !== 'active')) {
      h.end += dt;
      if (h.end > 0.9) { this.q.hammer = (h.res.perfect + 0.6 * h.res.good) / h.n; this.startQuench(); }
    }
  }
  strike(c, txt, col, hit) {
    FX.text(c.x, c.y - 14, txt, col);
    if (hit) { const perf = txt === 'PERFECT'; FX.spark(c.x, c.y, perf ? '#fff3b0' : '#ffb02a', perf ? 26 : 10, perf ? 130 : 80, 0.6, perf ? 2 : 1, 120); Sfx.play(perf ? 'perfect' : 'clang'); Game.shake = perf ? 3 : 1.5; this.heat = Math.min(1, this.heat + 0.06); }
    else Sfx.play('bad');
  }
  d_hammer() {
    const h = this.h;
    const sh = Game.shake; Game.shake = Math.max(0, Game.shake - 0.3);
    ctx.save(); if (sh) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    this.bg(this.heat, 'HAMMERING', 'Click each circle (or press SPACE) exactly as its outer ring closes on it.');
    this.ingot(150, 150, 180, 40, this.heat);
    for (const c of h.circles) {
      if (c.s === 'active') {
        const k = 1 - c.age / h.life, rr = 7 + 28 * Math.max(-0.1, k);
        ctx.strokeStyle = Math.abs(c.age - h.life) <= h.pw ? '#ffd23f' : '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(3, rr), 0, 6.3); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, 6.3); ctx.fill();
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, 6.3); ctx.stroke();
      } else if (c.fade < 0.4) {
        ctx.globalAlpha = 1 - c.fade / 0.4; ctx.fillStyle = c.s === 'perfect' ? '#ffd23f' : c.s === 'good' ? '#5ec8ff' : '#ff5a5a';
        ctx.beginPath(); ctx.arc(c.x, c.y, 7 + c.fade * 20, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    // hammer follows mouse
    ctx.fillStyle = '#7a5a2a'; ctx.fillRect(Input.mx - 1, Input.my - 22, 3, 22); ctx.fillStyle = '#8a8f9c'; ctx.fillRect(Input.mx - 8, Input.my - 30, 16, 9);
    UI.text(`Perfect ${h.res.perfect}   Good ${h.res.good}   Miss ${h.res.miss}   (${h.spawned}/${h.n})`, 240, 40, '#e8e0c8', 'center');
    ctx.restore();
  }

  // ---------------------------------------------------------------- quench + result
  startQuench() {
    this.stage = 'quench'; this.qt = 0; Sfx.play('steam');
    let q = 100 * (0.22 * this.q.bellows + 0.18 * this.q.pour + 0.60 * this.q.hammer);
    if (S.forgemBonus) { q += S.forgemBonus; S.forgemBonus = 0; }
    q += Race.p('forge'); // race bonus (economy races)
    this.quality = U.clamp(q, 0, 100); if (this.quality >= 99.5) S.stats.master100 = (S.stats.master100 || 0) + 1;
    this.item = Forge.create({ kind: this.kind, slot: this.kind === 'weapon' ? 'weapon' : this.slot, ores: this.ores, quality: this.quality }, S.nextId++);
  }
  u_quench(dt) {
    this.qt += dt; this.heat = Math.max(0, 0.7 - this.qt * 0.5);
    if (Math.random() < 0.8) FX.spark(U.rnd(160, 320), 160, '#dfe6ee', 1, 25, 1.0, 2, -40);
    if (this.qt > 1.7) {
      S.items.push(this.item); S.stats.forged++; if (this.item.grade === 'Perfect') S.stats.perfect++;
      Quests.event('forge', this.item);
      S.tutorial.forge = true; Save.save(); this.stage = 'result'; this.rt = 0;
      Sfx.play(this.item.grade === 'Perfect' ? 'levelup' : 'perfect');
      if (this.item.master) FX.spark(240, 130, '#fff3b0', 40, 120, 1, 2, 30);
    }
  }
  d_quench() {
    this.bg(this.heat, 'QUENCH', 'The metal hisses in the water...');
    this.ingot(150, 150, 180, 40, this.heat);
    ctx.fillStyle = 'rgba(160,190,230,0.35)'; ctx.fillRect(150, 190, 180, 12);
  }
  d_result() {
    this.rt += 1 / 60; const live = this.rt >= RESULT_LOCK;
    const it = this.item, gc = Forge.gradeColor(it.grade);
    ctx.fillStyle = '#0d0a12'; ctx.fillRect(0, 0, VW, VH);
    // radiating light behind a good item
    const rays = it.master ? 1 : it.grade === 'Perfect' ? 0.8 : it.grade === 'Great' ? 0.45 : 0.15;
    if (rays > 0.2) {
      ctx.save(); ctx.translate(96, 128); ctx.rotate(this.rt * 0.25);
      for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(255,210,90,${0.05 * rays})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 120, i * 0.523, i * 0.523 + 0.26); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
    UI.panel(8, 6, VW - 16, VH - 12, it.master ? 'MASTERWORK!' : 'FORGED');

    // ---- item display
    UI.slot(24, 34, 144, 152, { edge: gc });
    const sp = ItemArt.sprite(it), sc = Math.min(120 / sp.width, 128 / sp.height);
    const bobY = Math.sin(this.rt * 2) * 2;
    ctx.drawImage(sp, Math.round(96 - sp.width * sc / 2), Math.round(110 - sp.height * sc / 2 + bobY), Math.round(sp.width * sc), Math.round(sp.height * sc));
    if (it.master) { // sparkle
      for (let i = 0; i < 4; i++) {
        const a = this.rt * 1.5 + i * 1.57, sx = 96 + Math.cos(a) * 52, sy = 110 + Math.sin(a) * 56;
        ctx.fillStyle = '#fff6b0'; ctx.fillRect(Math.round(sx), Math.round(sy) - 2, 1, 5); ctx.fillRect(Math.round(sx) - 2, Math.round(sy), 5, 1);
      }
    }
    // grade banner under the art
    ctx.fillStyle = U.shade(gc, 0.3); ctx.fillRect(24, 168, 144, 18);
    ctx.fillStyle = gc; ctx.fillRect(24, 168, 144, 1); ctx.fillRect(24, 185, 144, 1);
    UI.text(`${it.grade.toUpperCase()}  ${it.quality.toFixed(1)}%`, 96, 172, gc, 'center', 9);

    // ---- details
    const dx = 182;
    UI.text(it.name, dx, 36, gc, 'left', 10);
    UI.text(it.kind === 'weapon' ? CLS[it.cls].n : `${ARMOR_CLS[it.cls].n} ${SLOTS[it.slot].n}`, dx, 50, PAL.dim, 'left', 7);
    let y = 64;
    UI.header('STATS', dx, y, 272); y += 12;
    const m = Forge.enhMult(it);
    const stat = (k, v, col) => { UI.text(k, dx + 2, y, PAL.faint, 'left', 7); UI.text(v, dx + 120, y, col, 'left', 7); y += 10; };
    if (it.kind === 'weapon') {
      stat('Damage', (it.stats.dmg * m).toFixed(1), '#ffb066');
      stat('Swing time', `${it.stats.cd}s`, PAL.text);
      stat('Reach / arc', `${it.stats.range} / ${it.stats.arc}\u00b0`, PAL.text);
    } else {
      stat('Defence', (it.stats.def * m).toFixed(1), '#8fb0ff');
      stat('Health', `+${Math.round(it.stats.hp * m)}`, '#ff9a9a');
      stat('Weight class', ARMOR_CLS[it.cls].n, PAL.text);
    }
    for (const t of it.traits) {
      UI.text(TRAITS[t.id].n, dx + 2, y, '#ffb066', 'left', 7);
      UI.text(trunc(it.kind === 'weapon' ? TRAITS[t.id].wdesc : TRAITS[t.id].adesc, 24), dx + 108, y, PAL.dim, 'left', 7);
      y += 10;
    }
    y += 2;
    UI.header('YOUR WORK', dx, y, 272); y += 12;
    // per-stage score bars
    const stages = [['Bellows', this.q.bellows], ['Pour', this.q.pour], ['Hammer', this.q.hammer]];
    for (const [nm, v] of stages) {
      UI.text(nm, dx + 2, y, PAL.faint, 'left', 7);
      UI.bar(dx + 48, y + 1, 110, 5, v, v > 0.85 ? PAL.good : v > 0.5 ? PAL.gold : '#c0603a');
      UI.text(`${Math.round(v * 100)}%`, dx + 164, y, PAL.dim, 'left', 7);
      y += 10;
    }
    UI.text('Sell value', dx + 2, y + 2, PAL.faint, 'left', 7);
    UI.text(U.fmt(it.value) + 'g', dx + 72, y + 1, PAL.gold, 'left', 8);
    // comparison with what is worn
    const cur = getItem(S.equip[it.slot]);
    y += 14;
    if (cur && cur.id !== it.id) {
      const a = it.kind === 'weapon' ? it.stats.dmg * m : it.stats.def * m;
      const b = (it.kind === 'weapon' ? cur.stats.dmg : cur.stats.def) * Forge.enhMult(cur);
      const d = a - b, better = d >= 0;
      UI.text(`vs ${trunc(cur.name, 22)}`, dx + 2, y, PAL.dim, 'left', 7);
      UI.text(`${better ? '+' : ''}${d.toFixed(1)} ${it.kind === 'weapon' ? 'dmg' : 'def'}`, dx + 164, y, better ? PAL.good : PAL.bad, 'left', 7);
    } else UI.text('Nothing equipped in this slot yet.', dx + 2, y, PAL.good, 'left', 7);

    // ---- actions
    const by = VH - 42;
    if (UI.btn(24, by, 144, 18, 'Equip', live, PAL.btnGreen)) { S.equip[it.slot] = it.id; Game.toast(`Equipped ${it.name}`, gc); Save.save(); this.again(); }
    if (UI.btn(182, by, 132, 18, `Sell  ${U.fmt(it.value)}g`, live, PAL.btnGold)) { addGold(it.value); S.items = S.items.filter(i => i.id !== it.id); Sfx.play('coin'); Save.save(); this.again(); }
    if (UI.btn(322, by, 132, 18, 'Keep in bag', live)) { Save.save(); this.again(); }
    UI.text(live ? 'Higher quality means stronger stats and a higher price.' : 'Well struck...', VW / 2, VH - 20, PAL.faint, 'center', 7);
  }  again() { this.stage = 'setup'; this.sel = {}; this.item = null; this.heat = 0.1; FX.clear(); }
}
