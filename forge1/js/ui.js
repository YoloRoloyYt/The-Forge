'use strict';
// ---------------------------------------------------------------------------
// ui.js — immediate-mode pixel UI, particles/floating text, procedural item sprites
// Visual language: dark plum panels, bronze/gold frames, beveled buttons, outlined sprites.
// ---------------------------------------------------------------------------

// Shared palette so every screen matches.
const PAL = {
  ink: '#0b0810',        // outlines / deepest shadow
  panel: '#1b1526',      // panel body
  panelLo: '#140f1d',    // panel body, lower band
  panelHi: '#241c33',    // panel body, upper band
  bar: '#2a2038',        // title bar
  barHi: '#382a4c',
  edge: '#c9a24b',       // bronze frame
  edgeHi: '#f0d68a',     // frame highlight
  edgeLo: '#6e5322',     // frame shadow
  row: '#211a2d',
  rowAlt: '#1d1727',
  rowOn: '#2b3a28',      // "active/owned" row
  text: '#f3ecd8',
  dim: '#a89cc0',
  faint: '#6d6678',
  gold: '#ffd23f',
  good: '#7fe08a',
  bad: '#ff7a7a',
  info: '#7fd0ff',
  btn: '#3b2f52',
  btnGold: '#6a4a1a',
  btnGreen: '#2c5a2c',
  btnRed: '#6a2a2a',
};

