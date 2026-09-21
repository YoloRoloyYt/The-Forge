'use strict';
// ---------------------------------------------------------------------------
// gl.js — WebGL2 context, shader/program helpers, textures, framebuffers.
// Everything else in the renderer is built on these five primitives.
// ---------------------------------------------------------------------------
(function (F) {

  const GL = F.GL = {
    gl: null, canvas: null,
    /** Device-pixel size of the backbuffer. */
    dw: 0, dh: 0,
    floatOK: false,

    init(canvas) {
      const gl = canvas.getContext('webgl2', {
        alpha: false, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: true, powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
      if (!gl) throw new Error('WebGL2 is required');
      this.gl = gl; this.canvas = canvas;
      this.floatOK = !!gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('OES_texture_float_linear');
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.clearColor(0, 0, 0, 1);
      this.unitQuad = this.buffer(new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
      this._quadVao = null;
      return gl;
    },

    buffer(data, usage) {
      const gl = this.gl, b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
      return b;
    },

    // ------------------------------------------------------------- shaders
    compile(type, src) {
      const gl = this.gl, s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        const numbered = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
        throw new Error('shader compile failed: ' + log + '\n' + numbered);
      }
      return s;
    },

    /** Compile+link; returns a program object with cached uniform setters. */
    program(vsSrc, fsSrc, name) {
      const gl = this.gl;
      const p = gl.createProgram();
      gl.attachShader(p, this.compile(gl.VERTEX_SHADER, vsSrc));
      gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error('link failed (' + (name || '?') + '): ' + gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        const base = info.name.replace(/\[0\]$/, '');
        u[base] = gl.getUniformLocation(p, info.name);
      }
      const a = {};
      const an = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < an; i++) {
        const info = gl.getActiveAttrib(p, i);
        a[info.name] = gl.getAttribLocation(p, info.name);
      }
      return { p, u, a, name: name || '?' };
    },

    use(prog) { this.gl.useProgram(prog.p); return prog; },

    // ------------------------------------------------------------ textures
    /**
     * fmt: 'rgba8' | 'rgba16f' | 'r8'
     * filter: gl.NEAREST | gl.LINEAR
     */
    texture(w, h, opts) {
      const gl = this.gl, o = opts || {};
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      let internal = gl.RGBA8, format = gl.RGBA, type = gl.UNSIGNED_BYTE;
      if (o.fmt === 'rgba16f') { internal = gl.RGBA16F; type = gl.HALF_FLOAT; }
      else if (o.fmt === 'r8') { internal = gl.R8; format = gl.RED; }
      gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
      const f = o.filter === undefined ? gl.NEAREST : o.filter;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      const wrap = o.wrap || gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      if (o.src) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, format, type, o.src);
      t._w = w; t._h = h; t._fmt = o.fmt || 'rgba8';
      return t;
    },

    /** Upload a canvas/ImageData into an existing texture at (x,y). */
    upload(tex, x, y, src) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, src);
    },

    bindTex(unit, tex) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
    },

    // -------------------------------------------------------- framebuffers
    /** targets: array of texture-option objects (one per colour attachment). */
    fbo(w, h, targets) {
      const gl = this.gl;
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      const texs = [], bufs = [];
      (targets || [{}]).forEach((o, i) => {
        const t = this.texture(w, h, o);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
        texs.push(t); bufs.push(gl.COLOR_ATTACHMENT0 + i);
      });
      gl.drawBuffers(bufs);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('incomplete FBO: 0x' + st.toString(16));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fb, tex: texs, w, h, bufs };
    },

    /** Release an FBO and the textures hanging off it. */
    freeFbo(f) {
      if (!f) return;
      const gl = this.gl;
      for (const t of f.tex) gl.deleteTexture(t);
      gl.deleteFramebuffer(f.fb);
    },

    bindFbo(f, clear) {
      const gl = this.gl;
      if (f) { gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb); gl.viewport(0, 0, f.w, f.h); gl.drawBuffers(f.bufs); }
      else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, this.dw, this.dh); }
      if (clear) { gl.clearColor(clear[0], clear[1], clear[2], clear[3]); gl.clear(gl.COLOR_BUFFER_BIT); }
    },

    // --------------------------------------------------------- blend modes
    blend(mode) {
      const gl = this.gl;
      if (mode === 'none') { gl.disable(gl.BLEND); return; }
      gl.enable(gl.BLEND);
      if (mode === 'add') gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE, gl.ONE);
      else if (mode === 'premul') gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      else gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.blendEquation(gl.FUNC_ADD);
    },

    /** Draw a full-screen triangle-pair with the bound program. */
    fullscreen(prog) {
      const gl = this.gl;
      if (!this._fsVao) {
        this._fsVao = gl.createVertexArray();
        gl.bindVertexArray(this._fsVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.unitQuad);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
        gl.bindVertexArray(null);
      }
      gl.bindVertexArray(this._fsVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindVertexArray(null);
    },
  };

  /** Boilerplate vertex shader for full-screen passes: a_p in 0..1, v_uv out. */
  GL.FS_VS = `#version 300 es
layout(location=0) in vec2 a_p;
out vec2 v_uv;
void main(){ v_uv = a_p; gl_Position = vec4(a_p*2.0-1.0, 0.0, 1.0); }`;

})(window.F2 = window.F2 || {});
