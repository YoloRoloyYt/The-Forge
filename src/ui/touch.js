'use strict';
// ---------------------------------------------------------------------------
// touch.js — on-screen controls. They appear on the first touch and never
// before, so a mouse player never sees them.
// ---------------------------------------------------------------------------
(function (F) {

  const P = F.PAL;

  const T = F.Touch = {
    active: false,
    stick: { id: null, ox: 0, oy: 0, x: 0, y: 0 },
    buttons: [],

    init(canvas) {
      const map = e => {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width * F.UI.W, y: (e.clientY - r.top) / r.height * F.UI.H };
      };
      const start = e => {
        this.activate();
        for (const t of e.changedTouches) {
          const p = map(t);
          const b = this.hit(p.x, p.y);
          if (b) { b.id = t.identifier; F.Input.buttons[b.key] = 1; continue; }
          if (p.x < F.UI.W * 0.45 && this.stick.id === null) {
            this.stick.id = t.identifier; this.stick.ox = p.x; this.stick.oy = p.y;
            this.stick.x = p.x; this.stick.y = p.y;
          } else {
            // the right half aims and swings
            this.aimId = t.identifier;
            F.Input.mdown = true; F.Input.mclick = true;
            F.Input.mx = p.x / 2; F.Input.my = p.y / 2;
          }
        }
        e.preventDefault();
      };
      const move = e => {
        for (const t of e.changedTouches) {
          const p = map(t);
          if (t.identifier === this.stick.id) { this.stick.x = p.x; this.stick.y = p.y; }
          else if (t.identifier === this.aimId) { F.Input.mx = p.x / 2; F.Input.my = p.y / 2; }
        }
        e.preventDefault();
      };
      const end = e => {
        for (const t of e.changedTouches) {
          if (t.identifier === this.stick.id) { this.stick.id = null; }
          if (t.identifier === this.aimId) { this.aimId = null; F.Input.mdown = false; }
          for (const b of this.buttons) if (b.id === t.identifier) { b.id = null; F.Input.buttons[b.key] = 0; }
        }
        e.preventDefault();
      };
      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end, { passive: false });
      canvas.addEventListener('touchcancel', end, { passive: false });
      this.layout();
      return this;
    },

    activate() {
      if (this.active) return;
      this.active = true;
      F.Input.touch = true;
      F.Audio.resume();
    },

    layout() {
      const W = F.UI.W, H = F.UI.H;
      this.buttons = [
        { key: 'attack', label: '', icon: 'sword', x: W - 150, y: H - 180, r: 62, col: P.ember },
        { key: 'heavy', label: 'H', x: W - 280, y: H - 130, r: 44, col: P.warn },
        { key: 'dash', label: 'Q', x: W - 250, y: H - 270, r: 44, col: P.cool },
        { key: 'parry', label: 'F', x: W - 120, y: H - 330, r: 44, col: P.brassHi },
        { key: 'use', label: 'E', x: W - 330, y: H - 250, r: 40, col: P.good },
        { key: 'sprint', label: '»', x: 230, y: H - 300, r: 40, col: P.stam },
      ];
    },

    hit(x, y) {
      for (const b of this.buttons) if (Math.hypot(x - b.x, y - b.y) < b.r + 8) return b;
      return null;
    },

    update() {
      if (!this.active) return;
      if (this.stick.id !== null) {
        const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
        const m = Math.hypot(dx, dy), max = 110;
        const k = Math.min(1, m / max);
        F.Input.stickX = m > 6 ? dx / m * k : 0;
        F.Input.stickY = m > 6 ? dy / m * k : 0;
      } else { F.Input.stickX = 0; F.Input.stickY = 0; }
    },

    draw(U) {
      if (!this.active) return;
      this.update();
      const g = U.g;
      // the stick
      const sx = this.stick.id !== null ? this.stick.ox : 210;
      const sy = this.stick.id !== null ? this.stick.oy : U.H - 170;
      g.save();
      g.globalAlpha = this.stick.id !== null ? 0.55 : 0.28;
      g.strokeStyle = P.brass; g.lineWidth = 3;
      g.beginPath(); g.arc(sx, sy, 92, 0, 7); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.beginPath(); g.arc(sx, sy, 92, 0, 7); g.fill();
      const kx = sx + F.Input.stickX * 70, ky = sy + F.Input.stickY * 70;
      g.fillStyle = 'rgba(240,203,126,0.7)';
      g.beginPath(); g.arc(kx, ky, 38, 0, 7); g.fill();
      g.restore();
      // buttons
      for (const b of this.buttons) {
        const down = F.Input.buttons[b.key];
        g.save();
        g.globalAlpha = down ? 0.75 : 0.34;
        g.fillStyle = 'rgba(10,8,14,0.7)';
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
        g.strokeStyle = b.col; g.lineWidth = 3;
        g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.stroke();
        g.restore();
        if (b.label) U.text(b.label, b.x, b.y + b.r * 0.3, {
          size: b.r * 0.72, weight: '700', align: 'center', col: b.col, alpha: down ? 1 : 0.7,
        });
        else {
          g.save(); g.globalAlpha = down ? 1 : 0.7;
          g.strokeStyle = b.col; g.lineWidth = 4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(b.x - 20, b.y + 20); g.lineTo(b.x + 18, b.y - 18); g.stroke();
          g.beginPath(); g.moveTo(b.x + 6, b.y - 22); g.lineTo(b.x + 22, b.y - 6); g.stroke();
          g.restore();
        }
      }
    },
  };

})(window.F2 = window.F2 || {});
