'use strict';
// ---------------------------------------------------------------------------
// rig.js — cut-out skeletal animation.
//
// Characters are not animated frame by frame. A skeleton of bones carries a
// sprite each; animations are plain functions that write bone angles for a
// phase. That buys smooth, blendable motion, per-frame aiming, equipment that
// layers onto the same skeleton, and hit reactions that can bend a pose that
// is already playing — none of which a sprite sheet gives you.
// ---------------------------------------------------------------------------
(function (F) {

  /**
   * Bone: { name, parent, x, y, angle, sprite, z, sx, sy, ax, ay }
   *   x,y     joint offset from the parent's origin, in the parent's frame
   *   angle   rest angle (radians)
   *   z       draw order; lower first
   *   ax,ay   sprite anchor override (defaults to the frame's own)
   */
  class Rig {
    constructor(def) {
      this.bones = [];
      this.byName = {};
      for (const b of def) {
        const bone = Object.assign({
          x: 0, y: 0, angle: 0, z: 0, sx: 1, sy: 1, sprite: null, parent: null,
          wx: 0, wy: 0, wa: 0, wsx: 1, wsy: 1, hidden: false,
        }, b);
        bone.pose = 0; bone.poseX = 0; bone.poseY = 0; bone.poseScale = 1;
        this.bones.push(bone);
        this.byName[bone.name] = bone;
      }
      this.order = this.bones.slice().sort((a, b) => a.z - b.z);
      // resolve parents once
      for (const b of this.bones) b._p = b.parent ? this.byName[b.parent] : null;
      // a rig is evaluated parent-before-child
      this.chain = topo(this.bones);
    }

    reset() {
      for (const b of this.bones) { b.pose = 0; b.poseX = 0; b.poseY = 0; b.poseScale = 1; b.hidden = false; }
    }
    set(name, angle, dx, dy) {
      const b = this.byName[name];
      if (!b) return;
      b.pose = angle || 0;
      if (dx !== undefined) b.poseX = dx;
      if (dy !== undefined) b.poseY = dy;
    }
    add(name, angle) { const b = this.byName[name]; if (b) b.pose += angle; }
    hide(name, v) { const b = this.byName[name]; if (b) b.hidden = v !== false; }
    sprite(name, key) { const b = this.byName[name]; if (b) b.sprite = key; }
    bone(name) { return this.byName[name]; }

    /** Evaluate world transforms. root: {x, y, angle, sx, sy}. */
    pose(root) {
      const rx = root.x, ry = root.y, ra = root.angle || 0;
      const rsx = root.sx === undefined ? 1 : root.sx, rsy = root.sy === undefined ? 1 : root.sy;
      const rc = Math.cos(ra), rs = Math.sin(ra);
      for (const b of this.chain) {
        const p = b._p;
        const lx = (b.x + b.poseX) * (p ? 1 : rsx), ly = (b.y + b.poseY) * (p ? 1 : rsy);
        if (!p) {
          b.wx = rx + (lx * rc - ly * rs);
          b.wy = ry + (lx * rs + ly * rc);
          b.wa = ra + b.angle + b.pose;
          b.wsx = rsx * b.sx; b.wsy = rsy * b.sy;
        } else {
          const c = Math.cos(p.wa), s = Math.sin(p.wa);
          const sx = lx * p.wsx, sy = ly * p.wsy;
          b.wx = p.wx + (sx * c - sy * s);
          b.wy = p.wy + (sx * s + sy * c);
          b.wa = p.wa + b.angle + b.pose;
          b.wsx = p.wsx * b.sx; b.wsy = p.wsy * b.sy;
        }
      }
    }

    /**
     * Push every visible bone sprite into the batcher.
     * opt: { tint, alpha, emis, height, tints: {boneName: uint} }
     */
    draw(opt) {
      const A = F.Art, Bt = F.Batch;
      opt = opt || {};
      const tints = opt.tints;
      for (const b of this.order) {
        if (b.hidden || !b.sprite) continue;
        if (!A.has(b.sprite)) continue;
        const f = A.get(b.sprite);
        Bt.push(f, b.wx, b.wy, {
          rot: b.wa, sx: b.wsx * (b.poseScale || 1), sy: b.wsy * (b.poseScale || 1),
          ax: b.ax, ay: b.ay,
          tint: (tints && tints[b.name] !== undefined) ? tints[b.name] : opt.tint,
          alpha: opt.alpha, emis: opt.emis === undefined ? 1 : opt.emis,
          height: opt.height === undefined ? 1 : opt.height,
        });
      }
    }

    /**
     * Draw the whole figure four times in a dark tint, offset by `px` in each
     * direction, then draw it properly on top. That traces one clean rim around
     * the assembled silhouette — outlining each part separately would draw seams
     * everywhere the parts overlap.
     */
    drawOutlined(opt, px, col) {
      const A = F.Art, Bt = F.Batch;
      const w = px === undefined ? 1.25 : px;
      const tint = F.Col.tint(col || '#08060c', 1);
      const offs = [[w, 0], [-w, 0], [0, w], [0, -w], [w, w], [-w, -w], [w, -w], [-w, w]];
      for (const o of offs) {
        for (const b of this.order) {
          if (b.hidden || !b.sprite || !A.has(b.sprite)) continue;
          const f = A.get(b.sprite);
          Bt.push(f, b.wx + o[0], b.wy + o[1], {
            rot: b.wa, sx: b.wsx * (b.poseScale || 1), sy: b.wsy * (b.poseScale || 1),
            ax: b.ax, ay: b.ay, tint, alpha: opt && opt.alpha, emis: 0, height: 0.02,
          });
        }
      }
      this.draw(opt);
    }

    /** World position of a bone's origin — used to spawn sparks at a hand. */
    at(name, ox, oy) {
      const b = this.byName[name];
      if (!b) return { x: 0, y: 0 };
      const c = Math.cos(b.wa), s = Math.sin(b.wa);
      const x = (ox || 0) * b.wsx, y = (oy || 0) * b.wsy;
      return { x: b.wx + x * c - y * s, y: b.wy + x * s + y * c, a: b.wa };
    }
  }

  function topo(bones) {
    const out = [], done = new Set();
    let guard = 0;
    while (out.length < bones.length && guard++ < 64) {
      for (const b of bones) {
        if (done.has(b.name)) continue;
        if (b._p && !done.has(b._p.name)) continue;
        out.push(b); done.add(b.name);
      }
    }
    return out;
  }

  F.Rig = Rig;

  // ------------------------------------------------------------- animation
  /** Small helpers used by every animation function. */
  F.Anim = {
    /** Smooth 0..1 triangle wave. */
    tri(p) { return Math.abs(((p % 1) + 1) % 1 * 2 - 1); },
    sin(p) { return Math.sin(p * Math.PI * 2); },
    cos(p) { return Math.cos(p * Math.PI * 2); },
    /** Ease a value toward a target at a frame-rate independent rate. */
    to(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); },
  };

})(window.F2 = window.F2 || {});
