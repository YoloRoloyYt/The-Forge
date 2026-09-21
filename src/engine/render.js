'use strict';
// ---------------------------------------------------------------------------
// render.js — the frame.
//
//   geometry  -> G-buffer (albedo | normal+height+spec | emissive)
//   lights    -> instanced quads, normal-mapped, ray-marched tile shadows
//   composite -> HDR scene = albedo*(ambient*AO + light) + emissive
//   bloom     -> 6-level progressive down/up sample (wide, soft, cheap)
//   present   -> heat shimmer, ACES tonemap, colour grade, vignette,
//                chromatic aberration, grain, sharp-bilinear upscale
// ---------------------------------------------------------------------------
(function (F) {

  // ------------------------------------------------------------------ lights
  const LIGHT_VS = `#version 300 es
  layout(location=0) in vec2 a_p;
  layout(location=1) in vec2 i_pos;
  layout(location=2) in vec2 i_zr;    // z height, radius
  layout(location=3) in vec4 i_col;   // rgb, intensity
  layout(location=4) in vec4 i_cone;  // angle, spread(half-width, >=PI = omni), shadow, specular
  uniform vec4 u_cam;                 // camx, camy, viewW, viewH
  out vec2 v_pos; out vec2 v_zr; out vec4 v_col; out vec4 v_cone;
  void main(){
    v_pos = i_pos; v_zr = i_zr; v_col = i_col; v_cone = i_cone;
    vec2 w = i_pos + (a_p * 2.0 - 1.0) * i_zr.y;
    vec2 s = (w - u_cam.xy) * vec2(2.0 / u_cam.z, -2.0 / u_cam.w) + vec2(-1.0, 1.0);
    gl_Position = vec4(s, 0.0, 1.0);
  }`;

  const LIGHT_FS = `#version 300 es
  precision highp float;
  in vec2 v_pos; in vec2 v_zr; in vec4 v_col; in vec4 v_cone;
  uniform sampler2D u_normal;
  uniform sampler2D u_occ;            // tile occlusion map (r8), 1 = solid
  uniform vec4 u_cam;                 // camx, camy, vw, vh
  uniform vec2 u_res;
  uniform vec2 u_occSize;             // level size in tiles
  uniform float u_tile;
  uniform float u_heightScale;
  uniform float u_time;
  uniform int u_shadowSteps;
  out vec4 o_col;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

  void main(){
    vec2 uv = gl_FragCoord.xy / u_res;
    vec4 nrm = texture(u_normal, uv);
    float cover = max(nrm.x, max(nrm.y, max(nrm.z, nrm.w)));
    vec2 nxy = nrm.xy * 2.0 - 1.0;
    float nz = sqrt(max(0.02, 1.0 - dot(nxy, nxy)));
    vec3 N = normalize(vec3(nxy, nz));
    float height = nrm.z * u_heightScale;

    vec2 wp = vec2(u_cam.x + gl_FragCoord.x / u_res.x * u_cam.z,
                   u_cam.y + (1.0 - gl_FragCoord.y / u_res.y) * u_cam.w);

    vec3 P = vec3(wp, height);
    vec3 Lp = vec3(v_pos, v_zr.x);
    vec3 d = Lp - P;
    float dist = length(d);
    float r = v_zr.y;
    if (dist > r) discard;
    vec3 L = d / max(dist, 0.0001);

    // falloff: inverse-square with a smooth window so lights end cleanly
    float t = dist / r;
    float win = 1.0 - t * t;
    float atten = win * win / (1.0 + 3.0 * t * t);

    // cone mask
    if (v_cone.y < 3.1415) {
      float a = atan(d.y, d.x) + 3.14159265;   // direction from light to pixel
      float da = abs(mod(a - v_cone.x + 3.14159265*3.0, 6.2831853) - 3.14159265);
      atten *= 1.0 - smoothstep(v_cone.y * 0.55, v_cone.y, da);
    }
    if (atten <= 0.0005) discard;

    float ndl = max(0.0, dot(N, L));
    // half-lambert keeps unlit faces readable instead of pure black
    ndl = ndl * 0.82 + 0.18;

    // ------------------------------------------------------- tile shadowing
    float shadow = 1.0;
    if (v_cone.z > 0.0 && u_shadowSteps > 0) {
      int steps = u_shadowSteps;
      float jit = hash(gl_FragCoord.xy + vec2(u_time));
      vec2 stepv = (v_pos - wp) / float(steps);
      float occ = 0.0;
      // skip the first sample so a lit wall face does not shadow itself
      for (int i = 1; i < 48; i++) {
        if (i >= steps) break;
        vec2 sp = wp + stepv * (float(i) + jit * 0.9);
        vec2 tc = sp / (u_tile * u_occSize);
        float s = texture(u_occ, tc).r;
        // nearer occluders cast harder shadows
        occ = max(occ, s * (1.0 - float(i) / float(steps) * 0.45));
      }
      shadow = 1.0 - occ * v_cone.z;
      shadow = clamp(shadow, 0.0, 1.0);
      shadow = shadow * shadow * (3.0 - 2.0 * shadow);
    }

    // ------------------------------------------------------------- specular
    vec3 V = normalize(vec3(0.0, -0.35, 1.0));
    vec3 H = normalize(L + V);
    float spec = pow(max(0.0, dot(N, H)), 24.0) * nrm.w * v_cone.w;

    vec3 c = v_col.rgb * v_col.a * atten * shadow * (ndl + spec);
    o_col = vec4(c * cover, 1.0);
  }`;

  // --------------------------------------------------------------- composite
  const COMPOSITE_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  uniform sampler2D u_albedo, u_normal, u_emis, u_light;
  uniform sampler2D u_macro;     // world-space variation noise
  uniform vec3 u_ambient;
  uniform vec3 u_ambientSky;     // colour of the "up" ambient term
  uniform float u_aoStrength;
  uniform float u_emisBoost;
  uniform float u_macroAmt;
  uniform float u_haze;          // light scattered by dust in the air
  uniform vec4 u_cam;            // camx, camy, viewW, viewH
  out vec4 o_col;
  void main(){
    vec4 a = texture(u_albedo, v_uv);
    vec4 n = texture(u_normal, v_uv);
    vec4 e = texture(u_emis, v_uv);
    vec3 l = texture(u_light, v_uv).rgb;

    // crevice AO straight out of the height channel
    float ao = mix(1.0 - u_aoStrength, 1.0, clamp(n.z * 1.15, 0.0, 1.0));
    vec2 nxy = n.xy * 2.0 - 1.0;
    float up = clamp(0.5 + nxy.y * -0.5, 0.0, 1.0);
    vec3 amb = mix(u_ambient, u_ambientSky, up) * ao;

    // Macro variation: a slow world-space noise multiplied over albedo. Tiles
    // are 32px and repeat; this does not, so the grid stops reading as a grid.
    vec2 wp = vec2(u_cam.x + v_uv.x * u_cam.z, u_cam.y + (1.0 - v_uv.y) * u_cam.w);
    vec3 m = texture(u_macro, wp / 1024.0).rgb;
    vec3 m2 = texture(u_macro, wp / 233.0 + vec2(0.37, 0.19)).rgb;
    float macro = m.r * 0.62 + m2.g * 0.38;
    vec3 macroTint = mix(vec3(0.74, 0.72, 0.78), vec3(1.22, 1.20, 1.14), macro);
    macroTint = mix(vec3(1.0), macroTint, u_macroAmt);

    // albedo authored in sRGB; light and bloom want linear
    vec3 albL = pow(max(a.rgb, 0.0), vec3(2.2)) * macroTint;
    vec3 emsL = pow(max(e.rgb, 0.0), vec3(2.2));
    vec3 col = albL * (amb + l) + emsL * u_emisBoost;

    // Volumetric haze: a fraction of the light added on top of the surface
    // rather than multiplied into it, which is what light scattering off dust
    // actually looks like. It is the difference between a lit floor and a lit
    // room. Kept off the brightest pixels so it lifts the dark, not the sun.
    float lum = dot(l, vec3(0.2126, 0.7152, 0.0722));
    col += l * u_haze * (1.0 - clamp(lum * 0.55, 0.0, 0.85));
    o_col = vec4(col, 1.0);
  }`;

  // ------------------------------------------------------------------ bloom
  const DOWN_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv; uniform sampler2D u_src; uniform vec2 u_texel;
  uniform float u_threshold; uniform int u_first;
  out vec4 o_col;
  vec3 tap(vec2 o){ return texture(u_src, v_uv + o * u_texel).rgb; }
  void main(){
    // 13-tap Kawase-ish downsample (Jimenez / COD)
    vec3 a = tap(vec2(-2,  2)), b = tap(vec2( 0,  2)), c = tap(vec2( 2,  2));
    vec3 d = tap(vec2(-2,  0)), e = tap(vec2( 0,  0)), f = tap(vec2( 2,  0));
    vec3 g = tap(vec2(-2, -2)), h = tap(vec2( 0, -2)), i = tap(vec2( 2, -2));
    vec3 j = tap(vec2(-1,  1)), k = tap(vec2( 1,  1)), l = tap(vec2(-1, -1)), m = tap(vec2( 1, -1));
    vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    if (u_first == 1) {
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      float soft = clamp(lum - u_threshold, 0.0, 1.0);
      col *= soft / max(lum, 0.0001);
    }
    o_col = vec4(col, 1.0);
  }`;

  const UP_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv; uniform sampler2D u_src; uniform vec2 u_texel; uniform float u_radius;
  out vec4 o_col;
  vec3 tap(vec2 o){ return texture(u_src, v_uv + o * u_texel * u_radius).rgb; }
  void main(){
    vec3 c = tap(vec2(-1, 1)) + tap(vec2(0, 1)) * 2.0 + tap(vec2(1, 1))
           + tap(vec2(-1, 0)) * 2.0 + tap(vec2(0, 0)) * 4.0 + tap(vec2(1, 0)) * 2.0
           + tap(vec2(-1,-1)) + tap(vec2(0,-1)) * 2.0 + tap(vec2(1,-1));
    o_col = vec4(c / 16.0, 1.0);
  }`;

  // ---------------------------------------------------------------- present
  const PRESENT_FS = `#version 300 es
  precision highp float;
  in vec2 v_uv;
  uniform sampler2D u_scene, u_bloom, u_heat;
  uniform vec2 u_srcSize;
  uniform float u_time, u_bloomAmt, u_heatAmt, u_exposure, u_vignette, u_grain, u_ca, u_sat;
  uniform vec3 u_lift, u_gain;
  uniform float u_flash; uniform vec3 u_flashCol;
  uniform float u_fade;
  out vec4 o_col;

  // ACES filmic approximation (Narkowicz)
  vec3 aces(vec3 x){
    const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
    return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
  }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = fract(sin(dot(i, vec2(41.3,289.1)))*43758.5453);
    float b = fract(sin(dot(i+vec2(1,0), vec2(41.3,289.1)))*43758.5453);
    float c = fract(sin(dot(i+vec2(0,1), vec2(41.3,289.1)))*43758.5453);
    float d = fract(sin(dot(i+vec2(1,1), vec2(41.3,289.1)))*43758.5453);
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  // sample the low-res scene with a crisp, non-blocky filter
  vec3 sharpSample(sampler2D t, vec2 uv){
    vec2 p = uv * u_srcSize;
    vec2 i = floor(p) + 0.5;
    vec2 f = p - i;
    f = clamp(f * 1.6, -0.5, 0.5);   // squeeze the ramp: crisp texels, no jaggies
    return texture(t, (i + f) / u_srcSize).rgb;
  }

  void main(){
    vec2 uv = v_uv;

    // heat shimmer driven by the blurred warm emissive
    vec3 heat = texture(u_heat, uv).rgb;
    float warm = clamp((heat.r - heat.b * 0.8) * 1.4, 0.0, 1.0);
    if (u_heatAmt > 0.0 && warm > 0.001) {
      float n1 = noise(uv * vec2(28.0, 14.0) + vec2(0.0, -u_time * 1.6));
      float n2 = noise(uv * vec2(17.0, 40.0) + vec2(u_time * 0.7, -u_time * 2.3));
      uv += (vec2(n1, n2) - 0.5) * warm * u_heatAmt;
    }

    // chromatic aberration grows toward the corners
    vec2 cc = uv - 0.5;
    float r2 = dot(cc, cc);
    float caK = u_ca * r2;
    vec3 col;
    col.r = sharpSample(u_scene, uv + cc * caK).r;
    col.g = sharpSample(u_scene, uv).g;
    col.b = sharpSample(u_scene, uv - cc * caK).b;

    col += texture(u_bloom, uv).rgb * u_bloomAmt;
    col *= u_exposure;
    col = aces(col);
    col = pow(max(col, 0.0), vec3(1.0 / 2.2));

    // grade: lift / gain, then saturation
    col = clamp(col * u_gain + u_lift, 0.0, 1.0);
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(lum), col, u_sat);

    col = mix(col, u_flashCol, u_flash);

    // vignette
    float v = 1.0 - u_vignette * smoothstep(0.25, 0.95, length(cc) * 1.35);
    col *= v;

    // film grain, slightly stronger in the shadows
    float g = noise(gl_FragCoord.xy * 0.75 + u_time * 60.0) - 0.5;
    col += g * u_grain * (1.2 - lum * 0.7);

    col *= u_fade;
    o_col = vec4(max(col, 0.0), 1.0);
  }`;

  /** A seamless two-octave value-noise tile used for world-space variation. */
  function makeMacroTexture() {
    const gl = F.GL.gl, N = 256;
    const n1 = F.noise2(9001), n2 = F.noise2(4242);
    const data = new Uint8Array(N * N * 4);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      // wrap the domain so the texture tiles without a seam
      const u = x / N * 8, v = y / N * 8;
      const a = (n1.fbm(u, v, 4, 0.55) + 1) * 0.5;
      const b = (n2.fbm(u * 2.7, v * 2.7, 3, 0.5) + 1) * 0.5;
      const c = (n1.fbm(u * 0.45, v * 0.45, 2, 0.6) + 1) * 0.5;
      data[i] = Math.round(F.U.sat(a) * 255);
      data[i + 1] = Math.round(F.U.sat(b) * 255);
      data[i + 2] = Math.round(F.U.sat(c) * 255);
      data[i + 3] = 255;
    }
    const t = F.GL.texture(N, N, { filter: gl.LINEAR, wrap: gl.REPEAT });
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return t;
  }

  const R = F.Render = {
    w: 0, h: 0,
    gbuf: null, lightBuf: null, scene: null,
    mips: [], MIP_COUNT: 6,
    lights: [], maxLights: 512,
    // tuneables (a scene can override per frame)
    ambient: [0.10, 0.11, 0.15],
    ambientSky: [0.16, 0.17, 0.24],
    aoStrength: 0.55,
    // Bloom and the emissive boost are the two knobs that decide whether a lit
    // room reads or just glares. Held low on purpose: only genuinely bright
    // things should bloom, or every torch smears over whatever is standing in
    // front of it — which is how a shopkeeper disappears into their own shop.
    // The base values the settings sliders and the quality ladder scale. They
    // live here so the numbers are not copied into three call sites, which is
    // how they drifted apart in the first place.
    bloomBase: 0.30, grainBase: 0.024, caBase: 0.0022,
    emisBoost: 0.78,
    bloomAmt: 0.30, bloomThreshold: 1.06, bloomRadius: 1.2,
    heatAmt: 0.0,
    exposure: 1.06, vignette: 0.44, grain: 0.024, ca: 0.0022, sat: 1.04,
    lift: [0.006, 0.004, 0.012], gain: [1.03, 1.0, 1.02],
    flash: 0, flashCol: [1, 1, 1], fade: 1,
    heightScale: 14,
    macroAmt: 1.0,
    haze: 0.085, hazeScale: 1, bloomScale: 1,
    shadowSteps: 22,
    occTex: null, occSize: [1, 1], tile: 32,
    time: 0,

    init(w, h) {
      const gl = F.GL.gl;
      this.w = w; this.h = h;
      this.buffers(w, h);

      this.pLight = F.GL.program(LIGHT_VS, LIGHT_FS, 'light');
      this.pComp = F.GL.program(F.GL.FS_VS, COMPOSITE_FS, 'composite');
      this.pDown = F.GL.program(F.GL.FS_VS, DOWN_FS, 'down');
      this.pUp = F.GL.program(F.GL.FS_VS, UP_FS, 'up');
      this.pPresent = F.GL.program(F.GL.FS_VS, PRESENT_FS, 'present');

      // instanced light geometry
      this.lightData = new Float32Array(this.maxLights * 12);
      this.lightVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lightVbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.lightData.byteLength, gl.DYNAMIC_DRAW);
      this.lightVao = gl.createVertexArray();
      gl.bindVertexArray(this.lightVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, F.GL.unitQuad);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lightVbo);
      const ia = (loc, n, off) => {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 48, off);
        gl.vertexAttribDivisor(loc, 1);
      };
      ia(1, 2, 0); ia(2, 2, 8); ia(3, 4, 16); ia(4, 4, 32);
      gl.bindVertexArray(null);

      // 1x1 "nothing is solid" occlusion map used until a level supplies one
      this.blankOcc = F.GL.texture(1, 1, { fmt: 'r8' });
      gl.bindTexture(gl.TEXTURE_2D, this.blankOcc);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1, 1, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]));
      this.occTex = this.blankOcc;
      this.macroTex = makeMacroTexture();
      return this;
    },

    /** Replace the ray-marched shadow map. data = Uint8Array(w*h), 255 = solid. */
    setOcclusion(data, tw, th, tileSize) {
      const gl = F.GL.gl;
      if (this._occOwned) gl.deleteTexture(this._occOwned);
      const t = F.GL.texture(tw, th, { fmt: 'r8', filter: gl.LINEAR });
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, tw, th, gl.RED, gl.UNSIGNED_BYTE, data);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      this._occOwned = t; this.occTex = t; this.occSize = [tw, th]; this.tile = tileSize;
    },
    clearOcclusion() { this.occTex = this.blankOcc; this.occSize = [1, 1]; },

    beginFrame(cam) {
      this.cam = cam;
      this.lights.length = 0;
      F.Batch.setCam(cam);
      F.Batch.begin();
      F.GL.bindFbo(this.gbuf, [0, 0, 0, 0]);
      F.GL.blend('premul');
    },

    /** (Re)build every screen-sized target. Safe to call again on a resize. */
    buffers(w, h) {
      const gl = F.GL.gl;
      F.GL.freeFbo(this.gbuf); F.GL.freeFbo(this.lightBuf); F.GL.freeFbo(this.scene);
      for (const m of this.mips || []) F.GL.freeFbo(m);
      this.w = w; this.h = h;
      const HDR = F.GL.floatOK ? 'rgba16f' : 'rgba8';
      this.gbuf = F.GL.fbo(w, h, [{}, {}, {}]);                       // albedo | normal | emissive
      this.lightBuf = F.GL.fbo(w, h, [{ fmt: HDR, filter: gl.LINEAR }]);
      this.scene = F.GL.fbo(w, h, [{ fmt: HDR, filter: gl.LINEAR }]);
      // Stop the chain well before the mips get tiny. A 4x4 mip turns every
      // bright pixel into a screen-wide axis-aligned cross when it is tented
      // back up, which is the classic "plus-shaped bloom" artefact.
      this.mips = [];
      let mw = w, mh = h;
      for (let i = 0; i < this.MIP_COUNT; i++) {
        const nw = mw >> 1, nh = mh >> 1;
        if (nh < 20) break;
        mw = nw; mh = nh;
        this.mips.push(F.GL.fbo(mw, mh, [{ fmt: HDR, filter: gl.LINEAR }]));
      }
    },

    /**
     * The world buffer is sized from the window's aspect, so it changes when
     * the window does. Without this the targets stayed at whatever size the
     * game booted at and the scene was rendered at the wrong resolution.
     */
    resize(w, h) {
      if (w === this.w && h === this.h) return;
      this.buffers(w, h);
    },

    /**
     * o: { x, y, z, r, col:[r,g,b], intensity, angle, spread, shadow, spec }
     */
    light(o) {
      if (this.lights.length >= this.maxLights) return;
      this.lights.push(o);
    },

    /** Convenience: warm point light. */
    pointLight(x, y, r, col, intensity, z, shadow) {
      this.light({ x, y, z: z === undefined ? 10 : z, r, col, intensity,
        angle: 0, spread: 4, shadow: shadow === undefined ? 1 : shadow, spec: 1 });
    },

    endFrame() {
      const gl = F.GL.gl;
      // ---- geometry
      F.Batch.flush(this.cam);

      // ---- lights
      F.GL.bindFbo(this.lightBuf, [0, 0, 0, 1]);
      if (this.lights.length) {
        const d = this.lightData;
        for (let i = 0; i < this.lights.length; i++) {
          const L = this.lights[i], o = i * 12;
          d[o] = L.x; d[o + 1] = L.y;
          d[o + 2] = L.z === undefined ? 10 : L.z; d[o + 3] = L.r;
          d[o + 4] = L.col[0]; d[o + 5] = L.col[1]; d[o + 6] = L.col[2];
          d[o + 7] = L.intensity === undefined ? 1 : L.intensity;
          d[o + 8] = L.angle || 0;
          d[o + 9] = L.spread === undefined ? 4 : L.spread;
          d[o + 10] = L.shadow === undefined ? 1 : L.shadow;
          d[o + 11] = L.spec === undefined ? 1 : L.spec;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lightVbo);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, this.lights.length * 12);
        F.GL.blend('add');
        const p = F.GL.use(this.pLight);
        const c = this.cam;
        gl.uniform4f(p.u.u_cam, c.x, c.y, c.vw, c.vh);
        gl.uniform2f(p.u.u_res, this.w, this.h);
        gl.uniform2f(p.u.u_occSize, this.occSize[0], this.occSize[1]);
        gl.uniform1f(p.u.u_tile, this.tile);
        gl.uniform1f(p.u.u_heightScale, this.heightScale);
        gl.uniform1f(p.u.u_time, this.time);
        gl.uniform1i(p.u.u_shadowSteps, this.shadowSteps);
        F.GL.bindTex(0, this.gbuf.tex[1]); gl.uniform1i(p.u.u_normal, 0);
        F.GL.bindTex(1, this.occTex); gl.uniform1i(p.u.u_occ, 1);
        gl.bindVertexArray(this.lightVao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.lights.length);
        gl.bindVertexArray(null);
      }

      // ---- composite
      F.GL.bindFbo(this.scene);
      F.GL.blend('none');
      let p = F.GL.use(this.pComp);
      gl.uniform3fv(p.u.u_ambient, this.ambient);
      gl.uniform3fv(p.u.u_ambientSky, this.ambientSky);
      gl.uniform1f(p.u.u_aoStrength, this.aoStrength);
      gl.uniform1f(p.u.u_emisBoost, this.emisBoost);
      gl.uniform1f(p.u.u_macroAmt, this.macroAmt);
      gl.uniform1f(p.u.u_haze, this.haze * (this.hazeScale === undefined ? 1 : this.hazeScale));
      gl.uniform4f(p.u.u_cam, this.cam.x, this.cam.y, this.cam.vw, this.cam.vh);
      F.GL.bindTex(4, this.macroTex); gl.uniform1i(p.u.u_macro, 4);
      F.GL.bindTex(0, this.gbuf.tex[0]); gl.uniform1i(p.u.u_albedo, 0);
      F.GL.bindTex(1, this.gbuf.tex[1]); gl.uniform1i(p.u.u_normal, 1);
      F.GL.bindTex(2, this.gbuf.tex[2]); gl.uniform1i(p.u.u_emis, 2);
      F.GL.bindTex(3, this.lightBuf.tex[0]); gl.uniform1i(p.u.u_light, 3);
      F.GL.fullscreen(p);

      // ---- bloom: progressive downsample then additive upsample
      p = F.GL.use(this.pDown);
      let src = this.scene, first = 1;
      for (let i = 0; i < this.mips.length; i++) {
        const dst = this.mips[i];
        F.GL.bindFbo(dst);
        gl.uniform2f(p.u.u_texel, 1 / src.w, 1 / src.h);
        gl.uniform1f(p.u.u_threshold, this.bloomThreshold);
        gl.uniform1i(p.u.u_first, first);
        F.GL.bindTex(0, src.tex[0]); gl.uniform1i(p.u.u_src, 0);
        F.GL.fullscreen(p);
        src = dst; first = 0;
      }
      p = F.GL.use(this.pUp);
      F.GL.blend('add');
      for (let i = this.mips.length - 1; i > 0; i--) {
        const s = this.mips[i], dst = this.mips[i - 1];
        F.GL.bindFbo(dst);
        gl.uniform2f(p.u.u_texel, 1 / s.w, 1 / s.h);
        gl.uniform1f(p.u.u_radius, this.bloomRadius);
        F.GL.bindTex(0, s.tex[0]); gl.uniform1i(p.u.u_src, 0);
        F.GL.fullscreen(p);
      }
      F.GL.blend('none');

      // ---- present
      F.GL.bindFbo(null);
      p = F.GL.use(this.pPresent);
      gl.uniform2f(p.u.u_srcSize, this.w, this.h);
      gl.uniform1f(p.u.u_time, this.time);
      gl.uniform1f(p.u.u_bloomAmt, this.bloomAmt * (this.bloomScale === undefined ? 1 : this.bloomScale));
      gl.uniform1f(p.u.u_heatAmt, this.heatAmt);
      gl.uniform1f(p.u.u_exposure, this.exposure);
      gl.uniform1f(p.u.u_vignette, this.vignette);
      gl.uniform1f(p.u.u_grain, this.grain);
      gl.uniform1f(p.u.u_ca, this.ca);
      gl.uniform1f(p.u.u_sat, this.sat);
      gl.uniform3fv(p.u.u_lift, this.lift);
      gl.uniform3fv(p.u.u_gain, this.gain);
      gl.uniform1f(p.u.u_flash, this.flash);
      gl.uniform3fv(p.u.u_flashCol, this.flashCol);
      gl.uniform1f(p.u.u_fade, this.fade);
      F.GL.bindTex(0, this.scene.tex[0]); gl.uniform1i(p.u.u_scene, 0);
      F.GL.bindTex(1, this.mips[0].tex[0]); gl.uniform1i(p.u.u_bloom, 1);
      F.GL.bindTex(2, this.mips[Math.min(2, this.mips.length - 1)].tex[0]); gl.uniform1i(p.u.u_heat, 2);
      F.GL.fullscreen(p);
    },

    /** Apply a named look. Scenes call this on enter. */
    grade(g) {
      for (const k in g) if (k in this) this[k] = g[k];
    },
  };

})(window.F2 = window.F2 || {});
