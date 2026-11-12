// Shared helper for the focused Playwright checks in this folder: opens the game on an iPad-sized
// touch screen (iPad Pro 11" landscape, Safari UA) and reports ✓/✗ lines.
// Run one:  node hogwarts-explorer/tests/quidditch-positions.test.js   (needs `playwright`, e.g. from ../../_test)
const path = require('path');
const { chromium } = require(require.resolve('playwright', { paths: [__dirname, path.resolve(__dirname, '../../_test'), process.cwd()] }));
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SHOTS = process.env.SHOT_DIR || '/workspace/fable_shots';
const IPAD = { width: 1194, height: 834 };
const UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function open(opts = {}) {
  // a stale DISPLAY / D-Bus address in the shell stops headless Chromium creating a WebGL context, so launch without them
  const env = Object.assign({}, process.env); delete env.DISPLAY; delete env.DBUS_SESSION_BUS_ADDRESS;
  const browser = await chromium.launch({ env, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: IPAD, deviceScaleFactor: 1, isMobile: true, hasTouch: true, userAgent: UA });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (opts.deviceHour != null) {   // pretend the iPad's clock says this hour (only the two getters the game reads)
    await page.addInitScript((h) => { Date.prototype.getHours = function () { return Math.floor(h); }; Date.prototype.getMinutes = function () { return Math.round((h % 1) * 60); }; }, opts.deviceHour);
  }
  await page.goto(URL + (opts.query || '')); await page.waitForTimeout(1500);
  await page.touchscreen.tap(IPAD.width / 2, IPAD.height / 2); await page.waitForTimeout(600);        // the start screen
  await page.waitForFunction(() => window.__game && window.HPFun && window.HPFun.ready, null, { timeout: 30000 });
  await page.evaluate(() => { if (window.HPFun.mods.peeves) window.HPFun.mods.peeves.soon(99999); });   // no surprise poltergeist mid-test
  return { browser, ctx, page, errors };
}
// poll a condition in the page (game time crawls under software rendering, so never wait a fixed time for game events)
async function until(page, fn, ms = 20000, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (await page.evaluate(fn, arg)) return true; } catch (e) { if (page.isClosed()) return false; } await page.waitForTimeout(100); }
  return false;
}
async function tapEl(page, sel) {   // a real touch tap on the middle of an element (the page ignores a second tap within 350 ms)
  await page.waitForTimeout(600);
  const b = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, sel);
  if (!b) return false; await page.touchscreen.tap(b.x, b.y); return true;
}
function reporter(name) {
  let fails = 0;
  return {
    check(ok, good, bad) { console.log((ok ? '  ✓ ' : '  ✗ ') + (ok ? good : bad)); if (!ok) fails++; },
    done() { console.log(fails ? '\n❌ ' + name + ': ' + fails + ' failure(s)' : '\n✅ ' + name + ' passed'); process.exit(fails ? 1 : 0); },
  };
}
const shot = (page, file) => page.screenshot({ path: path.join(SHOTS, file), timeout: 30000 }).then(() => true, () => false);
module.exports = { open, until, tapEl, reporter, shot, IPAD, SHOTS };
