// Teachers on corridor duty: Filch (+ Mrs Norris) and Dumbledore walk their routes and react to you and to the
// wand — friendly only: the game never takes control away, there is no chase and no game-over.
const { open, until, reporter, shot } = require('./ipad');
(async () => {
  const { browser, page, errors } = await open();
  const R = reporter('corridor patrol');
  const r = await page.evaluate(async () => {
    const g = window.__game, F = window.HPFun, M = F.mods.magic, P = window.HPI.patrol, wait = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
    const until = async (fn, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await wait(100); } return false; };
    const by = (id) => P.state().list.find((w) => w.id === id);
    out.who = P.walkers.map((w) => w.who).join(',');
    g.fastTravel({ world: 'inside', key: 'corridor' }); await wait(600); g.player.position.set(33, 0, 23.2); P.hold(true); P.hold(false);      // stand well away, so he is not stopping to greet you
    // they walk by themselves
    const f0 = by('filch'); out.walks = await until(() => Math.hypot(by('filch').x - f0.x, by('filch').z - f0.z) > 3, 150000);
    out.catFollows = Math.hypot(P.state().cat.x - by('filch').x, P.state().cat.z - by('filch').z) < 4;
    // they react when you come close: stop, wave, a few words — and you keep control
    P._put('filch', 22, 20); g.player.position.set(25, 0, 21); const g0 = by('filch').greets;
    out.greets = await until(() => by('filch').greets > g0 && by('filch').stopped && by('filch').waving, 20000);
    out.words = ([...document.querySelectorAll('.funBub')].map((b) => b.textContent).find((x) => /🏮|🧹/.test(x))) || null;
    out.noGameOver = !g.modal && !g.takeover && g.started && g.world === 'inside';
    const p0 = g.player.position.clone(); await wait(1500); out.notMoved = g.player.position.distanceTo(p0) < 0.5;      // nobody grabs or pushes the child
    // they react to the wand
    for (let i = 0; i < 300 && !M.found().includes('filch'); i++) { const f = by('filch'); g.player.position.set(f.x + 2, 0, f.z + 2.2); M.cast(); await wait(100); }
    out.filchWand = M.found().includes('filch') && by('filch').zaps >= 1;
    out.walksOn = await until(() => !by('filch').stopped, 60000);
    g.fastTravel({ world: 'inside', key: 'ncorridor' }); await wait(500);
    for (let i = 0; i < 400 && !M.found().includes('dumbledore'); i++) { const d = by('dumbledore'); g.player.position.set(d.x + 1.5, 0, d.z + 2.5); M.cast(); await wait(100); }
    out.dumbWand = M.found().includes('dumbledore'); out.dumbGreets = by('dumbledore').greets >= 1;
    out.stillFree = !g.modal && !g.takeover;
    return out;
  });
  R.check(r.who === 'filch,dumbledore', 'Filch and Dumbledore are on corridor duty', 'patrol cast wrong: ' + r.who);
  R.check(r.walks && r.catFollows, 'Filch walks his route by himself, Mrs Norris close behind', 'not walking ' + JSON.stringify({ walks: r.walks, cat: r.catFollows }));
  R.check(r.greets && r.words, 'come close → he stops, waves and says: ' + r.words, 'no greeting ' + JSON.stringify({ greets: r.greets, words: r.words }));
  R.check(r.noGameOver && r.notMoved && r.stillFree && r.walksOn, 'friendly only: no modal, no takeover, nobody moves you — then he walks on', 'not friendly ' + JSON.stringify({ noGameOver: r.noGameOver, notMoved: r.notMoved, stillFree: r.stillFree, walksOn: r.walksOn }));
  R.check(r.filchWand && r.dumbWand && r.dumbGreets, 'both react to the wand (Filch sneezes, Dumbledore conjures stars) and Dumbledore greets you too', 'wand reactions missing ' + JSON.stringify({ filch: r.filchWand, dumb: r.dumbWand, dumbGreets: r.dumbGreets }));
  // one picture: Filch with his lantern in the portrait corridor
  await page.evaluate(async () => { const g = window.__game, P = window.HPI.patrol, wait = (ms) => new Promise((res) => setTimeout(res, ms)); g.fastTravel({ world: 'inside', key: 'corridor', yaw: Math.PI / 2, pitch: 0.1 }); await wait(500); P.hold(true); P._put('filch', 21, 18.6); g.player.position.set(27, 0, 22); await wait(2500); document.querySelectorAll('.funToast,#lsnTip').forEach((e) => (e.style.display = 'none')); });
  await shot(page, 'patrol-ipad.png');
  R.check(errors.length === 0, 'no console errors', 'errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));
  await browser.close(); R.done();
})();
