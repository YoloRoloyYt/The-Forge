'use strict';
// ---------------------------------------------------------------------------
// world.js — the playable scene. Mines, the hub and boss arenas are all this
// class with different levels loaded into it.
// ---------------------------------------------------------------------------
(function (F) {

  const TS = F.TS;

  class WorldScene {
    constructor(lv, opt) {
      this.lv = lv;
      this.opt = opt || {};
      this.isWorld = true;
      this.cam = { x: 0, y: 0, vw: F.VW, vh: F.VH };
      this.camX = 0; this.camY = 0;
      this.player = new F.Player(lv.spawn.x, lv.spawn.y);
      this.projectiles = [];
      this.slashes = [];
      this.beams = [];
      this.rings = [];
      this.combatT = 0;
      this.time = 0;
      this.introT = 2.6;
      this.deathT = 0;
      this.hintT = 0; this.hint = null;
      this.prompt = null;
      lv.drops = lv.drops || [];
      this.ambientT = 0;
    }

    enter() {
      const lv = this.lv;
      F.Render.setOcclusion(lv.occlusion(), lv.w, lv.h, TS);
      const B = lv.B;
      F.Render.grade(Object.assign({ ambient: B.ambient, ambientSky: B.ambientSky }, B.grade));
      F.Render.bloomAmt = 0.58 * F.Game.settings.bloom;
      if (F.Quality) F.Quality.apply();
      F.Particles.clear();
      this.snapCamera();
      if (this.opt.onEnter) this.opt.onEnter(this);
    }
    exit() { F.Render.clearOcclusion(); }

    // ---------------------------------------------------------------- loop
    update(dt) {
      this.time += dt;
      F.Render.time = this.time;
      if (this.introT > 0) this.introT -= dt;
      this.combatT = Math.max(0, this.combatT - dt);
      F.Game.tickBuffs(dt);

      const p = this.player;
      if (!p.dead) p.update(dt, this);
      else { p.update(dt, this); this.deathT += dt; }

      for (const e of this.lv.enemies) {
        if (!e.alive && e.deadT > 1.6) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        // far-away mobs tick at a fraction of the rate; nobody can tell
        if (d > 620) { e._skip = (e._skip || 0) + 1; if (e._skip % 4) continue; }
        e.update(dt * (d > 620 ? 4 : 1), this);
      }

      this.updateProjectiles(dt);
      this.updateDrops(dt);
      this.updateFx(dt);
      F.Particles.update(dt, this.lv);
      this.ambient(dt);
      this.updateCamera(dt);
      this.checkInteract();

      if (F.Input.hit('escape')) F.Game.push(new F.PauseScene());
      if (F.Input.hit('t') || F.Input.hit('tab')) F.Game.push(new F.InventoryScene());
      if (F.Input.hit('j')) F.Game.push(new F.QuestScene());
      if (F.Input.hit('k')) F.Game.push(new F.AchieveScene());
      if (F.Input.hit('m')) F.Game.push(new F.MapScene(this));
    }

    // ------------------------------------------------------------- camera
    snapCamera() {
      const p = this.player;
      this.camX = p.x; this.camY = p.y;
      this.applyCam();
    }
    updateCamera(dt) {
      const p = this.player;
      // lead the camera toward where the player is looking, but only a little
      const lx = F.Input.touch ? 0 : F.U.clamp((F.Input.mx - F.VW / 2) * 0.22, -70, 70);
      const ly = F.Input.touch ? 0 : F.U.clamp((F.Input.my - F.VH / 2) * 0.22, -46, 46);
      const tx = p.x + lx, ty = p.y + ly;
      this.camX = F.U.damp(this.camX, tx, 7, dt);
      this.camY = F.U.damp(this.camY, ty, 7, dt);
      this.applyCam();
    }
    applyCam() {
      const lv = this.lv;
      let x = this.camX - F.VW / 2 + F.Game.shakeX;
      let y = this.camY - F.VH / 2 + F.Game.shakeY;
      const maxX = lv.w * TS - F.VW, maxY = lv.h * TS - F.VH;
      this.cam.x = maxX > 0 ? F.U.clamp(x, 0, maxX) : maxX / 2;
      this.cam.y = maxY > 0 ? F.U.clamp(y, 0, maxY) : maxY / 2;
    }

    // -------------------------------------------------------------- combat
    hitEnemy(e, dmg, o) {
      const w = o.weapon || F.Game.weapon();
      let d = dmg;
      let crit = false;
      // heavy swings on a staggered target crit
      if (o.heavy && e.stun > 0) { d *= 1.6; crit = true; }
      if (F.Forge.hasTrait(w, 'eternal')) crit = crit || Math.random() < 0.12;
      if (crit && !o.heavy) d *= 1.5;
      const pierce = w.rune === 'pierce' || F.Forge.hasTrait(w, 'void');
      if (w.spell === 'voidsp' && e.hp > e.max * 0.5) d *= 1.25;
      const dealt = e.hurt(d, this, { knock: o.knock, angle: o.angle, crit, pierce });
      this.combatT = 4;

      // on-hit trait and rune effects
      if (F.Forge.hasTrait(w, 'demonic') || w.rune === 'fire' || w.spell === 'flame')
        e.ignite(dealt * 0.10, 6);
      if (F.Forge.hasTrait(w, 'volcanic') && Math.random() < 0.3) e.ignite(dealt * 0.06, 4);
      if (F.Forge.hasTrait(w, 'frost') || w.spell === 'frost') e.chill = 3;
      if (F.Forge.hasTrait(w, 'explosive') && Math.random() < 0.18) this.explosion(e.x, e.y, 46, dealt * 0.55, '#b7ff4a');
      const leech = F.Forge.hasTrait(w, 'leeching') ? 0.07 : (w.rune === 'life' ? 0.07 : 0);
      if (leech) this.player.heal(dealt * leech);
      if (w.spell === 'storm') {
        let best = null, bd = 120;
        for (const o2 of this.lv.enemies) {
          if (o2 === e || !o2.alive) continue;
          const dd = Math.hypot(o2.x - e.x, o2.y - e.y);
          if (dd < bd) { bd = dd; best = o2; }
        }
        if (best) {
          best.hurt(dealt * 0.45, this, {});
          this.beams.push({ x0: e.x, y0: e.y - 12, x1: best.x, y1: best.y - 12, t: 0.22, max: 0.22, col: '#8fd4ff' });
        }
      }
    }

    hitPlayer(src, dmg, noParry) {
      const p = this.player;
      if (p.dead) return;
      if (!noParry && p.parries(src.x, src.y)) {
        p.parryFlash = 1;
        src.stun = Math.max(src.stun, F.PARRY_STUN);
        src.vulnerable = 1.5;
        setTimeout(() => { src.vulnerable = 1; }, F.PARRY_STUN * 1000);
        F.Audio.parry();
        F.Game.kick(3, 0.09);
        F.Game.flash('#ffe8b0', 0.45, 0.14);
        F.Game.floater(p.x, p.y - 34, 'PARRY', F.PAL.brassHi, { size: 1.3 });
        F.Particles.burst(p.x + Math.cos(p.parryAngle) * 16, p.y + Math.sin(p.parryAngle) * 16, 20, {
          sprite: 'spark', col: '#fff0c0', col1: '#ff9a3c', size: 4, size1: 0,
          life: 0.45, speed0: 60, speed1: 250, emis: 3.6, light: 40, drag: 5,
        });
        return;
      }
      this.combatT = 4;
      p.damage(dmg, this);
      // armour that answers back
      for (const it of F.Game.armorPieces()) {
        if (F.Forge.hasTrait(it, 'demonic') && src.ignite) src.ignite(dmg * 0.08, 4);
        if (F.Forge.hasTrait(it, 'frost') && src) src.chill = 2.5;
        if (F.Forge.hasTrait(it, 'explosive') && Math.random() < 0.2) this.explosion(p.x, p.y, 54, dmg * 0.8, '#b7ff4a');
        if (it.spell === 'inferno' && src.ignite) src.ignite(dmg * 0.1, 5);
      }
    }

    explosion(x, y, r, dmg, col) {
      F.Audio.boom();
      F.Game.kick(3.2, 0.05);
      F.Particles.burst(x, y, 26, {
        sprite: 'blob', col: col || '#ffd08a', col1: '#7a2000', size: 10, size1: 0,
        life: 0.5, speed0: 40, speed1: 220, emis: 3.2, light: 36, drag: 3.6,
      });
      this.rings.push({ x, y, r: 6, r1: r, t: 0.34, max: 0.34, col: col || '#ffd08a' });
      for (const e of this.lv.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - x, e.y - y) < r + e.r) e.hurt(dmg, this, {});
      }
    }

    damageNode(n, power, angle) {
      if (!n.alive) return;
      const D = F.NODES[n.type];
      n.hp -= power;
      n.flash = 1; n.shake = 1; n.hitT = 1;
      const O = F.ORES[n.ore] || F.ORES.stone;
      F.Audio.pick(D.hp > 200);
      F.Game.kick(0.8);
      F.Particles.burst(n.x - Math.cos(angle) * n.r * 0.6, n.y - Math.sin(angle) * n.r * 0.6, 7, {
        sprite: 'spark', col: '#ffe0a0', col1: O.col, size: 3, size1: 0,
        life: 0.32, speed0: 40, speed1: 170, emis: 2.8, drag: 5, grav: 160,
        dir: angle + Math.PI, spread: 1.9,
      });
      F.Particles.burst(n.x, n.y - 4, 3, {
        sprite: 'dust', col: this.lv.B.dust, size: 5, size1: 11, life: 0.5,
        speed0: 6, speed1: 30, emis: 0, alpha: 0.4, drag: 3,
      });
      // a decaying tick animation, driven by the scene
      n._decay = 1;
      if (n.hp <= 0) this.breakNode(n);
    }

    breakNode(n) {
      const D = F.NODES[n.type];
      n.alive = false;
      const O = F.ORES[n.ore] || F.ORES.stone;
      F.Audio.crack();
      F.Game.kick(2.2, 0.03);
      F.Particles.burst(n.x, n.y - 4, 22, {
        sprite: 'shard', col: O.col, col1: O.col2, size: 4.5, size1: 1,
        life: 0.7, speed0: 30, speed1: 170, emis: O.glowAmt ? 2.4 : 0.3, drag: 3.4, grav: 240,
      });
      F.Particles.burst(n.x, n.y - 4, 10, {
        sprite: 'dust', col: this.lv.B.dust, size: 8, size1: 20, life: 0.8,
        speed0: 8, speed1: 52, emis: 0, alpha: 0.45, drag: 2.6,
      });
      if (D.seal) {
        F.Game.toast('The rock gives way.', F.PAL.cool, 3);
        if (this.lv.secret && !this.lv.secret.found) {
          this.lv.secret.found = true;
          F.Quests.onEvent(F.Game.s, 'secret', {});
        }
        F.Render.setOcclusion(this.lv.occlusion(), this.lv.w, this.lv.h, TS);
        return;
      }
      // the yield
      const yieldMult = F.Game.oreYield();
      let n0 = Math.round(F.U.ri(D.drops[0], D.drops[1]) * yieldMult);
      for (let i = 0; i < n0; i++) {
        const ore = (i === 0 || Math.random() < 0.72) ? n.ore : F.rollOre(n.depth, D.boost, F.Game.luck());
        this.spawnDrop(n.x, n.y, 'ore', ore);
      }
      if (Math.random() < D.gem * (1 + F.Game.luck() * 0.6)) {
        this.spawnDrop(n.x, n.y, 'gem', F.rollGem(n.depth, F.Game.luck()));
      }
      F.Game.addXp(D.xp * Math.pow(1.34, n.depth - 1));
      // the occlusion map changes when a node that blocked light is gone
      F.Achieve.check(F.Game.s);
    }

    // --------------------------------------------------------------- loot
    spawnDrop(x, y, kind, id) {
      const a = Math.random() * 6.28, sp = F.U.rnd(20, 70);
      const col = kind === 'ore' ? (F.ORES[id] ? F.ORES[id].col : '#8d929c')
        : kind === 'gem' ? (F.GEMS[id] ? F.GEMS[id].col : '#fff')
        : kind === 'gold' ? '#f4cf5a' : kind === 'essence' ? '#b76cff' : '#63c7ff';
      this.lv.drops.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        kind, id, col, phase: Math.random() * 6.28, t: 0, pull: 0,
        sprite: kind === 'ore' ? 'ore_drop' : kind === 'gem' ? 'gem_drop' : kind === 'gold' ? 'coin' : 'frag',
        scale: kind === 'gem' ? 1 : 0.9, n: 1,
      });
    }
    dropLoot(e) {
      const g = Math.round(F.U.rnd(e.goldLo, e.goldHi));
      const coins = F.U.clamp(Math.round(g / Math.max(8, g / 5)), 1, 6);
      for (let i = 0; i < coins; i++) {
        const d = this.spawnDrop(e.x, e.y - 6, 'gold');
        this.lv.drops[this.lv.drops.length - 1].n = Math.ceil(g / coins);
      }
      if (Math.random() < 0.45 + (e.elite ? 0.4 : 0)) this.spawnDrop(e.x, e.y - 6, 'essence');
      if (Math.random() < 0.16 + (e.elite ? 0.3 : 0)) this.spawnDrop(e.x, e.y - 6, 'frag');
    }

    updateDrops(dt) {
      const p = this.player, drops = this.lv.drops;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.t += dt;
        const dist = Math.hypot(p.x - d.x, p.y - d.y);
        if (d.t > 0.25 && dist < 62) {
          // magnetise, accelerating as it closes
          d.pull = Math.min(1, d.pull + dt * 3.4);
          const a = Math.atan2(p.y - d.y, p.x - d.x);
          const sp = 60 + 520 * d.pull;
          d.vx = F.U.lerp(d.vx, Math.cos(a) * sp, 0.3);
          d.vy = F.U.lerp(d.vy, Math.sin(a) * sp, 0.3);
        } else {
          const k = Math.exp(-4 * dt);
          d.vx *= k; d.vy *= k;
        }
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (dist < 14) { this.collect(d); drops.splice(i, 1); }
        else if (d.t > 90) drops.splice(i, 1);
      }
    }
    collect(d) {
      if (d.kind === 'ore') {
        F.Game.addOre(d.id, 1);
        F.Audio.ore();
        const O = F.ORES[d.id];
        F.Game.floater(this.player.x, this.player.y - 40, '+1 ' + O.n, O.col, { size: 0.82, life: 0.7 });
      } else if (d.kind === 'gem') {
        F.Game.addGem(d.id, 1);
        F.Audio.coin();
        F.Game.floater(this.player.x, this.player.y - 44, F.GEMS[d.id].n + '!', F.GEMS[d.id].col, { size: 1.1 });
      } else if (d.kind === 'gold') {
        const got = F.Game.addGold(d.n || 1);
        F.Quests.onEvent(F.Game.s, 'gold', { n: got });
        F.Audio.coin();
      } else if (d.kind === 'essence') {
        F.Game.s.essence++; F.Audio.coin();
        F.Game.floater(this.player.x, this.player.y - 44, '+1 essence', F.PAL.magic, { size: 0.85 });
      } else {
        F.Game.s.frags++; F.Audio.coin();
        F.Game.floater(this.player.x, this.player.y - 44, '+1 rune fragment', F.PAL.cool, { size: 0.85 });
      }
    }

    // -------------------------------------------------------- projectiles
    spawnProjectile(o) {
      this.projectiles.push({
        x: o.x, y: o.y, vx: Math.cos(o.a) * o.speed, vy: Math.sin(o.a) * o.speed,
        a: o.a, dmg: o.dmg, sprite: o.sprite, col: o.col, life: o.life || 2,
        from: o.from, emis: o.emis === undefined ? 1 : o.emis, light: o.light || 0,
        r: o.r || 4, friendly: !!o.friendly, spin: o.spin || 0,
      });
    }
    updateProjectiles(dt) {
      const p = this.player;
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const b = this.projectiles[i];
        b.life -= dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.spin) b.a += b.spin * dt;
        let gone = b.life <= 0;
        if (!gone && this.lv.solidPx(b.x, b.y)) {
          gone = true;
          F.Particles.burst(b.x, b.y, 6, { sprite: 'spark', col: b.col, size: 3, size1: 0, life: 0.25, speed0: 20, speed1: 90, emis: 2.4, drag: 6 });
        }
        if (!gone && !b.friendly && !p.dead && Math.hypot(p.x - b.x, p.y - b.y) < p.r + b.r) {
          if (p.parries(b.x, b.y)) {
            // parried shots are sent back
            b.vx *= -1; b.vy *= -1; b.a += Math.PI; b.friendly = true; b.dmg *= 1.6;
            F.Audio.parry(); F.Game.kick(2); p.parryFlash = 1;
          } else { this.hitPlayer(b.from || { x: b.x, y: b.y }, b.dmg, true); gone = true; }
        }
        if (!gone && b.friendly) {
          for (const e of this.lv.enemies) {
            if (!e.alive || e === b.from) continue;
            if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
              e.hurt(b.dmg, this, { angle: b.a, knock: 40 });
              gone = true; break;
            }
          }
        }
        if (gone) this.projectiles.splice(i, 1);
        else if (b.light > 0) F.Render.light({ x: b.x, y: b.y, r: b.light, col: F.Col.lin(b.col, 1), intensity: 1.6, z: 10, shadow: 0, spec: 0.4 });
      }
    }

    blinkFx(x, y) {
      F.Particles.burst(x, y - 12, 12, {
        sprite: 'blob', col: '#b76cff', col1: '#2a0850', size: 7, size1: 0,
        life: 0.4, speed0: 10, speed1: 80, emis: 3, light: 28, drag: 4,
      });
    }

    updateFx(dt) {
      for (let i = this.slashes.length - 1; i >= 0; i--) { this.slashes[i].t -= dt; if (this.slashes[i].t <= 0) this.slashes.splice(i, 1); }
      for (let i = this.beams.length - 1; i >= 0; i--) { this.beams[i].t -= dt; if (this.beams[i].t <= 0) this.beams.splice(i, 1); }
      for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].t -= dt; if (this.rings[i].t <= 0) this.rings.splice(i, 1); }
      for (const n of this.lv.nodes) {
        if (n.flash > 0) n.flash -= dt * 5;
        if (n.shake > 0) n.shake -= dt * 6;
        if (n.hitT > 0) n.hitT -= dt * 7;
      }
    }

    /** Dust motes, embers and drips — the room breathing. */
    ambient(dt) {
      const B = this.lv.B, cam = this.cam;
      this.ambientT -= dt;
      if (this.ambientT > 0) return;
      this.ambientT = 0.05;
      if (F.Particles.n > 900) return;
      const x = cam.x + Math.random() * cam.vw, y = cam.y + Math.random() * cam.vh;
      if (B.liquid && B.liquid.emis > 0.6) {
        F.Particles.spawn({
          x, y, vx: F.U.rnd(-6, 6), vy: F.U.rnd(-22, -8), life: F.U.rnd(1.4, 3),
          sprite: 'spark', col: B.liquid.glow, col1: '#3a0a00', size: 2.4, size1: 0,
          emis: 2.6, drag: 0.5, light: 0,
        });
      } else {
        F.Particles.spawn({
          x, y, vx: F.U.rnd(-5, 5), vy: F.U.rnd(-6, 2), life: F.U.rnd(2, 4.5),
          sprite: 'dust', col: B.dust, size: 2.2, size1: 1.2, alpha: 0.22,
          emis: 0, drag: 0.3,
        });
      }
    }

    // --------------------------------------------------------- interaction
    checkInteract() {
      const p = this.player;
      this.prompt = null;
      if (p.dead) return;
      let best = null, bd = 44;
      for (const ex of this.lv.exits) {
        const d = Math.hypot(ex.x - p.x, ex.y - p.y);
        if (d < (ex.r || 26) + 10 && d < bd) { bd = d; best = { kind: 'exit', ex, label: ex.label, key: 'E' }; }
      }
      for (const c of this.lv.chests) {
        if (c.opened) continue;
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < 30 && d < bd) { bd = d; best = { kind: 'chest', c, label: 'Open the chest', key: 'E' }; }
      }
      for (const n of this.lv.npcs) {
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < 40 && d < bd) { bd = d; best = { kind: 'npc', npc: n, label: n.prompt || n.name, key: 'E' }; }
      }
      this.prompt = best;
      if (best && (F.Input.hit('e') || F.Input.buttons.use === 1)) this.doInteract(best);
    }

    doInteract(it) {
      if (it.kind === 'exit') {
        if (this.opt.onExit) this.opt.onExit(it.ex, this);
        return;
      }
      if (it.kind === 'chest') {
        it.c.opened = true;
        F.Audio.uiBig();
        F.Game.kick(1.5);
        const depth = it.c.depth || this.lv.depth || 1;
        const gold = Math.round(F.U.rnd(220, 480) * Math.pow(2.1, depth - 1));
        F.Game.addGold(gold);
        F.Game.toast('+' + F.U.fmt(gold) + ' gold', F.PAL.gold, 3);
        for (let i = 0; i < 4 + depth; i++) this.spawnDrop(it.c.x, it.c.y, 'ore', F.rollOre(depth, 1.8, F.Game.luck()));
        if (Math.random() < 0.8) this.spawnDrop(it.c.x, it.c.y, 'gem', F.rollGem(depth, 1));
        F.Game.s.essence += 2 + depth;
        F.Game.s.frags += 1 + Math.floor(depth / 2);
        F.Particles.burst(it.c.x, it.c.y - 10, 30, {
          sprite: 'spark', col: '#ffe9a0', col1: '#c79a2e', size: 4, size1: 0,
          life: 0.9, speed0: 20, speed1: 130, emis: 3.2, light: 30, drag: 2.6, grav: 90,
        });
        return;
      }
      if (it.kind === 'npc' && it.npc.onUse) it.npc.onUse(this);
    }

    onPlayerDead() {
      this.deathT = 0;
      setTimeout(() => { if (F.Game.top() === this) F.Game.push(new F.DeathScene(this)); }, 1200);
    }

    // -------------------------------------------------------------- render
    draw() {
      const lv = this.lv, cam = this.cam, p = this.player, t = this.time;
      F.Render.beginFrame(cam);

      const sorted = [];
      F.drawTerrain(lv, cam, sorted, t);
      F.drawProps(lv, cam, sorted, t);
      F.drawNodes(lv, cam, sorted, t);
      F.drawChests(lv, cam, sorted, t);
      F.drawPickups(lv, cam, sorted, t);
      if (lv.npcs && lv.npcs.length) F.drawNpcs(lv, cam, sorted, t);

      for (const e of lv.enemies) {
        if (!e.alive && e.deadT > 1.2) continue;
        if (e.x < cam.x - 80 || e.x > cam.x + cam.vw + 80 || e.y < cam.y - 100 || e.y > cam.y + cam.vh + 80) continue;
        sorted.push({ y: e.y, draw: () => e.draw(this) });
      }
      if (this.opt.drawExtra) this.opt.drawExtra(this, sorted);
      sorted.push({ y: p.y, draw: () => p.draw(this) });
      F.drawSorted(sorted);

      this.drawFx();
      F.Particles.draw(cam, t);
      this.drawLights();

      F.Render.endFrame();
      F.Hud.draw(this);
    }

    drawFx() {
      const A = F.Art, Bt = F.Batch;
      for (const s of this.slashes) {
        const k = s.t / s.max;
        // pick the trail whose sweep matches the weapon instead of stretching one
        const key = s.arc < 1.8 ? 'slash_n' : s.arc < 2.8 ? 'slash_m' : 'slash_w';
        const f = A.get(key);
        const scale = (s.range * 1.24) / 78 * (0.9 + (1 - k) * 0.22);
        // a wide soft bloom under a sharp core reads as a moving edge, not a smear
        Bt.push(f, s.x, s.y, {
          rot: s.a, scale: scale * 1.14, alpha: k * 0.30,
          tint: F.Col.tint(s.col), emis: 1.5 + (s.heavy ? 0.7 : 0), height: 0,
        });
        Bt.push(f, s.x, s.y, {
          rot: s.a, scale, alpha: k * 0.85,
          tint: F.Col.tint(F.Col.mix(s.col, '#ffffff', 0.55)),
          emis: 2.2 + (s.heavy ? 1.0 : 0), height: 0,
        });
        F.Render.light({ x: s.x + Math.cos(s.a) * s.range * 0.55, y: s.y + Math.sin(s.a) * s.range * 0.55,
          r: s.range * 1.7, col: F.Col.lin(s.col, 1), intensity: 1.7 * k, z: 14, shadow: 0, spec: 0.5 });
      }
      for (const b of this.beams) {
        const k = b.t / b.max;
        const dx = b.x1 - b.x0, dy = b.y1 - b.y0;
        const len = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        Bt.push(A.get('streak'), (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, {
          rot: a, sx: len / 64, sy: (0.4 + k * 0.8), alpha: k,
          tint: F.Col.tint(b.col), emis: 4, height: 0,
        });
      }
      for (const r of this.rings) {
        const k = 1 - r.t / r.max;
        Bt.push(A.get('ring'), r.x, r.y, {
          scale: F.U.lerp(r.r, r.r1, F.U.ease.outCubic(k)) / 22,
          alpha: (1 - k) * 0.9, tint: F.Col.tint(r.col), emis: 3.4, height: 0,
        });
      }
      for (const b of this.projectiles) {
        Bt.push(A.get(b.sprite), b.x, b.y, { rot: b.a, tint: F.Col.tint(b.col), emis: b.emis, height: 0.4 });
      }
      // the parry guard, drawn as a shimmering arc
      const p = this.player;
      if (p.parryT > 0) {
        const k = p.parryT / F.PARRY_TIME;
        Bt.push(A.get('slash'), p.x + Math.cos(p.parryAngle) * 14, p.y + Math.sin(p.parryAngle) * 14, {
          rot: p.parryAngle, scale: 0.85, alpha: 0.30 + k * 0.35,
          tint: F.Col.tint('#ffe8b0'), emis: 2.4, height: 0,
        });
      }
    }

    drawLights() {
      const lv = this.lv, cam = this.cam, p = this.player, t = this.time;
      // level lights
      for (const L of lv.lights) {
        if (L.x < cam.x - 300 || L.x > cam.x + cam.vw + 300 || L.y < cam.y - 300 || L.y > cam.y + cam.vh + 300) continue;
        const fl = L.flicker ? 1 + Math.sin(t * 9.3 + L.x * 0.13) * L.flicker * 0.32 + Math.sin(t * 17.1 + L.y * 0.07) * L.flicker * 0.16 : 1;
        F.Render.light({ x: L.x, y: L.y, r: L.r, col: L.col, intensity: L.i * fl, z: L.z, shadow: L.shadow, spec: 1 });
      }
      // the player's lantern, hanging where the sprite says it hangs
      if (!p.dead) {
        const lp = p.lanternPos();
        const L = F.LANTERNS[F.Game.s.lantern];
        const fl = 1 + Math.sin(t * 11) * 0.035 + Math.sin(t * 6.3) * 0.025;
        F.Render.light({ x: lp.x, y: lp.y, r: F.Game.lightRadius() * fl, col: F.Col.lin(L.col, 1),
          intensity: L.i * fl, z: 18, shadow: 1, spec: 1 });
        // a small, soft fill so the player is never a silhouette in a black room
        F.Render.light({ x: p.x, y: p.y - 14, r: 96, col: F.Col.lin(L.col, 1), intensity: 0.85, z: 26, shadow: 0, spec: 0.3 });
      }
      if (p.parryFlash > 0)
        F.Render.light({ x: p.x, y: p.y - 14, r: 160, col: [1, 0.9, 0.6], intensity: 3 * p.parryFlash, z: 20, shadow: 0, spec: 1 });
    }
  }

  F.WorldScene = WorldScene;

})(window.F2 = window.F2 || {});
