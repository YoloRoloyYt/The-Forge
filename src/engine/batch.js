'use strict';
// ---------------------------------------------------------------------------
// batch.js — the geometry pass. One interleaved vertex buffer, one atlas set,
// three MRT outputs:
//   RT0 albedo.rgb            + coverage
//   RT1 normal.xy, height, specular
//   RT2 emissive.rgb          + shadow-caster weight
// Sprites carry a rotation so their baked normals rotate with them, an
// emissive multiplier (for things that flare — lava, runes, hot metal) and a
// tint that is applied to albedo only, never to the normal.
// ---------------------------------------------------------------------------
(function (F) {

  const VS = `#version 300 es
  layout(location=0) in vec2 a_pos;
  layout(location=1) in vec2 a_uv;
  layout(location=2) in vec4 a_tint;
  layout(location=3) in vec2 a_rot;   // cos,sin for normal rotation (x may be negated for flips)
  layout(location=4) in vec2 a_ext;   // x = emissive multiplier, y = height scale
  uniform vec4 u_cam;                 // x,y = camera top-left in world px; z,w = 2/viewW, -2/viewH
  out vec2 v_uv; out vec4 v_tint; out vec2 v_rot; out vec2 v_ext;
  void main(){
    v_uv = a_uv; v_tint = a_tint; v_rot = a_rot; v_ext = a_ext;
    vec2 s = (a_pos - u_cam.xy) * u_cam.zw + vec2(-1.0, 1.0);
    gl_Position = vec4(s, 0.0, 1.0);
  }`;

  const FS = `#version 300 es
  precision highp float;
  in vec2 v_uv; in vec4 v_tint; in vec2 v_rot; in vec2 v_ext;
  uniform sampler2D u_alb, u_nrm, u_ems;
  layout(location=0) out vec4 o_albedo;
  layout(location=1) out vec4 o_normal;
  layout(location=2) out vec4 o_emis;
  void main(){
    vec4 a = texture(u_alb, v_uv);
    if (a.a < 0.004) discard;
    vec4 n = texture(u_nrm, v_uv);
    vec4 e = texture(u_ems, v_uv);

    // unpack the baked normal, rotate it into world space, re-pack
    vec2 nxy = n.xy * 2.0 - 1.0;
    float c = v_rot.x, s = v_rot.y;
    // a negative cosine magnitude flag is not used; flips are baked by negating nx via a_rot
    vec2 r = vec2(nxy.x * c - nxy.y * s, nxy.x * s + nxy.y * c);

    float alpha = a.a * v_tint.a;
    o_albedo = vec4(a.rgb * v_tint.rgb * alpha, alpha);
    o_normal = vec4((r * 0.5 + 0.5) * alpha, n.z * v_ext.y * alpha, n.w * alpha);
    o_emis   = vec4(e.rgb * v_tint.rgb * v_ext.x * alpha, e.a * alpha);
  }`;

  const STRIDE = 36;             // bytes per vertex
  const MAX_SPRITES = 24000;

  const Batch = F.Batch = {
    prog: null, vao: null, vbo: null, ibo: null,
    buf: null, f32: null, u32: null,
    count: 0,                    // sprites queued
    drawCalls: 0, spritesDrawn: 0,
    atlas: null,                 // { alb, nrm, ems, w, h }

    init() {
      const gl = F.GL.gl;
      this.prog = F.GL.program(VS, FS, 'gbuffer');
      this.buf = new ArrayBuffer(MAX_SPRITES * 4 * STRIDE);
      this.f32 = new Float32Array(this.buf);
      this.u32 = new Uint32Array(this.buf);

      this.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.buf.byteLength, gl.DYNAMIC_DRAW);

      const idx = new Uint32Array(MAX_SPRITES * 6);
      for (let i = 0, v = 0; i < MAX_SPRITES; i++, v += 4) {
        const o = i * 6;
        idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2;
        idx[o + 3] = v + 2; idx[o + 4] = v + 1; idx[o + 5] = v + 3;
      }
      this.ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      const fa = (loc, n, off) => { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, gl.FLOAT, false, STRIDE, off); };
      fa(0, 2, 0); fa(1, 2, 8);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, STRIDE, 16);
      fa(3, 2, 20); fa(4, 2, 28);
      gl.bindVertexArray(null);
      return this;
    },

    setAtlas(a) { this.atlas = a; },

    begin() { this.count = 0; this.drawCalls = 0; this.spritesDrawn = 0; },

    /**
     * Push one quad.
     * f: atlas frame { u0,v0,u1,v1, w,h, ax,ay } (ax/ay = anchor in px from top-left)
     * opts: { rot, scale, sx, sy, flip, tint (uint32 abgr), alpha, emis, height }
     */
    push(f, x, y, o) {
      if (this.count >= MAX_SPRITES) this.flush();
      o = o || EMPTY;
      const sx = (o.sx !== undefined ? o.sx : (o.scale !== undefined ? o.scale : 1)) * (o.flip ? -1 : 1);
      const sy = (o.sy !== undefined ? o.sy : (o.scale !== undefined ? o.scale : 1));
      const rot = o.rot || 0;
      const w = f.w * sx, h = f.h * sy;
      const ax = (o.ax !== undefined ? o.ax : f.ax) * (o.sx !== undefined ? o.sx : (o.scale !== undefined ? o.scale : 1)) * (o.flip ? -1 : 1);
      const ay = (o.ay !== undefined ? o.ay : f.ay) * sy;

      let x0 = -ax, y0 = -ay, x1 = x0 + w, y1 = y0 + h;
      const c = rot ? Math.cos(rot) : 1, s = rot ? Math.sin(rot) : 0;

      const tint = o.tint === undefined ? 0xffffffff : o.tint;
      const alpha = o.alpha === undefined ? 1 : o.alpha;
      const A = (tint >>> 24) & 255;
      const packed = (tint & 0x00ffffff) | ((Math.round(A * alpha) & 255) << 24);

      // normal rotation: flipping x mirrors the normal's x component
      const nc = o.flip ? -c : c, ns = o.flip ? -s : s;

      const emis = o.emis === undefined ? 1 : o.emis;
      const hgt = o.height === undefined ? 1 : o.height;

      const f32 = this.f32, u32 = this.u32;
      let p = this.count * 36;   // 4 verts * 9 floats
      const put = (lx, ly, u, v) => {
        f32[p] = x + lx * c - ly * s; f32[p + 1] = y + lx * s + ly * c;
        f32[p + 2] = u; f32[p + 3] = v;
        u32[p + 4] = packed;
        f32[p + 5] = nc; f32[p + 6] = ns;
        f32[p + 7] = emis; f32[p + 8] = hgt;
        p += 9;
      };
      put(x0, y0, f.u0, f.v0);
      put(x1, y0, f.u1, f.v0);
      put(x0, y1, f.u0, f.v1);
      put(x1, y1, f.u1, f.v1);
      this.count++;
    },

    /** Push an arbitrary quad by explicit corners (used for beams, trails, links). */
    pushQuad(f, ax, ay, bx, by, cx, cy, dx, dy, o) {
      if (this.count >= MAX_SPRITES) this.flush();
      o = o || EMPTY;
      const tint = o.tint === undefined ? 0xffffffff : o.tint;
      const alpha = o.alpha === undefined ? 1 : o.alpha;
      const A = (tint >>> 24) & 255;
      const packed = (tint & 0x00ffffff) | ((Math.round(A * alpha) & 255) << 24);
      const rot = o.rot || 0, nc = Math.cos(rot), ns = Math.sin(rot);
      const emis = o.emis === undefined ? 1 : o.emis;
      const hgt = o.height === undefined ? 1 : o.height;
      const f32 = this.f32, u32 = this.u32;
      let p = this.count * 36;
      const put = (X, Y, u, v) => {
        f32[p] = X; f32[p + 1] = Y; f32[p + 2] = u; f32[p + 3] = v;
        u32[p + 4] = packed; f32[p + 5] = nc; f32[p + 6] = ns;
        f32[p + 7] = emis; f32[p + 8] = hgt; p += 9;
      };
      put(ax, ay, f.u0, f.v0); put(bx, by, f.u1, f.v0);
      put(dx, dy, f.u0, f.v1); put(cx, cy, f.u1, f.v1);
      this.count++;
    },

    /** Upload and draw everything queued. cam = {x,y,vw,vh}. */
    flush(cam) {
      const gl = F.GL.gl;
      if (!this.count) return;
      const c = cam || this._cam;
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.f32, 0, this.count * 36);
      F.GL.use(this.prog);
      gl.uniform4f(this.prog.u.u_cam, c.x, c.y, 2 / c.vw, -2 / c.vh);
      F.GL.bindTex(0, this.atlas.alb); gl.uniform1i(this.prog.u.u_alb, 0);
      F.GL.bindTex(1, this.atlas.nrm); gl.uniform1i(this.prog.u.u_nrm, 1);
      F.GL.bindTex(2, this.atlas.ems); gl.uniform1i(this.prog.u.u_ems, 2);
      gl.drawElements(gl.TRIANGLES, this.count * 6, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      this.drawCalls++; this.spritesDrawn += this.count;
      this.count = 0;
    },

    setCam(c) { this._cam = c; },
  };

  const EMPTY = {};

})(window.F2 = window.F2 || {});
