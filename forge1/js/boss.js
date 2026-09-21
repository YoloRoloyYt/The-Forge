'use strict';
// ---------------------------------------------------------------------------
// boss.js — the Ancient Grove Guardian (4-phase boss), its arena, powerup pickups,
//           floor hazards, treasure chests, hidden-cavern discovery. Mixed into WorldScene.
// ---------------------------------------------------------------------------
function genBossArena() {
  const w = 32, h = 22, lv = new Level(w, h, 'boss', BOSS_FLOOR);
  lv.tiles.fill(T_FLOOR);
  const set = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) lv.tiles[y * w + x] = T_WALL; };
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) set(x, y);
  for (const p of [[7, 8], [23, 8], [7, 15], [23, 15]]) for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) set(p[0] + dx, p[1] + dy); // giant roots
  lv.spawn = { x: 16 * TS + 8, y: 17 * TS }; lv.ladderUp = { x: 16 * TS + 8, y: 19 * TS + 8 };
  lv.exitPt = lv.ladderUp;
  const b = new Enemy('guardian', 16 * TS + 8, 9 * TS, BOSS_FLOOR, false, BOSS_LEVEL);
  b.phase = 1; b.bstate = 'move'; b.cd = 2.5; b.at = null; b.rt = 0;
  lv.enemies.push(b);
  lv.chests = []; lv.secret = null;
  lv.torches.push({ x: 4 * TS, y: 4 * TS }, { x: 27 * TS, y: 4 * TS }, { x: 4 * TS, y: 18 * TS }, { x: 27 * TS, y: 18 * TS });
  lv.layer = renderLayer(lv);
  return lv;
}