const UI = {
  active: true,

  // ---------------------------------------------------------------- text (5x7 bitmap font)
  // x is the left edge, or the centre/right edge when align says so; y is the top of the glyphs.
  originX(str, x, align, sc) {
    if (align === 'center') return Math.round(x - Font.width(str, sc) / 2);
    if (align === 'right') return Math.round(x - Font.width(str, sc));
    return Math.round(x);
  },
  // Layout audit: when UI.audit is an array, every text/button/panel appends its bounds to it so a
  // test can find text that overlaps other text, spills out of a button, or leaves its panel.
  audit: null,
  _rec(kind, r) { if (this.audit) this.audit.push(Object.assign({ kind }, r)); },
  text(str, x, y, col = PAL.text, align = 'left', size = 8) {
    str = String(str);
    const sc = Font.scaleFor(size), dx = this.originX(str, x, align, sc), dy = Math.round(y);
    this._rec('text', { x: dx, y: dy, w: Font.width(str, sc), h: Font.H * sc, str });
    Font.draw(str, dx + sc, dy + sc, '#000000', sc);   // drop shadow
    Font.draw(str, dx, dy, col, sc);
  },
  // Text with a full dark halo — for world-space labels over busy backgrounds.
  textOut(str, x, y, col = PAL.text, align = 'center', size = 8) {
    str = String(str);
    const sc = Font.scaleFor(size), dx = this.originX(str, x, align, sc), dy = Math.round(y);
    this._rec('text', { x: dx, y: dy, w: Font.width(str, sc), h: Font.H * sc, str, world: true });
    for (const o of [[-sc, 0], [sc, 0], [0, -sc], [0, sc]]) Font.draw(str, dx + o[0], dy + o[1], '#000000', sc);
    Font.draw(str, dx, dy, col, sc);
  },
  width(str, size = 8) { return Font.width(String(str), Font.scaleFor(size)); },
  // Inspect a recorded frame (see UI.audit) and describe every layout defect found.
  layoutProblems(log) {
    const out = [], texts = log.filter(r => r.kind === 'text' && !r.world), btns = log.filter(r => r.kind === 'btn'), panels = log.filter(r => r.kind === 'panel'), rows = log.filter(r => r.kind === 'row');
    const hit = (a, b, m = 1) => a.x < b.x + b.w - m && b.x < a.x + a.w - m && a.y < b.y + b.h - m && b.y < a.y + a.h - m;
    for (const b of btns) if (b.lw + 4 > b.w) out.push(`button "${b.label}" needs ${b.lw + 4}px but is ${b.w}px wide`);
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++)
      // the same string drawn again almost on top of itself is a deliberate shadow or glow, not a collision
      if (hit(texts[i], texts[j]) && !(texts[i].str === texts[j].str && Math.abs(texts[i].x - texts[j].x) <= 4 && Math.abs(texts[i].y - texts[j].y) <= 4)) out.push(`"${texts[i].str}" overlaps "${texts[j].str}"`);
    for (const t of texts) for (const b of btns)
      if (t.str !== b.label && hit(t, b, 2)) out.push(`"${t.str}" runs under button "${b.label}"`);
    for (const t of texts) {
      if (t.x < 0 || t.x + t.w > VW) out.push(`"${t.str}" leaves the screen`);
      // innermost panel that contains the start of this text
      let best = null;
      for (const p of panels.concat(rows)) if (t.x >= p.x && t.y >= p.y && t.x < p.x + p.w && t.y < p.y + p.h && (!best || p.w * p.h < best.w * best.h)) best = p;
      if (best && (t.x + t.w > best.x + best.w - 2 || t.y + t.h > best.y + best.h - 1)) out.push(`"${t.str}" does not fit its box (${best.w}x${best.h})`);
    }
    return out;
  },

  // ---------------------------------------------------------------- frames
  // Bronze double frame with corner rivets; used by panel() and slot().
  frame(x, y, w, h, edge = PAL.edge) {
    this._rec('panel', { x, y, w, h });
    ctx.fillStyle = PAL.ink; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = edge;
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    // top-left catches the light, bottom-right falls away
    ctx.fillStyle = U.shade(edge, 1.35); ctx.fillRect(x + 1, y, w - 2, 1); ctx.fillRect(x, y + 1, 1, h - 2);
    ctx.fillStyle = U.shade(edge, 0.6); ctx.fillRect(x + 1, y + h - 1, w - 2, 1); ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
    // corner rivets
    ctx.fillStyle = PAL.edgeHi;
    for (const c of [[x + 1, y + 1], [x + w - 2, y + 1], [x + 1, y + h - 2], [x + w - 2, y + h - 2]]) ctx.fillRect(c[0], c[1], 1, 1);
  },
  panel(x, y, w, h, title) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    this._rec('panel', { x, y, w, h });
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 3, y + 4, w, h);   // drop shadow
    // body: three flat bands instead of a gradient (cheap, and reads as pixel art)
    ctx.fillStyle = PAL.panelHi; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAL.panel; ctx.fillRect(x, y + Math.round(h * 0.25), w, h - Math.round(h * 0.25));
    ctx.fillStyle = PAL.panelLo; ctx.fillRect(x, y + Math.round(h * 0.75), w, h - Math.round(h * 0.75));
    this.frame(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x + 2, y + 2, w - 4, 1);  // inner sheen
    if (title) {
      ctx.fillStyle = PAL.barHi; ctx.fillRect(x + 1, y + 1, w - 2, 13);
      ctx.fillStyle = PAL.bar; ctx.fillRect(x + 1, y + 7, w - 2, 7);
      ctx.fillStyle = PAL.edgeLo; ctx.fillRect(x + 1, y + 14, w - 2, 1);
      ctx.fillStyle = U.shade(PAL.edge, 0.85); ctx.fillRect(x + 6, y + 14, w - 12, 1);
      this.text(title, x + w / 2, y + 3, PAL.gold, 'center');
      // little diamonds either side of the title
      const tw = this.width(title) / 2;
      ctx.fillStyle = PAL.edge;
      for (const dx of [-tw - 8, tw + 7]) { const cx2 = Math.round(x + w / 2 + dx), cy2 = y + 7; ctx.fillRect(cx2, cy2 - 1, 1, 3); ctx.fillRect(cx2 - 1, cy2, 3, 1); }
    }
  },
  divider(x, y, w) {
    ctx.fillStyle = PAL.ink; ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y + 1, w, 1);
  },
  // Section heading with a rule running to the right edge.
  header(str, x, y, w, col = PAL.edge) {
    this.text(str, x, y, col);
    const tw = this.width(str) + 6;
    if (w > tw) this.divider(x + tw, y + 4, w - tw);
  },

  hover(x, y, w, h) { return this.active && Input.mx >= x && Input.mx < x + w && Input.my >= y && Input.my < y + h; },

  // ---------------------------------------------------------------- button
  btn(x, y, w, h, label, enabled = true, col = PAL.btn) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    this._rec('btn', { x, y, w, h, label, lw: this.width(label) });
    const hv = enabled && this.hover(x, y, w, h);
    const held = hv && Input.mdown[0];
    const base = enabled ? (hv ? U.shade(col, 1.45) : col) : '#272230';
    const oy = held ? 1 : 0;   // sink while pressed
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 1, y + 2, w, h);
    ctx.fillStyle = base; ctx.fillRect(x, y + oy, w, h);
    if (!held) { ctx.fillStyle = U.shade(base, 1.3); ctx.fillRect(x + 1, y + 1, w - 2, 1); }
    ctx.fillStyle = U.shade(base, 0.62); ctx.fillRect(x + 1, y + h - 2 + oy, w - 2, 1);
    const edge = enabled ? (hv ? PAL.edgeHi : PAL.edge) : '#4a4452';
    ctx.fillStyle = edge;
    ctx.fillRect(x, y + oy, w, 1); ctx.fillRect(x, y + h - 1 + oy, w, 1);
    ctx.fillRect(x, y + oy, 1, h); ctx.fillRect(x + w - 1, y + oy, 1, h);
    this.text(label, x + w / 2, y + Math.floor((h - 8) / 2) + oy, enabled ? (hv ? '#fffdf2' : PAL.text) : '#6d6678', 'center');
    if (hv && Input.mpressed[0]) { Sfx.play('ui'); Input.mpressed[0] = false; return true; }
    return false;
  },
  // Tab strip; returns the index clicked, or -1.
  tabs(names, cur, x, y) {
    let tx = x, clicked = -1;
    names.forEach((n, i) => {
      const w = this.width(n) + 16, on = i === cur;
      if (this.btn(tx, y + (on ? 0 : 1), w, on ? 14 : 13, n, true, on ? PAL.btnGold : PAL.btn)) clicked = i;
      tx += w + 3;
    });
    return clicked;
  },

  // ---------------------------------------------------------------- bars & slots
  bar(x, y, w, h, frac, col, bg = '#241c2e') {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const fw = Math.max(0, Math.round(w * U.clamp(frac, 0, 1)));
    ctx.fillStyle = PAL.ink; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    if (fw > 0) {
      ctx.fillStyle = U.shade(col, 0.72); ctx.fillRect(x, y, fw, h);
      ctx.fillStyle = col; ctx.fillRect(x, y, fw, Math.max(1, h - 1));
      ctx.fillStyle = U.shade(col, 1.45); ctx.fillRect(x, y, fw, 1);
      if (h >= 5 && fw > 2) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x + 1, y + 1, fw - 2, 1); }
    }
    if (h >= 6) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = x + 10; i < x + w; i += 10) ctx.fillRect(i, y, 1, h); } // tick marks
  },
  // Inset square well, for hotbar/equipment/item slots.
  slot(x, y, w, h, opts = {}) {
    ctx.fillStyle = PAL.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = opts.fill || '#15111e'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + 1, 1, h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 1, y + h - 2, w - 2, 1); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
    if (opts.edge) { ctx.fillStyle = opts.edge; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h); }
  },
  // List row with alternating shade and optional state tint.
  row(x, y, w, h, i, state) {
    this._rec('row', { x, y, w, h });
    const base = state === 'on' ? PAL.rowOn : state === 'bad' ? '#2e2029' : (i % 2 ? PAL.rowAlt : PAL.row);
    ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + h - 1, w, 1);
  },
  // Small rounded label chip (rarity, tier, counts).
  chip(str, x, y, col) {
    const w = this.width(str, 7) + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, w, 9);
    ctx.fillStyle = col; ctx.fillRect(x, y, 1, 9); ctx.fillRect(x + w - 1, y, 1, 9);
    ctx.fillStyle = U.shade(col, 0.5); ctx.fillRect(x + 1, y, w - 2, 1); ctx.fillRect(x + 1, y + 8, w - 2, 1);
    this.text(str, x + w / 2, y + 1, col, 'center', 7);
    return w;
  },
  // Floating tooltip box, kept on screen.
  tip(lines, x, y, col = PAL.text) {
    const w = Math.max(...lines.map(l => this.width(l))) + 10, h = lines.length * 10 + 6;
    x = U.clamp(x, 2, VW - w - 2); y = U.clamp(y, 2, VH - h - 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 2, y + 2, w, h);
    ctx.fillStyle = '#16111f'; ctx.fillRect(x, y, w, h);
    this.frame(x, y, w, h, PAL.edgeLo);
    lines.forEach((l, i) => this.text(l, x + 5, y + 4 + i * 10, i ? PAL.dim : col));
  },
  wrap(str, maxChars) {
    const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  },
  wheel: 0,
};
addEventListener('wheel', e => { UI.wheel += Math.sign(e.deltaY); }, { passive: true });

