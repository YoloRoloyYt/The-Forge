'use strict';
// ---------------------------------------------------------------------------
// boss.js — the arena, the four-phase framework, and the seven move sets.
//
// One framework, seven bosses. A phase is a slice of the health bar with its
// own move pool, cadence and a short spectacle when it starts. That is enough
// structure for each fight to feel authored without seven bespoke bosses.
// ---------------------------------------------------------------------------
(function (F) {

  const TS = F.TS;

  // ------------------------------------------------------------ the arena
  F.genArena = function (bossId) {
    const B = F.BOSSES[bossId];
    const W = 38, H = 28;
    const lv = new F.Level(W, H, B.biome, 99);
    lv.name = B.n; lv.sub = B.sub; lv.noMap = true;
    lv.tiles.fill(F.T.WALL);
    const cx = W / 2, cy = H / 2;
    // a round chamber with a broken rim
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - cx) / (W / 2 - 3), dy = (y - cy) / (H / 2 - 3);
      const d = Math.sqrt(dx * dx + dy * dy);
      const wob = 1 + Math.sin(Math.atan2(dy, dx) * 5) * 0.045;
      if (d < wob) lv.tiles[y * W + x] = F.T.FLOOR;
    }
    // liquid rim, where the biome has one
    if (lv.B.liquid) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (lv.tiles[y * W + x] !== F.T.FLOOR) continue;
        const dx = (x - cx) / (W / 2 - 3), dy = (y - cy) / (H / 2 - 3);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.90) lv.tiles[y * W + x] = F.T.LIQUID;
      }
    }
    lv.spawn = { x: cx * TS, y: (cy + 6) * TS };
    lv.exits.push({ kind: 'leave', x: cx * TS, y: (H - 4) * TS, r: 28, label: 'Back to Emberhold' });
    // braziers around the rim
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * 6.2832 + 0.4;
      const x = cx * TS + Math.cos(a) * (W / 2 - 4.5) * TS;
      const y = cy * TS + Math.sin(a) * (H / 2 - 4.5) * TS;
      if (lv.t(Math.floor(x / TS), Math.floor(y / TS)) !== F.T.FLOOR) continue;
      lv.props.push({ kind: 'brazier', x, y, r: 8, solid: true, phase: Math.random() * 7 });
      // braziers stay firelight; the boss supplies its own colour
      lv.lights.push({ x, y: y - 16, r: 250, col: [1.0, 0.64, 0.30], i: 2.8, z: 30, flicker: 0.4, shadow: 1 });
    }
    // The stage itself. The braziers only reach the rim, so without this the
    // middle of the arena — where the whole fight happens — was unlit.
    lv.lights.push({ x: cx * TS, y: cy * TS, r: 700, col: F.Col.lin(F.Col.mix(B.col, '#ffffff', 0.55), 1), i: 1.45, z: 110, flicker: 0.08, shadow: 0 });
    lv.decals.push({ sprite: 'arena_sigil', x: cx * TS, y: cy * TS, rot: 0, alpha: 0.5,
      scale: (W - 7) * TS / 448, tint: F.Col.tint(F.Col.mix(B.glow, '#ffffff', 0.25)) });
    // Arenas are lit stages. A boss you cannot read is not a fight, it is a
    // guessing game, so the ambient here is several times the mine's.
    lv.arenaGrade = {
      ambient: lv.B.ambient.map(v => v * 2.1),
      ambientSky: lv.B.ambientSky.map(v => v * 2.1),
      vignette: 0.62, sat: 1.02,
    };
    lv.rollVariants(7000 + bossId.length);
    lv.placeGround(7000 + bossId.length);
    lv.placeRafts(7000 + bossId.length);
    lv.bossId = bossId;
    return lv;
  };

  // ------------------------------------------------------------- the boss
  class Boss {
    constructor(id, x, y) {
      const B = F.BOSSES[id];
      this.id = id; this.def = B;
      this.x = x; this.y = y; this.r = B.r;
      this.max = B.hp; this.hp = B.hp;
      this.level = B.lvl;
      this.alive = true; this.deadT = 0;
      this.rig = F.makeRig();
      this.seed = 3.1;
      this.aim = Math.PI / 2; this.facing = 'S';
      this.animT = 0; this.moveSpeed = 0;
      this.swingT = 0; this.swingDur = 0; this.swingDir = 1; this.windFrac = 0.5;
      this.hurtT = 0; this.flash = 0; this.stun = 0; this.chill = 0; this.burn = 0; this.burnT = 0;
      this.vulnerable = 1; this.armor = 0.12;
      this.phase = 0; this.phaseT = 0; this.intermission = 2.2;
      this.cool = 2.4;
      this.move = null; this.moveT = 0;
      this.telegraphs = [];       // { kind, x, y, r, a, len, t, max, col }
      this.adds = [];
      this.scale = B.r / 38;
      // The boss wears the same skeleton as everyone else, but its body sprite
      // is four times the size of a torso — so the joints have to move out to
      // match, or the head ends up buried inside the chest.
      const R = this.rig;
      // The body sprite puts its shoulders 82 units above the hips, so the neck
      // has to clear that or the head renders inside the chest.
      R.byName.hips.y = -60;
      R.byName.neck.y = -92;     // head origin lands just above the shoulders
      R.byName.helm.y = -46;     // the crown sits on the skull, overlapping it
      R.byName.armBU.x = -36; R.byName.armBU.y = -76;
      R.byName.armFU.x = 36;  R.byName.armFU.y = -76;
      R.byName.armBL.y = 38;  R.byName.armFL.y = 38;
      R.byName.handB.y = 36;  R.byName.handF.y = 36;
      R.byName.legBU.x = -16; R.byName.legFU.x = 16;
      R.byName.legBL.y = 30;  R.byName.legFL.y = 30;
      R.byName.footB.y = 28;  R.byName.footF.y = 28;
      this.headroom = 300 * this.scale;   // body + crown, so the camera never crops the horns   // how far the silhouette rises above its feet
      this.enrage = 1;
      this.noHit = true;
      this.tints = null;
    }

    phaseCount() { return 4; }
    phaseOf() {
      const f = this.hp / this.max;
      return f > 0.75 ? 0 : f > 0.5 ? 1 : f > 0.25 ? 2 : 3;
    }

    update(dt, sc) {
      if (!this.alive) { this.deadT += dt; this.pose(); return; }
      const p = sc.player;
      this.flash = Math.max(0, this.flash - dt * 6);
      this.hurtT = Math.max(0, this.hurtT - dt * 4);
      if (this.chill > 0) this.chill -= dt;
      if (this.burn > 0) {
        this.burn -= dt; this.burnT -= dt;
        if (this.burnT <= 0) { this.burnT = 0.5; this.hurt(this.max * 0.002 + this.burnDmg, sc, { dot: true }); }
      }
      if (this.stun > 0) { this.stun -= dt; this.moveSpeed = 0; this.pose(); return; }

      // phase change
      const ph = this.phaseOf();
      if (ph !== this.phase) {
        this.phase = ph;
        this.intermission = 2.0;
        this.enrage = 1 + ph * 0.22;
        this.onPhase(sc);
      }
      if (this.intermission > 0) {
        this.intermission -= dt;
        this.moveSpeed = 0;
        this.pose();
        return;
      }

      this.aim = Math.atan2(p.y - this.y, p.x - this.x);
      this.facing = Math.sin(this.aim) < -0.45 ? 'N' : 'S';

      // active move
      if (this.move) { this.runMove(dt, sc); this.pose(); return; }

      this.cool -= dt * this.enrage;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (this.cool <= 0) {
        const pool = this.def.moves;
        const pick = pool[Math.floor(Math.random() * Math.min(pool.length, 2 + this.phase))];
        this.startMove(pick, sc);
      } else {
        // reposition between moves
        const want = 110;
        let mx = 0, my = 0;
        if (d > want + 40) { mx = Math.cos(this.aim); my = Math.sin(this.aim); }
        else if (d < want - 50) { mx = -Math.cos(this.aim); my = -Math.sin(this.aim); }
        else { mx = -Math.sin(this.aim) * 0.6; my = Math.cos(this.aim) * 0.6; }
        const spd = this.def.spd * (this.chill > 0 ? 0.6 : 1) * this.enrage;
        F.moveEnt(sc.lv, this, mx * spd * dt, my * spd * dt);
        this.moveSpeed = 0.5;
      }
      this.animT = (this.animT + dt * (1 + this.moveSpeed)) % 1;
      this.pose();
    }

    onPhase(sc) {
      F.Audio.boss();
      F.Game.kick(6, 0.1);
      F.Game.flash(this.def.glow, 0.35, 0.4);
      F.Game.toast(['', 'It changes.', 'It stops pretending.', 'Last stand.'][this.phase] || '', this.def.glow, 3);
      F.Particles.burst(this.x, this.y - 30, 60, {
        sprite: 'blob', col: this.def.glow, col1: this.def.col2, size: 14, size1: 0,
        life: 1.0, speed0: 40, speed1: 340, emis: 3.2, light: 40, drag: 2.4,
      });
      sc.rings.push({ x: this.x, y: this.y, r: 20, r1: 320, t: 0.7, max: 0.7, col: this.def.glow });
      if (this.phase >= 2) this.summon(sc, 2);
    }

    startMove(kind, sc) {
      this.move = { kind, t: 0, phase: 0, fired: 0 };
      this.moveT = 0;
      const p = sc.player;
      const M = this.move;
      switch (kind) {
        case 'slam': case 'blinkstrike':
          M.tx = p.x; M.ty = p.y; M.wind = 0.95; M.dur = 1.7; M.rad = 110;
          if (kind === 'blinkstrike') { M.wind = 0.6; M.dur = 1.2; }
          this.telegraphs.push({ kind: 'circle', x: M.tx, y: M.ty, r: M.rad, t: M.wind, max: M.wind, col: this.def.glow });
          break;
        case 'sweep': case 'whirl':
          M.wind = 0.8; M.dur = 1.9; M.rad = kind === 'whirl' ? 170 : 140; M.a0 = this.aim - 1.2;
          this.telegraphs.push({ kind: 'arc', x: this.x, y: this.y, r: M.rad, a: this.aim, arc: kind === 'whirl' ? 6.28 : 2.4, t: M.wind, max: M.wind, col: this.def.glow });
          break;
        case 'thorns': case 'riftlines': case 'firewall': {
          M.wind = 1.0; M.dur = 2.1;
          M.lines = [];
          const n = kind === 'firewall' ? 3 : 5 + this.phase;
          const base = Math.atan2(p.y - this.y, p.x - this.x);
          for (let i = 0; i < n; i++) {
            const a = kind === 'firewall' ? base + (i - (n - 1) / 2) * 0.34 : base + (i / n) * 6.2832;
            M.lines.push(a);
            this.telegraphs.push({ kind: 'line', x: this.x, y: this.y, a, len: 420, t: M.wind, max: M.wind, col: this.def.glow });
          }
          break;
        }
        case 'summon':
          M.wind = 1.1; M.dur = 1.8;
          break;
        case 'shards': case 'bonestorm':
          M.wind = 0.7; M.dur = kind === 'bonestorm' ? 2.6 : 1.5; M.every = kind === 'bonestorm' ? 0.16 : 0.5;
          break;
        case 'meteor': case 'grave':
          M.wind = 0.4; M.dur = 3.0; M.every = 0.34; M.spots = [];
          break;
        case 'charge':
          M.wind = 0.9; M.dur = 2.0;
          M.a = this.aim;
          this.telegraphs.push({ kind: 'line', x: this.x, y: this.y, a: M.a, len: 520, t: M.wind, max: M.wind, col: this.def.glow, w: 2.2 });
          break;
        case 'beam':
          M.wind = 0.9; M.dur = 3.4; M.a = this.aim; M.spin = (Math.random() < 0.5 ? 1 : -1) * 0.5;
          this.telegraphs.push({ kind: 'line', x: this.x, y: this.y, a: M.a, len: 520, t: M.wind, max: M.wind, col: this.def.glow });
          break;
        case 'nova': case 'wave': case 'collapse':
          M.wind = 1.2; M.dur = 2.6; M.rings = 0;
          this.telegraphs.push({ kind: 'circle', x: this.x, y: this.y, r: 130, t: M.wind, max: M.wind, col: this.def.glow });
          break;
        case 'mirror':
          M.wind = 0.8; M.dur = 1.6;
          break;
        default:
          M.wind = 0.8; M.dur = 1.6; M.rad = 110; M.tx = p.x; M.ty = p.y;
          this.telegraphs.push({ kind: 'circle', x: M.tx, y: M.ty, r: M.rad, t: M.wind, max: M.wind, col: this.def.glow });
      }
      this.swingDur = M.dur; this.swingT = M.dur; this.windFrac = M.wind / M.dur;
      F.Audio.swing(1);
    }

    runMove(dt, sc) {
      const M = this.move;
      if (!M) return;
      const p = sc.player;
      M.t += dt * this.enrage;
      this.swingT = Math.max(0, M.dur - M.t);
      this.moveSpeed = 0;
      const justFired = M.t >= M.wind && M.fired === 0;

      switch (M.kind) {
        case 'slam': case 'blinkstrike': {
          if (M.kind === 'blinkstrike' && M.t > M.wind * 0.5 && !M.blinked) {
            M.blinked = true;
            const a = Math.random() * 6.2832;
            const nx = p.x + Math.cos(a) * 70, ny = p.y + Math.sin(a) * 70;
            if (!F.blocked(sc.lv, nx, ny, this.r)) { sc.blinkFx(this.x, this.y); this.x = nx; this.y = ny; sc.blinkFx(nx, ny); }
          }
          if (justFired) {
            M.fired = 1;
            this.impact(sc, M.tx, M.ty, M.rad, this.def.dmg * 1.2);
          }
          break;
        }
        case 'sweep': case 'whirl': {
          if (justFired) {
            M.fired = 1;
            const arc = M.kind === 'whirl' ? Math.PI : 1.2;
            const d = Math.hypot(p.x - this.x, p.y - this.y);
            const a = Math.atan2(p.y - this.y, p.x - this.x);
            if (d < M.rad && Math.abs(F.U.angDiff(a, this.aim)) < arc) sc.hitPlayer(this, this.def.dmg);
            sc.rings.push({ x: this.x, y: this.y, r: 20, r1: M.rad, t: 0.4, max: 0.4, col: this.def.glow });
            F.Game.kick(4, 0.05);
            F.Audio.boom();
            F.Particles.burst(this.x, this.y - 10, 30, {
              sprite: 'blob', col: this.def.glow, size: 9, size1: 0, life: 0.5,
              speed0: 80, speed1: 340, emis: 2.8, light: 30, drag: 3,
            });
          }
          break;
        }
        case 'thorns': case 'riftlines': case 'firewall': {
          if (justFired) {
            M.fired = 1;
            for (const a of M.lines) {
              for (let i = 1; i < 14; i++) {
                const x = this.x + Math.cos(a) * i * 32, y = this.y + Math.sin(a) * i * 32;
                if (sc.lv.solidPx(x, y)) break;
                sc.hazards.push({ x, y, r: 26, t: 0.9, max: 0.9, dmg: this.def.dmg * 0.7, col: this.def.glow, delay: i * 0.035 });
              }
            }
            F.Audio.boom();
            F.Game.kick(3.4);
          }
          break;
        }
        case 'summon': {
          if (justFired) { M.fired = 1; this.summon(sc, 2 + this.phase); }
          break;
        }
        case 'shards': case 'bonestorm': {
          if (M.t >= M.wind) {
            M.next = (M.next || 0) - dt;
            if (M.next <= 0) {
              M.next = M.every;
              const n = M.kind === 'bonestorm' ? 4 : 10 + this.phase * 3;
              const base = M.kind === 'bonestorm' ? Math.atan2(p.y - this.y, p.x - this.x) : Math.random() * 6.2832;
              for (let i = 0; i < n; i++) {
                const a = M.kind === 'bonestorm' ? base + (Math.random() - 0.5) * 0.9 : base + i / n * 6.2832;
                sc.spawnProjectile({
                  x: this.x, y: this.y - 20, a, speed: 190 + this.phase * 22, dmg: this.def.dmg * 0.55,
                  sprite: 'bolt', col: this.def.glow, life: 2.6, from: this, emis: 3.0, light: 44, r: 8,
                });
              }
              F.Audio.swing(0.5);
            }
          }
          break;
        }
        case 'meteor': case 'grave': {
          if (M.t >= M.wind) {
            M.next = (M.next || 0) - dt;
            if (M.next <= 0) {
              M.next = M.every;
              const a = Math.random() * 6.2832, rr = Math.random() * 190;
              const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
              this.telegraphs.push({ kind: 'circle', x, y, r: 64, t: 0.8, max: 0.8, col: this.def.glow,
                then: () => this.impact(sc, x, y, 66, this.def.dmg * 0.8) });
            }
          }
          break;
        }
        case 'charge': {
          if (M.t >= M.wind) {
            const spd = 560;
            const before = { x: this.x, y: this.y };
            F.moveEnt(sc.lv, this, Math.cos(M.a) * spd * dt, Math.sin(M.a) * spd * dt);
            this.moveSpeed = 1;
            if (Math.hypot(this.x - before.x, this.y - before.y) < 0.4 && !M.hitWall) {
              M.hitWall = true;
              this.stun = 2.2;
              F.Game.kick(6, 0.08);
              F.Audio.boom();
              sc.rings.push({ x: this.x, y: this.y, r: 10, r1: 150, t: 0.4, max: 0.4, col: this.def.glow });
            }
            if (Math.hypot(p.x - this.x, p.y - this.y) < this.r + p.r + 6) sc.hitPlayer(this, this.def.dmg * 1.1);
            F.Particles.burst(this.x, this.y, 2, {
              sprite: 'dust', col: sc.lv.B.dust, size: 10, size1: 22, life: 0.5,
              speed0: 4, speed1: 40, emis: 0, alpha: 0.4, drag: 3,
            });
          }
          break;
        }
        case 'beam': {
          if (M.t >= M.wind) {
            M.a += M.spin * dt;
            const x1 = this.x + Math.cos(M.a) * 520, y1 = this.y + Math.sin(M.a) * 520;
            sc.beams.push({ x0: this.x, y0: this.y - 20, x1, y1, t: 0.06, max: 0.06, col: this.def.glow, thick: 2.6 });
            // damage anything along the line
            const dx = p.x - this.x, dy = p.y - this.y;
            const proj = dx * Math.cos(M.a) + dy * Math.sin(M.a);
            if (proj > 0) {
              const px = this.x + Math.cos(M.a) * proj, py = this.y + Math.sin(M.a) * proj;
              if (Math.hypot(p.x - px, p.y - py) < 22) {
                M.beamCd = (M.beamCd || 0) - dt;
                if (M.beamCd <= 0) { M.beamCd = 0.5; sc.hitPlayer(this, this.def.dmg * 0.55, true); }
              }
            }
          }
          break;
        }
        case 'nova': case 'wave': case 'collapse': {
          if (M.t >= M.wind) {
            M.next = (M.next || 0) - dt;
            if (M.next <= 0 && M.rings < 3 + this.phase) {
              M.next = 0.42; M.rings++;
              const rad = 90 + M.rings * 78;
              sc.rings.push({ x: this.x, y: this.y, r: rad - 60, r1: rad, t: 0.34, max: 0.34, col: this.def.glow });
              const d = Math.hypot(p.x - this.x, p.y - this.y);
              if (Math.abs(d - rad) < 34) sc.hitPlayer(this, this.def.dmg * 0.75);
              F.Audio.boom();
              F.Game.kick(2.6);
            }
          }
          break;
        }
        case 'mirror': {
          if (justFired) {
            M.fired = 1;
            for (let i = 0; i < 2 + this.phase; i++) {
              const a = Math.random() * 6.2832;
              sc.spawnProjectile({
                x: this.x + Math.cos(a) * 40, y: this.y + Math.sin(a) * 40,
                a: Math.atan2(p.y - this.y, p.x - this.x) + (Math.random() - 0.5) * 0.5,
                speed: 210, dmg: this.def.dmg * 0.6, sprite: 'shard', col: this.def.glow,
                life: 3, from: this, emis: 3, light: 40, r: 9, spin: 8,
              });
            }
          }
          break;
        }
      }

      if (M.t >= M.dur) {
        this.move = null;
        this.swingT = 0;
        this.cool = F.U.rnd(1.1, 2.1) / this.enrage;
      }
    }

    impact(sc, x, y, rad, dmg) {
      F.Audio.boom();
      F.Game.kick(5.5, 0.07);
      sc.rings.push({ x, y, r: 16, r1: rad, t: 0.4, max: 0.4, col: this.def.glow });
      F.Particles.burst(x, y, 40, {
        sprite: 'blob', col: this.def.glow, col1: this.def.col2, size: 12, size1: 0,
        life: 0.7, speed0: 50, speed1: 380, emis: 3.2, light: 44, drag: 2.8,
      });
      sc.lv.decals.push({ sprite: 'crackdecal', x, y, rot: Math.random() * 7, alpha: 0.6, scale: rad / 32, tint: 0xff000000 });
      const p = sc.player;
      if (Math.hypot(p.x - x, p.y - y) < rad + p.r) sc.hitPlayer(this, dmg);
    }

    summon(sc, n) {
      const D = F.DEPTHS[Math.min(7, Math.max(0, this.def.after - 1))];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.2832, rr = 70 + Math.random() * 90;
        const x = this.x + Math.cos(a) * rr, y = this.y + Math.sin(a) * rr;
        if (F.blocked(sc.lv, x, y, 12)) continue;
        const e = F.makeEnemy(F.U.pick(D.mobs), x, y, this.def.after, false, this.def.lvl);
        sc.lv.enemies.push(e);
        sc.blinkFx(x, y);
      }
      F.Audio.boss();
    }

    hurt(raw, sc, opt) {
      if (!this.alive) return 0;
      opt = opt || {};
      let d = raw * (1 - this.armor * (opt.pierce ? 0.4 : 1)) * this.vulnerable;
      d = Math.max(1, Math.round(d));
      this.hp -= d;
      this.flash = 1; this.hurtT = 1;
      if (!opt.dot) {
        F.Game.floater(this.x + F.U.rnd(-14, 14), this.y - this.r - 18, '' + d,
          opt.crit ? '#ffd23f' : '#ffffff', { size: opt.crit ? 1.3 : 1.0, crit: opt.crit });
        F.Audio.hit(opt.crit);
        F.Particles.burst(this.x, this.y - this.r * 0.5, opt.crit ? 16 : 9, {
          sprite: 'spark', col: '#ffd9a0', col1: this.def.col, size: 3.6, size1: 0,
          life: 0.4, speed0: 50, speed1: 220, emis: 3.0, drag: 5, dir: opt.angle, spread: 1.7,
        });
      }
      if (this.hp <= 0) this.die(sc);
      return d;
    }
    ignite(dmg, dur) { this.burn = Math.max(this.burn, dur || 5); this.burnDmg = dmg || 0; }

    die(sc) {
      this.alive = false; this.deadT = 0; this.hp = 0;
      const s = F.Game.s;
      s.bossesDown[this.id] = 1;
      s.spins = (s.spins || 0) + 2;
      F.Game.addXp(this.def.xp);
      F.Game.addGold(F.U.ri(this.def.gold[0], this.def.gold[1]));
      if (this.noHit) s.flagNoHitBoss = 1;
      F.Quests.onEvent(s, 'boss', { id: this.id });
      F.Achieve.check(s);
      F.Game.save();
      F.Audio.levelUp();
      F.Game.kick(9, 0.2);
      F.Game.flash('#ffffff', 0.7, 0.8);
      for (let k = 0; k < 4; k++) setTimeout(() => {
        F.Particles.burst(this.x + F.U.rnd(-40, 40), this.y - F.U.rnd(0, 60), 44, {
          sprite: 'blob', col: this.def.glow, col1: this.def.col2, size: 16, size1: 0,
          life: 1.2, speed0: 40, speed1: 340, emis: 3.4, light: 50, drag: 2.2,
        });
        F.Audio.boom();
      }, k * 260);
      if (sc.onBossDead) sc.onBossDead(this);
    }

    pose() {
      F.poseActor(this.rig, {
        moveSpeed: this.moveSpeed, animT: this.animT, aim: this.aim, aimLocal: -0.3,
        facing: this.facing, holding: false, seed: this.seed,
        swingT: this.swingT, swingDur: this.swingDur, swingDir: this.swingDir, windFrac: this.windFrac,
        mineT: 0, hurtT: this.hurtT, dashT: 0, deadT: this.alive ? 0 : Math.min(1, this.deadT * 0.8),
      }, F.Game.time);
    }

    draw(sc) {
      const rig = this.rig, D = this.def, id = this.id;
      if (!F.Art.has('bs_body_' + id)) {
        // loud rather than invisible: a boss with no art is a bug, not a style
        if (!this._warned) { this._warned = 1; console.error('no boss art for "' + id + '"'); }
      }
      if (!this.tints) {
        // a value ramp: the mass is darkest, the limbs step up, the crown and
        // the eyes carry the accent. One flat hue over every bone reads as soup.
        this.tints = {};
        const body = F.Col.tint(F.Col.mix(D.col2, D.col, 0.34));
        const mid = F.Col.tint(F.Col.mix(D.col2, D.col, 0.72));
        const hi = F.Col.tint(F.Col.mix(D.col, '#ffffff', 0.10));
        const acc = F.Col.tint(D.glow);
        this.tints.torso = body;
        this.tints.armBU = this.tints.legBU = F.Col.tint(F.Col.mix(D.col2, D.col, 0.18));
        this.tints.armFU = this.tints.legFU = mid;
        this.tints.armBL = this.tints.legBL = mid;
        this.tints.armFL = this.tints.legFL = hi;
        this.tints.handB = this.tints.handF = hi;
        this.tints.head = mid;
        this.tints.helm = acc;
        this.tints.hair = acc;
        this.tints.chest = acc;
      }
      rig.sprite('torso', 'bs_body_' + id);
      rig.sprite('chest', 'bs_core_' + id);
      rig.sprite('head', 'bs_head_' + id);
      rig.sprite('helm', 'bs_crown_' + id);
      rig.sprite('hair', 'bs_eyes_' + id); rig.sprite('beard', null);
      rig.byName.hair.x = 0; rig.byName.hair.y = 0;
      rig.byName.hair.ax = undefined; rig.byName.hair.ay = undefined;
      rig.sprite('armBU', 'bs_armU_' + id); rig.sprite('armBL', 'bs_armL_' + id);
      rig.sprite('armFU', 'bs_armU_' + id); rig.sprite('armFL', 'bs_armL_' + id);
      rig.sprite('handB', 'bs_fist_' + id); rig.sprite('handF', 'bs_fist_' + id);
      rig.sprite('legBU', 'bs_legU_' + id); rig.sprite('legBL', 'bs_legL_' + id);
      rig.sprite('legFU', 'bs_legU_' + id); rig.sprite('legFL', 'bs_legL_' + id);
      rig.sprite('footB', null); rig.sprite('footF', null);
      rig.sprite('weapon', null); rig.sprite('grip', null); rig.sprite('wglow', null); rig.sprite('offhand', null);
      rig.sprite('greaveB', null); rig.sprite('greaveF', null);
      rig.sprite('bootB', null); rig.sprite('bootF', null);
      rig.sprite('pauldB', null); rig.sprite('pauldF', null);

      const flip = Math.cos(this.aim) < 0;
      const sc2 = this.scale * (this.alive ? 1 : Math.max(0.2, 1 - this.deadT * 0.25));
      rig.pose({ x: this.x, y: this.y, sx: (flip ? -1 : 1) * sc2, sy: sc2 });
      const alpha = this.alive ? 1 : Math.max(0, 1 - this.deadT * 0.5);
      F.Batch.push(F.Art.get('shadow'), this.x, this.y + 2, { sx: sc2 * 2.4, sy: sc2 * 1.6, height: 0, alpha });
      const tel = this.move && this.move.t < this.move.wind;
      rig.drawOutlined({
        tints: this.tints, height: 1, alpha,
        emis: this.flash > 0 ? 3.0 * this.flash : (tel ? 1.9 : 1.15),
        tint: this.flash > 0.02 ? F.Col.tint('#ffffff') : undefined,
      }, 2.0, '#080410');
      // its own glow, plus a key light so the silhouette always reads
      F.Render.light({ x: this.x, y: this.y - this.headroom * 0.5, r: 190 + (tel ? 110 : 0),
        col: F.Col.lin(D.glow, 1), intensity: 1.6 + (tel ? 1.8 : 0) + this.flash * 2.5, z: 40, shadow: 0, spec: 0.7 });
      // a neutral key from above keeps the form readable without staining the
      // whole arena the boss's colour
      F.Render.light({ x: this.x, y: this.y - this.headroom * 0.9, r: 260,
        col: [1.0, 0.97, 0.94], intensity: 1.5, z: 120, shadow: 0, spec: 0.9 });
    }
  }
  F.Boss = Boss;

  // ------------------------------------------------------------ the fight
  class BossScene extends F.WorldScene {
    constructor(bossId) {
      super(F.genArena(bossId), {});
      this.bossId = bossId;
      this.hazards = [];
      this.won = false; this.winT = 0;
    }
    enter() {
      super.enter();
      if (this.lv.arenaGrade) F.Render.grade(this.lv.arenaGrade);
      const B = F.BOSSES[this.bossId];
      this.boss = new F.Boss(this.bossId, this.lv.w * TS / 2, this.lv.h * TS / 2 - 20);
      this.lv.decals = this.lv.decals || [];
      this.introT = 3.4;
      // open looking at the thing, then drift back to the player
      this.camX = this.boss.x; this.camY = this.boss.y - this.boss.headroom * 0.5;
      this.applyCam();
      this.camLockT = 2.0;
      F.Audio.boss();
      F.Game.toast(B.intro, B.glow, 5);
      this.bossBar = { name: B.n, sub: B.sub, hp: B.hp, max: B.hp, phases: 4, shield: 0 };
    }
    /**
     * Arena camera: frames the player and the boss together rather than
     * following the player, so you can always see what is winding up.
     */
    updateCamera(dt) {
      const b = this.boss, p = this.player;
      if (!b) { super.updateCamera(dt); return; }
      if (this.camLockT > 0) {
        this.camLockT -= dt;
        const t = F.U.sat(1 - this.camLockT / 2.0);
        this.camX = F.U.lerp(b.x, p.x, F.U.ease.inOutSine(t));
        this.camY = F.U.lerp(b.y - b.headroom * 0.5, p.y, F.U.ease.inOutSine(t));
        this.applyCam();
        return;
      }
      // weight toward the player, but never let the boss fall off the edge
      // the boss's visual centre is well above its feet
      const bcy = b.y - b.headroom * 0.5;
      let tx = p.x * 0.60 + b.x * 0.40;
      let ty = p.y * 0.60 + bcy * 0.40;
      if (b.alive) {
        const halfW = F.VW / 2 - 110, halfH = F.VH / 2 - 128;
        tx = F.U.clamp(tx, b.x - halfW, b.x + halfW);
        ty = F.U.clamp(ty, bcy - halfH, bcy + halfH);
      }
      this.camX = F.U.damp(this.camX, tx, 6, dt);
      this.camY = F.U.damp(this.camY, ty, 6, dt);
      this.applyCam();
    }
    update(dt) {
      super.update(dt);
      const b = this.boss;
      if (b) {
        b.update(dt, this);
        this.bossBar.hp = Math.max(0, b.hp);
        // the player's swings need to find the boss too
        for (let i = this.boss.telegraphs.length - 1; i >= 0; i--) {
          const t = this.boss.telegraphs[i];
          t.t -= dt;
          if (t.t <= 0) { if (t.then) t.then(); this.boss.telegraphs.splice(i, 1); }
        }
      }
      for (let i = this.hazards.length - 1; i >= 0; i--) {
        const h = this.hazards[i];
        if (h.delay > 0) { h.delay -= dt; continue; }
        h.t -= dt;
        if (h.t <= 0) { this.hazards.splice(i, 1); continue; }
        if (!h.hit && Math.hypot(this.player.x - h.x, this.player.y - h.y) < h.r) {
          h.hit = true;
          this.hitPlayer(this.boss, h.dmg);
        }
      }
      if (this.won) {
        this.winT += dt;
        if (this.winT > 3.6 && !this.pushed) { this.pushed = true; F.Game.push(new BossWinScene(this)); }
      }
    }
    /** Player attacks reach the boss as well as the adds. */
    hitEnemy(e, dmg, o) { super.hitEnemy(e, dmg, o); }
    onBossDead() { this.won = true; this.winT = 0; }
    onPlayerDead() {
      setTimeout(() => { if (F.Game.top() === this) F.Game.push(new F.DeathScene(this)); }, 1200);
    }
    doInteract(it) {
      if (it.kind === 'exit' && it.ex.kind === 'leave') { F.Game.replace(new F.HubScene()); return; }
      super.doInteract(it);
    }
    draw() {
      const b = this.boss;
      // fold the boss into the y-sorted pass
      this.opt.drawExtra = (sc, sorted) => {
        if (b && (b.alive || b.deadT < 2.4)) sorted.push({ y: b.y, draw: () => b.draw(sc) });
      };
      super.draw();
    }
    drawFx() {
      super.drawFx();
      const A = F.Art, Bt = F.Batch, b = this.boss;
      if (b) for (const t of b.telegraphs) {
        const k = 1 - t.t / t.max;
        const pulse = 0.35 + 0.45 * k + Math.sin(this.time * 18) * 0.08;
        if (t.kind === 'circle') {
          Bt.push(A.get('telegraph'), t.x, t.y, { scale: t.r / 60, alpha: pulse * 0.55, tint: F.Col.tint(t.col), emis: 2.4, height: 0 });
          Bt.push(A.get('ring'), t.x, t.y, { scale: (t.r * k) / 22, alpha: 0.8, tint: F.Col.tint('#ffffff'), emis: 3, height: 0 });
        } else if (t.kind === 'line') {
          Bt.push(A.get('warnline'), t.x, t.y, {
            ax: 0, ay: 12, rot: t.a, sx: t.len / 128, sy: (t.w || 1.4),
            alpha: pulse * 0.7, tint: F.Col.tint(t.col), emis: 2.6, height: 0,
          });
        } else if (t.kind === 'arc') {
          Bt.push(A.get('slash'), t.x, t.y, { rot: t.a, scale: t.r / 30, alpha: pulse * 0.5, tint: F.Col.tint(t.col), emis: 2.4, height: 0 });
        }
      }
      for (const h of this.hazards) {
        if (h.delay > 0) continue;
        const k = h.t / h.max;
        Bt.push(A.get('blob'), h.x, h.y, { scale: h.r / 14 * (0.6 + k * 0.5), alpha: k * 0.9, tint: F.Col.tint(h.col), emis: 3.2, height: 0 });
        F.Render.light({ x: h.x, y: h.y, r: h.r * 2.4, col: F.Col.lin(h.col, 1), intensity: 2.2 * k, z: 10, shadow: 0, spec: 0.4 });
      }
    }
  }
  F.BossScene = BossScene;

  // --------------------------------------------------------------- reward
  class BossWinScene {
    constructor(w) { this.w = w; this.t = 0; }
    update(dt) { this.t += dt; }
    draw() {
      const U = F.UI, g = U.g, P = F.PAL, B = F.BOSSES[this.w.bossId];
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      const a = F.U.sat(this.t * 0.7);
      g.fillStyle = 'rgba(4,3,7,' + (a * 0.85) + ')'; g.fillRect(0, 0, U.W, U.H);
      U.text('SLAIN', U.W / 2, 210, {
        size: 84, weight: '700', display: true, align: 'center',
        col: B.glow, glow: B.glow, glowBlur: 40, alpha: a,
      });
      U.text(B.n, U.W / 2, 258, { size: 24, weight: '600', display: true, align: 'center', col: P.text, alpha: a });
      const rows = [
        ['Experience', F.U.fmt(B.xp), P.xp],
        ['Gold', F.U.fmt(Math.round((B.gold[0] + B.gold[1]) / 2)), P.gold],
        ['Shrine spins', '2', P.magic],
      ];
      let yy = 330;
      for (const [n, v, c] of rows) {
        U.text(n, U.W / 2 - 160, yy, { size: 17, col: P.textDim, alpha: a });
        U.text(v, U.W / 2 + 160, yy, { size: 18, weight: '700', align: 'right', col: c, alpha: a });
        yy += 34;
      }
      const nextDepth = F.DEPTHS.find(d => d.boss === this.w.bossId);
      if (nextDepth) U.text('The way to ' + nextDepth.name + ' is open.', U.W / 2, yy + 24,
        { size: 17, align: 'center', col: P.brassHi, alpha: a });
      if (this.t > 1.2 && U.btn(U.W / 2 - 150, 520, 300, 56, 'BACK TO EMBERHOLD', { primary: true, display: true })) {
        F.Game.pop();
        F.Game.replace(new F.HubScene());
      }
      U.end();
    }
  }
  F.BossWinScene = BossWinScene;

  // ------------------------------------------------------------ the gate
  class BossGateScene {
    constructor() { this.sel = 0; }
    update(dt) { if (F.Input.hit('escape')) F.Game.pop(); }
    draw() {
      const U = F.UI, g = U.g, P = F.PAL, s = F.Game.s;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      g.fillStyle = 'rgba(4,3,7,0.88)'; g.fillRect(0, 0, U.W, U.H);
      const w = 980, h = 680, x = (U.W - w) / 2, y = (U.H - h) / 2;
      U.panel(x, y, w, h, { title: 'The Deep Gate' });
      const power = F.Game.power();
      U.text('Your power: ' + F.U.fmt(power), x + w / 2, y + 62, { size: 15, align: 'center', col: P.brassHi });
      U.text('The gate will open for any of them. It does not check whether you are ready.',
        x + w / 2, y + 84, { size: 12.5, align: 'center', col: P.textDim });
      let yy = y + 104;
      for (const id of F.BOSS_ORDER) {
        const B = F.BOSSES[id];
        const down = !!s.bossesDown[id];
        const open = F.Game.bossUnlocked(id);
        const rh = 74;
        const over = U.row(x + 26, yy, w - 52, rh - 6, { key: 'b' + id });
        g.save();
        g.shadowColor = B.glow; g.shadowBlur = down ? 6 : open ? 18 : 0;
        g.fillStyle = down ? '#3a3440' : open ? B.col : '#241f2c';
        g.beginPath(); g.arc(x + 62, yy + 34, 17, 0, 7); g.fill();
        g.restore();
        U.text(B.n, x + 94, yy + 28, { size: 18, weight: '600', display: true, col: down ? P.textDim : open ? P.text : P.textFaint });
        U.text(down ? 'dead' : B.sub, x + 94, yy + 48, { size: 12.5, col: down ? P.good : P.textDim });
        const ratio = power / B.power;
        const col = ratio > 1.15 ? P.good : ratio > 0.8 ? P.warn : P.bad;
        U.text('recommended ' + F.U.fmt(B.power), x + w - 240, yy + 28, { size: 12.5, align: 'right', col: P.textDim });
        if (!down) U.text(ratio > 1.15 ? 'you are ready' : ratio > 0.8 ? 'it will be close' : 'you will die',
          x + w - 240, yy + 48, { size: 12.5, align: 'right', col });
        if (!down && open && U.btn(x + w - 210, yy + 14, 160, 44, 'ENTER', { primary: ratio > 0.8, display: true })) {
          F.Game.pop();
          F.Game.replace(new BossScene(id));
        }
        if (!open && !down) U.text('locked', x + w - 130, yy + 40, { size: 13, align: 'center', col: P.textFaint });
        yy += rh;
      }
      if (U.btn(x + w / 2 - 80, y + h - 58, 160, 44, 'BACK', {})) F.Game.pop();
      U.end();
    }
  }
  F.BossGateScene = BossGateScene;

})(window.F2 = window.F2 || {});