Object.assign(WorldScene.prototype, {
  // ------------------------------------------------------------ per-frame extras
  updateExtras(dt) {
    const P = this.P, lv = this.lv, st = P.stats;
    // achievements are cheap to re-check once a second
    this.achT += dt; if (this.achT > 1) { this.achT = 0; Ach.check(); }
    // powerup pickups
    for (const pk of this.pickups) {
      pk.t -= dt; pk.bob += dt * 4;
      if (Math.hypot(pk.x - P.x, pk.y - P.y) < 13) { pk.t = 0; this.collectPowerup(pk.type); }
    }
    this.pickups = this.pickups.filter(p => p.t > 0);
    // inferno armour spell: burns enemies standing next to you
    if (st.aura > 0) {
      P.auraT += dt;
      if (P.auraT >= 0.5) {
        P.auraT = 0;
        for (const e of lv.enemies) if (!e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 38 + e.r) this.damageEnemy(e, st.aura * 2, { noProc: true, ang: Math.atan2(e.y - P.y, e.x - P.x) });
        FX.spark(P.x, P.y, '#ff6a2a', 4, 40, 0.3);
      }
    }
    // boss floor hazards (root patches)
    for (const h of this.hazards) {
      h.t += dt;
      if (h.t >= h.tele) {
        h.tick -= dt;
        if (h.tick <= 0 && Math.hypot(P.x - h.x, P.y - h.y) < h.r + P.r - 2) { h.tick = 0.5; this.hurtPlayer(h.dmg, h.x, h.y, null); }
      }
    }
    this.hazards = this.hazards.filter(h => h.t < h.tele + h.life);
    // hidden cavern discovery
    if (lv.secret && !lv.secret.found && Math.hypot(P.x - lv.secret.x, P.y - lv.secret.y) < lv.secret.r * 0.6) {
      lv.secret.found = true; S.stats.secrets = (S.stats.secrets || 0) + 1;
      Game.toast('You discovered a hidden cavern!', '#ffd23f'); Sfx.play('levelup');
      Quests.event('secret', this.floor); Ach.check();
    }
  },

  // ------------------------------------------------------------ powerups (GDD 27)
  dropPowerup(e) {
    if (Math.random() > (e.elite ? 0.45 : 0.07)) return;
    const type = U.wpick(Object.keys(POWERUPS).map(k => [k, POWERUPS[k].w]));
    this.pickups.push({ x: e.x, y: e.y, type, t: 25, bob: 0 });
  },
  collectPowerup(type) {
    const P = this.P, pu = POWERUPS[type];
    Sfx.play('perfect'); FX.spark(P.x, P.y - 4, pu.col, 14, 80, 0.5, 2); Game.toast(`${pu.n}: ${pu.desc}`, pu.col);
    if (type === 'health') P.hp = Math.min(P.stats.maxHp, P.hp + P.stats.maxHp * 0.35);
    else if (type === 'barrier') P.barrier = 3;
    else if (type === 'inferno') P.fireCharges = 6;
    else if (type === 'frenzy') S.forgeFrenzy = true;
    else S.buffs[type] = pu.dur;
  },

  // ------------------------------------------------------------ chests
  openChest(c) {
    if (c.opened) return; c.opened = true; Sfx.play('levelup');
    const f = Math.max(1, this.floor === BOSS_FLOOR ? 3 : this.floor), big = !!c.boss;
    const gold = U.ri(120, 200) * f * (big ? 3 : 1), ess = U.ri(2, 4) + (big ? 4 : 0), frags = U.ri(1, 3) + (big ? 3 : 0), gem = rollGem(Math.max(2, f), 0.5);
    addGold(gold); S.essence += ess; S.runeFrags += frags; addGem(gem, big ? 2 : 1);
    Game.toast(`Chest: ${gold}g, ${ess} essence, ${frags} rune frags, ${GEMS[gem].n}${big ? ' x2' : ''}`, '#ffd23f');
    FX.spark(c.x, c.y - 4, '#ffd23f', 24, 100, 0.7, 2);
  },
  drawChest(c, cx, cy) {
    const x = Math.round(c.x - cx), y = Math.round(c.y - cy), P = (col, a, b, w, h) => { ctx.fillStyle = col; ctx.fillRect(x + a, y + b, w, h); };
    P('rgba(0,0,0,0.4)', -8, 4, 16, 3);
    if (c.opened) { P('#3a2412', -7, -3, 14, 8); P('#1a0f08', -6, -2, 12, 4); P('#ffd23f', -3, -2, 6, 1); P('#5a3a1e', -7, -6, 14, 3); return; }
    P('#3a2412', -7, -4, 14, 9); P('#6a4526', -6, -3, 12, 7); P('#8a5a2a', -7, -6, 14, 4); P('#c9a24b', -7, -1, 14, 1); P('#ffd23f', -1, -2, 2, 3);
    if (Math.floor(this.time * 3) % 2) P('#fff3b0', 4, -5, 1, 1);
  },

  // ------------------------------------------------------------ boss AI
  updateBoss(e, dt) {
    const P = this.P;
    if (this.bossIntro > 0) { this.bossIntro -= dt; return; }
    const f = e.hp / e.maxHp, ph = f > 0.75 ? 1 : f > 0.5 ? 2 : f > 0.25 ? 3 : 4;
    if (ph > e.phase) { e.phase = ph; this.bossPhaseUp(e); }
    const enr = e.phase === 4, k = enr ? 0.6 : 1, dmg = e.dmg * (enr ? 1.25 : 1);
    e.face = Math.atan2(P.y - e.y, P.x - e.x);
    const dist = Math.hypot(P.x - e.x, P.y - e.y);
    if (e.bstate === 'move') {
      if (dist > 48) this.step(e, P.x, P.y, e.spd * (enr ? 1.7 : 1) * (e.slow > 0 ? 0.55 : 1), dt);
      if (e.slow > 0) e.slow -= dt;
      e.cd -= dt; if (e.cd <= 0 && !P.dead) this.bossChoose(e, k);
    } else if (e.bstate === 'tele') {
      const a = e.at; a.t += dt;
      if (a.t >= a.dur) { this.bossFire(e, a, dmg); e.bstate = 'rec'; e.rt = a.rec * k; e.at = null; }
    } else if (e.bstate === 'rec') {
      e.rt -= dt; if (e.rt <= 0) { e.bstate = 'move'; e.cd = U.rnd(0.5, 1.1) * k; }
    }
  },
  bossChoose(e, k) {
    const P = this.P, minions = this.lv.enemies.filter(m => m.minion && !m.dead).length;
    const opts = [['slam', 3], ['line', 3]];
    if (e.phase >= 2 && minions < 3) opts.push(['summon', 3]);
    if (e.phase >= 3 && this.hazards.length < 5) opts.push(['roots', 3]);
    const type = U.wpick(opts);
    e.bstate = 'tele';
    const base = { type, t: 0 };
    if (type === 'slam') e.at = Object.assign(base, { dur: 1.0 * (k < 1 ? 0.8 : 1), rec: 0.8, r: 54 });
    else if (type === 'line') e.at = Object.assign(base, { dur: 1.0 * (k < 1 ? 0.8 : 1), rec: 0.7, ang: Math.atan2(P.y - e.y, P.x - e.x), len: 240, w: 16 });
    else if (type === 'summon') e.at = Object.assign(base, { dur: 1.2, rec: 0.8 });
    else e.at = Object.assign(base, { dur: 0.9, rec: 0.9 });
  },
  bossFire(e, a, dmg) {
    const P = this.P;
    if (a.type === 'slam') {
      Sfx.play('boom'); Game.shake = Math.max(Game.shake, 6);
      for (let i = 0; i < 24; i++) { const an = i / 24 * 6.28; FX.spark(e.x + Math.cos(an) * a.r, e.y + Math.sin(an) * a.r, '#7a5a2a', 2, 40, 0.5, 2); }
      if (Math.hypot(P.x - e.x, P.y - e.y) < a.r + P.r) this.hurtPlayer(dmg * 1.1, e.x, e.y, e);
    } else if (a.type === 'line') {
      Sfx.play('boom'); Game.shake = Math.max(Game.shake, 4);
      const ex = e.x + Math.cos(a.ang) * a.len, ey = e.y + Math.sin(a.ang) * a.len;
      for (let i = 0; i <= 14; i++) FX.spark(U.lerp(e.x, ex, i / 14), U.lerp(e.y, ey, i / 14), '#6ad04a', 3, 40, 0.5, 2);
      const vx = ex - e.x, vy = ey - e.y, t = U.clamp(((P.x - e.x) * vx + (P.y - e.y) * vy) / (vx * vx + vy * vy), 0, 1);
      if (Math.hypot(P.x - (e.x + vx * t), P.y - (e.y + vy * t)) < a.w / 2 + P.r) this.hurtPlayer(dmg * 1.2, e.x, e.y, e);
    } else if (a.type === 'summon') {
      Sfx.play('steam');
      for (let i = 0; i < 2; i++) {
        const an = Math.random() * 6.28, mx = e.x + Math.cos(an) * 40, my = e.y + Math.sin(an) * 40;
        if (blockedAt(this.lv, mx, my, 6)) continue;
        const m = new Enemy('grunt', mx, my, 3, false, 7); m.minion = true; m.state = 'chase'; this.lv.enemies.push(m); FX.spark(mx, my, '#6ad04a', 10, 60, 0.5, 2);
      }
    } else if (a.type === 'roots') {
      Sfx.play('steam');
      for (let i = 0; i < 3; i++) {
        const hx = i === 0 ? P.x : U.clamp(P.x + U.rnd(-70, 70), 48, this.lv.w * TS - 48), hy = i === 0 ? P.y : U.clamp(P.y + U.rnd(-70, 70), 48, this.lv.h * TS - 48);
        this.hazards.push({ x: hx, y: hy, r: 24, t: 0, tele: 1.1, life: 6, tick: 0, dmg: e.dmg * 0.4 });
      }
    }
  },
  bossPhaseUp(e) {
    Game.shake = 7; Sfx.play('boom');
    const msg = { 2: 'PHASE 2: The Guardian calls saplings!', 3: 'PHASE 3: The arena is overgrown!', 4: 'PHASE 4: ENRAGED!' }[e.phase];
    Game.toast(msg, e.phase === 4 ? '#ff6a6a' : '#7fd08a');
    FX.spark(e.x, e.y, '#6ad04a', 30, 120, 0.8, 2);
    if (e.phase === 3) for (let i = 0; i < 4; i++) this.hazards.push({ x: U.rnd(60, this.lv.w * TS - 60), y: U.rnd(60, this.lv.h * TS - 60), r: 26, t: 0, tele: 1.5, life: 9, tick: 0, dmg: e.dmg * 0.4 });
    e.bstate = 'move'; e.at = null; e.cd = 1.2;
  },
  bossDefeated(e) {
    const first = S.bossKills < 1;
    S.bossKills++; Quests.event('boss');
    if (!this.bossHurt) S.stats.bossNoHit = (S.stats.bossNoHit || 0) + 1;
    for (const m of this.lv.enemies) if (m.minion) m.dead = true;
    this.hazards = [];
    const gold = first ? 800 : 400, ess = first ? 10 : 5, frags = first ? 6 : 3;
    addGold(gold); S.essence += ess; S.runeFrags += frags; addGem(first ? 'diamond' : 'emerald', first ? 2 : 1);
    if (first) S.spins = (S.spins || 0) + 3;
    Game.toast(`THE GUARDIAN FALLS! +${gold}g, ${ess} essence, ${frags} rune frags${first ? ', +3 spins' : ''}`, '#ffd23f'); Sfx.play('levelup');
    this.lv.chests.push({ x: 16 * TS + 8, y: 11 * TS, opened: false, boss: true });
    FX.spark(e.x, e.y, '#9aff7a', 50, 150, 1, 2);
    Ach.check(); Save.save();
  },

  // ------------------------------------------------------------ drawing
  drawExtras(cx, cy) {
    // hazards
    for (const h of this.hazards) {
      const x = Math.round(h.x - cx), y = Math.round(h.y - cy), live = h.t >= h.tele;
      ctx.fillStyle = live ? 'rgba(60,140,40,0.55)' : `rgba(255,80,60,${0.15 + 0.25 * (h.t / h.tele)})`;
      ctx.beginPath(); ctx.arc(x, y, h.r, 0, 6.3); ctx.fill();
      ctx.strokeStyle = live ? '#7aff5a' : '#ff5a4a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, h.r, 0, 6.3); ctx.stroke();
      if (live) { ctx.fillStyle = '#3a2412'; for (let i = 0; i < 6; i++) { const a = i * 1.05 + h.t; ctx.fillRect(Math.round(x + Math.cos(a) * h.r * 0.6), Math.round(y + Math.sin(a) * h.r * 0.6), 2, 4); } }
    }
    // boss telegraphs
    const b = this.lv.enemies.find(e => e.boss && !e.dead);
    if (b && b.bstate === 'tele' && b.at) {
      const a = b.at, k = a.t / a.dur, x = Math.round(b.x - cx), y = Math.round(b.y - cy);
      if (a.type === 'slam') { ctx.fillStyle = `rgba(255,60,40,${0.15 + 0.3 * k})`; ctx.beginPath(); ctx.arc(x, y, a.r, 0, 6.3); ctx.fill(); ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, a.r * k, 0, 6.3); ctx.stroke(); }
      else if (a.type === 'line') { ctx.save(); ctx.translate(x, y); ctx.rotate(a.ang); ctx.fillStyle = `rgba(255,60,40,${0.15 + 0.3 * k})`; ctx.fillRect(0, -a.w / 2, a.len, a.w); ctx.strokeStyle = '#ff5a4a'; ctx.strokeRect(0.5, -a.w / 2 + 0.5, a.len, a.w); ctx.restore(); }
      else { ctx.strokeStyle = a.type === 'summon' ? '#6ad04a' : '#c8a02a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 30 + k * 10, 0, 6.3); ctx.stroke(); }
    }
    // pickups
    for (const pk of this.pickups) {
      const pu = POWERUPS[pk.type], x = Math.round(pk.x - cx), y = Math.round(pk.y - cy - 4 + Math.sin(pk.bob) * 2), blink = pk.t < 5 && Math.floor(this.time * 8) % 2;
      if (blink) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 8, 4, 2, 0, 0, 6.3); ctx.fill();
      ctx.globalAlpha = 0.35; ctx.fillStyle = pu.col; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.3); ctx.fill(); ctx.fillStyle = pu.col; ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.3); ctx.fill();
      UI.text(pu.n[0], x, y - 4, '#111', 'center', 8);
    }
    // boss health bar
    if (b) {
      const bw = 260, bx = (VW - bw) / 2;
      UI.text(`Lv ${b.level} ${b.d.n}`, VW / 2, 6, '#9aff7a', 'center', 8);
      UI.bar(bx, 17, bw, 7, b.hp / b.maxHp, b.phase === 4 ? '#e0344f' : '#5ac050');
      for (const p of [0.25, 0.5, 0.75]) { ctx.fillStyle = '#000'; ctx.fillRect(bx + Math.round(bw * p), 16, 1, 9); }
      UI.text(`Phase ${b.phase}`, VW / 2, 26, '#cfc6e8', 'center', 7);
      if (this.bossIntro > 0) UI.text('THE GUARDIAN AWAKENS', VW / 2, 60, '#ffd23f', 'center', 12);
    }
  },
});
