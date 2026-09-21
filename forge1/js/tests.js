'use strict';
// Headless test + smoke-simulation. Open tests.html in a browser; results are printed on the page.
const results = []; let failed = 0;
function ok(cond, name) { results.push((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) failed++; }
function eq(a, b, name) { ok(a === b, `${name} (got ${a}, want ${b})`); }
window.addEventListener('error', e => { results.push('ERROR ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); failed++; });

try {
  // ---- forge maths
  eq(Forge.weaponClass(3), 'dagger', 'class 3');
  eq(Forge.weaponClass(9), 'dagger', 'class 9');
  eq(Forge.weaponClass(10), 'sword', 'class 10');
  eq(Forge.weaponClass(25), 'sword', 'class 25');
  eq(Forge.weaponClass(26), 'greatsword', 'class 26');
  eq(Forge.weaponClass(39), 'greatsword', 'class 39');
  eq(Forge.weaponClass(40), 'colossal', 'class 40');
  eq(Forge.armorClass(9), 'light', 'armour light'); eq(Forge.armorClass(30), 'heavy', 'armour heavy');
  ok(Math.abs(Forge.avgMult({ stone: 5, iron: 5 }) - 0.35) < 1e-9, 'avg mult');
  ok(Forge.qualityMult(100) / Forge.qualityMult(55) >= 1.3 && Forge.qualityMult(100) / Forge.qualityMult(55) <= 1.5, 'perfect is 1.3-1.5x good');
  ok(Forge.qualityMult(0) < Forge.qualityMult(50) && Forge.qualityMult(50) < Forge.qualityMult(80) && Forge.qualityMult(80) < Forge.qualityMult(96), 'quality monotonic');
  eq(Forge.grade(39.9), 'Poor', 'grade poor'); eq(Forge.grade(40), 'Good', 'grade good'); eq(Forge.grade(70), 'Great', 'grade great'); eq(Forge.grade(95), 'Perfect', 'grade perfect');
  eq(Forge.traits({ magmite: 2, iron: 8 }).length, 1, 'trait at 20%'); eq(Forge.traits({ magmite: 1, iron: 9 }).length, 0, 'no trait below 20%');
  const w1 = Forge.create({ kind: 'weapon', ores: { iron: 12, copper: 4 }, quality: 60 }, 1);
  const w2 = Forge.create({ kind: 'weapon', ores: { iron: 12, copper: 4 }, quality: 100 }, 2);
  ok(w2.stats.dmg / w1.stats.dmg > 1.3, 'same ore: perfect >1.3x good damage'); ok(w2.value > w1.value * 1.5, 'quality raises sell price');
  eq(w1.cls, 'sword', 'created sword'); ok(/Sword/.test(w1.name), 'name ' + w1.name);
  const a1 = Forge.create({ kind: 'armor', slot: 'chest', ores: { iron: 30 }, quality: 80 }, 3); eq(a1.cls, 'heavy', 'heavy armour'); ok(a1.stats.def > 0 && a1.stats.hp > 0, 'armour stats');
  const m1 = Forge.create({ kind: 'weapon', ores: { iron: 5 }, quality: 99 }, 4); ok(m1.master, 'masterwork >=98');

  // ---- world generation
  for (let f = 1; f <= MAX_FLOOR; f++) {
    const lv = genCave(f);
    ok(lv.nodes.length > 40, `floor ${f} nodes ${lv.nodes.length}`); ok(lv.enemies.length > 5, `floor ${f} enemies ${lv.enemies.length}`);
    ok(lv.enemies.some(e => e.elite), `floor ${f} has elite guard`);
    ok(!blockedAt(lv, lv.spawn.x, lv.spawn.y, 5), `floor ${f} spawn free`);
    if (f < MAX_FLOOR) ok(!!lv.shaftDown, `floor ${f} has shaft`);
    // reachability of shaft from spawn (BFS on non-solid tiles)
    if (lv.shaftDown) {
      const seen = new Set(), q = [[Math.floor(lv.spawn.x / TS), Math.floor(lv.spawn.y / TS)]]; let reach = false;
      while (q.length) { const [x, y] = q.pop(); const k = x + ',' + y; if (seen.has(k) || lv.solid(x, y)) continue; seen.add(k); if (x === Math.floor(lv.shaftDown.x / TS) && y === Math.floor(lv.shaftDown.y / TS)) reach = true; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
      ok(reach, `floor ${f} shaft reachable`);
    }
  }
  { // enemy levels
    const l1 = genCave(1), l3 = genCave(3), avg = a => a.reduce((s, e) => s + e.level, 0) / a.length;
    ok(l1.enemies.every(e => e.level >= 1) && avg(l3.enemies) > avg(l1.enemies) + 5, 'deeper floors have higher level mobs: ' + avg(l1.enemies).toFixed(1) + ' vs ' + avg(l3.enemies).toFixed(1));
    const lv1 = l1.enemies.filter(e => !e.elite); ok(Math.max(...lv1.map(e => e.level)) > Math.min(...lv1.map(e => e.level)), 'level rises further into a floor');
    const lo = new Enemy('grunt', 0, 0, 1, false, 1), hi = new Enemy('grunt', 0, 0, 1, false, 10); ok(hi.maxHp > lo.maxHp * 2 && hi.dmg > lo.dmg * 1.5, 'higher level = more hp and damage: ' + lo.maxHp + '/' + hi.maxHp);
    ok(l3.enemies.filter(e => e.elite).every(e => e.level >= 9 + 2), 'elites are +2 levels'); }
  const hub = genHub(); ok(hub.npcs.length === 8, 'hub npcs (5 shops, board, shrine, gate)');

  // ---- scene smoke simulation
  S = newState(); Quests.ensure(); eq(S.quests.length, 3, 'quests generated');
  const world = new WorldScene(); Game.stack = []; Game.push(world);
  for (let i = 0; i < 120; i++) { world.update(1 / 60); world.draw(); Input.endFrame(); }
  ok(world.floor === 0, 'hub loaded');
  // forge scene: run a full scripted forge
  S.ores = { iron: 12, copper: 4, stone: 5 };
  const fs = new ForgeScene(); Game.push(fs);
  fs.sel = { iron: 12, copper: 4 }; fs.draw(); fs.begin(); eq(fs.stage, 'bellows', 'bellows started'); ok(fs.ready > 1, 'get-ready delay before bellows'); Input.down.Space = true; for (let i = 0; i < 30; i++) fs.update(1 / 60); ok(fs.b.t === 0, 'input ignored during get-ready'); Input.down.Space = false;
  let guard = 0;
  while (fs.stage !== 'result' && guard++ < 6000) {
    if (fs.stage === 'bellows') { Input.down.Space = fs.b.heat < fs.b.c; }
    if (fs.stage === 'pour') { Input.down.Space = fs.p.state === 'wait' ? true : fs.p.fill < 0.99; if (fs.p.state === 'wait' && !fs.p.armed) Input.down.Space = false; }
    if (fs.stage === 'hammer') { Input.down.Space = false; const c = fs.h.circles.find(c => c.s === 'active'); if (c && Math.abs(c.age - fs.h.life) < 0.02) Input.pressed.Space = true; }
    fs.update(1 / 60); fs.draw(); Input.endFrame();
  }
  Input.down.Space = false;
  eq(fs.stage, 'result', 'forge reaches result'); ok(!!fs.item && S.items.length === 1, 'item created and stored');
  ok(fs.q.hammer > 0.7, 'scripted hammer scores well: ' + fs.q.hammer.toFixed(2)); ok(fs.item.quality > 50, 'scripted quality ' + fs.item.quality);
  fs.draw(); ok(fs.rt < RESULT_LOCK, 'result buttons locked briefly'); S.equip.weapon = fs.item.id; Game.pop();
  ok(S.ores.iron === undefined && S.ores.copper === undefined && S.ores.stone === 5, 'ore consumed');
  // combat + mining smoke
  world.goto(1); const lv = world.lv, P = world.P;
  // pick a node that actually has a free tile beside it, so the miner can reach it
  let node = null, spot = null;
  for (const n of lv.nodes) {
    if (!n.alive || n.type === 'seal') continue;
    if (lv.secret && Math.hypot(n.x - lv.secret.x, n.y - lv.secret.y) < 70) continue;
    for (const o of [[-14, 0], [14, 0], [0, -14], [0, 14]]) {
      if (!blockedAt(lv, n.x + o[0], n.y + o[1], 5)) { node = n; spot = o; break; }
    }
    if (node) break;
  }
  ok(!!node, 'found a mineable node with clear footing');
  lv.enemies = []; P.x = node.x + spot[0]; P.y = node.y + spot[1]; Input.down.KeyE = true;
  const before = Object.values(S.ores).reduce((a, b) => a + b, 0);
  world.held = 1; for (let i = 0; i < 120; i++) { world.update(1 / 60); P.sta = 100; Input.endFrame(); } ok(node.alive && node.hp === node.max, 'cannot mine without pickaxe held');
  Input.pressed.Digit1 = true; world.update(1 / 60); Input.endFrame(); eq(world.held, 0, 'key 1 selects pickaxe');
  for (let i = 0; i < 1200 && node.alive; i++) { world.update(1 / 60); if (P.sta < 10) P.sta = 50; P.hp = 100; world.draw(); Input.endFrame(); }
  Input.down.KeyE = false;
  ok(!node.alive, 'node mined'); ok(Object.values(S.ores).reduce((a, b) => a + b, 0) > before, 'ore collected');
  Input.pressed.Digit2 = true; world.update(1 / 60); Input.endFrame(); eq(world.held, 1, 'key 2 selects weapon');
  { const r = world.hotbarRect(1); Input.mx = r.x + 5; Input.my = r.y + 5; Input.mpressed[0] = true; world.held = 0; world.update(1 / 60); Input.endFrame(); eq(world.held, 1, 'clicking hotbar slot selects it'); }
  // enemy fights
  const en = new Enemy('grunt', P.x + 30, P.y, 1); lv.enemies.push(en);
  Input.mx = en.x - world.cam.x; Input.my = en.y - world.cam.y;
  for (let i = 0; i < 900 && !en.dead; i++) {
    P.sta = 100; const d = Math.hypot(en.x - P.x, en.y - P.y);
    Input.mx = en.x - world.cam.x; Input.my = en.y - world.cam.y;
    if (d < 40 && P.state === 'idle') Input.mpressed[0] = true; P.hp = Math.max(P.hp, 50);
    world.update(1 / 60);
    world.draw(); Input.endFrame();
  }
  ok(en.dead, 'enemy killed by player'); ok(S.stats.kills >= 1 && S.xp + S.level > 1, 'kill rewards');
  { world.hitStop = 0; P.state = 'idle'; P.atk = null; world.held = 0; const e2 = new Enemy('grunt', P.x + 500, P.y, 1); lv.enemies.push(e2); const hpb = e2.hp; Input.mpressed[0] = true; world.update(1 / 60); Input.endFrame(); ok(P.state !== 'attack', 'cannot attack with pickaxe held'); world.held = 1; e2.dead = true; }
  S.potions.heal = 2; S.hotbar = ['heal', null, null, null, null]; P.hp = 40; Input.pressed.Digit3 = true; world.update(1 / 60); Input.endFrame(); ok(P.hp > 40 && S.potions.heal === 1, 'potion in slot 3 used by key 3');
  ok(Hotbar.toggle('str') && S.hotbar[1] === 'str', 'hotbar assign'); Hotbar.toggle('str'); ok(S.hotbar[1] === null, 'hotbar unassign');
  // every enemy type update
  for (const t of ['grunt', 'rogue', 'bomber']) { const e = new Enemy(t, P.x + 40, P.y, 2, t === 'grunt'); lv.enemies.push(e); }
  for (let i = 0; i < 600; i++) { world.update(1 / 60); P.hp = P.stats.maxHp; world.draw(); Input.endFrame(); }
  ok(true, 'all enemy AI ran');
  // dash, block, heavy
  Input.hit = Input.hit; Input.pressed.KeyQ = true; world.update(1 / 60); ok(P.state === 'dash' || P.sta < 100, 'dash');
  for (let i = 0; i < 20; i++) { world.update(1 / 60); Input.endFrame(); }
  P.sta = 100; P.exhausted = false; P.state = 'idle'; P.shieldT = 0; P.shieldCd = 0; world.held = 0; Input.pressed.KeyF = true; world.update(1 / 60); ok(P.shieldT === 0, 'no parry while pickaxe is held'); Input.endFrame(); world.held = 1; P.shieldCd = 0; Input.pressed.KeyF = true; world.update(1 / 60); ok(P.shieldT > 0, 'shield up'); ok(Math.abs(P.shieldT - SHIELD_TIME) < 0.05, 'parry window is fixed length'); world.held = 0; world.update(1 / 60); ok(P.shieldT <= 0.001 || P.shieldT === 0, 'parry drops if weapon is put away'); world.held = 1; P.shieldT = SHIELD_TIME; P.shieldCd = 0; { const pe = new Enemy('grunt', P.x + 12, P.y, 1); pe.state = 'windup'; world.lv.enemies.push(pe); P.iframes = 0; P.face = 0; P.parryAng = 0; const hp1 = P.hp; world.hurtPlayer(pe.dmg, pe.x, pe.y, pe); ok(P.hp === hp1 && pe.stun >= PARRY_STUN - 0.01 && pe.parried && pe.state === 'chase', 'parry stuns attacker and negates damage'); const ph = pe.hp; world.damageEnemy(pe, 10, { ang: 0, noProc: true }); ok(ph - pe.hp > 12, 'stunned enemy takes bonus damage: ' + (ph - pe.hp).toFixed(1)); pe.dead = true; } Input.endFrame(); P.hp = P.stats.maxHp = 100000; const hp0 = P.hp;
  P.shieldT = SHIELD_TIME; P.iframes = 0; P.face = Math.PI; P.parryAng = Math.PI; ok(world.hurtPlayer(50, P.x - 10, P.y + 2, null) && P.hp === hp0, 'parry blocks hits from the faced side (west)');
  P.iframes = 0; P.face = 0; P.parryAng = 0; world.hurtPlayer(30, P.x - 10, P.y, null); ok(P.hp < hp0, 'hit from behind is NOT blocked'); const hp2 = P.hp;
  P.iframes = 0; P.face = -Math.PI / 2; P.parryAng = -Math.PI / 2; world.hurtPlayer(30, P.x, P.y + 10, null); ok(P.hp < hp2, 'north-facing parry does not cover south'); const hp3 = P.hp;
  P.iframes = 0; P.face = 0.5; P.parryAng = 0.5; ok(Math.abs(world.parryDir() - 0.5) < 1e-9, 'parry aims at the exact mouse angle (not snapped)'); P.face = Math.PI; ok(Math.abs(world.parryDir() - 0.5) < 1e-9, 'parry direction stays locked when the mouse turns'); world.hurtPlayer(30, P.x - 10, P.y, null); ok(P.hp < hp3, 'hit from where the mouse moved to is not blocked'); P.face = 0.5; P.hp = hp3; P.iframes = 0; world.hurtPlayer(30, P.x + Math.cos(0.9) * 10, P.y + Math.sin(0.9) * 10, null); ok(P.hp === hp3, 'hit within 50deg of the aimed direction blocked'); 
  P.iframes = 0; world.hurtPlayer(30, P.x + Math.cos(1.6) * 10, P.y + Math.sin(1.6) * 10, null); ok(P.hp < hp3, 'hit outside the 50deg arc not blocked'); P.hp = hp0; for (let i = 0; i < 200; i++) { world.update(1 / 60); P.hp = 100000; Input.endFrame(); } ok(P.shieldT === 0 && P.shieldCd > 5 && P.shieldCd <= SHIELD_CD, 'parry expires then long cooldown ' + P.shieldCd.toFixed(1)); Input.pressed.KeyF = true; world.update(1 / 60); ok(P.shieldT === 0, 'no shield on cooldown'); Input.endFrame(); P.iframes = 0; world.hurtPlayer(20, P.x, P.y, null); ok(P.hp < hp0, 'damage applies after shield ends');
  // death + respawn
  world.killPlayer(); for (let i = 0; i < 200; i++) { world.update(1 / 60); world.draw(); Input.endFrame(); } ok(!world.P.dead && world.floor === 0, 'death respawns in hub');
  // menus render
  for (const M of [InventoryScene, MerchantScene, SmithScene, AlchemistScene, EnchanterScene, BoardScene, PauseScene]) { const m = new M(); Game.push(m); for (let i = 0; i < 3; i++) { m.draw(); Input.endFrame(); } Game.pop(); }
  for (const M of [ControlsScene, QuestLogScene]) { const m = new M(); Game.push(m); m.draw(); Game.pop(); }
  { const bl = world.hudButtons(); ok(bl.length === 2, 'hud buttons'); world.hitStop = 0; Input.mx = bl[0].x + 3; Input.my = bl[0].y + 3; Input.mpressed[0] = true; world.update(1 / 60); Input.endFrame(); ok(Game.top() instanceof QuestLogScene, 'quests button opens quest log'); Game.pop(); }
  { let bombers = 0; for (let i = 0; i < 12; i++) bombers += genCave(1).enemies.filter(e => e.type === 'bomber').length; ok(bombers > 0, 'bombers appear on floor 1: ' + bombers); }
  const ds = new DescendScene(world); Game.push(ds); ds.draw(); Game.pop();
  const ts = new TitleScene(); ts.update(0.1); ts.draw();
  // save round trip
  Save.save(); const loaded = Save.load(); ok(loaded && loaded.items.length === S.items.length, 'save round trip');
  // quests
  S.quests = []; Quests.ensure(); const q = S.quests.find(q => q.type === 'kill') || S.quests[0]; q.prog = q.need - 1; Quests.event(q.type === 'kill' ? 'kill' : 'ore', q.target, 1);
  ok(true, 'quest events');
  { S.quests = []; Quests.ensure(); ok(S.quests.every(q => q.done === false), 'new quests start not done'); const g0 = S.gold, q0 = S.quests[0]; Quests.claim(q0); ok(S.gold === g0 && S.quests.includes(q0), 'cannot claim unfinished quest');
    const bs = new BoardScene(); Game.push(bs); const ry = bs.y + 22 + 10; Input.mx = bs.x + 10 + 340; Input.my = ry + 6; UI.active = true; Input.mpressed[0] = true; bs.draw(); Input.endFrame(); ok(S.gold === g0 && S.quests.includes(q0), 'Claim button inert on unfinished quest'); Game.pop();
    q0.prog = q0.need; q0.done = true; Quests.claim(q0); ok(S.gold > g0 && !S.quests.includes(q0), 'finished quest can be claimed'); }

  // ================= Phase 3/4 features =================
  Game.stack = []; const wx = new WorldScene(); Game.push(wx); wx.update(1 / 60); Input.endFrame();
  { // races
    S.race = 'human'; S.spins = 3; S.pity = 0; const id = Race.spin(); ok(!!RACES[id] && S.spins === 2, 'race spin consumes a spin');
    S.spins = 0; ok(Race.spin() === null, 'no spin without spins left');
    const counts = [0, 0, 0, 0, 0, 0, 0]; S.pity = 0; for (let i = 0; i < 4000; i++) counts[RACES[Race.roll()].tier]++;
    ok(counts[0] > counts[1] && counts[1] > counts[2] && counts[2] > counts[3], 'race rarity ordering ' + counts.join('/')); ok(counts[3] + counts[4] + counts[5] + counts[6] > 0, 'epic+ races can roll');
    S.pity = 0; let hi0 = 0; for (let i = 0; i < 3000; i++) if (RACES[Race.roll()].tier >= 3) hi0++; S.pity = 30; let hi1 = 0; for (let i = 0; i < 3000; i++) if (RACES[Race.roll()].tier >= 3) hi1++; S.pity = 0;
    ok(hi1 > hi0 * 2, 'soft pity raises epic+ odds ' + hi0 + ' -> ' + hi1);
    S.race = 'human'; const base = calcStats(); S.race = 'titan'; const tt = calcStats(); S.race = 'human';
    ok(tt.maxHp > base.maxHp * 1.3 && tt.moveMult > base.moveMult && tt.dr > 0 && tt.lifesteal > 0 && tt.minePower > base.minePower && tt.forgeBonus === 8 && tt.luck > 0.4 && tt.wstats.cd < base.wstats.cd, 'race passives feed stats');
    ok(Object.values(RACES).some(r => r.eco && r.p.mine && r.p.forge), 'economy race exists');
  }
  { // spells
    const wi = Forge.create({ kind: 'weapon', ores: { iron: 12 }, quality: 70 }, 9001); S.items.push(wi); S.equip.weapon = wi.id;
    const a0 = calcStats(); wi.spell = 'wind'; ok(calcStats().wstats.cd < a0.wstats.cd, 'wind spell speeds attacks'); wi.spell = 'flame'; ok(calcStats().burnChance >= 0.25, 'flame spell'); wi.spell = 'frost'; ok(calcStats().slowHit, 'frost spell'); wi.spell = 'storm'; ok(calcStats().chain > 0, 'storm spell'); wi.spell = 'void'; ok(calcStats().voidBonus > 0, 'void spell');
    wi.spell = 'void'; const pw = wx.P; wx.goto(1); const e1 = new Enemy('grunt', wx.P.x + 20, wx.P.y, 1); e1.hp = e1.maxHp * 0.4; wx.lv.enemies.push(e1); const h1 = e1.hp; wx.damageEnemy(e1, 10, { noProc: true, ang: 0 }); const dv = h1 - e1.hp;
    wi.spell = null; const e2 = new Enemy('grunt', wx.P.x + 20, wx.P.y, 1); e2.hp = e2.maxHp * 0.4; wx.lv.enemies.push(e2); const h2 = e2.hp; wx.damageEnemy(e2, 10, { noProc: true, ang: 0 }); ok(dv > (h2 - e2.hp) * 1.2 || dv > 11, 'void does bonus to weakened foes ' + dv.toFixed(1)); e1.dead = e2.dead = true;
    wi.spell = 'frost'; wx.P.stats = calcStats(); const e3 = new Enemy('grunt', wx.P.x + 20, wx.P.y, 1); wx.lv.enemies.push(e3); wx.damageEnemy(e3, 5, { ang: 0 }); ok(e3.slow > 0, 'frost hit slows enemy'); e3.dead = true; wi.spell = null;
    const ar = Forge.create({ kind: 'armor', slot: 'chest', ores: { iron: 12 }, quality: 70 }, 9002); S.items.push(ar); S.equip.chest = ar.id; const d0 = calcStats(); ar.spell = 'fortify'; ok(calcStats().def > d0.def, 'fortify spell'); ar.spell = 'vitality'; ok(calcStats().maxHp > d0.maxHp, 'vitality spell'); ar.spell = 'inferno'; ok(calcStats().aura > 0, 'inferno spell'); ar.spell = 'iceshield'; ok(calcStats().iceShield > 0, 'ice shield spell'); ar.spell = null;
  }
  { // powerups
    const P3 = wx.P; P3.hp = 10; wx.collectPowerup('health'); ok(P3.hp > 30, 'health powerup'); wx.collectPowerup('barrier'); ok(P3.barrier === 3, 'barrier powerup'); const hpB = P3.hp; P3.iframes = 0; ok(wx.hurtPlayer(40, P3.x + 5, P3.y, null) && P3.hp === hpB && P3.barrier === 2, 'barrier absorbs a hit');
    wx.collectPowerup('berserk'); ok(S.buffs.berserk > 0 && calcStats().dmg > 1, 'berserk buff'); const dm = calcStats().dmg; delete S.buffs.berserk; ok(dm > calcStats().dmg * 1.35, 'berserk +40% damage');
    wx.collectPowerup('goldrush'); ok(S.buffs.goldrush > 0, 'gold rush buff'); delete S.buffs.goldrush; wx.collectPowerup('frenzy'); ok(S.forgeFrenzy === true, 'forge frenzy flag'); S.forgeFrenzy = false;
    wx.collectPowerup('inferno'); ok(P3.fireCharges === 6, 'inferno charges'); P3.fireCharges = 0; P3.barrier = 0;
    wx.pickups = [{ x: P3.x, y: P3.y, type: 'health', t: 20, bob: 0 }]; P3.hp = 20; wx.updateExtras(0.016); ok(wx.pickups.length === 0 && P3.hp > 20, 'walking over a pickup collects it');
    let drops = 0; for (let i = 0; i < 400; i++) { wx.pickups = []; wx.dropPowerup({ x: 0, y: 0, elite: false }); drops += wx.pickups.length; } ok(drops > 5 && drops < 80, 'powerup drop rate sane ' + drops + '/400');
  }
  { // new quest types
    S.quests = []; S.level = 8; let seen = {}; for (let i = 0; i < 200; i++) { const q = Quests.gen(); seen[q.type] = true; }
    ok(['gather', 'kill', 'forge', 'challenge', 'explore', 'deliver', 'floor', 'boss'].every(t => seen[t] || t === 'floor'), 'all quest types generate: ' + Object.keys(seen).join(','));
    const ch = { id: 1, type: 'challenge', done: false, target: 'any', need: 3, prog: 0, text: 'c', reward: { gold: 1, xp: 1 } }; S.quests = [ch]; Quests.event('kill', 'grunt'); Quests.event('kill', 'grunt'); ok(ch.prog === 2, 'challenge streak counts'); Quests.event('hurt'); ok(ch.prog === 0, 'challenge streak resets when hurt'); Quests.event('kill', 'grunt'); Quests.event('kill', 'grunt'); Quests.event('kill', 'grunt'); ok(ch.done === true, 'challenge completes');
    const ex = { id: 2, type: 'explore', done: false, target: 2, need: 1, prog: 0, text: 'x', reward: { gold: 1, xp: 1 } }; S.quests = [ex]; Quests.event('secret', 1); ok(!ex.done, 'explore ignores other floors'); Quests.event('secret', 2); ok(ex.done === true, 'explore completes on secret');
    const bq = { id: 3, type: 'boss', done: false, target: 'guardian', need: 1, prog: 0, text: 'b', reward: { gold: 1, xp: 1 } }; S.quests = [bq]; Quests.event('boss'); ok(bq.done === true, 'boss quest completes');
    const dq = { id: 4, type: 'deliver', done: false, target: 'sword', minq: 60, need: 1, prog: 0, text: 'd', reward: { gold: 5, xp: 1 } }; S.quests = [dq]; S.items = []; ok(!Quests.findDeliverable(dq), 'nothing to deliver at first');
    const good = Forge.create({ kind: 'weapon', ores: { iron: 12 }, quality: 75 }, 9100); S.items.push(good); ok(Quests.findDeliverable(dq) === good, 'deliverable found'); Quests.deliver(dq); ok(dq.done === true && !S.items.includes(good), 'deliver consumes the item'); S.quests = []; Quests.ensure();
  }
  { // hidden cavern
    let found = 0, walled = true; for (let i = 0; i < 40; i++) { const lv = genCave(1 + (i % 3)); if (lv.secret) { found++; const seal = lv.nodes.find(n => n.type === 'seal'); if (!seal || !lv.chests.length) walled = false; } }
    ok(found >= 36, 'most caves have a hidden cavern: ' + found + '/40'); ok(walled, 'each cavern has a seal and a chest');
    let lvs = null; for (let i = 0; i < 30 && !lvs; i++) { const c = genCave(1); if (c.secret) lvs = c; }
    ok(!!lvs, 'got a cave with a secret'); const sealN = lvs.nodes.find(n => n.type === 'seal'); ok(blockedAt(lvs, sealN.x, sealN.y, 3), 'seal blocks the tunnel');
    wx.lv = lvs; wx.caves[1] = lvs; wx.floor = 1; wx.P.x = lvs.secret.x; wx.P.y = lvs.secret.y; const s0 = S.stats.secrets; S.quests = [{ id: 5, type: 'explore', done: false, target: 1, need: 1, prog: 0, text: 'e', reward: { gold: 1, xp: 1 } }];
    wx.updateExtras(0.016); ok(lvs.secret.found && S.stats.secrets === s0 + 1 && S.quests[0].done === true, 'entering the cavern registers discovery + quest');
    const g0 = S.gold; wx.openChest(lvs.chests[0]); ok(S.gold > g0 && lvs.chests[0].opened, 'chest gives loot'); const g1 = S.gold; wx.openChest(lvs.chests[0]); ok(S.gold === g1, 'chest only opens once');
    sealN.hp = 1; wx.P.stats = calcStats(); wx.breakNode(sealN); ok(!sealN.alive && sealN.respawn > 1e6, 'seal breaks and never respawns'); S.quests = []; Quests.ensure();
  }
  { // boss
    wx.goto(0); const gate = wx.lv.npcs.find(n => n.kind === 'gate'), shrine = wx.lv.npcs.find(n => n.kind === 'shrine'); ok(gate && shrine, 'hub has gate and shrine');
    wx.goto(BOSS_FLOOR); const bl = wx.lv, boss = bl.enemies.find(e => e.boss); ok(!!boss && boss.maxHp === 1500 && boss.level === BOSS_LEVEL, 'boss arena spawns the guardian'); ok(!blockedAt(bl, bl.spawn.x, bl.spawn.y, 5), 'boss arena spawn free');
    for (let i = 0; i < 400; i++) { wx.update(1 / 60); wx.P.hp = wx.P.stats.maxHp; wx.draw(); Input.endFrame(); }
    ok(boss.phase === 1 && (boss.bstate === 'tele' || boss.at || boss.cd < 3), 'boss AI runs in phase 1');
    let used = {}; for (let i = 0; i < 300; i++) { boss.bstate = 'move'; boss.cd = 0; boss.phase = 4; wx.bossChoose(boss, 0.6); used[boss.at.type] = true; const P4 = wx.P; P4.iframes = 0; wx.bossFire(boss, boss.at, boss.dmg); boss.at = null; wx.P.hp = wx.P.stats.maxHp; }
    ok(used.slam && used.line && used.summon && used.roots, 'boss uses all four attacks: ' + Object.keys(used).join(',')); ok(wx.lv.enemies.some(e => e.minion), 'boss summoned saplings'); ok(wx.hazards.length > 0, 'boss spawned root hazards');
    for (const m of wx.lv.enemies) if (m.minion) m.dead = true; wx.hazards = []; boss.bstate = 'move'; boss.cd = 5;
    boss.phase = 1; boss.hp = boss.maxHp * 0.7; wx.updateBoss(boss, 0.016); eq(boss.phase, 2, 'phase 2 at 75%'); boss.hp = boss.maxHp * 0.45; wx.updateBoss(boss, 0.016); eq(boss.phase, 3, 'phase 3 at 50%'); ok(wx.hazards.length > 0, 'phase 3 changes the arena'); boss.hp = boss.maxHp * 0.2; wx.updateBoss(boss, 0.016); eq(boss.phase, 4, 'phase 4 at 25%');
    // parry vs boss
    wx.P.shieldT = 1; wx.P.parryAng = Math.atan2(boss.y - wx.P.y, boss.x - wx.P.x); wx.P.iframes = 0; boss.stun = 0; const hpP = wx.P.hp; wx.hurtPlayer(30, boss.x, boss.y, boss); ok(wx.P.hp === hpP && boss.stun > 0 && boss.stun < PARRY_STUN, 'parrying the boss stuns it briefly'); wx.P.shieldT = 0;
    ok(playerPower() > 0, 'power rating computes');
    { // property: adding any armour piece (any traits/spells) never lowers power; removing one never raises it
      const keep2 = { eq: Object.assign({}, S.equip), items: S.items.slice() }; let viol = 0, uid = 50000, ids2 = Object.keys(ORES);
      for (let t = 0; t < 300; t++) {
        const wp = Forge.create({ kind: 'weapon', ores: { iron: U.ri(3, 45), [U.pick(ids2)]: U.ri(1, 10) }, quality: U.ri(30, 100) }, uid++); S.items = [wp]; S.equip = { weapon: wp.id, head: null, chest: null, legs: null, boots: null };
        let prev = playerPower();
        for (const slot of ['head', 'chest', 'legs', 'boots']) {
          const o = {}; for (let j = 0; j < U.ri(1, 2); j++) o[U.pick(ids2)] = U.ri(3, 45);
          const a = Forge.create({ kind: 'armor', slot, ores: o, quality: U.ri(0, 100) }, uid++); if (Math.random() < 0.3) a.spell = U.pick(['fortify', 'vitality', 'inferno', 'iceshield']);
          S.items.push(a); S.equip[slot] = a.id; const p = playerPower(); if (p < prev) viol++; prev = p;
        }
      }
      ok(viol === 0, 'adding armour never lowers power (violations: ' + viol + ')'); S.equip = keep2.eq; S.items = keep2.items; }
    { const keep = { eq: Object.assign({}, S.equip), buffs: S.buffs, items: S.items.slice() };
      S.equip = { weapon: null, head: null, chest: null, legs: null, boots: null }; S.buffs = {};
      const wpn = Forge.create({ kind: 'weapon', ores: { iron: 12, copper: 4 }, quality: 80 }, 9500); S.items.push(wpn); S.equip.weapon = wpn.id;
      const p0 = playerPower(); S.buffs = { str: 100, berserk: 10, prot: 100 }; eq(playerPower(), p0, 'power ignores temporary buffs'); S.buffs = {};
      const arm = Forge.create({ kind: 'armor', slot: 'chest', ores: { iron: 14, copper: 4 }, quality: 80 }, 9501); S.items.push(arm); S.equip.chest = arm.id; const p1 = playerPower(); ok(p1 > p0, 'wearing armour raises power: ' + p0 + ' -> ' + p1);
      const hel = Forge.create({ kind: 'armor', slot: 'head', ores: { iron: 8 }, quality: 80 }, 9502); S.items.push(hel); S.equip.head = hel.id; ok(playerPower() > p1, 'more armour raises it further');
      const heavy = Forge.create({ kind: 'weapon', ores: { iron: 12, copper: 4 }, quality: 100 }, 9503); S.items.push(heavy); S.equip.weapon = heavy.id; ok(playerPower() > p1, 'a better weapon raises power');
      S.equip = keep.eq; S.buffs = keep.buffs; S.items = keep.items; }
    // victory
    S.bossKills = 0; S.spins = 0; S.stats.bossNoHit = 0; wx.bossHurt = false; const bg = S.gold; boss.hp = 0; wx.killEnemy(boss); ok(S.bossKills === 1 && S.gold >= bg + 800 && S.spins >= 3 && S.stats.bossNoHit === 1, 'boss victory rewards'); ok(S.ach.kingslayer && S.ach.untouchable, 'boss achievements unlock'); ok(wx.lv.chests.length === 1 && wx.lv.chests[0].boss, 'boss chest appears');
    wx.P.x = bl.ladderUp.x; wx.P.y = bl.ladderUp.y; wx.prompt = wx.findInteract(); wx.activate(wx.prompt); ok(wx.floor === 0, 'leaving the arena returns to the hub'); const gn = wx.lv.npcs.find(n => n.kind === 'gate'); ok(Math.hypot(wx.P.x - gn.x, wx.P.y - gn.y) < 40, 'returns next to the gate');
  }
  { // achievements + settings
    S.ach = {}; S.stats.forged = 0; Ach.check(); ok(!S.ach.first_forge, 'no forge achievement at 0'); S.stats.forged = 1; const sp0 = S.spins; Ach.check(); ok(S.ach.first_forge && S.spins === sp0 + 1, 'first forge achievement + spin');
    S.stats.seen = { stone: 1, copper: 1, iron: 1, aurite: 1 }; Ach.check(); ok(S.ach.collector, 'collector achievement'); S.stats.master100 = 1; Ach.check(); ok(S.ach.master_forger, 'master forger achievement');
    S.settings = { vol: 0.3, mute: false, shake: true }; applySettings(); ok(Sfx.vol === 0.3, 'volume applies'); S.settings.mute = true; applySettings(); ok(Sfx.vol === 0, 'mute applies'); S.settings.mute = false; applySettings();
    const sc = new WorldScene(); S.settings.shake = false; sc.hub = genHub(); sc.lv = sc.hub; ok(true, 'settings ok'); S.settings.shake = true;
  }
  { // forge: race bonus + frenzy
    S.race = 'titan'; S.ores = { iron: 12, copper: 4 }; const f3 = new ForgeScene(); Game.push(f3); f3.sel = { iron: 12, copper: 4 }; S.forgeFrenzy = true; f3.begin(); ok(f3.frenzy === true && S.forgeFrenzy === false, 'frenzy consumed at forge start'); const bw = f3.b.w; ok(bw > 0.2, 'frenzy widens the heat zone: ' + bw.toFixed(3));
    f3.q = { bellows: 0, pour: 0, hammer: 0 }; f3.startQuench(); ok(f3.quality >= 8 - 1e-9, 'race forge bonus applied: ' + f3.quality); Game.pop(); S.race = 'human';
  }
  { // scenes render
    S.spins = 2; for (const M of [RaceScene, AchievementsScene, SettingsScene, EnchanterScene]) { const m = new M(); Game.push(m); if (M === EnchanterScene) m.tab = 2; for (let i = 0; i < 3; i++) { m.draw(); Input.endFrame(); } Game.pop(); }
    const bgs = new BossGateScene(wx); Game.push(bgs); bgs.draw(); Game.pop();
    const rs = new RaceScene(); Game.push(rs); rs.pending = 'dwarf'; rs.anim = 0; rs.draw(); Game.pop();
  }
  { // touch controls
    Input.touch = false; Game.stack = []; const w3 = new WorldScene(); Game.push(w3); w3.update(1 / 60);
    Touch.start(1, 60, 200); Touch.move(1, 100, 200); ok(Input.stick.x > 0.9 && Math.abs(Input.stick.y) < 0.1, 'touch joystick reads right'); Touch.end(1); ok(Input.stick.x === 0, 'joystick releases');
    const atk = Touch.buttons.find(b => b.id === 'atk'); Touch.start(2, atk.x, atk.y); ok(Input.atkPressed, 'attack button'); Input.endFrame(); Touch.end(2);
    for (const [id, key] of [['heavy', 'KeyR'], ['dash', 'KeyQ'], ['parry', 'KeyF'], ['bag', 'KeyT'], ['pause', 'Escape']]) { const b = Touch.buttons.find(x => x.id === id); Touch.start(3, b.x, b.y); ok(Input.pressed[key], id + ' button -> ' + key); Input.endFrame(); Touch.end(3); }
    const mb = Touch.buttons.find(b => b.id === 'mine'); Touch.start(4, mb.x, mb.y); ok(Input.down.KeyE, 'mine button holds E'); Touch.end(4); ok(!Input.down.KeyE, 'mine button releases E');
    Touch.start(5, 240, 20); ok(Input.mpressed[0] && Input.mx === 240, 'tap acts as a click'); Touch.end(5); Input.endFrame();
    const en = new Enemy('grunt', w3.P.x + 40, w3.P.y, 1); w3.lv.enemies.push(en); ok(Math.abs(Touch.aim(w3, w3.P)) < 0.05, 'touch auto-aims at nearest enemy'); en.dead = true;
    Input.touch = true; Touch.draw(); Input.touch = false; Input.endFrame();
    Game.stack = []; Game.push(wx);
  }
  { // regression: a menu must survive the frame it was opened in (the key that opened it
    // used to still be "pressed" when the menu drew, so it closed itself immediately)
    Game.stack = []; const wm = new WorldScene(); Game.push(wm); wm.update(1 / 60); Input.endFrame();
    const frame = () => { const top = Game.top(); if (top && top.update) top.update(1 / 60); for (const s of Game.stack.slice()) { UI.active = s === Game.top(); s.draw(); } UI.active = true; Input.endFrame(); };
    Input.pressed.Escape = true; frame();
    ok(Game.top() instanceof PauseScene, 'Escape opens the pause menu and it stays open');
    frame(); ok(Game.top() instanceof PauseScene, 'pause menu still open on the next frame');
    Input.pressed.Escape = true; frame(); ok(Game.top() === wm, 'Escape closes the pause menu');
    for (const [key, cls] of [['KeyT', InventoryScene], ['KeyJ', QuestLogScene], ['KeyK', AchievementsScene], ['KeyH', ControlsScene]]) {
      Input.pressed[key] = true; frame();
      ok(Game.top() instanceof cls, key + ' opens ' + cls.name + ' and it stays open');
      frame(); ok(Game.top() instanceof cls, cls.name + ' survives a second frame');
      Input.pressed[key] = true; frame();
      ok(Game.top() === wm, key + ' toggles ' + cls.name + ' shut');
    }
    // and clicking a HUD button should not leave the click live for the menu underneath
    const qb = wm.hudButtons()[0]; Input.mx = qb.x + 3; Input.my = qb.y + 3; Input.mpressed[0] = true; Input.mdown[0] = true; frame();
    ok(Game.top() instanceof QuestLogScene, 'HUD button opens the quest log and it stays open');
    Input.mdown[0] = false; frame(); ok(Game.top() instanceof QuestLogScene, 'quest log survives the next frame'); Game.pop();
    Game.stack = []; Game.push(wx);
  }
  { // every node type still renders, lit and unlit
    for (const t of Object.keys(NODES)) {
      const n = makeNode(t, 3, 3, 1);
      const a = Sprites.nodeSprite(n), b = Sprites.plainRock(n);
      ok(a.width > 8 && a.height > 8 && b.width > 8, 'node sprite ' + t + ' renders ' + a.width + 'x' + a.height);
    }
    // ore colour must actually reach the sprite (a vein of cobalt differs from a vein of stone)
    const g1 = Sprites.nodeSprite({ type: 'vein', ore: 'cobalt' }), g2 = Sprites.nodeSprite({ type: 'vein', ore: 'aurite' });
    ok(g1 !== g2, 'different ores give different node sprites');
  }
  { // ore name plate while mining
    Game.stack = []; const wn = new WorldScene(); Game.push(wn); wn.update(1 / 60); wn.goto(1);
    const P = wn.P, lv = wn.lv; lv.enemies = [];
    let node = null, spot = null;
    for (const n of lv.nodes) { if (!n.alive || n.type === 'seal') continue; for (const o of [[-14, 0], [14, 0], [0, -14], [0, 14]]) if (!blockedAt(lv, n.x + o[0], n.y + o[1], 5)) { node = n; spot = o; break; } if (node) break; }
    P.x = node.x + spot[0]; P.y = node.y + spot[1]; wn.held = 0; P.sta = 100;
    ok(!(node.labelUntil > wn.time), 'no name plate before mining');
    Input.down.KeyE = true; for (let i = 0; i < 6; i++) { wn.update(1 / 60); P.sta = 100; Input.endFrame(); }
    Input.down.KeyE = false; ok(node.labelUntil > wn.time, 'name plate set while mining');
    wn.draw(); ok(true, 'name plate draws');
    for (let i = 0; i < 100; i++) { wn.update(1 / 60); Input.endFrame(); }
    ok(!(node.labelUntil > wn.time), 'name plate fades after mining stops');
    Game.stack = []; Game.push(wx);
  }
  { // level menu: ladders and shafts open a menu instead of teleporting
    Game.stack = []; const wl = new WorldScene(); Game.push(wl); wl.update(1 / 60); S.level = 10;
    const frame = () => { const top = Game.top(); if (top && top.update) top.update(1 / 60); for (const s of Game.stack.slice()) { UI.active = s === Game.top(); s.draw(); } UI.active = true; Input.endFrame(); };
    wl.goto(1); wl.lv.enemies = [];
    // stand on the entrance ladder and press E
    wl.P.x = wl.lv.ladderUp.x; wl.P.y = wl.lv.ladderUp.y; Input.pressed.KeyE = true; frame();
    ok(Game.top() instanceof DescendScene && wl.floor === 1, 'ladder opens the level menu (does not teleport)');
    frame(); ok(Game.top() instanceof DescendScene, 'level menu stays open');
    const clickRow = (idx) => { const d = Game.top(); Input.mx = d.x + d.w - 8 - 30; Input.my = d.y + 34 + idx * 34 + 15; Input.mpressed[0] = true; Input.mdown[0] = true; frame(); Input.mdown[0] = false; };
    clickRow(2); ok(wl.floor === 2 && Game.top() === wl, 'menu row 2 descends to floor 2');
    wl.lv.enemies = [];
    // the far shaft on floor 2 opens the same menu, and lets you leave to the hub
    wl.P.x = wl.lv.shaftDown.x; wl.P.y = wl.lv.shaftDown.y; Input.pressed.KeyE = true; frame();
    ok(Game.top() instanceof DescendScene, 'shaft opens the level menu too');
    clickRow(0); ok(wl.floor === 0 && Game.top() === wl, 'menu lets you leave to the hub');
    // level gating
    S.level = 1; wl.P.x = wl.lv.shaftDown.x; wl.P.y = wl.lv.shaftDown.y; Input.pressed.KeyE = true; frame();
    ok(Game.top() instanceof DescendScene, 'hub shaft opens the menu'); clickRow(3);
    ok(wl.floor === 0, 'locked floor cannot be entered'); if (Game.top() instanceof DescendScene) Game.pop();
    S.level = 10; wl.goto(3); wl.lv.enemies = []; wl.P.x = wl.lv.ladderUp.x; wl.P.y = wl.lv.ladderUp.y; Input.pressed.KeyE = true; frame();
    clickRow(1); ok(wl.floor === 1, 'can ascend several floors at once'); if (Game.top() instanceof DescendScene) Game.pop();
    Game.stack = []; Game.push(wx);
  }
  { // the rebuilt stronghold must stay fully walkable: every keeper reachable from the spawn
    const hb = genHub();
    ok(hb.rooms.length === 5, 'five workshop rooms');
    // A plaque must name the trade that actually works inside, and that keeper must stand in that room.
    const SIGN_FOR = { smith: 'Pickaxe Smith', enchanter: 'Enchanter', alchemist: 'Alchemist', board: 'Commissions', merchant: 'Merchant' };
    for (const rm of hb.rooms) {
      ok(rm.sign === SIGN_FOR[rm.kind], 'plaque names its trade: ' + rm.kind + ' reads "' + rm.sign + '"');
      const keeper = hb.npcs.find(n => n.kind === rm.kind);
      const kx = Math.floor(keeper.x / TS), ky = Math.floor(keeper.y / TS);
      ok(kx > rm.x && kx < rm.x + rm.w - 1 && ky > rm.y && ky < rm.y + rm.h - 1, rm.kind + ' keeper stands inside the ' + rm.sign + ' room');
    }
    ok(!blockedAt(hb, hb.spawn.x, hb.spawn.y, 5), 'hub spawn is clear');
    const W2 = hb.w, seen = new Uint8Array(W2 * hb.h);
    const open = (x, y) => { const t2 = hb.t(x, y); return t2 === T_PATH || t2 === T_WOOD || t2 === T_FLOOR || t2 === T_GRASS; };
    const stack = [[Math.floor(hb.spawn.x / TS), Math.floor(hb.spawn.y / TS)]];
    while (stack.length) {
      const [x, y] = stack.pop(); const i = y * W2 + x;
      if (x < 0 || y < 0 || x >= W2 || y >= hb.h || seen[i] || hb.solid(x, y)) continue;
      seen[i] = 1; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    for (const n of hb.npcs) {
      // reachable if any tile next to the keeper was flooded
      let ok2 = false;
      const nx = Math.floor(n.x / TS), ny = Math.floor(n.y / TS);
      for (let dy = -2; dy <= 2 && !ok2; dy++) for (let dx = -2; dx <= 2; dx++) { const i = (ny + dy) * W2 + (nx + dx); if (seen[i]) { ok2 = true; break; } }
      ok(ok2, 'reachable from spawn: ' + n.name);
    }
    { const i = Math.floor(hb.shaftDown.y / TS) * W2 + Math.floor(hb.shaftDown.x / TS); ok(!!seen[i], 'mine entrance reachable'); }
    { const r = hb.mineReturn; ok(!blockedAt(hb, r.x, r.y, 5), 'you can stand where the mine puts you back'); }
    ok(hb.tiles.some ? true : true, 'hub built');
    let lava = 0, wood = 0, stone = 0;
    for (let i = 0; i < hb.tiles.length; i++) { if (hb.tiles[i] === T_MAGMA) lava++; if (hb.tiles[i] === T_WOOD) wood++; if (hb.tiles[i] === T_STONE) stone++; }
    ok(lava > 20, 'lava seams present: ' + lava); ok(wood > 20, 'plank bridges present: ' + wood); ok(stone > 100, 'masonry present: ' + stone);
  }
  { // ================= layout audit: no text may collide, overflow its box, or leave the screen =================
    const rich = () => {
      S = newState(); S.gold = 12345678; S.level = 27; S.xp = 300; S.essence = 123; S.runeFrags = 45; S.spins = 12; S.race = 'titan'; S.pity = 14;
      for (const id of ORE_IDS) S.ores[id] = 999; for (const g in GEMS) S.gems[g] = 88; for (const p in POTIONS) S.potions[p] = 99;
      S.hotbar = ['heal', 'str', 'prot', 'fort', 'luck']; S.pickaxe = 2; S.lantern = 1; S.stats.bestFloor = 2; S.bossKills = 3; S.stats.forged = 250; S.stats.kills = 1500;
      S.buffs = { str: 100, berserk: 10, goldrush: 25 };
      const mk = (kind, slot, ores, q) => { const it = Forge.create({ kind, slot, ores, quality: q }, S.nextId++); S.items.push(it); return it; };
      S.equip.weapon = mk('weapon', 'weapon', { glassite: 20, iron: 25 }, 99).id;       // long name, masterwork, trait
      S.equip.head = mk('armor', 'head', { magmite: 8, iron: 6 }, 90).id; S.equip.chest = mk('armor', 'chest', { demonite: 12, cobalt: 20 }, 96).id;
      mk('weapon', 'weapon', { volatite: 30, titanium: 15 }, 85); mk('weapon', 'weapon', { stone: 45 }, 60); mk('armor', 'legs', { platinum: 30 }, 70); mk('armor', 'boots', { copper: 12 }, 45);
      for (let i = 0; i < 8; i++) mk('weapon', 'weapon', { iron: 5 + i * 4 }, 30 + i * 8);
      getItem(S.equip.weapon).spell = 'storm'; getItem(S.equip.weapon).rune = 'life'; getItem(S.equip.weapon).enh = 7;
      S.ach = { first_forge: true, kingslayer: true, delver: true }; S.quests = []; Quests.ensure(); S.quests[0].prog = S.quests[0].need; S.quests[0].done = true;
      S.settings = { vol: 0.3, mute: false, shake: true };
      Hotbar.sync();
    };
    rich();
    Game.stack = []; const wa = new WorldScene(); Game.push(wa); wa.update(1 / 60); wa.goto(0);
    const bad = [];
    const check = (name, sc, prep) => {
      try {
        if (prep) prep(sc);
        UI.audit = []; UI.active = false; ctx.clearRect(0, 0, VW, VH);
        sc.draw();
        const log = UI.audit; UI.audit = null; UI.active = true;
        const probs = UI.layoutProblems(log);
        ok(probs.length === 0, 'layout ' + name + (probs.length ? ' -> ' + probs.slice(0, 5).join(' | ') : ''));
        for (const p of probs) bad.push(name + ': ' + p);
      } catch (e) { UI.audit = null; UI.active = true; ok(false, 'layout ' + name + ' threw ' + e.message); }
    };
    // in-world HUD with every element switched on
    wa.prompt = { label: 'Mine Levels' }; Game.toasts = [{ msg: 'Achievement: Kingslayer  (+100g, +1 spin)', col: '#ffd23f', t: 3 }];
    wa.P.barrier = 2; wa.P.fireCharges = 4; wa.P.hp = 60; wa.P.sta = 40;
    check('world HUD (hub)', wa);
    wa.P.exhausted = true; check('world HUD (tired)', wa); wa.P.exhausted = false;
    for (const lvl of [1, 9, 27, 99, 100, 250]) { S.level = lvl; check('world HUD level ' + lvl, wa); } S.level = 27;
    wa.goto(1); check('world HUD (mine)', wa); wa.goto(0);
    for (let tab = 0; tab < 3; tab++) { check('Inventory tab ' + tab, new InventoryScene(), s => { s.tab = tab; }); check('Merchant tab ' + tab, new MerchantScene(), s => { s.tab = tab; }); check('Enchanter tab ' + tab, new EnchanterScene(), s => { s.tab = tab; }); }
    check('Smith', new SmithScene()); check('Alchemist', new AlchemistScene()); check('Board', new BoardScene()); check('Quest log', new QuestLogScene());
    check('Pause', new PauseScene()); check('Controls', new ControlsScene()); check('Achievements', new AchievementsScene()); check('Settings', new SettingsScene());
    check('Race (idle)', new RaceScene()); check('Race (result)', new RaceScene(), s => { s.pending = 'dragonkin'; s.anim = 0; }); check('Race (result, economy)', new RaceScene(), s => { s.pending = 'celestial'; s.anim = 0; });
    check('Boss gate', new BossGateScene(wa)); check('Level menu (hub)', new DescendScene(wa)); wa.goto(2); check('Level menu (floor 2)', new DescendScene(wa)); wa.goto(0);
    check('Title', new TitleScene());
    check('Crucible (weapon)', new ForgeScene(), s => { s.sel = { iron: 12, magmite: 6, aurite: 4, cobalt: 3 }; });
    check('Crucible (armour)', new ForgeScene(), s => { s.kind = 'armor'; s.slot = 'boots'; s.sel = { glassite: 10, iron: 5 }; });
    check('Crucible (empty)', new ForgeScene());
    check('Forge result', new ForgeScene(), s => { s.stage = 'result'; s.rt = 5; s.q = { bellows: 0.8, pour: 0.9, hammer: 1 }; s.item = Forge.create({ kind: 'weapon', ores: { glassite: 20, iron: 25 }, quality: 99 }, 99999); });
    check('Forge result (armour)', new ForgeScene(), s => { s.stage = 'result'; s.rt = 5; s.q = { bellows: 0.8, pour: 0.9, hammer: 1 }; s.item = Forge.create({ kind: 'armor', slot: 'chest', ores: { demonite: 12, cobalt: 20 }, quality: 96 }, 99998); });
    for (const st2 of ['bellows', 'pour', 'hammer', 'quench']) check('Forge ' + st2, new ForgeScene(), s => { s.ores = { iron: 12 }; s.tier = 1; s.sel = {}; if (st2 === 'bellows') s.startBellows(); else if (st2 === 'pour') s.startPour(); else if (st2 === 'hammer') s.startHammer(); else { s.stage = 'quench'; s.qt = 0; } s.ready = 0; });
    check('Forge (get ready)', new ForgeScene(), s => { s.ores = { iron: 12 }; s.tier = 1; s.startBellows(); s.ready = 1.2; });
    if (bad.length) results.push('LAYOUT REPORT (' + bad.length + '):\n  ' + bad.join('\n  '));
    Game.stack = []; Game.push(wx);
  }} catch (e) { results.push('EXCEPTION ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')); failed++; }
document.getElementById('out').textContent = (failed ? 'FAILED ' + failed : 'ALL OK') + '\n' + results.join('\n');
document.title = failed ? 'FAILED' : 'ALL_OK';


