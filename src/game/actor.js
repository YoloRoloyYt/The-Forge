'use strict';
// ---------------------------------------------------------------------------
// actor.js — the skeleton every character in the game wears, the animation
// states that drive it, and the draw call that layers equipment onto it.
// ---------------------------------------------------------------------------
(function (F) {

  const PI = Math.PI;

  // Joint layout. Designed at ~60px tall and drawn scaled down, so parts stay
  // detailed when the camera is close and never alias when it is far.
  const BONES = [
    { name: 'hips',    parent: null,    x: 0,    y: -23, z: -1 },
    { name: 'torso',   parent: 'hips',  x: 0,    y: 0,   z: 20, sprite: 'pc_torso' },

    { name: 'legBU',   parent: 'hips',  x: -4.4, y: -1,  z: 8,  sprite: 'pc_legU' },
    { name: 'legBL',   parent: 'legBU', x: 0,    y: 13,  z: 9,  sprite: 'pc_legL' },
    { name: 'footB',   parent: 'legBL', x: 0,    y: 12,  z: 10, sprite: 'pc_foot' },
    { name: 'greaveB', parent: 'legBU', x: 0,    y: 0,   z: 11 },
    { name: 'bootB',   parent: 'footB', x: 0,    y: 0,   z: 12 },

    { name: 'armBU',   parent: 'torso', x: -9,   y: -20, z: 2,  sprite: 'pc_armU' },
    { name: 'armBL',   parent: 'armBU', x: 0,    y: 11,  z: 3,  sprite: 'pc_armL' },
    { name: 'handB',   parent: 'armBL', x: 0,    y: 10,  z: 4 },
    { name: 'pauldB',  parent: 'armBU', x: 0,    y: 0,   z: 5 },
    { name: 'offhand', parent: 'handB', x: 0,    y: 2,   z: 6 },

    { name: 'legFU',   parent: 'hips',  x: 4.4,  y: -1,  z: 13, sprite: 'pc_legU' },
    { name: 'legFL',   parent: 'legFU', x: 0,    y: 13,  z: 14, sprite: 'pc_legL' },
    { name: 'footF',   parent: 'legFL', x: 0,    y: 12,  z: 15, sprite: 'pc_foot' },
    { name: 'greaveF', parent: 'legFU', x: 0,    y: 0,   z: 16 },
    { name: 'bootF',   parent: 'footF', x: 0,    y: 0,   z: 17 },

    { name: 'chest',   parent: 'torso', x: 0,    y: 0,   z: 21 },
    { name: 'neck',    parent: 'torso', x: 0,    y: -23, z: 24 },
    { name: 'head',    parent: 'neck',  x: 0,    y: 0,   z: 25, sprite: 'pc_head' },
    { name: 'hair',    parent: 'head',  x: 0,    y: -13, z: 26 },
    { name: 'beard',   parent: 'head',  x: 0,    y: 1,   z: 27 },
    { name: 'helm',    parent: 'head',  x: 0,    y: 0,   z: 28 },

    { name: 'armFU',   parent: 'torso', x: 9,    y: -20, z: 30, sprite: 'pc_armU' },
    { name: 'armFL',   parent: 'armFU', x: 0,    y: 11,  z: 31, sprite: 'pc_armL' },
    { name: 'handF',   parent: 'armFL', x: 0,    y: 10,  z: 32, sprite: 'pc_hand' },
    { name: 'pauldF',  parent: 'armFU', x: 0,    y: 0,   z: 33 },
    { name: 'grip',    parent: 'handF', x: 0,    y: 2,   z: 34, angle: 2.35 },
    { name: 'weapon',  parent: 'grip',  x: 0,    y: 0,   z: 35 },
    { name: 'wglow',   parent: 'grip',  x: 0,    y: 0,   z: 36 },
  ];

  F.makeRig = function () { return new F.Rig(BONES); };

  // ------------------------------------------------------------- animation
  /**
   * Write a whole pose into the rig.
   * a needs: animState, animT, moveSpeed (0..1), aim (radians), facing ('S'|'N'),
   *          swingT, swingDur, mineT, hurtT, dashT, deadT
   */
  F.poseActor = function (rig, a, t) {
    rig.reset();
    const back = a.facing === 'N';
    rig.sprite('torso', back ? 'pc_torso_back' : 'pc_torso');
    rig.sprite('head', back ? 'pc_head_back' : 'pc_head');
    rig.byName.beard.hidden = back;

    const sp = a.moveSpeed || 0;
    const ph = a.animT || 0;

    // --- breathing underlies everything else
    const br = Math.sin(t * 1.7 + (a.seed || 0)) * 0.5 + 0.5;
    rig.set('torso', 0, 0, -br * 0.5);
    rig.set('neck', Math.sin(t * 1.3) * 0.03, 0, -br * 0.3);

    // --- locomotion
    if (sp > 0.02) {
      const run = Math.min(1, sp);
      const swing = 0.52 * run + 0.18;
      const s1 = Math.sin(ph * PI * 2), s2 = Math.sin(ph * PI * 2 + PI);
      rig.set('legFU', s1 * swing);
      rig.set('legBU', s2 * swing);
      rig.set('legFL', Math.max(0, -s1) * swing * 1.25);
      rig.set('legBL', Math.max(0, -s2) * swing * 1.25);
      rig.set('footF', -Math.max(0, s1) * 0.3);
      rig.set('footB', -Math.max(0, s2) * 0.3);
      // torso bob and counter-rotation sell the weight of the stride
      const bob = Math.abs(Math.sin(ph * PI * 2)) * (1.4 + run * 1.6);
      rig.add('torso', s1 * 0.05 * run);
      rig.byName.torso.poseY -= bob;
      rig.byName.hips.poseY = -bob * 0.35;
      rig.set('armBU', -s2 * swing * 0.85 + 0.12);
      rig.set('armBL', 0.28 + Math.max(0, s2) * 0.4);
      if (!a.holding) {
        rig.set('armFU', -s1 * swing * 0.85 - 0.12);
        rig.set('armFL', 0.28 + Math.max(0, s1) * 0.4);
      }
    } else {
      const idle = Math.sin(t * 1.6 + (a.seed || 0)) * 0.05;
      rig.set('armBU', 0.16 + idle);
      rig.set('armBL', 0.22 - idle);
      if (!a.holding) { rig.set('armFU', -0.16 - idle); rig.set('armFL', 0.22 + idle); }
      rig.set('legFU', 0.02); rig.set('legBU', -0.02);
    }

    // --- the armed arm points wherever the player is aiming
    if (a.holding) {
      // at rest the tool hangs across the body; aiming raises it
      const aimUp = a.aimLocal === undefined ? 0 : a.aimLocal;
      rig.set('armFU', aimUp * 0.55 - 0.18);
      rig.set('armFL', 0.34);
      rig.set('grip', -aimUp * 0.30);
    }

    // --- mining: a full overhead swing that lands on the beat
    if (a.mineT > 0) {
      const p = 1 - a.mineT;                     // 0 at start, 1 at impact
      const lift = p < 0.55 ? F.U.ease.outCubic(p / 0.55) : 1;
      const strike = p < 0.55 ? 0 : F.U.ease.inQuad((p - 0.55) / 0.45);
      const ang = F.U.lerp(-0.4, -2.5, lift) + strike * 3.5;
      rig.set('armFU', ang);
      rig.set('armBU', ang * 0.55 + 0.2);
      rig.set('armFL', 0.05 + strike * 0.35);
      rig.set('armBL', 0.3);
      rig.set('grip', -1.5 + lift * 0.6 + strike * 0.9);
      rig.add('torso', -0.10 + strike * 0.36);
      rig.set('neck', -0.05 + strike * 0.22);
      rig.byName.hips.poseY += strike * 1.6;
    }

    // --- attacking: wind up against the swing, then commit through it
    if (a.swingT > 0 && a.swingDur > 0) {
      const p = 1 - a.swingT / a.swingDur;
      const wind = a.windFrac === undefined ? 0.35 : a.windFrac;
      let ang, twist;
      if (p < wind) {
        const q = F.U.ease.outQuad(p / wind);
        ang = F.U.lerp(-0.3, -1.9, q) * (a.swingDir || 1);
        twist = -0.22 * q * (a.swingDir || 1);
      } else {
        const q = F.U.ease.outCubic((p - wind) / (1 - wind));
        ang = F.U.lerp(-1.9, 1.5, q) * (a.swingDir || 1);
        twist = F.U.lerp(-0.22, 0.30, q) * (a.swingDir || 1);
      }
      rig.set('armFU', ang - 0.35);
      rig.set('armFL', 0.15);
      rig.set('grip', -0.9 - ang * 0.25);
      rig.add('torso', twist);
      rig.set('neck', twist * -0.4);
      rig.byName.armBU.pose = -ang * 0.35 + 0.2;
    }

    // --- reactions
    if (a.hurtT > 0) {
      const q = a.hurtT;
      rig.add('torso', 0.30 * q);
      rig.add('neck', 0.30 * q);
      rig.byName.hips.poseY += 2.4 * q;
    }
    if (a.dashT > 0) {
      const q = a.dashT;
      rig.add('torso', -0.40 * q);
      rig.set('legFU', -0.7 * q); rig.set('legBU', 0.7 * q);
      rig.set('legFL', 0.9 * q);
    }
    if (a.deadT > 0) {
      const q = F.U.sat(a.deadT);
      rig.reset();
      rig.add('torso', 0.4 * q);
      rig.byName.hips.poseY += 10 * q;
      rig.set('armFU', 1.6 * q); rig.set('armBU', -1.6 * q);
      rig.set('legFU', 1.2 * q); rig.set('legBU', -0.9 * q);
    }
  };

  // ------------------------------------------------------------- equipment
  /** Attach the player's current gear to the rig's overlay bones. */
  F.dressRig = function (rig, eq, opt) {
    opt = opt || {};
    const tints = {};
    rig.sprite('hair', 'pc_hair');
    rig.sprite('beard', 'pc_beard');
    rig.sprite('handB', 'pc_hand');
    rig.sprite('handF', 'pc_hand');

    // Clothing is deliberately split: bare forearms and a dark leather tunic
    // over darker trousers. A single cloth colour makes the figure read naked.
    const skin = opt.skin || '#caa07a';
    const tunic = opt.tunic || '#5c4736';
    const sleeve = opt.sleeve || '#6d5641';
    const trouser = opt.trouser || '#3d3427';
    const hair = opt.hair || '#94542a';
    for (const n of ['head', 'handF', 'handB', 'armBL', 'armFL']) tints[n] = F.Col.tint(skin);
    tints.armBU = tints.armFU = F.Col.tint(sleeve);
    tints.legBU = tints.legFU = F.Col.tint(trouser);
    tints.legBL = tints.legFL = F.Col.tint(F.Col.shade(trouser, 0.86));
    tints.torso = F.Col.tint(tunic);
    tints.hair = F.Col.tint(hair); tints.beard = F.Col.tint(hair);
    tints.footB = tints.footF = F.Col.tint('#463322');

    const put = (bone, sprite, col) => {
      rig.sprite(bone, sprite);
      if (col) tints[bone] = F.Col.tint(col);
    };
    const head = eq && eq.head, chest = eq && eq.chest, legs = eq && eq.legs, boots = eq && eq.boots;
    if (head) { put('helm', 'arm_head_' + head.cls, head.color); rig.hide('hair'); }
    if (chest) {
      put('chest', 'arm_chest_' + chest.cls, chest.color);
      put('pauldF', 'arm_pauld_' + chest.cls, chest.color);
      put('pauldB', 'arm_pauld_' + chest.cls, chest.color);
    }
    if (legs) { put('greaveF', 'arm_legs_' + legs.cls, legs.color); put('greaveB', 'arm_legs_' + legs.cls, legs.color); }
    if (boots) { put('bootF', 'arm_boots_' + boots.cls, boots.color); put('bootB', 'arm_boots_' + boots.cls, boots.color); }
    // the lantern rides in the off hand — it is where the light is coming from
    if (opt.lantern) { rig.sprite('offhand', 'lantern'); tints.offhand = F.Col.tint(opt.lanternCol || '#ffd070'); }
    return tints;
  };

  /** Put the held tool or weapon into the front hand. */
  F.armRig = function (rig, held, tints) {
    rig.sprite('weapon', null); rig.sprite('grip', null); rig.sprite('wglow', null);
    if (!held) return;
    // rest angle of the held thing, in the hand's frame
    rig.byName.grip.angle = held.kind === 'pick' ? 0.55 : 2.35;
    if (held.kind === 'pick') {
      rig.sprite('grip', 'pick_haft');
      rig.sprite('weapon', 'pick_head');
      tints.weapon = F.Col.tint(held.color || '#b9c0cf');
      if (held.glow) { rig.sprite('wglow', 'pick_glow'); tints.wglow = F.Col.tint(held.glow); }
    } else if (held.cls && held.cls !== 'fists') {
      rig.sprite('grip', 'grip_' + held.cls);
      rig.sprite('weapon', 'wpn_' + held.cls);
      tints.weapon = F.Col.tint(held.color || '#c8c8c8');
      const gl = held.glowCol;
      if (gl) { rig.sprite('wglow', 'wglow_' + held.cls); tints.wglow = F.Col.tint(gl); }
    }
  };

})(window.F2 = window.F2 || {});
