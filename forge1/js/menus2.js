'use strict';
// ---------------------------------------------------------------------------
// menus2.js — race shrine, achievements, settings, boss gate
// ---------------------------------------------------------------------------

// Card showing one race: tier colour, name, and its passive lines.
function raceCard(id, x, y, w, h, label, dim) {
  const r = RACES[id], t = RACE_TIERS[r.tier];
  UI._rec('panel', { x, y, w, h });
  ctx.fillStyle = dim ? '#171222' : '#1e1830'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.ink; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  // tier banner
  ctx.fillStyle = U.shade(t.col, 0.35); ctx.fillRect(x + 1, y + 1, w - 2, 11);
  ctx.fillStyle = t.col; ctx.fillRect(x + 1, y + 12, w - 2, 1);
  UI.text(label, x + 5, y + 3, t.col, 'left', 7);
  UI.text(t.n.toUpperCase(), x + w - 5, y + 3, t.col, 'right', 7);
  UI.text(r.n, x + 6, y + 17, dim ? U.shade(t.col, 0.8) : t.col, 'left', 12);
  if (r.eco) UI.chip('ECONOMY', x + w - 52, y + 18, '#c8e8a0');
  const lines = Race.lines(r);
  lines.slice(0, 5).forEach((l, i) => UI.text(l, x + 6, y + 34 + i * 10, dim ? PAL.faint : PAL.text, 'left', 7));
  // faint tier pips along the bottom
  for (let i = 0; i <= r.tier; i++) { ctx.fillStyle = t.col; ctx.fillRect(x + 6 + i * 5, y + h - 6, 3, 3); }
}

// ---------------------------------------------------------------- race shrine (GDD A2)
class RaceScene extends MenuScene {
  constructor() { super('RACE SHRINE', 432, 250); this.pending = null; this.anim = 0; this.shown = 'human'; this.lastTick = -1; S.tutorial.race = true; }
  exit() { Save.save(); }
  draw() {
    this.drawFrame();
    const x = this.x + 10, W = this.w - 20;
    // spins counter
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, this.y + 18, W, 15);
    UI.text(`SPINS`, x + 6, this.y + 22, PAL.dim, 'left', 7);
    UI.text(String(S.spins || 0), x + 44, this.y + 21, PAL.gold, 'left', 9);
    UI.text(`Dry streak ${S.pity || 0}`, x + 74, this.y + 22, (S.pity || 0) > 8 ? PAL.good : PAL.faint, 'left', 7);
    UI.text('You choose whether to keep each roll.', x + W - 6, this.y + 22, PAL.dim, 'right', 7);

    const cw = (W - 10) / 2, cy = this.y + 38, ch = 92;
    raceCard(S.race || 'human', x, cy, cw, ch, 'CURRENT', true);
    // ---- result side
    const nx = x + cw + 10;
    if (this.anim > 0) {
      this.anim -= 1 / 60;
      const tick = Math.floor(this.anim * 16);
      if (tick !== this.lastTick) { this.lastTick = tick; this.shown = U.pick(Object.keys(RACES)); Sfx.play('ui'); }
      raceCard(this.shown, nx, cy, cw, ch, 'ROLLING...', false);
      ctx.fillStyle = `rgba(255,255,255,${0.10 + Math.random() * 0.10})`; ctx.fillRect(nx, cy, cw, ch);
      if (this.anim <= 0) Sfx.play(RACES[this.pending].tier >= 3 ? 'levelup' : 'perfect');
    } else if (this.pending) {
      raceCard(this.pending, nx, cy, cw, ch, 'NEW ROLL', false);
      const t = RACE_TIERS[RACES[this.pending].tier];
      if (RACES[this.pending].tier >= 3) { // celebrate the good ones
        ctx.strokeStyle = t.col; ctx.lineWidth = 1;
        const p = 1 + Math.sin(Date.now() / 160) * 1.5;
        ctx.strokeRect(nx - p, cy - p, cw + p * 2, ch + p * 2);
      }
    } else {
      ctx.fillStyle = '#171222'; ctx.fillRect(nx, cy, cw, ch);
      ctx.fillStyle = PAL.ink; ctx.fillRect(nx, cy, cw, 1); ctx.fillRect(nx, cy + ch - 1, cw, 1); ctx.fillRect(nx, cy, 1, ch); ctx.fillRect(nx + cw - 1, cy, 1, ch);
      UI.text('?', nx + cw / 2, cy + 32, '#3f3752', 'center', 32);
      UI.text('Press Spin to reroll', nx + cw / 2, cy + 70, PAL.faint, 'center', 7);
    }