// ---------------------------------------------------------------- particles / floating text
const FX = {
  parts: [], texts: [],
  spark(x, y, col, n = 6, spd = 60, life = 0.4, size = 1, grav = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, col, size, grav });
    }
  },
  text(x, y, str, col = '#fff') { this.texts.push({ x, y, str, col, t: 0.9 }); },
  update(dt) {
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 0.98; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const t of this.texts) { t.t -= dt; t.y -= 18 * dt; }
    this.texts = this.texts.filter(t => t.t > 0);
  },
  draw(cx = 0, cy = 0) {
    for (const p of this.parts) {
      const k = U.clamp(p.life / p.max * 1.5, 0, 1);
      ctx.globalAlpha = k;
      // hot core fading to the particle colour
      if (p.size > 1 && k > 0.7) { ctx.fillStyle = '#fff6d8'; ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.size, p.size); }
      else { ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.size, p.size); }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      ctx.globalAlpha = U.clamp(t.t * 2, 0, 1);
      UI.textOut(t.str, Math.round(t.x - cx), Math.round(t.y - cy), t.col, 'center');
    }
    ctx.globalAlpha = 1;
  },
  clear() { this.parts = []; this.texts = []; },
};

// ---------------------------------------------------------------- procedural item art
// Appearance is derived from the ores used: palette from dominant/accent ore, trait overlays,
// sparkle for Masterwork. Rules are authored, not individual items.
const ItemArt = {
  // Blade profile per class: [bladeLen, bladeW, guardW, gripLen, shape]
  PROF: {
    dagger:     { len: 11, w: 3, guard: 7,  grip: 4, tip: 3, shape: 'leaf' },
    sword:      { len: 18, w: 4, guard: 11, grip: 5, tip: 5, shape: 'straight' },
    greatsword: { len: 25, w: 6, guard: 14, grip: 7, tip: 7, shape: 'straight' },
    colossal:   { len: 33, w: 9, guard: 17, grip: 9, tip: 9, shape: 'slab' },
    fists:      { len: 6,  w: 3, guard: 5,  grip: 3, tip: 2, shape: 'straight' },
  },
  sprite(it) {
    if (Art.ext['item_' + it.cls]) return Art.ext['item_' + it.cls];
    const key = 'item_' + it.id + '_' + it.enh + '_' + (it.spell || '');
    if (Art.gen[key]) return Art.gen[key];
    const raw = it.kind === 'weapon' ? this.weapon(it) : this.armor(it);
    Art.gen[key] = Art.outline(raw, PAL.ink);
    return Art.gen[key];
  },
  weapon(it) {
    const p = this.PROF[it.cls] || this.PROF.sword;
    const W = p.guard + 2, H = p.len + p.grip + 5;
    return Art.mk(W, H, (g) => {
      const rnd = mulberry32(it.seed);
      const cx = Math.floor(W / 2);
      const hi = U.shade(it.color, 1.45), lo = it.color2, mid = it.color;
      // ---- blade (tip at top)
      for (let y = 0; y < p.len; y++) {
        let bw;
        if (y < p.tip) bw = Math.max(1, Math.round(p.w * (y + 1) / p.tip));           // taper to the point
        else if (p.shape === 'leaf') bw = Math.max(1, p.w - Math.round((y - p.tip) / 4)); // leaf swells then narrows
        else if (p.shape === 'slab') bw = p.w;
        else bw = p.w;
        const bx = cx - Math.floor(bw / 2);
        g.fillStyle = lo; g.fillRect(bx, y, bw, 1);
        g.fillStyle = mid; g.fillRect(bx, y, Math.max(1, bw - 1), 1);
        g.fillStyle = hi; g.fillRect(bx, y, 1, 1);                                      // lit edge
        if (bw >= 4 && y > p.tip) { g.fillStyle = U.shade(lo, 0.85); g.fillRect(cx, y, 1, 1); }  // fuller groove
        if (bw >= 7) { g.fillStyle = it.accent; g.fillRect(cx + 1, y, 1, 1); }
      }
      // trait speckles along the blade
      for (const t of it.traits) {
        const oc = { volcanic: '#ff8a2a', demonic: '#d35bff', glass: '#e2fbff', explosive: '#c9ff5a' }[t.id];
        for (let i = 0; i < 3 + p.len / 4; i++) { g.fillStyle = oc; g.fillRect(cx - Math.floor(p.w / 2) + Math.floor(rnd() * p.w), p.tip + Math.floor(rnd() * (p.len - p.tip)), 1, 1); }
      }
      // spell glow tint on the edge
      if (it.spell) {
        const sc = { flame: '#ff7a2a', storm: '#7fd8ff', frost: '#bff0ff', void: '#c23bff', wind: '#c8f7d8' }[it.spell];
        if (sc) { g.fillStyle = sc; for (let y = p.tip; y < p.len; y += 2) g.fillRect(cx - Math.floor(p.w / 2), y, 1, 1); }
      }
      // ---- guard
      const gy = p.len, gw = p.guard, gx = cx - Math.floor(gw / 2);
      g.fillStyle = U.shade(it.accent, 0.6); g.fillRect(gx, gy + 1, gw, 2);
      g.fillStyle = it.accent; g.fillRect(gx, gy, gw, 2);
      g.fillStyle = U.shade(it.accent, 1.4); g.fillRect(gx + 1, gy, gw - 2, 1);
      if (p.guard >= 11) { // quillon tips droop toward the blade
        g.fillStyle = it.accent; g.fillRect(gx, gy - 1, 2, 1); g.fillRect(gx + gw - 2, gy - 1, 2, 1);
      }
      if (p.guard >= 14) { g.fillStyle = U.shade(it.accent, 0.75); g.fillRect(gx + 2, gy + 3, gw - 4, 1); }
      // ---- grip (wrapped leather) and pommel
      const ry = gy + 3, rw = p.w >= 6 ? 4 : 3, rx = cx - Math.floor(rw / 2);
      g.fillStyle = '#3d2716'; g.fillRect(rx, ry, rw, p.grip);
      g.fillStyle = '#5c3a20'; g.fillRect(rx, ry, rw - 1, p.grip);
      g.fillStyle = '#2a1a0e'; for (let y = ry + 1; y < ry + p.grip; y += 2) g.fillRect(rx, y, rw, 1);
      const py = ry + p.grip;
      g.fillStyle = U.shade(it.accent, 0.7); g.fillRect(cx - 2, py, 4, 2);
      g.fillStyle = it.accent; g.fillRect(cx - 2, py, 4, 1); g.fillRect(cx - 1, py + 1, 2, 1);
      if (it.master) { g.fillStyle = '#fff6b0'; for (let i = 0; i < 6; i++) g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * p.len), 1, 1); }
    });
  },
  armor(it) {
    return Art.mk(16, 16, (g) => {
      const m = it.color, d = it.color2, a = it.accent, h = U.shade(m, 1.4), s = U.shade(d, 0.7);
      const P = (col, x, y, w, hh) => { g.fillStyle = col; g.fillRect(x, y, w, hh); };
      const heavy = it.cls === 'heavy' || it.cls === 'bulwark';
      if (it.slot === 'head') {
        // helm: dome, brow band, eye slit, cheek guards, crest
        P(s, 3, 3, 10, 10); P(d, 3, 4, 10, 8); P(m, 4, 3, 8, 8); P(h, 5, 3, 4, 2);
        P(a, 7, 0, 2, 5);                                   // crest spine
        if (heavy) { P(a, 6, 1, 4, 1); P(d, 2, 7, 1, 5); P(d, 13, 7, 1, 5); }
        P('#0a0810', 4, 8, 8, 2); P(a, 3, 7, 10, 1);        // eye slit + brow band
        P(s, 4, 12, 8, 2); P(m, 4, 12, 3, 1);
      } else if (it.slot === 'chest') {
        // cuirass: pauldrons, chest plate, belt
        P(s, 1, 3, 14, 11); P(d, 2, 3, 12, 10); P(m, 3, 3, 10, 9); P(h, 3, 3, 10, 1);
        P(d, 1, 2, 4, 4); P(m, 1, 2, 3, 2); P(d, 11, 2, 4, 4); P(m, 12, 2, 3, 2);   // shoulders
        P(a, 7, 4, 2, 8);                                   // centre ridge
        P(h, 4, 5, 2, 3);                                   // chest highlight
        P(s, 2, 11, 12, 1); P(a, 2, 12, 12, 2); P(U.shade(a, 1.4), 7, 12, 2, 2);     // belt + buckle
        if (heavy) { P(d, 3, 8, 10, 1); P(d, 3, 10, 10, 1); }
      } else if (it.slot === 'legs') {
        P(s, 2, 2, 12, 4); P(a, 2, 2, 12, 1);               // waist
        P(d, 2, 5, 5, 9); P(m, 3, 5, 3, 8); P(h, 3, 5, 1, 7);
        P(d, 9, 5, 5, 9); P(m, 10, 5, 3, 8); P(h, 10, 5, 1, 7);
        P(s, 7, 5, 2, 4);
        if (heavy) { P(a, 2, 9, 5, 1); P(a, 9, 9, 5, 1); }  // knee plates
      } else {
        // boots: cuff, shaft, sole
        P(a, 2, 4, 5, 2); P(a, 9, 4, 5, 2);
        P(s, 2, 6, 5, 7); P(m, 2, 6, 4, 6); P(h, 2, 6, 1, 5);
        P(s, 9, 6, 5, 7); P(m, 9, 6, 4, 6); P(h, 9, 6, 1, 5);
        P('#2a1e14', 1, 13, 7, 2); P('#2a1e14', 8, 13, 7, 2);
        if (heavy) { P(a, 2, 9, 5, 1); P(a, 9, 9, 5, 1); }
      }
      const rnd = mulberry32(it.seed);
      for (const t of it.traits) {
        const oc = { volcanic: '#ff8a2a', demonic: '#d35bff', glass: '#e2fbff', explosive: '#c9ff5a' }[t.id];
        for (let i = 0; i < 5; i++) { g.fillStyle = oc; g.fillRect(3 + Math.floor(rnd() * 10), 3 + Math.floor(rnd() * 10), 1, 1); }
      }
      if (it.spell) {
        const sc = { fortify: '#7fd0ff', vitality: '#7fe08a', inferno: '#ff7a2a', iceshield: '#bff0ff' }[it.spell];
        if (sc) { g.fillStyle = sc; g.fillRect(1, 7, 1, 1); g.fillRect(14, 7, 1, 1); g.fillRect(7, 1, 1, 1); }
      }
      if (it.master) { g.fillStyle = '#fff6b0'; for (let i = 0; i < 4; i++) g.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1); }
    });
  },
  // Draw an icon fitted into a box.
  icon(it, x, y, size = 20) {
    const s = this.sprite(it);
    const sc = Math.min(size / s.width, size / s.height);
    const w = Math.round(s.width * sc), h = Math.round(s.height * sc);
    ctx.drawImage(s, Math.round(x + (size - w) / 2), Math.round(y + (size - h) / 2), w, h);
  },
};

