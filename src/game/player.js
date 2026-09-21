'use strict';
// ---------------------------------------------------------------------------
// player.js — the character you drive. Movement, stamina, mining, the three
// attacks, dash, parry, and the animation state that feeds the rig.
// ---------------------------------------------------------------------------
(function (F) {

  const TS = F.TS;

  class Player {
    constructor(x, y) {
      this.x = x; this.y = y; this.r = 9;
      this.vx = 0; this.vy = 0;
      this.rig = F.makeRig();
      this.seed = Math.random() * 10;

      this.stam = 100; this.maxStam = 100;
      this.aim = Math.PI / 2;
      this.facing = 'S';
      this.holding = 'pick';           // 'pick' | 'weapon'
      this.animT = 0; this.moveSpeed = 0;
      this.swingT = 0; this.swingDur = 0; this.swingDir = 1; this.windFrac = 0.35;
      this.swingHit = false; this.swingHeavy = false; this.hitList = null;
      this.cool = 0;
      this.mineT = 0; this.mineTarget = null; this.mineCool = 0;
      this.hurtT = 0; this.iframes = 0;
      this.dashT = 0; this.dashCool = 0; this.dashVX = 0; this.dashVY = 0;
      this.parryT = 0; this.parryCool = 0; this.parryAngle = 0; this.parryFlash = 0;
      this.deadT = 0; this.dead = false;
      this.stepT = 0;
      this.regenT = 0;
      this.lastSafe = { x, y };
      this.burn = 0; this.chill = 0;
      this.shieldCharge = 0;
    }

    get held() {
      const s = F.Game.s;
      if (this.holding === 'pick') {
        const p = F.PICKS[s.pick];
        return { kind: 'pick', color: p.col, glow: p.glow };
      }
      const w = F.Game.weapon();
      return w === F.FISTS ? null : w;
    }

    // ------------------------------------------------------------- update
    update(dt, sc) {
      const s = F.Game.s, lv = sc.lv, In = F.Input;
      if (this.dead) { this.deadT = Math.min(1, this.deadT + dt * 2.4); this.updateRig(dt); return; }

      // aim always follows the cursor, so the character reads as "ready"
      const wx = sc.cam.x + In.mx, wy = sc.cam.y + In.my;
      if (!F.Input.touch) this.aim = Math.atan2(wy - this.y, wx - this.x);
      this.facing = (this.aim < -0.55 * Math.PI || this.aim > -0.45 * Math.PI) ? this.facing : this.facing;
      this.facing = (Math.sin(this.aim) < -0.45) ? 'N' : 'S';

      this.cool = Math.max(0, this.cool - dt);
      this.mineCool = Math.max(0, this.mineCool - dt);
      this.dashCool = Math.max(0, this.dashCool - dt);
      this.parryCool = Math.max(0, this.parryCool - dt);
      this.hurtT = Math.max(0, this.hurtT - dt * 4);
      this.iframes = Math.max(0, this.iframes - dt);
      this.parryFlash = Math.max(0, this.parryFlash - dt * 3);
      if (this.parryT > 0) this.parryT -= dt;

      // ------------------------------------------------------- movement
      const ax = In.axis();
      let speed = F.Game.moveSpeed();
      const sprinting = (In.down('shift') || In.buttons.sprint) && ax.m > 0.1 && this.stam > 1 && !this.mineT;
      if (sprinting) { speed *= 1.55; this.stam = Math.max(0, this.stam - 22 * dt); }
      if (this.chill > 0) { speed *= 0.65; this.chill -= dt; }
      if (this.dashT > 0) {
        this.dashT -= dt;
        const k = F.U.sat(this.dashT / F.DASH_TIME);
        F.moveEnt(lv, this, this.dashVX * dt * (0.4 + k), this.dashVY * dt * (0.4 + k));
        if (Math.random() < 0.6) this.dashPuff(sc);
      } else if (this.swingT > 0 && !this.swingHeavy) {
        // light attacks let you drift; heavy attacks root you
        F.moveEnt(lv, this, ax.x * speed * 0.35 * dt, ax.y * speed * 0.35 * dt);
      } else if (this.swingT <= 0) {
        F.moveEnt(lv, this, ax.x * speed * dt, ax.y * speed * dt);
      }
      this.moveSpeed = ax.m * (sprinting ? 1 : 0.62);
      if (this.mineT > 0 || this.swingT > 0) this.moveSpeed *= 0.2;
      this.animT = (this.animT + dt * (1.5 + this.moveSpeed * 2.4)) % 1;

      // footsteps with dust
      if (ax.m > 0.1 && this.dashT <= 0) {
        this.stepT -= dt * (1.6 + this.moveSpeed * 2.6);
        if (this.stepT <= 0) {
          this.stepT = 1;
          F.Audio.step();
          F.Particles.burst(this.x, this.y + 2, 2, {
            sprite: 'dust', col: lv.B.dust, col1: lv.B.dust, alpha: 0.30, emis: 0,
            size: 5, size1: 9, life: 0.5, speed0: 4, speed1: 18, drag: 3, grav: -6,
          });
        }
      }

      // stamina regenerates quickly unless you are spending it
      if (!sprinting) this.stam = Math.min(this.maxStam, this.stam + (this.mineT > 0 ? 8 : 26) * dt);

      // -------------------------------------------------------- actions
      if ((In.hit('1') || In.wheel < 0) && !this.swingT) this.setHold('pick');
      if ((In.hit('2') || In.wheel > 0) && !this.swingT) this.setHold('weapon');
      if (In.hit('q') || In.buttons.dash === 1) this.tryDash(ax, sc);
      if (In.hit('f') || In.buttons.parry === 1) this.tryParry();

      for (let i = 0; i < 6; i++) if (In.hit(String(i + 3))) F.usePotion(i);

      const wantAttack = In.mdown || In.buttons.attack;
      const wantHeavy = In.rdown || In.hit('r') || In.buttons.heavy === 1;
      if (this.holding === 'weapon') {
        if (wantHeavy) this.attack(sc, true);
        else if (wantAttack) this.attack(sc, false);
      } else if (this.holding === 'pick') {
        if (wantAttack || In.down('e') || In.buttons.attack) this.mine(dt, sc);
      }

      // swing progression
      if (this.swingT > 0) {
        this.swingT -= dt;
        const p = 1 - this.swingT / this.swingDur;
        if (!this.swingHit && p >= this.windFrac) { this.swingHit = true; this.landHit(sc); }
        if (this.swingT <= 0) { this.swingT = 0; this.hitList = null; }
      }
      if (this.mineT > 0) {
        this.mineT -= dt * F.Game.mineSpeed() * 2.6;
        if (this.mineT <= 0) { this.mineT = 0; this.strikeNode(sc); }
      }

      // burning damage over time
      if (this.burn > 0) {
        this.burn -= dt;
        this.regenT -= dt;
        if (this.regenT <= 0) { this.regenT = 0.5; this.damage(F.Game.maxHp() * 0.012, sc, true); }
      }

      // lava / hazard tiles
      const tile = lv.t(Math.floor(this.x / TS), Math.floor(this.y / TS));
      if (tile === F.T.LIQUID && lv.B.liquid && lv.B.liquid.emis > 0.6 && !F.Game.buff('stone')) {
        this.regenT -= dt;
        if (this.regenT <= 0) { this.regenT = 0.45; this.damage(F.Game.maxHp() * 0.05, sc, true); }
      } else if (tile === F.T.FLOOR) {
        this.lastSafe.x = this.x; this.lastSafe.y = this.y;
      }

      // leeching regenerates out of combat
      for (const it of F.Game.armorPieces()) {
        if (F.Forge.hasTrait(it, 'leeching') && sc.combatT <= 0) {
          F.Game.s.hp = Math.min(F.Game.maxHp(), F.Game.s.hp + F.Game.maxHp() * 0.02 * dt);
        }
      }
      if (F.Game.buff('regen')) F.Game.s.hp = Math.min(F.Game.maxHp(), F.Game.s.hp + F.Game.maxHp() * 0.035 * dt);

      this.updateRig(dt);
    }

    setHold(h) {
      if (this.holding === h) return;
      this.holding = h; this.mineT = 0; this.mineTarget = null;
      F.Audio.ui();
    }

    // -------------------------------------------------------------- dash
    tryDash(ax, sc) {
      if (this.dashCool > 0 || this.stam < F.DASH_STA || this.dashT > 0) return;
      let dx = ax.x, dy = ax.y;
      if (Math.hypot(dx, dy) < 0.1) { dx = Math.cos(this.aim); dy = Math.sin(this.aim); }
      const m = Math.hypot(dx, dy) || 1;
      const spd = F.DASH_DIST / F.DASH_TIME;
      this.dashVX = dx / m * spd; this.dashVY = dy / m * spd;
      this.dashT = F.DASH_TIME; this.dashCool = F.DASH_CD;
      this.iframes = F.DASH_TIME + 0.09;
      this.stam -= F.DASH_STA;
      this.swingT = 0;
      F.Audio.dash();
      F.Game.kick(1.2);
    }
    dashPuff(sc) {
      F.Particles.burst(this.x, this.y + 2, 2, {
        sprite: 'dust', col: '#ffffff', alpha: 0.22, emis: 0,
        size: 6, size1: 12, life: 0.35, speed0: 2, speed1: 14, drag: 4,
      });
    }

    // ------------------------------------------------------------- parry
    tryParry() {
      if (this.parryCool > 0 || this.holding !== 'weapon') return;
      this.parryT = F.PARRY_TIME;
      this.parryCool = F.PARRY_CD;
      this.parryAngle = this.aim;
      F.Audio.swing(0);
    }
    /** Does an incoming hit from (sx,sy) land inside the guarded cone? */
    parries(sx, sy) {
      if (this.parryT <= 0) return false;
      const a = Math.atan2(sy - this.y, sx - this.x);
      return Math.abs(F.U.angDiff(a, this.parryAngle)) <= F.PARRY_ARC;
    }

    // ------------------------------------------------------------ attack
    attack(sc, heavy) {
      if (this.cool > 0 || this.swingT > 0 || this.dashT > 0) return;
      const w = F.Game.weapon();
      const cost = w.stats.sta * (heavy ? 1.8 : 1);
      if (this.stam < cost) { if (heavy) F.Audio.error(); return; }
      this.stam -= cost;
      const spd = 1 + (w.spell === 'wind' ? 0.2 : 0) + (F.Game.buff('haste') ? 0.25 : 0);
      this.swingDur = w.stats.cd * (heavy ? 1.55 : 1) / spd;
      this.swingT = this.swingDur;
      this.windFrac = F.U.clamp(w.stats.wind / w.stats.cd, 0.18, 0.55) * (heavy ? 1.25 : 1);
      this.swingHit = false; this.swingHeavy = heavy;
      this.swingDir = -this.swingDir;
      this.cool = this.swingDur * 0.55;
      this.hitList = new Set();
      F.Audio.swing(F.CLS[w.cls] ? F.CLS[w.cls].tier / 2 : 0);
    }

    landHit(sc) {
      const w = F.Game.weapon();
      const heavy = this.swingHeavy;
      let dmg = F.Game.attackPower() * (heavy ? w.stats.heavy : 1);
      let range = w.stats.range * (heavy ? 1.15 : 1);
      let arc = w.stats.arc * (w.rune === 'cleave' ? 1.4 : 1) * Math.PI / 180;
      const knock = w.stats.knock * (heavy ? 1.8 : 1);
      let any = false;

      for (const e of sc.lv.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d > range + e.r) continue;
        const a = Math.atan2(e.y - this.y, e.x - this.x);
        if (Math.abs(F.U.angDiff(a, this.aim)) > arc / 2) continue;
        if (this.hitList.has(e)) continue;
        this.hitList.add(e);
        any = true;
        sc.hitEnemy(e, dmg, { knock, angle: a, heavy, weapon: w, from: this });
      }
      // heavy swings shatter ore nodes caught in the arc
      if (heavy) {
        for (const n of sc.lv.nodes) {
          if (!n.alive) continue;
          const d = Math.hypot(n.x - this.x, n.y - this.y);
          if (d > range + n.r) continue;
          const a = Math.atan2(n.y - this.y, n.x - this.x);
          if (Math.abs(F.U.angDiff(a, this.aim)) > arc / 2) continue;
          sc.damageNode(n, dmg * 0.55, this.aim);
        }
      }
      // the swing itself, drawn as an arc of light
      sc.slashes.push({
        x: this.x, y: this.y, a: this.aim, t: heavy ? 0.28 : 0.20, max: heavy ? 0.28 : 0.20,
        range, arc, heavy, col: w.glowCol || '#ffe9c0',
      });
      // sparks thrown off the edge, along the sweep
      const sparkN = heavy ? 14 : 7;
      for (let i = 0; i < sparkN; i++) {
        const a2 = this.aim + (i / (sparkN - 1) - 0.5) * arc * 0.9;
        F.Particles.spawn({
          x: this.x + Math.cos(a2) * range * 0.85, y: this.y + Math.sin(a2) * range * 0.85,
          vx: Math.cos(a2) * F.U.rnd(30, 120), vy: Math.sin(a2) * F.U.rnd(30, 120),
          life: F.U.rnd(0.16, 0.34), sprite: 'spark', col: w.glowCol || '#ffe9c0', col1: '#6a2a08',
          size: heavy ? 3.4 : 2.4, size1: 0, emis: 2.6, drag: 6, light: 0,
        });
      }
      F.Audio.swing(heavy ? 1 : 0.4);
      if (any) F.Game.kick(heavy ? 3.4 : 1.6, heavy ? 0.055 : 0.028);
      else if (heavy) F.Game.kick(1.0);
    }

    // -------------------------------------------------------------- mining
    mine(dt, sc) {
      if (this.mineT > 0 || this.mineCool > 0 || this.swingT > 0) return;
      const n = this.nodeInReach(sc);
      if (!n) return;
      if (this.stam < 6) return;
      this.mineTarget = n;
      this.mineT = 1;
      this.aim = Math.atan2(n.y - this.y, n.x - this.x);
      this.stam -= 6 * (F.Game.s.pickRune === 'swift' ? 0.8 : 1);
    }
    nodeInReach(sc) {
      let best = null, bd = 1e9;
      for (const n of sc.lv.nodes) {
        if (!n.alive) continue;
        const d = Math.hypot(n.x - this.x, n.y - this.y);
        if (d > n.r + 26) continue;
        const a = Math.atan2(n.y - this.y, n.x - this.x);
        if (Math.abs(F.U.angDiff(a, this.aim)) > 1.35) continue;
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    }
    strikeNode(sc) {
      const n = this.mineTarget;
      this.mineCool = 0.06;
      if (!n || !n.alive) { this.mineTarget = null; return; }
      const d = Math.hypot(n.x - this.x, n.y - this.y);
      if (d > n.r + 34) { this.mineTarget = null; return; }
      sc.damageNode(n, F.Game.minePower(), Math.atan2(n.y - this.y, n.x - this.x));
    }

    // -------------------------------------------------------------- damage
    damage(raw, sc, noReduce) {
      if (this.dead || this.iframes > 0) return 0;
      let d = noReduce ? raw : F.Game.damageTaken(raw);
      // an Ice Shield absorbs one hit outright
      if (this.shieldCharge > 0) {
        this.shieldCharge = 0;
        F.Game.floater(this.x, this.y - 30, 'BLOCKED', F.PAL.cool, { size: 1.1 });
        F.Audio.parry();
        return 0;
      }
      for (const it of F.Game.armorPieces()) {
        if (F.Forge.hasTrait(it, 'void') && Math.random() < 0.12) {
          F.Game.floater(this.x, this.y - 30, 'VOID', F.PAL.magic, { size: 1.05 });
          return 0;
        }
      }
      d = Math.max(1, Math.round(d));
      F.Game.s.hp -= d;
      this.hurtT = 1; this.iframes = 0.42;
      F.Game.floater(this.x, this.y - 26, '-' + d, F.PAL.hp, { size: 1.05 });
      F.Game.kick(2.6, 0.04);
      F.Game.flash('#ff2a3a', 0.30, 0.16);
      F.Audio.hurt();
      F.Particles.burst(this.x, this.y - 10, 8, {
        sprite: 'spark', col: '#ff4a5a', col1: '#7a1020', size: 3.5, size1: 0,
        life: 0.4, speed0: 30, speed1: 130, emis: 2.2, light: 0,
      });
      if (F.Game.s.hp <= 0) this.die(sc);
      return d;
    }
    die(sc) {
      F.Game.s.hp = 0;
      this.dead = true; this.deadT = 0;
      F.Game.s.stats.deaths++;
      F.Audio.death();
      F.Game.kick(6, 0.12);
      if (sc.onPlayerDead) sc.onPlayerDead();
    }
    heal(n) {
      const before = F.Game.s.hp;
      F.Game.s.hp = Math.min(F.Game.maxHp(), F.Game.s.hp + n);
      const got = Math.round(F.Game.s.hp - before);
      if (got > 0) F.Game.floater(this.x, this.y - 30, '+' + got, F.PAL.good, { size: 1.05 });
    }

    // ------------------------------------------------------------- drawing
    updateRig(dt) {
      const a = this;
      a.aimLocal = -F.U.clamp(Math.sin(this.aim) * -1, -1, 1) * 0.7;
      a.holding = true;
      F.poseActor(this.rig, {
        moveSpeed: this.moveSpeed, animT: this.animT, aim: this.aim, aimLocal: a.aimLocal,
        facing: this.facing, holding: true, seed: this.seed,
        swingT: this.swingT, swingDur: this.swingDur, swingDir: this.swingDir, windFrac: this.windFrac,
        mineT: this.mineT, hurtT: this.hurtT, dashT: F.U.sat(this.dashT / F.DASH_TIME), deadT: this.deadT,
      }, F.Game.time);
      this.holding = this.holding === true ? (this._hold || 'pick') : this.holding;
    }

    draw(sc) {
      const s = F.Game.s;
      const tints = F.dressRig(this.rig, {
        head: F.Game.equipped('head'), chest: F.Game.equipped('chest'),
        legs: F.Game.equipped('legs'), boots: F.Game.equipped('boots'),
      }, { lantern: true, lanternCol: F.LANTERNS[s.lantern].col });
      F.armRig(this.rig, this.held, tints);
      const flip = Math.cos(this.aim) < 0;
      this.rig.pose({ x: this.x, y: this.y, sx: (flip ? -1 : 1) * 0.78, sy: 0.78 });
      F.Batch.push(F.Art.get('shadow'), this.x, this.y + 1, { sx: 0.8, sy: 0.7, height: 0 });
      const hurt = this.hurtT > 0.3;
      const inv = this.iframes > 0 && Math.floor(F.Game.time * 22) % 2 === 0;
      this.rig.drawOutlined({
        tints, height: 1, emis: 1,
        alpha: inv ? 0.55 : 1,
        tint: hurt ? F.Col.tint('#ff9aa4') : undefined,
      }, 1.1);
    }

    /** Where the lantern actually hangs, so the light moves with the arm. */
    lanternPos() {
      const p = this.rig.at('offhand', 0, 6);
      return p;
    }
  }

  F.Player = Player;

})(window.F2 = window.F2 || {});