    // ---- buttons
    const by = cy + ch + 8, busy = this.anim > 0;
    if (UI.btn(x, by, cw, 18, (S.spins || 0) > 0 ? `Spin  (${S.spins})` : 'No spins left', !busy && !this.pending && (S.spins || 0) > 0, PAL.btnGold)) {
      this.pending = Race.spin(); this.anim = 1.1; this.lastTick = -1;
    }
    if (this.pending && !busy) {
      if (UI.btn(nx, by, cw / 2 - 3, 18, 'Keep new', true, PAL.btnGreen)) {
        S.race = this.pending; this.pending = null;
        Game.toast(`You are now a ${Race.cur().n}!`, RACE_TIERS[Race.cur().tier].col); Ach.check(); Save.save();
      }
      if (UI.btn(nx + cw / 2 + 3, by, cw / 2 - 3, 18, 'Discard', true, PAL.btnRed)) this.pending = null;
    }

    // ---- odds table
    const oy = by + 24;
    UI.header('TIER ODDS', x, oy, W);
    const total = RACE_TIERS.reduce((s, t) => s + t.w, 0);
    RACE_TIERS.forEach((t, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const tx = x + col * (W / 4), ty = oy + 12 + row * 11;
      ctx.fillStyle = t.col; ctx.fillRect(tx, ty + 2, 3, 5);
      UI.text(`${t.n}`, tx + 6, ty, t.col, 'left', 7);
      UI.text(`${(t.w / total * 100).toFixed(t.w < 1 ? 1 : 0)}%`, tx + W / 4 - 12, ty, PAL.dim, 'right', 7);
    });
    UI.text('Spins come from level-ups, achievements and bosses.', x, oy + 36, PAL.faint, 'left', 7);
    UI.text('A long dry streak raises the Epic+ odds.', x, oy + 46, PAL.faint, 'left', 7);
  }
}

// ---------------------------------------------------------------- achievements
class AchievementsScene extends MenuScene {
  constructor() { super('ACHIEVEMENTS', 440, 250); this.closeKeys = ['Escape', 'KeyK']; }
  draw() {
    this.drawFrame();
    const x = this.x + 10, W = this.w - 20;
    const done = Ach.count();
    UI.bar(x, this.y + 21, 120, 6, done / ACH.length, PAL.gold);
    UI.text(`${done} / ${ACH.length}`, x + 128, this.y + 21, PAL.gold, 'left', 7);
    UI.text('Each: 100 gold + a spin', x + W, this.y + 21, PAL.faint, 'right', 7);
    let y = this.y + 34;
    for (let i = 0; i < ACH.length; i++) {
      const a = ACH[i], got = !!(S.ach || {})[a.id];
      UI.row(x, y, W, 15, i, got ? 'on' : null);
      // trophy / lock glyph
      const gx = x + 8, gy = y + 8;
      if (got) { ctx.fillStyle = PAL.gold; ctx.fillRect(gx - 3, gy - 5, 6, 5); ctx.fillRect(gx - 1, gy, 2, 3); ctx.fillRect(gx - 4, gy + 3, 8, 2); ctx.fillStyle = '#fff3b0'; ctx.fillRect(gx - 2, gy - 4, 2, 2); }
      else { ctx.fillStyle = '#4a4458'; ctx.fillRect(gx - 3, gy - 2, 6, 6); ctx.fillRect(gx - 2, gy - 5, 4, 3); ctx.fillStyle = '#2a2634'; ctx.fillRect(gx - 1, gy, 2, 2); }
      UI.text(a.n, x + 18, y + 4, got ? PAL.gold : PAL.text, 'left', 7);
      UI.text(a.desc, x + 116, y + 4, got ? PAL.dim : PAL.faint, 'left', 7);
      if (got) UI.text(`"${a.title}"`, x + W - 6, y + 4, PAL.edge, 'right', 7);
      else if (a.prog) {
        const p = a.prog(S);
        UI.bar(x + W - 70, y + 5, 42, 5, p[0] / p[1], PAL.info);
        UI.text(`${U.fmt(p[0])}/${U.fmt(p[1])}`, x + W - 24, y + 4, PAL.faint, 'right', 7);
      }
      y += 16;
    }
  }
}

