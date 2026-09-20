'use strict';
// ---------------------------------------------------------------------------
// main.js — boot + main loop
// ---------------------------------------------------------------------------
let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.1, (ts - lastTs) / 1000 || 0.016); lastTs = ts;
  Game.time += dt;
  for (const t of Game.toasts) t.t -= dt;
  Game.toasts = Game.toasts.filter(t => t.t > 0);
  const top = Game.top();
  if (top && top.update) top.update(dt);
  const stack = Game.stack.slice();
  for (const s of stack) { UI.active = s === Game.top(); s.draw(); }
  UI.active = true;
  Touch.draw();
  Input.endFrame();
  requestAnimationFrame(frame);
}

function boot() {
  Input.init(); Touch.init();
  const keys = ['player', 'grunt', 'rogue', 'bomber'];
  Art.probe(keys).then(() => {
    Game.push(new TitleScene());
    requestAnimationFrame(frame);
  });
}
if (!window.__FORGE_TEST__) boot();