// ---------------------------------------------------------------- small icons
function oreIcon(id, x, y, s = 8) {
  const o = ORES[id];
  ctx.fillStyle = PAL.ink; ctx.fillRect(x + 1, y + 1, s - 1, s - 1);
  ctx.fillStyle = o.col2; ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.fillStyle = o.col; ctx.fillRect(x + 1, y + 1, s - 3, s - 3);
  ctx.fillStyle = U.shade(o.col, 1.5); ctx.fillRect(x + 2, y + 2, 2, 1);
  ctx.fillStyle = o.col2; ctx.fillRect(x + s - 3, y + s - 3, 1, 1);
}
function gemIcon(id, x, y, s = 8) {
  const g = GEMS[id];
  ctx.fillStyle = PAL.ink; ctx.fillRect(x + 2, y, s - 4, 1); ctx.fillRect(x + 1, y + 1, s - 2, s - 3); ctx.fillRect(x + 2, y + s - 2, s - 4, 1);
  ctx.fillStyle = U.shade(g.col, 0.65); ctx.fillRect(x + 2, y + 1, s - 4, s - 3);
  ctx.fillStyle = g.col; ctx.fillRect(x + 2, y + 1, s - 5, s - 4);
  ctx.fillStyle = '#ffffffdd'; ctx.fillRect(x + 3, y + 2, 1, 2);
}
// Potion bottle, used on the hotbar and in shops.
function potionIcon(id, x, y) {
  const p = POTIONS[id];
  const P = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
  P(PAL.ink, 3, 0, 4, 3); P('#b8c0cc', 3, 0, 4, 2); P('#e8eef5', 3, 0, 2, 1);
  P(PAL.ink, 1, 2, 8, 10);
  P(U.shade(p.col, 0.55), 2, 3, 6, 8);
  P(p.col, 2, 5, 5, 6);
  P(U.shade(p.col, 1.5), 3, 6, 1, 3);
  P('rgba(255,255,255,0.5)', 3, 3, 2, 1);
}
