'use strict';
// ---------------------------------------------------------------------------
// enemy.js — mine hazards. Eight behaviours over one skeleton, scaled by depth.
//
// Mobs never drop crafting ore. Ore comes out of rock; gold, essence and rune
// fragments come out of things that were trying to kill you.
// ---------------------------------------------------------------------------
(function (F) {

  const TS = F.TS;

  const LOOK = {
    grunt:  { scale: 0.68, skin: '#7a6a52', tunic: '#4a3f30', head: null,       weapon: 'club'  },
    rogue:  { scale: 0.62, skin: '#8a7a92', tunic: '#3a2f46', head: 'en_hood',  weapon: 'dagger' },
    bomber: { scale: 0.70, skin: '#9a9a4a', tunic: '#5a5a28', body: 'en_beetle' },
    archer: { scale: 0.66, skin: '#6a7a8a', tunic: '#38424e', head: 'en_hood',  weapon: 'bow'   },
    tank:   { scale: 0.92, skin: '#7a7a7a', tunic: '#4a4a4a', body: 'en_shell', weapon: 'club'  },
    mage:   { scale: 0.68, skin: '#7a5a9a', tunic: '#3a2050', head: 'en_hood',  weapon: 'staff' },
    healer: { scale: 0.66, skin: '#5a8a7a', tunic: '#274a3e', head: 'en_hood',  weapon: 'staff' },
    brute:  { scale: 0.92, skin: '#9a6a52', tunic: '#5a3020', head: 'en_horns', weapon: 'club'  },
    warden: { scale: 1.05, skin: '#6a7a9a', tunic: '#2e3852', body: 'en_shell', head: 'en_horns', weapon: 'maul' },
    wraith: { scale: 0.80, skin: '#9a6ac0', tunic: '#2a1440', head: 'en_hood',  weapon: 'dagger', ghost: true },
  };

  class Enemy {
    constructor(type, x, y, depth, elite, level) {
      const E = F.ENEMIES[type];
      this.type = type; this.x = x; this.y = y;
      this.depth = depth; this.elite = !!elite; this.level = level || 1;
      this.look = LOOK[type] || LOOK.grunt;

      const dscale = F.enemyScale(depth);
      const lscale = 1 + (this.level - 1) * 0.085;
      const es = elite ? 2.2 : 1;
      this.max = Math.round(E.hp * dscale * lscale * es);
      this.hp = this.max;
      this.dmg = E.dmg * dscale * lscale * (elite ? 1.35 : 1);
      this.spd = E.spd * (elite ? 0.94 : 1);
      this.r = E.r * (elite ? 1.2 : 1);
      this.armor = E.armor || 0;
      this.xp = Math.round(E.xp * Math.pow(dscale, 0.85) * lscale * (elite ? 2.4 : 1));
      this.goldLo = E.gold[0] * dscale * (elite ? 2.6 : 1);
      this.goldHi = E.gold[1] * dscale * (elite ? 2.6 : 1);
      this.ai = E.ai;
      this.name = (elite ? 'Elite ' : '') + E.n;

      this.alive = true;
      this.rig = F.makeRig();
      this.seed = Math.random() * 10;
      this.state = 'idle'; this.stateT = 0;
      this.animT = Math.random(); this.moveSpeed = 0;
      this.aim = Math.random() * 6.28; this.facing = 'S';
      this.swingT = 0; this.swingDur = 0; this.swingDir = 1; this.windFrac = 0.55;
      this.cool = F.U.rnd(0, 1);
      this.hurtT = 0; this.stun = 0; this.chill = 0; this.burn = 0; this.burnT = 0;
      this.deadT = 0; this.flash = 0;
      this.homeX = x; this.homeY = y;
      this.wanderT = 0; this.wx = x; this.wy = y;
      this.vulnerable = 1;
      this.tint = F.Col.tint(F.ENEMIES[type].col);
      this.scale = this.look.scale * (elite ? 1.16 : 1);
      this.healCool = 0;
      this.telegraph = 0;
    }

    // ------------------------------------------------------------- update
    update(dt, sc) {
      if (!this.alive) { this.deadT += dt * 1.8; return; }
      const p = sc.player;
      this.hurtT = Math.max(0, this.hurtT - dt * 4);
      this.flash = Math.max(0, this.flash - dt * 6);
      this.cool = Math.max(0, this.cool - dt);
      this.telegraph = Math.max(0, this.telegraph - dt);
      if (this.chill > 0) this.chill -= dt;
      if (this.burn > 0) {
        this.burn -= dt; this.burnT -= dt;
        if (this.burnT <= 0) { this.burnT = 0.5; this.hurt(this.max * 0.012 + this.burnDmg, sc, { dot: true }); }
        if (Math.random() < 0.5) F.Particles.spawn({
          x: this.x + F.U.rnd(-6, 6), y: this.y - F.U.rnd(2, 16), vy: -24, life: 0.4,
          sprite: 'blob', col: '#ff8a2a', col1: '#5a1000', size: 4, size1: 0, emis: 2.6, light: 24,
        });
      }
      if (this.stun > 0) {
        this.stun -= dt; this.moveSpeed = 0;
        this.poseRig(sc); return;
      }

      const d = Math.hypot(p.x - this.x, p.y - this.y);
      const E = F.ENEMIES[this.type];
      const aggro = E.aggro * (this.elite ? 1.2 : 1);
      const sees = d < aggro && F.hasLOS(sc.lv, this.x, this.y, p.x, p.y);
      if (sees) { this.state = 'chase'; this.stateT = 2.2; }
      else if (this.stateT > 0) this.stateT -= dt;
      else this.state = 'idle';

      if (this.swingT > 0) {
        this.swingT -= dt;
        const q = 1 - this.swingT / this.swingDur;
        if (!this.swingHit && q >= this.windFrac) { this.swingHit = true; this.strike(sc); }
        this.moveSpeed = 0;
        this.poseRig(sc); return;
      }

      let speed = this.spd * (this.chill > 0 ? 0.62 : 1);
      let mx = 0, my = 0;

      if (this.state === 'chase') {
        this.aim = Math.atan2(p.y - this.y, p.x - this.x);
        switch (this.ai) {
          case 'ranged': case 'caster': {
            const ideal = E.range * 0.62;
            if (d < ideal * 0.7) { mx = -Math.cos(this.aim); my = -Math.sin(this.aim); }
            else if (d > ideal) { mx = Math.cos(this.aim); my = Math.sin(this.aim); }
            else { mx = -Math.sin(this.aim) * 0.7; my = Math.cos(this.aim) * 0.7; }
            if (d < E.range && this.cool <= 0) this.beginSwing(E.wind, E.rec);
            break;
          }
          case 'healer': {
            const friend = this.nearestHurtFriend(sc);
            if (friend && this.healCool <= 0) {
              this.healCool = 4.5;
              friend.hp = Math.min(friend.max, friend.hp + friend.max * 0.22);
              sc.beams.push({ x0: this.x, y0: this.y - 14, x1: friend.x, y1: friend.y - 14, t: 0.5, max: 0.5, col: '#6ee787' });
              F.Game.floater(friend.x, friend.y - 34, '+heal', F.PAL.good, { size: 0.9 });
            }
            this.healCool -= dt;
            if (d < 120) { mx = -Math.cos(this.aim); my = -Math.sin(this.aim); }
            else { mx = Math.cos(this.aim) * 0.5; my = Math.sin(this.aim) * 0.5; }
            break;
          }
          case 'suicide': {
            mx = Math.cos(this.aim); my = Math.sin(this.aim);
            speed *= 1.25;
            if (d < E.range) this.beginSwing(E.wind, 0);
            break;
          }
          case 'dash': {
            if (d > 70 && this.cool <= 0) {
              this.cool = 1.7;
              this.dashVX = Math.cos(this.aim) * 320; this.dashVY = Math.sin(this.aim) * 320;
              this.dashT = 0.24;
            }
            mx = Math.cos(this.aim); my = Math.sin(this.aim);
            if (d < E.range + p.r) this.beginSwing(E.wind, E.rec);
            break;
          }
          case 'charger': {
            if (d > 90 && d < 260 && this.cool <= 0) {
              this.cool = 3.4; this.telegraph = 0.55;
              this.chargeAim = this.aim;
            }
            if (this.telegraph > 0) { mx = my = 0; }
            else if (this.chargeAim !== undefined && this.cool > 2.4) {
              mx = Math.cos(this.chargeAim); my = Math.sin(this.chargeAim); speed *= 2.6;
            } else { mx = Math.cos(this.aim); my = Math.sin(this.aim); }
            if (d < E.range + p.r) this.beginSwing(E.wind, E.rec);
            break;
          }
          case 'blink': {
            if (this.cool <= 0 && d > 60) {
              this.cool = 2.6;
              const a = this.aim + F.U.rnd(-1, 1);
              const tx = p.x - Math.cos(a) * 42, ty = p.y - Math.sin(a) * 42;
              if (!F.blocked(sc.lv, tx, ty, this.r)) {
                sc.blinkFx(this.x, this.y); this.x = tx; this.y = ty; sc.blinkFx(tx, ty);
              }
            }
            mx = Math.cos(this.aim); my = Math.sin(this.aim);
            if (d < E.range + p.r) this.beginSwing(E.wind, E.rec);
            break;
          }
          default: {
            mx = Math.cos(this.aim); my = Math.sin(this.aim);
            if (d < E.range + p.r) this.beginSwing(E.wind, E.rec);
          }
        }
      } else {
        // idle wander around the spot it was placed
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = F.U.rnd(1.6, 4.2);
          const a = Math.random() * 6.28, rr = F.U.rnd(10, 70);
          this.wx = this.homeX + Math.cos(a) * rr; this.wy = this.homeY + Math.sin(a) * rr;
        }
        const dx = this.wx - this.x, dy = this.wy - this.y;
        const m = Math.hypot(dx, dy);
        if (m > 6) { mx = dx / m * 0.42; my = dy / m * 0.42; this.aim = Math.atan2(dy, dx); }
      }

      if (this.dashT > 0) {
        this.dashT -= dt;
        F.moveEnt(sc.lv, this, this.dashVX * dt, this.dashVY * dt);
        this.moveSpeed = 1;
      } else {
        // separation keeps a pack from stacking into one sprite
        let sx = 0, sy = 0;
        for (const o of sc.lv.enemies) {
          if (o === this || !o.alive) continue;
          const ddx = this.x - o.x, ddy = this.y - o.y;
          const dd = ddx * ddx + ddy * ddy;
          if (dd < 900 && dd > 0.01) { const f = 1 / dd * 240; sx += ddx * f; sy += ddy * f; }
        }
        mx += F.U.clamp(sx, -1, 1); my += F.U.clamp(sy, -1, 1);
        const m = Math.hypot(mx, my);
        if (m > 0.01) {
          F.moveEnt(sc.lv, this, mx / m * speed * dt, my / m * speed * dt);
          this.moveSpeed = Math.min(1, m) * (speed / 70);
        } else this.moveSpeed = 0;
      }

      if (this.knockX || this.knockY) {
        F.moveEnt(sc.lv, this, this.knockX * dt, this.knockY * dt);
        const k = Math.exp(-9 * dt);
        this.knockX *= k; this.knockY *= k;
        if (Math.abs(this.knockX) < 2) this.knockX = 0;
        if (Math.abs(this.knockY) < 2) this.knockY = 0;
      }

      this.facing = Math.sin(this.aim) < -0.45 ? 'N' : 'S';
      this.animT = (this.animT + dt * (1.2 + this.moveSpeed * 2.2)) % 1;
      this.poseRig(sc);
    }

    nearestHurtFriend(sc) {
      let best = null, bd = 220;
      for (const o of sc.lv.enemies) {
        if (o === this || !o.alive || o.hp >= o.max * 0.85) continue;
        const d = Math.hypot(o.x - this.x, o.y - this.y);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }

    beginSwing(wind, rec) {
      if (this.cool > 0 || this.swingT > 0) return;
      this.swingDur = wind + (rec || 0.3);
      this.swingT = this.swingDur;
      this.windFrac = wind / this.swingDur;
      this.swingHit = false;
      this.swingDir = -this.swingDir;
      this.cool = this.swingDur + F.U.rnd(0.25, 0.7);
    }

    strike(sc) {
      const p = sc.player, E = F.ENEMIES[this.type];
      if (this.ai === 'suicide') { this.explode(sc); return; }
      if (this.ai === 'ranged') {
        sc.spawnProjectile({
          x: this.x, y: this.y - 12, a: this.aim, speed: 230, dmg: this.dmg,
          sprite: 'arrow', col: '#cfc8b8', life: 2.2, from: this, emis: 0.6,
        });
        return;
      }
      if (this.ai === 'caster') {
        sc.spawnProjectile({
          x: this.x, y: this.y - 14, a: this.aim, speed: 175, dmg: this.dmg,
          sprite: 'bolt', col: '#b76cff', life: 2.6, from: this, emis: 3.2, light: 50, r: 7,
        });
        return;
      }
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d > E.range + p.r + 8) return;
      const a = Math.atan2(p.y - this.y, p.x - this.x);
      if (Math.abs(F.U.angDiff(a, this.aim)) > 1.2) return;
      sc.hitPlayer(this, this.dmg);
    }

    explode(sc) {
      const R = 62;
      this.alive = false; this.deadT = 0.6;
      F.Audio.boom();
      F.Game.kick(4.5, 0.06);
      F.Particles.burst(this.x, this.y - 8, 34, {
        sprite: 'blob', col: '#ffe08a', col1: '#8a2000', size: 12, size1: 0,
        life: 0.55, speed0: 40, speed1: 260, emis: 3.4, light: 40, drag: 3.4,
      });
      F.Particles.burst(this.x, this.y - 8, 14, {
        sprite: 'smoke', col: '#6a5a4a', col1: '#2a2018', size: 14, size1: 30,
        life: 1.1, speed0: 10, speed1: 60, emis: 0, alpha: 0.5, drag: 2,
      });
      const p = sc.player;
      if (Math.hypot(p.x - this.x, p.y - this.y) < R) sc.hitPlayer(this, this.dmg, true);
      for (const o of sc.lv.enemies) {
        if (o === this || !o.alive) continue;
        if (Math.hypot(o.x - this.x, o.y - this.y) < R) o.hurt(this.dmg * 0.5, sc, {});
      }
      sc.dropLoot(this);
    }

    // -------------------------------------------------------------- damage
    hurt(raw, sc, opt) {
      if (!this.alive) return 0;
      opt = opt || {};
      let d = raw * (1 - this.armor * (opt.pierce ? 0.4 : 1)) * this.vulnerable;
      d = Math.max(1, Math.round(d));
      this.hp -= d;
      this.flash = 1; this.hurtT = 1;
      if (!opt.dot) {
        F.Game.floater(this.x + F.U.rnd(-6, 6), this.y - this.r - 14, '' + d,
          opt.crit ? '#ffd23f' : '#ffffff', { size: opt.crit ? 1.25 : 0.95, crit: opt.crit });
        F.Audio.hit(opt.crit);
        F.Particles.burst(this.x, this.y - this.r * 0.6, opt.crit ? 14 : 8, {
          sprite: 'spark', col: '#ffd9a0', col1: '#ff5a2a', size: 3.2, size1: 0,
          life: 0.35, speed0: 40, speed1: 190, emis: 3.0, drag: 5,
          dir: opt.angle, spread: 1.6,
        });
      }
      if (opt.knock) { this.knockX = Math.cos(opt.angle) * opt.knock; this.knockY = Math.sin(opt.angle) * opt.knock; }
      if (this.hp <= 0) this.die(sc, opt);
      return d;
    }

    ignite(dmg, dur) { this.burn = Math.max(this.burn, dur || 5); this.burnDmg = dmg || 0; }

    die(sc, opt) {
      this.alive = false; this.deadT = 0;
      F.Particles.burst(this.x, this.y - this.r * 0.6, 20, {
        sprite: 'spark', col: '#ffd9a0', col1: '#7a2a10', size: 4, size1: 0,
        life: 0.55, speed0: 30, speed1: 200, emis: 2.8, drag: 4,
      });
      F.Particles.burst(this.x, this.y - 6, 8, {
        sprite: 'smoke', col: '#3a3040', size: 10, size1: 22, life: 0.9,
        speed0: 6, speed1: 36, emis: 0, alpha: 0.42, drag: 2,
      });
      sc.dropLoot(this);
      F.Game.s.stats.kills++;
      F.Game.addXp(this.xp);
      F.Quests.onEvent(F.Game.s, 'kill', { type: this.type });
      F.Achieve.check(F.Game.s);
    }

    // ------------------------------------------------------------- drawing
    poseRig(sc) {
      F.poseActor(this.rig, {
        moveSpeed: this.moveSpeed, animT: this.animT, aim: this.aim,
        aimLocal: -0.2, facing: this.facing, holding: !!this.look.weapon, seed: this.seed,
        swingT: this.swingT, swingDur: this.swingDur, swingDir: this.swingDir, windFrac: this.windFrac,
        mineT: 0, hurtT: this.hurtT, dashT: 0, deadT: this.alive ? 0 : Math.min(1, this.deadT * 2),
      }, F.Game.time);
    }

    draw(sc) {
      const L = this.look;
      const rig = this.rig;
      const tints = F.dressRig(rig, {}, {
        skin: L.skin, tunic: L.tunic, sleeve: L.tunic, trouser: F.Col.shade(L.tunic, 0.8),
        hair: F.Col.shade(L.skin, 0.7),
      });
      // silhouette swaps
      if (L.head) { rig.sprite('helm', L.head); tints.helm = F.Col.tint(F.Col.shade(L.tunic, 1.25)); rig.hide('hair'); rig.hide('beard'); }
      if (L.body) { rig.sprite('chest', L.body); tints.chest = F.Col.tint(F.ENEMIES[this.type].col); }
      rig.sprite('weapon', null); rig.sprite('grip', null); rig.sprite('wglow', null); rig.sprite('offhand', null);
      if (L.weapon === 'club') { rig.sprite('weapon', 'en_club'); tints.weapon = F.Col.tint('#7a6a5a'); }
      else if (L.weapon === 'bow') { rig.sprite('weapon', 'en_bow'); tints.weapon = F.Col.tint('#6b5436'); }
      else if (L.weapon === 'staff') { rig.sprite('weapon', 'en_staff'); tints.weapon = F.Col.tint(F.ENEMIES[this.type].col); }
      else if (L.weapon === 'dagger') { rig.sprite('weapon', 'wpn_dagger'); rig.sprite('grip', 'grip_dagger'); tints.weapon = F.Col.tint('#b0b6c4'); }
      else if (L.weapon === 'maul') { rig.sprite('weapon', 'wpn_maul'); rig.sprite('grip', 'grip_maul'); tints.weapon = F.Col.tint('#8a90a0'); }

      const flip = Math.cos(this.aim) < 0;
      const dead = !this.alive;
      const sc2 = this.scale * (dead ? 1 : 1);
      rig.pose({ x: this.x, y: this.y, sx: (flip ? -1 : 1) * sc2, sy: sc2 });
      const alpha = dead ? Math.max(0, 1 - this.deadT * 1.4) : (L.ghost ? 0.82 : 1);
      if (alpha <= 0.02) return;
      F.Batch.push(F.Art.get('shadow'), this.x, this.y + 1, { sx: sc2 * 0.9, sy: sc2 * 0.75, height: 0, alpha });
      const tel = this.telegraph > 0;
      const opt = {
        tints, height: 1, alpha,
        emis: this.flash > 0 ? 2.4 * this.flash : (tel ? 1.6 : 1),
        tint: this.flash > 0.02 ? F.Col.tint('#ffffff') : (tel ? F.Col.tint('#ffb0a0') : undefined),
      };
      if (this.elite) rig.drawOutlined(opt, 1.1, '#2a0810'); else rig.drawOutlined(opt, 0.9);
      // elites wear a ring of their own light
      if (this.elite && this.alive)
        F.Render.light({ x: this.x, y: this.y - 14, r: 70, col: [1.0, 0.35, 0.25], intensity: 1.2, z: 14, shadow: 0, spec: 0.4 });
    }
  }

  F.Enemy = Enemy;
  F.makeEnemy = function (type, x, y, depth, elite, level) {
    return new Enemy(type, x, y, depth, elite, level);
  };

})(window.F2 = window.F2 || {});
