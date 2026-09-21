'use strict';
// ---------------------------------------------------------------------------
// input.js — keyboard, mouse, gamepad and touch, normalised into one place.
// ---------------------------------------------------------------------------
(function (F) {

  const In = F.Input = {
    keys: {}, pressed: {}, released: {},
    mx: 0, my: 0,                 // in virtual world-view pixels
    mdown: false, rdown: false,
    mclick: false, rclick: false,
    wheel: 0,
    anyKey: false,
    // touch
    touch: false, stickX: 0, stickY: 0,
    buttons: {},                  // virtual button states from the touch layer
    _canvas: null, _scale: 1, _ox: 0, _oy: 0, _vw: 640, _vh: 360,

    init(canvas, vw, vh) {
      this._canvas = canvas; this._vw = vw; this._vh = vh;
      addEventListener('keydown', e => {
        if (e.repeat) { return; }
        const k = norm(e.key);
        if (!this.keys[k]) this.pressed[k] = true;
        this.keys[k] = true; this.anyKey = true;
        if (BLOCK[k]) e.preventDefault();
      });
      addEventListener('keyup', e => {
        const k = norm(e.key);
        this.keys[k] = false; this.released[k] = true;
      });
      addEventListener('blur', () => { this.keys = {}; this.mdown = this.rdown = false; });
      canvas.addEventListener('mousemove', e => this._mouse(e));
      canvas.addEventListener('mousedown', e => {
        this._mouse(e);
        if (e.button === 0) { this.mdown = true; this.mclick = true; }
        if (e.button === 2) { this.rdown = true; this.rclick = true; }
        e.preventDefault();
      });
      addEventListener('mouseup', e => {
        if (e.button === 0) this.mdown = false;
        if (e.button === 2) this.rdown = false;
      });
      canvas.addEventListener('contextmenu', e => e.preventDefault());
      addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
      return this;
    },

    /** Map a client-space point into the virtual view. */
    _mouse(e) {
      const r = this._canvas.getBoundingClientRect();
      this.mx = (e.clientX - r.left) / r.width * this._vw;
      this.my = (e.clientY - r.top) / r.height * this._vh;
    },
    mapPoint(cx, cy) {
      const r = this._canvas.getBoundingClientRect();
      return { x: (cx - r.left) / r.width * this._vw, y: (cy - r.top) / r.height * this._vh };
    },

    down(k) { return !!this.keys[k]; },
    hit(k) { return !!this.pressed[k]; },
    up(k) { return !!this.released[k]; },

    /** Movement axis, -1..1, from WASD / arrows / touch stick / gamepad. */
    axis() {
      let x = 0, y = 0;
      if (this.keys.a || this.keys.arrowleft) x -= 1;
      if (this.keys.d || this.keys.arrowright) x += 1;
      if (this.keys.w || this.keys.arrowup) y -= 1;
      if (this.keys.s || this.keys.arrowdown) y += 1;
      if (this.touch) { x += this.stickX; y += this.stickY; }
      const gp = this.gamepad();
      if (gp) {
        if (Math.abs(gp.axes[0]) > 0.18) x += gp.axes[0];
        if (Math.abs(gp.axes[1]) > 0.18) y += gp.axes[1];
      }
      const m = Math.hypot(x, y);
      if (m > 1) { x /= m; y /= m; }
      return { x, y, m: Math.min(1, m) };
    },

    gamepad() {
      if (!navigator.getGamepads) return null;
      const list = navigator.getGamepads();
      for (const g of list) if (g && g.connected) return g;
      return null;
    },

    endFrame() {
      this.pressed = {}; this.released = {};
      this.mclick = false; this.rclick = false; this.wheel = 0; this.anyKey = false;
      for (const k in this.buttons) if (this.buttons[k] === 1) this.buttons[k] = 2;
    },
  };

  function norm(k) {
    if (k === ' ') return 'space';
    return k.length === 1 ? k.toLowerCase() : k.toLowerCase();
  }
  const BLOCK = { space: 1, arrowup: 1, arrowdown: 1, arrowleft: 1, arrowright: 1, tab: 1, "'": 1, '/': 1 };

})(window.F2 = window.F2 || {});
