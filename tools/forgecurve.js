// ---------------------------------------------------------------------------
// forgecurve.js — how much does forge quality actually move per millisecond of
// timing error?
//
// The forge is the only place in the game where the player's hands decide the
// outcome, so its windows need measuring rather than guessing. This drives the
// real ForgeScene at a fixed timestep with rendering off, playing it through an
// autoplayer that reacts LATE by a set amount — which is how people miss, and
// what a jitter-on-the-value model gets wrong.
//
// Needs Playwright and a Chromium:
//   node tools/forgecurve.js
// ---------------------------------------------------------------------------
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { chromium = require('/opt/node22/lib/node_modules/playwright').chromium; }
const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
(async () => {
  const b = await chromium.launch({ executablePath: EXE,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(PAGE, { waitUntil: 'load' });
  await p.waitForTimeout(2500);

  const rows = await p.evaluate(() => {
    const F = window.F2;
    const DT = 1 / 120;                       // fine step so ms error is meaningful
    const play = (lagMs, jitterMs) => {
      F.Game.newRun();
      F.Game.s.ores = { iron: 300, magmite: 120, cobalt: 60 };
      const sc = new F.ForgeScene();
      sc.ores = { iron: 26, magmite: 8, cobalt: 5 };
      sc.draw = () => {};
      sc.begin();
      const lag = () => (lagMs + (Math.random() - 0.5) * 2 * jitterMs) / 1000;
      let pourFire = -1, hamFire = -1, t = 0, guard = 0;
      while (sc.stage !== 4 && guard++ < 20000) {
        t += DT;
        F.Input.keys = {}; F.Input.pressed = {};
        F.Input.mdown = false; F.Input.mclick = false;
        if (sc.stage === 1 && sc.bell) {
          // a human holds a beat behind the band, not exactly on it
          sc.bell._lagBuf = sc.bell._lagBuf || [];
          sc.bell._lagBuf.push(sc.bell.heat < sc.bell.band);
          const back = Math.max(0, sc.bell._lagBuf.length - 1 - Math.round(lag() / DT));
          F.Input.keys.space = sc.bell._lagBuf[back];
        } else if (sc.stage === 2 && sc.pourS) {
          const q = sc.pourS;
          if (!q.stopped) {
            if (pourFire < 0 && q.fill >= q.target - 0.004) pourFire = t + lag();
            if (pourFire > 0 && t >= pourFire) F.Input.pressed.space = true;
          }
        } else if (sc.stage === 3 && sc.ham) {
          const h = sc.ham;
          if (h.wait > 0) hamFire = -1;
          else if (h.i < h.n && !h.struck) {
            if (hamFire < 0 && h.ring <= h.best + 0.004) hamFire = t + lag();
            if (hamFire > 0 && t >= hamFire) { F.Input.pressed.space = true; hamFire = -1; }
          }
        }
        sc.update(DT);
        if (sc.stage === 2 && sc.pourS && sc.pourS.stopped && !sc.ham) sc.startHammer();
        if (sc.stage === 3 && sc.ham && sc.ham.i >= sc.ham.n && !sc.result) sc.finish();
      }
      const it = F.Game.s.items[F.Game.s.items.length - 1];
      return { parts: sc.parts, q: it && it.quality, grade: it && it.grade, dmg: it && it.stats.dmg, val: it && it.value };
    };
    const out = [];
    for (const [label, lag, jit] of [
      ['expert   ±20ms', 15, 20], ['good     ±50ms', 40, 50], ['fair     ±90ms', 75, 90],
      ['poor    ±160ms', 130, 160], ['bad     ±280ms', 230, 280], ['flailing', 500, 500]]) {
      const runs = [];
      for (let i = 0; i < 5; i++) runs.push(play(lag, jit));
      const m = k => runs.reduce((a, r) => a + (r[k] || 0), 0) / runs.length;
      const mp = k => Math.round(runs.reduce((a, r) => a + (r.parts[k] || 0), 0) / runs.length * 100);
      out.push({ label, bellows: mp('bellows'), pour: mp('pour'), hammer: mp('hammer'),
        q: +m('q').toFixed(1), dmg: +m('dmg').toFixed(1), val: Math.round(m('val')),
        grade: F.Forge.grade(m('q')) });
    }
    return out;
  });

  console.log('\nquality against timing error, same 39-ore melt\n');
  console.log('  PLAYER            BELLOWS  POUR  HAMMER   QUALITY  GRADE         DMG    VALUE');
  console.log('  ' + '-'.repeat(78));
  for (const r of rows)
    console.log('  ' + r.label.padEnd(18) + String(r.bellows + '%').padStart(6) +
      String(r.pour + '%').padStart(7) + String(r.hammer + '%').padStart(7) +
      String(r.q).padStart(10) + '  ' + (r.grade || '?').padEnd(12) +
      String(r.dmg).padStart(6) + String(r.val).padStart(9));
  console.log('\n  expert vs flailing:  x' + (rows[0].dmg / rows[rows.length - 1].dmg).toFixed(2) +
    ' damage,  x' + (rows[0].val / rows[rows.length - 1].val).toFixed(2) + ' gold\n');
  await b.close();
})();
