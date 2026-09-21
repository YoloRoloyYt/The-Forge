'use strict';
// ---------------------------------------------------------------------------
// touch.js — on-screen controls for phones/tablets. Turns on the first time a touch is seen.
// Left side: floating joystick. Right side: attack, heavy, dash, parry, mine/interact, bag, pause.
// Taps elsewhere behave like mouse clicks (menus, hotbar). Aim is automatic (nearest enemy, else move direction).
// ---------------------------------------------------------------------------
const Touch = {
  ids: {}, stickId: null, ox: 0, oy: 0, kx: 0, ky: 0,
  buttons: [
    { id: 'atk',   x: VW - 36,  y: VH - 84,  r: 19, label: 'ATK' },
    { id: 'heavy', x: VW - 84,  y: VH - 66,  r: 14, label: 'HVY' },
    { id: 'dash',  x: VW - 36,  y: VH - 126, r: 14, label: 'DASH' },
    { id: 'parry', x: VW - 84,  y: VH - 108, r: 14, label: 'PARRY' },
    { id: 'mine',  x: VW - 130, y: VH - 84,  r: 16, label: 'E' },
    { id: 'bag',   x: VW - 22,  y: 64,        r: 10, label: 'BAG' },
    { id: 'pause', x: VW - 22,  y: 90,        r: 10, label: '||' },
  ],
  init() {
    const pos = e => {
      const r = canvas.getBoundingClientRect(), w = r.width || VW, h = r.height || VH;
      return [(e.clientX - r.left) * VW / w, (e.clientY - r.top) * VH / h];
    };
    canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; const p = pos(e); Input.touch = true; Sfx.unlock(); this.start(e.pointerId, p[0], p[1]); e.preventDefault(); });
    canvas.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') return; const p = pos(e); this.move(e.pointerId, p[0], p[1]); e.preventDefault(); });
    const up = e => { if (e.pointerType === 'touch') this.end(e.pointerId); };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  },
  inWorld() { return Game.top() instanceof WorldScene; },
  hitButton(x, y) { return this.buttons.find(b => Math.hypot(b.x - x, b.y - y) <= b.r + 4) || null; },
  start(id, x, y) {
    Input.touch = true;
    if (this.inWorld()) {
      const b = this.hitButton(x, y);
      if (b) { this.ids[id] = { btn: b.id }; this.press(b.id, true); return; }
      if (x < VW * 0.45 && y > VH * 0.25 && this.stickId === null) { this.stickId = id; this.ox = this.kx = x; this.oy = this.ky = y; this.ids[id] = { stick: true }; Input.stick = { x: 0, y: 0 }; return; }
    }
    // anything else is a click at that spot (hotbar, HUD buttons, menus)
    this.ids[id] = { tap: true }; Input.mx = x; Input.my = y; Input.mpressed[0] = true; Input.mdown[0] = true;
  },
  move(id, x, y) {
    const t = this.ids[id]; if (!t) return;
    if (t.stick) {
      const dx = x - this.ox, dy = y - this.oy, len = Math.hypot(dx, dy), max = 26;
      const k = len > max ? max / len : 1; this.kx = this.ox + dx * k; this.ky = this.oy + dy * k;
      Input.stick = len < 6 ? { x: 0, y: 0 } : { x: dx * k / max, y: dy * k / max };
    } else if (t.tap) { Input.mx = x; Input.my = y; }
  },
  end(id) {
    const t = this.ids[id]; if (!t) return; delete this.ids[id];
    if (t.stick) { this.stickId = null; Input.stick = { x: 0, y: 0 }; }
    else if (t.btn) this.press(t.btn, false);
    else if (t.tap) Input.mdown[0] = false;
  },
  press(btn, down) {
    if (btn === 'mine') { if (down) Input.pressed.KeyE = true; Input.down.KeyE = down; return; }
    if (!down) return;
    if (btn === 'atk') Input.atkPressed = true;
    else if (btn === 'heavy') Input.pressed.KeyR = true;
    else if (btn === 'dash') Input.pressed.KeyQ = true;
    else if (btn === 'parry') Input.pressed.KeyF = true;
    else if (btn === 'bag') Input.pressed.KeyT = true;
    else if (btn === 'pause') Input.pressed.Escape = true;
  },
  // Auto-aim: face the nearest enemy in reach; otherwise the direction of movement.
  aim(world, P) {
    let best = null, bd = 120;
    for (const e of world.lv.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < bd) { bd = d; best = e; } }
    if (best) return Math.atan2(best.y - P.y, best.x - P.x);
    if (Input.stick && (Input.stick.x || Input.stick.y)) return Math.atan2(Input.stick.y, Input.stick.x);
    return P.face;
  },
  draw() {
    if (!Input.touch || !this.inWorld()) return;
    const t = performance.now() / 1000;
    // joystick
    const bx = this.stickId !== null ? this.ox : 70, by = this.stickId !== null ? this.oy : VH - 70;
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#c9c9d6'; ctx.beginPath(); ctx.arc(bx, by, 28, 0, 6.3); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.arc(this.stickId !== null ? this.kx : bx, this.stickId !== null ? this.ky : by, 12, 0, 6.3); ctx.fill();
    for (const b of this.buttons) {
      const down = Object.values(this.ids).some(i => i.btn === b.id);
      ctx.globalAlpha = down ? 0.75 : 0.42; ctx.fillStyle = b.id === 'atk' ? '#a83a2a' : b.id === 'parry' ? '#3a6fa8' : b.id === 'mine' ? '#7a6a2a' : '#4a3f5c';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.3); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.3); ctx.stroke();
      ctx.globalAlpha = 1; UI.text(b.label, b.x, b.y - 3, '#ffffff', 'center', b.r > 15 ? 8 : 6);
    }
    ctx.globalAlpha = 1;
  },
};
