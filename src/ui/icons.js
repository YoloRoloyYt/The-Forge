'use strict';
// ---------------------------------------------------------------------------
// icons.js — UI-side sprite extraction.
//
// The world renderer reads sprites out of a GL atlas; menus need them as plain
// canvases so they can be drawn crisp at any size and tinted per item. Both
// come from the same generated art, so an axe in your hand and an axe in your
// bag are the same axe.
// ---------------------------------------------------------------------------
(function (F) {

  const cache = new Map();

  function cut(key) {
    const f = F.Art.frames[key];
    if (!f || !F.Art.sheet) return null;
    const c = document.createElement('canvas');
    c.width = f.w; c.height = f.h;
    const g = c.getContext('2d');
    g.drawImage(F.Art.sheet, f.u0 * F.Art.W, f.v0 * F.Art.H, f.w, f.h, 0, 0, f.w, f.h);
    return c;
  }

  function tinted(src, col) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(src, 0, 0);
    return c;
  }

  F.IconCache = {
    get(key, col) {
      const id = key + '|' + (col || '');
      if (cache.has(id)) return cache.get(id);
      let c = cut(key);
      if (c && col) c = tinted(c, col);
      cache.set(id, c);
      return c;
    },
    /** Compose a multi-layer icon: [[spriteKey, tintOrNull], ...] */
    compose(id, layers, w, h) {
      if (cache.has(id)) return cache.get(id);
      const pad = 3;
      const inner = document.createElement('canvas');
      inner.width = w; inner.height = h;
      const ig = inner.getContext('2d');
      ig.imageSmoothingEnabled = false;
      for (const [key, col] of layers) {
        const piece = this.get(key, col);
        if (!piece) continue;
        const s = Math.min((w - pad * 2) / piece.width, (h - pad * 2) / piece.height);
        ig.drawImage(piece, (w - piece.width * s) / 2, (h - piece.height * s) / 2, piece.width * s, piece.height * s);
      }
      // A dark rim traced around the assembled silhouette. Menu backgrounds are
      // dark too, and armour plates without one read as coloured blobs.
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      const shadow = document.createElement('canvas');
      shadow.width = w; shadow.height = h;
      const sg = shadow.getContext('2d');
      sg.imageSmoothingEnabled = false;
      sg.drawImage(inner, 0, 0);
      sg.globalCompositeOperation = 'source-in';
      sg.fillStyle = '#0a0710'; sg.fillRect(0, 0, w, h);
      const o = 1.6;
      for (const [dx, dy] of [[o, 0], [-o, 0], [0, o], [0, -o], [o, o], [-o, -o], [o, -o], [-o, o]])
        g.drawImage(shadow, dx, dy);
      g.drawImage(inner, 0, 0);
      cache.set(id, c);
      return c;
    },
    clear() { cache.clear(); },
  };

  /** The icon for a forged item, built from the same parts the world uses. */
  F.ItemIcon = function (it) {
    if (!it) return null;
    if (it.cls === 'fists') return F.IconCache.get('pc_hand', '#caa07a');
    const id = 'item:' + it.kind + ':' + it.cls + ':' + it.slot + ':' + it.color + ':' + (it.glowCol || '') + ':' + (it.master ? 'm' : '');
    if (it.kind === 'weapon') {
      return F.IconCache.compose(id, [
        ['wpn_' + it.cls, it.color],
        ['grip_' + it.cls, null],
        it.glowCol ? ['wglow_' + it.cls, it.glowCol] : null,
      ].filter(Boolean), 80, 104);
    }
    const map = { head: 'arm_head_', chest: 'arm_chest_', legs: 'arm_legs_', boots: 'arm_boots_' };
    return F.IconCache.compose(id, [[map[it.slot] + it.cls, it.color]], 80, 80);
  };

  F.PickIcon = function (idx) {
    const p = F.PICKS[idx];
    return F.IconCache.compose('pick:' + idx, [
      ['pick_haft', null], ['pick_head', p.col],
      p.glow ? ['pick_glow', p.glow] : null,
    ].filter(Boolean), 72, 88);
  };

  F.OreIcon = function (id) {
    const o = F.ORES[id];
    return F.IconCache.get('ore_drop', o ? o.col : '#8d929c');
  };
  F.GemIcon = function (id) {
    const g = F.GEMS[id];
    return F.IconCache.get('gem_drop', g ? g.col : '#ffffff');
  };

})(window.F2 = window.F2 || {});
