'use strict';
// ---------------------------------------------------------------------------
// main.js — boot and the frame loop.
// ---------------------------------------------------------------------------
(function (F) {

  F.VW = 640; F.VH = 360;

  let last = 0, acc = 0;
  const FIXED = 1 / 120, MAX_STEPS = 6;

  function frame(ts) {
    let dt = (ts - last) / 1000;
    if (!last || dt > 0.25) dt = 1 / 60;
    last = ts;

    // hit-stop freezes the world but never the interface
    if (F.Game.hitStop > 0) {
      F.Game.hitStop -= dt;
      dt *= 0.08;
    }

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
