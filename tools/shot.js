// Headless screenshot helper: node tools/shot.js <page-url-path> <out.png> [--wait ms] [--hash h] [--w W] [--h H]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
(async () => {
  const args = process.argv.slice(2);
  const page0 = args[0], out = args[1];
  const opt = {};
  for (let i = 2; i < args.length; i += 2) opt[args[i].replace(/^--/, '')] = args[i + 1];
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--disable-gpu-sandbox'],
  });
  const p = await b.newPage({ viewport: { width: +(opt.w || 1280), height: +(opt.h || 760) }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  const url = 'file://' + path.resolve(page0) + (opt.hash ? '#' + opt.hash : '');
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(+(opt.wait || 900));
  if (opt.eval) await p.evaluate(opt.eval);
  await p.waitForTimeout(+(opt.wait2 || 250));
  await p.screenshot({ path: out });
  if (errs.length) { console.log(errs.slice(0, 20).join('\n')); process.exitCode = 1; }
  else console.log('ok -> ' + out);
  await b.close();
})();
