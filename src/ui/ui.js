'use strict';
// ---------------------------------------------------------------------------
// ui.js — the interface layer.
//
// The world renders into a 640x360 buffer and gets upscaled; the UI is drawn
// separately, in Canvas2D, at the display's real resolution. That is why the
// rock can be chunky and lamplit while the text stays razor sharp.
// ---------------------------------------------------------------------------
(function (F) {

  const P = F.PAL;

  const UI = F.UI = {
    W: 1280, H: 720,                 // logical UI units (world units x2)
    c: null, g: null, dpr: 1,
    scale: 1, mx: 0, my: 0, mdown: false, mclick: false,
    hot: null, active: null, _focusRing: null,
    display: '"Palatino Linotype","Book Antiqua",Georgia,"DejaVu Serif",serif',
    ui: '"Segoe UI",Roboto,"Helvetica Neue","DejaVu Sans",sans-serif',

    init(canvas) {
      this.c = canvas;
      this.g = canvas.getContext('2d');
      return this;
    },
    resize(cssW, cssH, dpr) {
      this.dpr = dpr;
      this.c.width = Math.round(cssW * dpr);
      this.c.height = Math.round(cssH * dpr);
      this.c.style.width = cssW + 'px';
      this.c.style.height = cssH + 'px';
      // letterbox the 16:9 logical space inside whatever we were given
      const s = Math.min(this.c.width / this.W, this.c.height / this.H);
      this.scale = s;
      this.ox = (this.c.width - this.W * s) / 2;
      this.oy = (this.c.height - this.H * s) / 2;
    },
    begin(mouseVX, mouseVY, mdown, mclick) {
      const g = this.g;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.c.width, this.c.height);
      g.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
      g.textBaseline = 'alphabetic';
      this.mx = mouseVX * 2; this.my = mouseVY * 2;
      this.mdown = mdown; this.mclick = mclick;
      this.hot = null;
      this._consumed = false;
    },
    end() { this.g.setTransform(1, 0, 0, 1, 0, 0); },
    /** True once a widget has eaten this frame's click. */
    consume() { const v = this._consumed; this._consumed = true; return !v; },

    // ------------------------------------------------------------ helpers
    hitRect(x, y, w, h) { return this.mx >= x && this.my >= y && this.mx < x + w && this.my < y + h; },

    font(size, weight, display) {
      this.g.font = (weight || '400') + ' ' + size + 'px ' + (display ? this.display : this.ui);
    },
    text(str, x, y, opt) {
      opt = opt || {};
      const g = this.g;
      this.font(opt.size || 18, opt.weight || '500', opt.display);
      g.textAlign = opt.align || 'left';
      if (opt.shadow !== false) {
        g.fillStyle = 'rgba(0,0,0,' + (opt.shadowA || 0.75) + ')';
        g.fillText(str, x + (opt.shadowD || 1.5), y + (opt.shadowD || 1.5));
      }
      if (opt.glow) {
        g.save(); g.shadowColor = opt.glow; g.shadowBlur = opt.glowBlur || 14;
        g.fillStyle = opt.col || P.text; g.fillText(str, x, y);
        g.restore();
      }
      g.fillStyle = opt.col || P.text;
      g.globalAlpha = opt.alpha === undefined ? 1 : opt.alpha;
      g.fillText(str, x, y);
      g.globalAlpha = 1;
      g.textAlign = 'left';
      return g.measureText(str).width;
    },
    width(str, size, weight, display) {
      this.font(size || 18, weight || '500', display);
      return this.g.measureText(str).width;
    },
    /** Wrap text into lines that fit `w`. */
    wrap(str, w, size, weight) {
      this.font(size || 16, weight || '400');
      const words = String(str).split(' ');
      const out = []; let line = '';
      for (const word of words) {
        const t = line ? line + ' ' + word : word;
        if (this.g.measureText(t).width > w && line) { out.push(line); line = word; }
        else line = t;
      }
      if (line) out.push(line);
      return out;
    },
    /** Wrapped paragraph. With align:'center' the block centres inside `w`. */
    para(str, x, y, w, opt) {
      opt = opt || {};
      const lines = this.wrap(str, w, opt.size || 16, opt.weight);
      const lh = opt.lh || (opt.size || 16) * 1.45;
      const ax = opt.align === 'center' ? x + w / 2 : opt.align === 'right' ? x + w : x;
      lines.forEach((l, i) => this.text(l, ax, y + i * lh, opt));
      return lines.length * lh;
    },

    roundRect(x, y, w, h, r) {
      const g = this.g;
      g.beginPath(); g.roundRect(x, y, w, h, r); return g;
    },

    // -------------------------------------------------------------- panel
    /**
     * The house panel: dark glass, a brass frame, a lit top edge and corner
     * rivets. Every screen is built out of these so the game looks like itself.
     */
    panel(x, y, w, h, opt) {
      opt = opt || {};
      const g = this.g, r = opt.r === undefined ? 10 : opt.r;
      g.save();
      if (opt.shadow !== false) {
        g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = 26; g.shadowOffsetY = 8;
      }
      const grad = g.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, opt.top || '#221c2c');
      grad.addColorStop(0.5, opt.mid || '#171320');
      grad.addColorStop(1, opt.bot || '#100d17');
      g.fillStyle = grad;
      this.roundRect(x, y, w, h, r); g.fill();
      g.restore();

      // inner vignette so the middle of a big panel is not flat
      g.save();
      this.roundRect(x, y, w, h, r); g.clip();
      const vg = g.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.2,
                                        x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.42)');
      g.fillStyle = vg; g.fillRect(x, y, w, h);
      g.restore();

      // frame
      const fc = opt.frame || P.brass;
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3;
      this.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r); g.stroke();
      g.strokeStyle = fc; g.lineWidth = 1.6;
      this.roundRect(x + 2, y + 2, w - 4, h - 4, r - 1.5); g.stroke();
      g.strokeStyle = 'rgba(255,225,170,0.22)'; g.lineWidth = 1;
      this.roundRect(x + 3.5, y + 3.5, w - 7, h - 7, r - 2.5); g.stroke();

      if (opt.rivets !== false) {
        const rv = [[x + 11, y + 11], [x + w - 11, y + 11], [x + 11, y + h - 11], [x + w - 11, y + h - 11]];
        for (const p of rv) {
          g.fillStyle = P.brassDim; g.beginPath(); g.arc(p[0], p[1], 3.2, 0, 7); g.fill();
          g.fillStyle = P.brassHi; g.beginPath(); g.arc(p[0] - 0.7, p[1] - 0.7, 1.5, 0, 7); g.fill();
        }
      }
      if (opt.title) this.panelTitle(x, y, w, opt.title, opt.titleCol);
      return { x, y, w, h };
    },

    panelTitle(x, y, w, title, col) {
      const g = this.g;
      const tw = this.width(title, 22, '600', true) + 46;
      const cx = x + w / 2;
      g.save();
      const grad = g.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
      grad.addColorStop(0, 'rgba(199,154,78,0)');
      grad.addColorStop(0.5, 'rgba(199,154,78,0.30)');
      grad.addColorStop(1, 'rgba(199,154,78,0)');
      g.fillStyle = grad;
      g.fillRect(cx - tw / 2, y - 2, tw, 34);
      g.restore();
      this.text(title.toUpperCase(), cx, y + 24, { size: 21, weight: '600', display: true, align: 'center', col: col || P.brassHi, glow: 'rgba(240,203,126,0.5)' });
      // rule under the title
      g.strokeStyle = 'rgba(199,154,78,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + 22, y + 36); g.lineTo(x + w - 22, y + 36); g.stroke();
      g.fillStyle = P.brass;
      g.beginPath(); g.moveTo(cx, y + 31); g.lineTo(cx + 6, y + 36); g.lineTo(cx, y + 41); g.lineTo(cx - 6, y + 36); g.closePath(); g.fill();
    },

    // ------------------------------------------------------------- button
    btn(x, y, w, h, label, opt) {
      opt = opt || {};
      const g = this.g;
      const over = this.hitRect(x, y, w, h) && !opt.disabled;
      const dn = over && this.mdown;
      const r = opt.r === undefined ? 7 : opt.r;
      if (over) this.hot = label;
      const base = opt.disabled ? '#1b1822' : opt.danger ? '#3a1220' : opt.primary ? '#3d2d14' : '#241e2f';
      const hi = opt.disabled ? '#221e2a' : opt.danger ? '#5e1c30' : opt.primary ? '#6b4a18' : '#372e45';
      g.save();
      if (!opt.disabled && over) { g.shadowColor = opt.primary ? 'rgba(255,160,60,0.45)' : 'rgba(180,150,220,0.28)'; g.shadowBlur = 16; }
      const grad = g.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, over ? hi : base);
      grad.addColorStop(1, over ? base : '#14111c');
      g.fillStyle = grad;
      this.roundRect(x, y + (dn ? 1.5 : 0), w, h, r); g.fill();
      g.restore();
      g.strokeStyle = opt.disabled ? '#2e2838' : (over ? P.brassHi : P.brassDim);
      g.lineWidth = 1.4;
      this.roundRect(x + 0.7, y + 0.7 + (dn ? 1.5 : 0), w - 1.4, h - 1.4, r); g.stroke();
      if (!opt.disabled) {
        g.strokeStyle = 'rgba(255,240,210,0.16)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x + 5, y + 1.6 + (dn ? 1.5 : 0)); g.lineTo(x + w - 5, y + 1.6 + (dn ? 1.5 : 0)); g.stroke();
      }
      this.text(label, x + w / 2, y + h / 2 + (opt.size || 17) * 0.36 + (dn ? 1.5 : 0), {
        size: opt.size || 17, weight: '600', align: 'center', display: opt.display,
        col: opt.disabled ? P.textFaint : over ? P.brassHi : P.text,
      });
      if (opt.sub) this.text(opt.sub, x + w / 2, y + h - 7 + (dn ? 1.5 : 0), { size: 11, align: 'center', col: P.textDim });
      const clicked = over && this.mclick && !opt.disabled && this.consume();
      if (clicked) F.Audio.ui();
      return clicked;
    },

    // ---------------------------------------------------------------- bar
    bar(x, y, w, h, frac, opt) {
      opt = opt || {};
      const g = this.g;
      const r = h / 2;
      g.save();
      g.fillStyle = '#0a0810';
      this.roundRect(x, y, w, h, r); g.fill();
      g.restore();
      const f = F.U.sat(frac);
      if (opt.ghost !== undefined && opt.ghost > f) {
        g.fillStyle = 'rgba(255,255,255,0.20)';
        this.roundRect(x + 1.5, y + 1.5, Math.max(0, (w - 3) * F.U.sat(opt.ghost)), h - 3, r); g.fill();
      }
      if (f > 0.001) {
        const grad = g.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, opt.col2 || F.Col.mix(opt.col || P.hp, '#ffffff', 0.35));
        grad.addColorStop(0.55, opt.col || P.hp);
        grad.addColorStop(1, F.Col.shade(opt.col || P.hp, 0.62));
        g.save();
        if (opt.glow !== false) { g.shadowColor = opt.col || P.hp; g.shadowBlur = 10; }
        g.fillStyle = grad;
        this.roundRect(x + 1.5, y + 1.5, Math.max(2, (w - 3) * f), h - 3, r); g.fill();
        g.restore();
        // a highlight strip along the top of the fill
        g.fillStyle = 'rgba(255,255,255,0.25)';
        this.roundRect(x + 3, y + 2.5, Math.max(1, (w - 6) * f), Math.max(1, h * 0.26), r * 0.5); g.fill();
      }
      g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 2;
      this.roundRect(x, y, w, h, r); g.stroke();
      g.strokeStyle = opt.frame || 'rgba(199,154,78,0.55)'; g.lineWidth = 1;
      this.roundRect(x + 1, y + 1, w - 2, h - 2, r); g.stroke();
      if (opt.label) this.text(opt.label, x + w / 2, y + h / 2 + 4.5, { size: 12, weight: '600', align: 'center', col: '#fff', shadowA: 0.9 });
      // segment ticks make a long bar readable at a glance
      if (opt.segs) {
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
        for (let i = 1; i < opt.segs; i++) {
          const px = x + w * i / opt.segs;
          g.beginPath(); g.moveTo(px, y + 2); g.lineTo(px, y + h - 2); g.stroke();
        }
      }
    },

    // --------------------------------------------------------------- slot
    slot(x, y, s, opt) {
      opt = opt || {};
      const g = this.g;
      const over = this.hitRect(x, y, s, s);
      if (over) this.hot = opt.key || 'slot';
      g.save();
      const grad = g.createLinearGradient(x, y, x, y + s);
      grad.addColorStop(0, opt.empty ? '#15121c' : '#231d2e');
      grad.addColorStop(1, opt.empty ? '#0e0c14' : '#15111d');
      g.fillStyle = grad;
      this.roundRect(x, y, s, s, 6); g.fill();
      g.restore();
      if (opt.rarity) {
        g.save();
        g.shadowColor = opt.rarity; g.shadowBlur = over ? 16 : 9;
        g.strokeStyle = opt.rarity; g.lineWidth = 2;
        this.roundRect(x + 1, y + 1, s - 2, s - 2, 5); g.stroke();
        g.restore();
      } else {
        g.strokeStyle = over ? P.brassHi : '#3a3247'; g.lineWidth = 1.5;
        this.roundRect(x + 1, y + 1, s - 2, s - 2, 5); g.stroke();
      }
      if (opt.selected) {
        g.strokeStyle = P.brassHi; g.lineWidth = 2.4;
        this.roundRect(x - 2, y - 2, s + 4, s + 4, 8); g.stroke();
      }
      return over;
    },

    chip(x, y, label, col, opt) {
      opt = opt || {};
      const g = this.g;
      const pad = opt.pad || 9;
      const w = this.width(label, opt.size || 13, '600') + pad * 2;
      const h = opt.h || 22;
      g.fillStyle = opt.bg || 'rgba(0,0,0,0.55)';
      this.roundRect(x, y, w, h, h / 2); g.fill();
      g.strokeStyle = col; g.lineWidth = 1.2; g.globalAlpha = 0.75;
      this.roundRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2, h / 2); g.stroke();
      g.globalAlpha = 1;
      this.text(label, x + w / 2, y + h / 2 + (opt.size || 13) * 0.36, { size: opt.size || 13, weight: '600', align: 'center', col });
      return w;
    },

    /** A titled row used in lists (inventory, shops, quests). */
    row(x, y, w, h, opt) {
      opt = opt || {};
      const g = this.g;
      const over = this.hitRect(x, y, w, h);
      if (over) this.hot = opt.key || 'row';
      const grad = g.createLinearGradient(x, y, x + w, y);
      grad.addColorStop(0, over || opt.selected ? 'rgba(199,154,78,0.20)' : 'rgba(255,255,255,0.035)');
      grad.addColorStop(1, 'rgba(255,255,255,0.0)');
      g.fillStyle = grad;
      this.roundRect(x, y, w, h, 6); g.fill();
      if (opt.selected) {
        g.fillStyle = P.brass; this.roundRect(x, y, 3, h, 2); g.fill();
      }
      g.strokeStyle = over ? 'rgba(240,203,126,0.5)' : 'rgba(255,255,255,0.07)'; g.lineWidth = 1;
      this.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 6); g.stroke();
      return over;
    },

    tabs(x, y, w, labels, sel, h) {
      h = h || 34;
      const tw = w / labels.length;
      let out = sel;
      for (let i = 0; i < labels.length; i++) {
        const tx = x + i * tw;
        const over = this.hitRect(tx, y, tw, h);
        const on = i === sel;
        const g = this.g;
        g.fillStyle = on ? 'rgba(199,154,78,0.18)' : over ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.25)';
        this.roundRect(tx + 2, y, tw - 4, h, 6); g.fill();
        if (on) {
          g.fillStyle = P.brassHi;
          this.roundRect(tx + 10, y + h - 3, tw - 20, 3, 1.5); g.fill();
        }
        this.text(labels[i], tx + tw / 2, y + h / 2 + 6, {
          size: 15, weight: '600', align: 'center',
          col: on ? P.brassHi : over ? P.text : P.textDim,
        });
        if (over && this.mclick && this.consume()) { out = i; F.Audio.ui(); }
      }
      return out;
    },

    /** Floating tooltip that keeps itself on screen. */
    tip(x, y, lines, opt) {
      opt = opt || {};
      const g = this.g;
      const pad = 12;
      let w = 0;
      const sized = lines.map(l => {
        const o = typeof l === 'string' ? { t: l } : l;
        o.size = o.size || 14;
        w = Math.max(w, this.width(o.t, o.size, o.weight || '500', o.display));
        return o;
      });
      w = Math.min(Math.max(w + pad * 2, opt.min || 180), 420);
      let h = pad * 2;
      const wrapped = [];
      for (const o of sized) {
        if (o.gap) { wrapped.push({ gap: o.gap }); h += o.gap; continue; }
        const ls = this.wrap(o.t, w - pad * 2, o.size, o.weight || '500');
        for (const l of ls) { wrapped.push({ t: l, size: o.size, col: o.col, weight: o.weight, display: o.display, align: o.align }); h += o.size * 1.42; }
      }
      let px = x + 16, py = y + 10;
      if (px + w > this.W - 8) px = x - w - 16;
      if (py + h > this.H - 8) py = this.H - h - 8;
      if (py < 8) py = 8;
      if (px < 8) px = 8;
      this.panel(px, py, w, h, { r: 8, rivets: false, frame: opt.frame || P.brass });
      let yy = py + pad + 12;
      for (const o of wrapped) {
        if (o.gap) { yy += o.gap; continue; }
        this.text(o.t, o.align === 'center' ? px + w / 2 : px + pad, yy, {
          size: o.size, col: o.col || P.text, weight: o.weight || '500', display: o.display,
          align: o.align || 'left',
        });
        yy += o.size * 1.42;
      }
      return { x: px, y: py, w, h };
    },

    /** An ornamental horizontal rule. */
    rule(x, y, w, col) {
      const g = this.g;
      const grad = g.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, 'rgba(199,154,78,0)');
      grad.addColorStop(0.5, col || 'rgba(199,154,78,0.6)');
      grad.addColorStop(1, 'rgba(199,154,78,0)');
      g.fillStyle = grad; g.fillRect(x, y, w, 1);
    },

    /** Draw an atlas sprite into the UI canvas (icons in menus). */
    icon(key, x, y, size, tint) {
      const spr = F.IconCache.get(key, tint);
      if (!spr) return;
      const g = this.g;
      const s = size / Math.max(spr.width, spr.height);
      g.save(); g.imageSmoothingEnabled = false;
      g.drawImage(spr, x - spr.width * s / 2, y - spr.height * s / 2, spr.width * s, spr.height * s);
      g.restore();
    },
  };

})(window.F2 = window.F2 || {});
