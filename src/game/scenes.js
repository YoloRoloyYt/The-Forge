'use strict';
// ---------------------------------------------------------------------------
// scenes.js — the flow between places: title, hub, mines, death, pause, map.
// ---------------------------------------------------------------------------
(function (F) {

  // =========================================================== title screen
  class TitleScene {
    constructor() {
      this.t = 0;
      // the menu sits over Emberhold's Great Forge — the fire the game is named
      // for, and the only place in the world that is genuinely beautiful at rest
      this.lv = F.genHub();
      this.cam = { x: 0, y: 0, vw: F.VW, vh: F.VH };
      this.camA = Math.random() * 6.28;
      this.hasSave = F.Save.has();
      this.sel = 0;
      this.fade = 0;
      this.going = null;
    }
    enter() {
      F.Render.setOcclusion(this.lv.occlusion(), this.lv.w, this.lv.h, F.TS);
      const B = this.lv.B;
      F.Render.grade(Object.assign({ ambient: B.ambient, ambientSky: B.ambientSky }, B.grade));
      F.Render.vignette = 0.82;
      const drum = this.lv.props.find(p => p.kind === 'forgedrum');
      this.fx = drum ? drum.x : this.lv.spawn.x;
      this.fy = drum ? drum.y : this.lv.spawn.y;
      this.cx = this.fx - 118; this.cy = this.fy - 46;
    }
    exit() { F.Render.clearOcclusion(); F.Render.vignette = 0.5; }
    update(dt) {
      this.t += dt;
      // a slow orbit of the forge, so the light moves across the stone
      // a tight orbit, offset so the forge sits in the right half of the frame
      // and the wordmark and menu get the left half to themselves
      const a = this.t * 0.075 + this.camA;
      this.cx = this.fx - 118 + Math.cos(a) * 34;
      this.cy = this.fy - 46 + Math.sin(a * 1.3) * 20;
      this.cam.vw = F.VW; this.cam.vh = F.VH;
      this.cam.x = F.U.clamp(this.cx - F.VW / 2, 0, this.lv.w * F.TS - F.VW);
      this.cam.y = F.U.clamp(this.cy - F.VH / 2, 0, this.lv.h * F.TS - F.VH);
      F.Particles.update(dt, this.lv);
      // embers off the forge, and dust in the hall
      if (Math.random() < 0.85) {
        const ea = Math.random() * 6.2832, er = Math.random() * 54;
        F.Particles.spawn({
          x: this.fx + Math.cos(ea) * er, y: this.fy - 30 + Math.sin(ea) * er * 0.5,
          vx: F.U.rnd(-9, 9), vy: F.U.rnd(-34, -12), life: F.U.rnd(1.6, 3.4),
          sprite: 'spark', col: '#ffbe5a', col1: '#6a1a00', size: 2.6, size1: 0,
          emis: 2.8, drag: 0.5, light: 0,
        });
      }
      if (Math.random() < 0.4) {
        F.Particles.spawn({
          x: this.cam.x + Math.random() * this.cam.vw, y: this.cam.y + Math.random() * this.cam.vh,
          vx: F.U.rnd(-4, 4), vy: F.U.rnd(-6, 1), life: F.U.rnd(2, 5),
          sprite: 'dust', col: this.lv.B.dust, size: 2.4, size1: 1, alpha: 0.22, emis: 0, drag: 0.3,
        });
      }
      if (this.going) {
        this.fade = Math.min(1, this.fade + dt * 1.8);
        F.Render.fade = 1 - this.fade;
        if (this.fade >= 1) { const g = this.going; this.going = null; F.Render.fade = 1; g(); }
      }
    }
    start(load) {
      F.Audio.resume();
      this.going = () => {
        if (load) { if (!F.Game.load()) F.Game.newRun(); }
        else F.Game.newRun();
        F.Game.replace(new F.HubScene());
      };
    }
    draw() {
      const t = this.t;
      F.Render.time = t;
      F.Render.beginFrame(this.cam);
      const sorted = [];
      F.drawTerrain(this.lv, this.cam, sorted, t);
      F.drawProps(this.lv, this.cam, sorted, t);
      F.drawNodes(this.lv, this.cam, sorted, t);
      if (this.lv.npcs && this.lv.npcs.length) F.drawNpcs(this.lv, this.cam, sorted, t);
      F.drawSorted(sorted);
      F.Particles.draw(this.cam, t);
      for (const L of this.lv.lights) {
        if (L.x < this.cam.x - 300 || L.x > this.cam.x + this.cam.vw + 300) continue;
        const fl = L.flicker ? 1 + Math.sin(t * 9 + L.x) * L.flicker * 0.3 : 1;
        F.Render.light({ x: L.x, y: L.y, r: L.r, col: L.col, intensity: L.i * fl, z: L.z, shadow: L.shadow, spec: 1 });
      }
      F.Render.light({ x: this.fx, y: this.fy - 20, r: 420, col: [1.0, 0.54, 0.22], intensity: 3.4, z: 44, flicker: 0.2, shadow: 0.4, spec: 1 });
      F.Render.endFrame();
      this.drawUI();
    }
    drawUI() {
      const U = F.UI, g = U.g, P = F.PAL;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);

      // a soft scrim over the left half only, so the forge keeps its light
      const grad = g.createLinearGradient(0, 0, U.W * 0.78, 0);
      grad.addColorStop(0, 'rgba(6,4,10,0.90)');
      grad.addColorStop(0.55, 'rgba(6,4,10,0.72)');
      grad.addColorStop(1, 'rgba(6,4,10,0.0)');
      g.fillStyle = grad; g.fillRect(0, 0, U.W, U.H);
      const vg = g.createLinearGradient(0, 0, 0, U.H);
      vg.addColorStop(0, 'rgba(6,4,10,0.55)');
      vg.addColorStop(0.35, 'rgba(6,4,10,0.0)');
      vg.addColorStop(1, 'rgba(6,4,10,0.72)');
      g.fillStyle = vg; g.fillRect(0, 0, U.W, U.H);

      const x0 = 132;
      const b = 0.5 + 0.5 * Math.sin(this.t * 1.1);
      const w1 = U.width('THE FORGE', 96, '700', true);
      const w2 = U.width('II', 78, '700', true);
      const gap = 26;

      U.text('THE FORGE', x0, 214, {
        size: 96, weight: '700', display: true,
        col: '#f6dda0', glow: 'rgba(255,150,50,' + (0.42 + b * 0.22) + ')', glowBlur: 46, shadowD: 4, shadowA: 0.9,
      });
      U.text('II', x0 + w1 + gap, 212, {
        size: 78, weight: '700', display: true,
        col: '#ff9a3c', glow: 'rgba(255,110,30,' + (0.55 + b * 0.25) + ')', glowBlur: 36, shadowD: 3,
      });
      g.strokeStyle = 'rgba(255,154,60,0.45)'; g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x0 + w1 + gap - 11, 154); g.lineTo(x0 + w1 + gap - 11, 220);
      g.moveTo(x0 + w1 + gap + w2 + 11, 154); g.lineTo(x0 + w1 + gap + w2 + 11, 220);
      g.stroke();

      const wTot = w1 + gap + w2;
      const rg = g.createLinearGradient(x0, 0, x0 + wTot, 0);
      rg.addColorStop(0, 'rgba(199,154,78,0.85)');
      rg.addColorStop(1, 'rgba(199,154,78,0)');
      g.fillStyle = rg; g.fillRect(x0, 240, wTot, 1.5);

      U.text('"As a child, I yearned for the mines."', x0, 286, {
        size: 25, weight: '500', display: true, col: '#d3c6b6', alpha: 0.96,
      });

      const bw = 300, bh = 54;
      let by = 372;
      if (this.hasSave) {
        if (U.btn(x0, by, bw, bh, 'CONTINUE', { primary: true, display: true, size: 20 })) this.start(true);
        by += bh + 13;
      }
      if (U.btn(x0, by, bw, bh, this.hasSave ? 'NEW RUN' : 'BEGIN', { primary: !this.hasSave, display: true, size: 20 })) {
        if (this.hasSave) F.Game.push(new F.ConfirmScene('Start a new run?', 'Your current progress will be lost for good.', () => { F.Save.wipe(); this.start(false); }));
        else this.start(false);
      }
      by += bh + 13;
      if (U.btn(x0, by, bw, bh, 'SETTINGS', { display: true, size: 20 })) F.Game.push(new F.SettingsScene());
      by += bh + 13;
      if (U.btn(x0, by, bw, bh, 'HOW TO PLAY', { display: true, size: 20 })) F.Game.push(new F.HelpScene());

      U.text('Mine. Forge. Descend.', x0, U.H - 76, { size: 17, weight: '600', display: true, col: P.brass, alpha: 0.9 });
      U.text('Repeat until the rock gives up something worth keeping.', x0, U.H - 50,
        { size: 14, col: P.textFaint });
      U.end();
    }
  }
  F.TitleScene = TitleScene;

  // ================================================================= the hub
  class HubScene extends F.WorldScene {
    constructor() {
      super(F.genHub(), {});
      this.isHub = true;
    }
    enter() {
      super.enter();
      F.Game.save();
      this.player.x = this.lv.spawn.x; this.player.y = this.lv.spawn.y;
      this.snapCamera();
      F.Game.s.hp = F.Game.maxHp();
      this.introT = 2.2;
    }
    doInteract(it) {
      if (it.kind === 'exit') {
        if (it.ex.kind === 'mine') { F.Game.push(new F.DepthScene()); return; }
        if (it.ex.kind === 'forge') { F.Game.push(new F.ForgeScene()); return; }
        if (it.ex.kind === 'bossgate') { F.Game.push(new F.BossGateScene()); return; }
      }
      super.doInteract(it);
    }
  }
  F.HubScene = HubScene;

  // ================================================================== mines
  class MineScene extends F.WorldScene {
    constructor(depth) {
      super(F.genMine(depth), {});
      this.depth = depth;
      this.bannerT = 0;
    }
    enter() {
      super.enter();
      const s = F.Game.s;
      s.depth = this.depth;
      if (this.depth > s.deepest) {
        s.deepest = this.depth;
        F.Quests.onEvent(s, 'depth', { depth: this.depth });
        F.Achieve.check(s);
      }
      F.Game.save();
    }
    doInteract(it) {
      if (it.kind === 'exit') {
        if (it.ex.kind === 'up') {
          if (this.depth === 1) F.Game.replace(new F.HubScene());
          else F.Game.replace(new MineScene(this.depth - 1));
          return;
        }
        if (it.ex.kind === 'down') {
          const d = this.depth + 1;
          if (!F.Game.depthUnlocked(d)) {
            F.Game.toast(F.Game.depthLock(d), F.PAL.bad, 3);
            F.Audio.error();
            return;
          }
          F.Game.replace(new MineScene(d));
          return;
        }
      }
      super.doInteract(it);
    }
  }
  F.MineScene = MineScene;

  // ============================================================ depth select
  class DepthScene {
    constructor() { this.t = 0; this.sel = Math.min(F.Game.s.deepest, F.MAX_DEPTH); }
    update(dt) {
      this.t += dt;
      if (F.Input.hit('escape')) F.Game.pop();
    }
    draw() {
      const U = F.UI, g = U.g, P = F.PAL, s = F.Game.s;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      g.fillStyle = 'rgba(4,3,7,0.82)'; g.fillRect(0, 0, U.W, U.H);
      const w = 880, h = 620, x = (U.W - w) / 2, y = (U.H - h) / 2;
      U.panel(x, y, w, h, { title: 'The Shaft' });
      U.text('How far down are you going?', x + w / 2, y + 66, { size: 16, align: 'center', col: P.textDim });

      const rows = F.MAX_DEPTH;
      const rh = 56, rx = x + 34, rw = w - 68;
      let ry = y + 90;
      for (let i = 0; i < rows; i++) {
        const D = F.DEPTHS[i], d = i + 1;
        const open = F.Game.depthUnlocked(d);
        const over = U.row(rx, ry, rw, rh - 6, { selected: this.sel === d, key: 'd' + d });
        const col = open ? P.text : P.textFaint;
        U.text(F.roman(d), rx + 34, ry + 34, { size: 24, weight: '700', display: true, align: 'center', col: open ? P.brassHi : P.textFaint });
        U.text(D.name, rx + 70, ry + 24, { size: 18, weight: '600', display: true, col });
        const B = F.BIOMES[D.biome];
        U.text(open ? 'Danger x' + D.danger.toFixed(1) + '   ore up to tier ' + oreTier(d) : F.Game.depthLock(d),
          rx + 70, ry + 42, { size: 13, col: open ? P.textDim : P.bad });
        // a swatch of the biome's own colour
        g.fillStyle = B.accent; g.globalAlpha = open ? 0.85 : 0.25;
        U.roundRect(rx + rw - 40, ry + 14, 22, 22, 4); g.fill();
        g.globalAlpha = 1;
        if (over && U.mclick && U.consume()) {
          if (open) { this.sel = d; F.Audio.uiBig(); F.Game.pop(); F.Game.replace(new MineScene(d)); }
          else { F.Audio.error(); F.Game.toast(F.Game.depthLock(d), P.bad, 2.5); }
        }
        ry += rh;
      }
      if (U.btn(x + w / 2 - 90, y + h - 62, 180, 44, 'BACK', {})) F.Game.pop();
      U.end();
    }
  }
  function oreTier(d) {
    let best = 0;
    for (const id of F.ORE_IDS) { const o = F.ORES[id]; if (d >= o.f[0] && d <= o.f[1]) best = Math.max(best, o.tier); }
    return best;
  }
  F.DepthScene = DepthScene;

  // ================================================================== death
  class DeathScene {
    constructor(world) { this.w = world; this.t = 0; }
    enter() { F.Audio.death(); }
    update(dt) { this.t += dt; }
    draw() {
      const U = F.UI, g = U.g, P = F.PAL, s = F.Game.s;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      const a = F.U.sat(this.t * 0.8);
      g.fillStyle = 'rgba(30,2,6,' + (a * 0.72) + ')'; g.fillRect(0, 0, U.W, U.H);
      if (this.t < 0.4) { U.end(); return; }
      U.text('YOU DIED', U.W / 2, 250, {
        size: 96, weight: '700', display: true, align: 'center',
        col: '#c8324a', glow: 'rgba(200,40,70,0.6)', glowBlur: 40, alpha: a,
      });
      const lost = Math.round(s.gold * 0.12);
      U.text('The mine keeps ' + F.U.fmt(lost) + ' gold. It keeps everything eventually.',
        U.W / 2, 300, { size: 17, align: 'center', col: P.textDim, alpha: a });
      const bw = 300, bx = U.W / 2 - bw / 2;
      if (U.btn(bx, 380, bw, 54, 'BACK TO EMBERHOLD', { primary: true, display: true, size: 19 })) {
        s.gold = Math.max(0, s.gold - lost);
        s.hp = F.Game.maxHp();
        F.Game.pop();
        F.Game.replace(new HubScene());
      }
      if (U.btn(bx, 448, bw, 48, 'TRY THE SAME DEPTH', { display: true, size: 17 })) {
        s.gold = Math.max(0, s.gold - lost);
        s.hp = F.Game.maxHp();
        F.Game.pop();
        F.Game.replace(new MineScene(s.depth || 1));
      }
      U.end();
    }
  }
  F.DeathScene = DeathScene;

  // ================================================================== pause
  class PauseScene {
    constructor() { this.t = 0; }
    update(dt) {
      this.t += dt;
      if (F.Input.hit('escape')) F.Game.pop();
    }
    draw() {
      const U = F.UI, g = U.g, P = F.PAL, s = F.Game.s;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      g.fillStyle = 'rgba(4,3,7,0.78)'; g.fillRect(0, 0, U.W, U.H);
      const w = 460, h = 520, x = (U.W - w) / 2, y = (U.H - h) / 2;
      U.panel(x, y, w, h, { title: 'Paused' });
      const bx = x + 60, bw = w - 120;
      let by = y + 78;
      if (U.btn(bx, by, bw, 50, 'RESUME', { primary: true, display: true })) F.Game.pop();
      by += 62;
      if (U.btn(bx, by, bw, 46, 'INVENTORY', { display: true })) { F.Game.pop(); F.Game.push(new F.InventoryScene()); }
      by += 56;
      if (U.btn(bx, by, bw, 46, 'JOBS', { display: true })) { F.Game.pop(); F.Game.push(new F.QuestScene()); }
      by += 56;
      if (U.btn(bx, by, bw, 46, 'ACHIEVEMENTS', { display: true })) { F.Game.pop(); F.Game.push(new F.AchieveScene()); }
      by += 56;
      if (U.btn(bx, by, bw, 46, 'SETTINGS', { display: true })) F.Game.push(new F.SettingsScene());
      by += 56;
      if (U.btn(bx, by, bw, 46, 'SAVE AND QUIT', { display: true })) {
        F.Game.save();
        F.Game.pop();
        F.Game.replace(new TitleScene());
      }
      U.text('Depth ' + (F.Game.s.depth || 1) + '   ·   Power ' + F.U.fmt(F.Game.power()),
        x + w / 2, y + h - 30, { size: 13, align: 'center', col: P.textFaint });
      U.end();
    }
  }
  F.PauseScene = PauseScene;

  // ==================================================================== map
  class MapScene {
    constructor(world) { this.w = world; }
    update(dt) { if (F.Input.hit('m') || F.Input.hit('escape')) F.Game.pop(); }
    draw() {
      const U = F.UI, g = U.g, P = F.PAL, lv = this.w.lv;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      g.fillStyle = 'rgba(4,3,7,0.86)'; g.fillRect(0, 0, U.W, U.H);
      const w = 900, h = 640, x = (U.W - w) / 2, y = (U.H - h) / 2;
      U.panel(x, y, w, h, { title: lv.name || 'The Mine' });
      const iw = lv.w, ih = lv.h;
      const s = Math.min((w - 80) / iw, (h - 140) / ih);
      const ox = x + (w - iw * s) / 2, oy = y + 70 + ((h - 140) - ih * s) / 2;
      if (!lv._mapCache) lv._mapCache = null;
      g.save(); g.imageSmoothingEnabled = false;
      if (lv._mapCache) g.drawImage(lv._mapCache, ox, oy, iw * s, ih * s);
      g.restore();
      for (const ex of lv.exits) {
        g.fillStyle = ex.kind === 'down' ? '#ffb347' : '#63c7ff';
        g.beginPath(); g.arc(ox + ex.x / F.TS * s, oy + ex.y / F.TS * s, 5, 0, 7); g.fill();
      }
      for (const n of lv.nodes) {
        if (!n.alive || !F.NODES[n.type].rare) continue;
        const O = F.ORES[n.ore];
        g.fillStyle = O ? O.col : '#fff'; g.globalAlpha = 0.85;
        g.fillRect(ox + n.x / F.TS * s - 1, oy + n.y / F.TS * s - 1, 2.5, 2.5);
        g.globalAlpha = 1;
      }
      const p = this.w.player;
      g.save(); g.shadowColor = '#fff'; g.shadowBlur = 10; g.fillStyle = '#fff';
      g.beginPath(); g.arc(ox + p.x / F.TS * s, oy + p.y / F.TS * s, 4, 0, 7); g.fill(); g.restore();
      U.text('Rare seams show as coloured flecks.   M or ESC to close.',
        x + w / 2, y + h - 26, { size: 13, align: 'center', col: P.textFaint });
      U.end();
    }
  }
  F.MapScene = MapScene;

  // ================================================================ confirm
  class ConfirmScene {
    constructor(title, body, onYes) { this.title = title; this.body = body; this.onYes = onYes; }
    update(dt) { if (F.Input.hit('escape')) F.Game.pop(); }
    draw() {
      const U = F.UI, g = U.g, P = F.PAL;
      U.begin(F.Input.mx, F.Input.my, F.Input.mdown, F.Input.mclick);
      g.fillStyle = 'rgba(4,3,7,0.7)'; g.fillRect(0, 0, U.W, U.H);
      const w = 520, h = 240, x = (U.W - w) / 2, y = (U.H - h) / 2;
      U.panel(x, y, w, h, { title: this.title });
      U.para(this.body, x + 40, y + 96, w - 80, { size: 16, col: P.textDim, align: 'center' });
      if (U.btn(x + 40, y + h - 70, (w - 100) / 2, 46, 'YES', { danger: true, display: true })) { F.Game.pop(); this.onYes(); }
      if (U.btn(x + w / 2 + 10, y + h - 70, (w - 100) / 2, 46, 'CANCEL', { display: true })) F.Game.pop();
      U.end();
    }
  }
  F.ConfirmScene = ConfirmScene;

})(window.F2 = window.F2 || {});