// ---------------------------------------------------------------- settings
class SettingsScene extends MenuScene {
  constructor() { super('SETTINGS', 300, 180); }
  exit() { Save.save(); }
  draw() {
    this.drawFrame();
    const st = S.settings, x = this.x + 16, W = this.w - 32;
    let y = this.y + 26;
    // volume with a segmented meter
    UI.text('Volume', x, y + 3, PAL.text);
    const steps = 10, cur = Math.round(st.vol / 0.6 * steps);
    for (let i = 0; i < steps; i++) {
      ctx.fillStyle = i < cur && !st.mute ? PAL.gold : '#302840';
      ctx.fillRect(x + 78 + i * 10, y, 8, 11);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x + 78 + i * 10, y + 9, 8, 2);
    }
    if (UI.btn(x + W - 44, y, 20, 12, '-', st.vol > 0.01)) { st.vol = Math.max(0, +(st.vol - 0.06).toFixed(2)); applySettings(); Sfx.play('ui'); }
    if (UI.btn(x + W - 20, y, 20, 12, '+', st.vol < 0.59)) { st.vol = Math.min(0.6, +(st.vol + 0.06).toFixed(2)); applySettings(); Sfx.play('ui'); }
    y += 24;
    UI.text('Sound', x, y + 3, PAL.text);
    if (UI.btn(x + 78, y, 70, 14, st.mute ? 'Muted' : 'On', true, st.mute ? PAL.btnRed : PAL.btnGreen)) { st.mute = !st.mute; applySettings(); Sfx.play('ui'); }
    y += 24;
    UI.text('Screen shake', x, y + 3, PAL.text);
    if (UI.btn(x + 78, y, 70, 14, st.shake ? 'On' : 'Off', true, st.shake ? PAL.btnGreen : PAL.btnRed)) st.shake = !st.shake;
    y += 28;
    UI.divider(x, y, W); y += 8;
    UI.text('Settings are stored with your saved game.', x, y, PAL.faint, 'left', 7);
    UI.text('It also autosaves in the hub.', x, y + 10, PAL.faint, 'left', 7);
  }
}

// ---------------------------------------------------------------- boss gate (GDD 24, 25)
class BossGateScene extends MenuScene {
  constructor(world) { super('GROVE GATE', 400, 240); this.world = world; }
  draw() {
    this.drawFrame();
    const x = this.x + 12, W = this.w - 24, p = playerPower(), r = p / BOSS_POWER, pb = powerBreakdown();
    // portrait
    const gs = Sprites.guardian();
    ctx.fillStyle = '#0d1a0d'; ctx.fillRect(x, this.y + 20, 72, 72);
    ctx.fillStyle = PAL.ink; ctx.fillRect(x, this.y + 20, 72, 1); ctx.fillRect(x, this.y + 91, 72, 1); ctx.fillRect(x, this.y + 20, 1, 72); ctx.fillRect(x + 71, this.y + 20, 1, 72);
    ctx.drawImage(gs, x + 6, this.y + 22, 60, 58);
    // name + blurb
    const tx = x + 82;
    UI.text('Ancient Grove Guardian', tx, this.y + 22, '#9aff7a', 'left', 10);
    UI.chip(`Lv ${BOSS_LEVEL}`, tx, this.y + 36, PAL.gold);
    UI.chip('4 PHASES', tx + 38, this.y + 36, PAL.info);
    const blurb = [
      'A colossal tree spirit. It slams the',
      'ground, lashes thorn lines, calls',
      'saplings, overgrows the arena with roots,',
      'then enrages. Parry to stun it.',
    ];
    blurb.forEach((l, i) => UI.text(l, tx, this.y + 50 + i * 10, PAL.dim, 'left', 7));

    // power readout
    let y = this.y + 98;
    UI.header('YOUR READINESS', x, y, W); y += 13;
    UI.text(`Recommended power`, x + 4, y, PAL.dim, 'left', 7); UI.text(String(BOSS_POWER), x + 130, y, PAL.text, 'left', 7);
    UI.text(`Your power`, x + 190, y, PAL.dim, 'left', 7);
    UI.text(String(p), x + 262, y, r >= 1 ? PAL.good : r >= 0.85 ? PAL.gold : PAL.bad, 'left', 7);
    y += 12;
    UI.bar(x + 4, y, W - 8, 8, Math.min(1, r), r >= 1 ? '#5aff8a' : r >= 0.85 ? PAL.gold : '#ff6a6a');
    y += 14;
    const verdict = r >= 1 ? 'You are well equipped for this fight.' : r >= 0.85 ? 'Risky — but skill can carry you.' : r >= 0.6 ? 'You are at a real disadvantage.' : 'Far under-equipped. Forge better gear first!';
    UI.text(verdict, x + 4, y, r >= 1 ? PAL.good : r >= 0.85 ? PAL.gold : PAL.bad, 'left', 7); y += 12;
    UI.text(`Damage/sec ${pb.dps.toFixed(0)}`, x + 4, y, PAL.dim, 'left', 7);
    UI.text(`Effective HP ${pb.ehp.toFixed(0)}`, x + 96, y, PAL.dim, 'left', 7);
    UI.text(`Defeated ${S.bossKills || 0}x`, x + 206, y, PAL.faint, 'left', 7);
    y += 11;
    UI.text('Only gear, spells and race count — not potions.', x + 4, y, PAL.faint, 'left', 7);
    y += 14;
    if (UI.btn(x + 4, y, 168, 20, 'Enter the Arena', true, '#7a3a10')) { Game.pop(); this.world.goto(BOSS_FLOOR); }
    UI.text('Exit by the arena ladder.', x + 176, y + 6, PAL.faint, 'left', 7);
  }
}
