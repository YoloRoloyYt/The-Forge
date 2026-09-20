'use strict';
// ---------------------------------------------------------------------------
// main.js — boot and the frame loop.
// ---------------------------------------------------------------------------
(function (F) {

  F.VW = 640; F.VH = 360;

  let last = 0, acc = 0;
  const FIXED = 1 / 120, MAX_STEPS = 6;

  // ---------------------------------------------------------------- quality
  // The renderer is cheap on a GPU and expensive on a software rasteriser, and
  // a browser game does not get to know which it is running on. So measure.
  const Q = F.Quality = {
    level: 3,                 // 3 = everything, 0 = get it on screen
    avg: 16, samples: 0, cooldown: 2.5, locked: false,
    LEVELS: [
      { shadows: 0,  haze: 0,    bloom: 0.0,  grain: 0,    ca: 0,      scale: 0.66 },
      { shadows: 0,  haze: 0.5,  bloom: 0.55, grain: 0.5,  ca: 0.5,    scale: 0.8 },
      { shadows: 12, haze: 0.85, bloom: 0.85, grain: 1,    ca: 1,      scale: 1 },
      { shadows: 22, haze: 1,    bloom: 1,    grain: 1,    ca: 1,      scale: 1 },
    ],
    apply() {
      const L = this.LEVELS[this.level];
      const st = F.Game.settings;
      F.Render.shadowSteps = st.shadows ? L.shadows : 0;
      F.Render.hazeScale = L.haze;
      F.Render.bloomScale = L.bloom;
      F.Render.grain = 0.030 * st.grain * L.grain;
      F.Render.ca = 0.0045 * L.ca;
    },
    sample(dt) {
      if (this.locked) return;
      const ms = dt * 1000;
      this.avg += (ms - this.avg) * 0.05;
      this.cooldown -= dt;
      if (this.cooldown > 0) return;
      if (this.avg > 26 && this.level > 0) { this.level--; this.cooldown = 3; this.apply(); }
      else if (this.avg < 13 && this.level < 3) { this.level++; this.cooldown = 6; this.apply(); }
    },
  };

  function frame(ts) {
    let dt = (ts - last) / 1000;
    if (!last || dt > 0.25) dt = 1 / 60;
    last = ts;

    // hit-stop freezes the world but never the interface
    if (F.Game.hitStop > 0) {
      F.Game.hitStop -= dt;
      dt *= 0.08;
    }

    F.Quality.sample(Math.min(dt, 0.1));
    F.Game.update(dt);
    const top = F.Game.top();
    if (top && top.update) top.update(dt);

    // draw from the bottom of the stack up, so overlays sit on the world
    for (let i = 0; i < F.Game.stack.length; i++) {
      const sc = F.Game.stack[i];
      if (sc.draw) sc.draw(i === F.Game.stack.length - 1);
    }

    F.Input.endFrame();
    requestAnimationFrame(frame);
  }

  function fit() {
    const w = innerWidth, h = innerHeight;
    const glc = F.GL.canvas;
    // render the world buffer 1:1 and let the present pass upscale it
    const dpr = Math.min(devicePixelRatio || 1, 2);
    glc.style.width = w + 'px'; glc.style.height = h + 'px';
    glc.width = Math.round(w * dpr); glc.height = Math.round(h * dpr);
    F.GL.dw = glc.width; F.GL.dh = glc.height;
    F.UI.resize(w, h, dpr);
    // keep the world view 16:9 and scale it to the window
    const aspect = w / h;
    F.VH = 360;
    F.VW = Math.round(F.VH * aspect / 2) * 2;
    F.VW = F.U.clamp(F.VW, 480, 900);
    if (F.Render.w !== F.VW) F.Render.resize && F.Render.resize(F.VW, F.VH);
    F.Input._vw = F.VW; F.Input._vh = F.VH;
    const sc = F.Game.world();
    if (sc) { sc.cam.vw = F.VW; sc.cam.vh = F.VH; }
  }

  F.boot = function () {
    const glc = document.getElementById('gl');
    const uic = document.getElementById('ui');
    F.GL.init(glc);
    F.Batch.init();
    F.UI.init(uic);
    F.Input.init(uic, F.VW, F.VH);
    F.Audio.init();
    F.Particles.init();

    // ------------------------------------------------------------- art
    F.Art.reset();
    F.Tiles.buildShared();
    for (const id in F.BIOMES) F.Tiles.build(id, F.BIOMES[id]);
    F.Props.build();
    F.Chars.build();
    if (F.BossArt) F.BossArt.build();
    if (F.HubArt) F.HubArt.build();
    F.Art.build();
    F.Particles.rebuildFrames();

    F.Render.init(F.VW, F.VH);
    fit();
    addEventListener('resize', fit);

    // settings
    const st = F.Save.settings();
    Object.assign(F.Game.settings, st);
    F.Quality.apply();
    F.Audio.setVolume(F.Game.settings.volume);
    F.Audio.setMusicVolume(F.Game.settings.music);
    F.Audio.setMuted(F.Game.settings.muted);

    const unlock = () => { F.Audio.resume(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    if (F.Touch) F.Touch.init(uic);

    F.Game.push(new F.TitleScene());
    requestAnimationFrame(frame);
  };

  // Rebuild the render targets when the window aspect changes.
  F.Render.resize = function (w, h) {
    const gl = F.GL.gl;
    const old = [this.gbuf, this.lightBuf, this.scene].concat(this.mips);
    for (const f of old) if (f) { gl.deleteFramebuffer(f.fb); for (const t of f.tex) gl.deleteTexture(t); }
    const keepOcc = this.occTex, keepSize = this.occSize, keepTile = this.tile, keepMacro = this.macroTex;
    this.init(w, h);
    this.occTex = keepOcc; this.occSize = keepSize; this.tile = keepTile;
    if (keepMacro) { gl.deleteTexture(this.macroTex); this.macroTex = keepMacro; }
  };

})(window.F2 = window.F2 || {});
