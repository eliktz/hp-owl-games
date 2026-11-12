// Quidditch: all four positions are playable from the chooser, each with its own goal.
//   ✨ Seeker catches the Snitch · 🔴 Chaser carries the Quaffle against the clock · 🏏 Beater whacks a Bludger away
//   from a team-mate · 🧤 Keeper slides along the hoops (real touch stick) and saves a shot.
const { open, until, tapEl, reporter, shot, IPAD } = require('./ipad');
(async () => {
  const { browser, ctx, page, errors } = await open();
  const R = reporter('quidditch positions');
  const Q = (fn, arg) => page.evaluate(fn, arg);
  const state = () => Q(() => window.HPFun.mods.quidditch.state());
  // walk up to the broom stand → 🧹 → the chooser, by real taps
  await Q(() => { const g = window.__game, s = window.HPFun.mods.quidditch.stand; g.fastTravel({ world: 'outside', x: s.x, z: s.z + 3, face: Math.PI, yaw: 0 }); });
  R.check(await until(page, () => window.HPFun.promptId() === 'quidditch'), 'the broom stand offers 🧹', 'no 🧹 prompt at the stand');
  await tapEl(page, '#funPrompt');
  R.check(await until(page, () => window.HPFun.mods.quidditch.state().pick), 'tap 🧹 → the position chooser opens', 'chooser did not open');
  const roles = await Q(() => [...document.querySelectorAll('#qPick .qR')].map((b) => b.dataset.r).join(','));
  R.check(roles === 'seeker,chaser,beater,keeper', 'four positions on offer: Seeker, Chaser, Beater, Keeper', 'chooser buttons wrong: ' + roles);
  const fit = await Q(() => { const p = document.querySelector('#qPick .p').getBoundingClientRect(), b = [...document.querySelectorAll('#qPick .qR')];
    return { fits: p.top >= 0 && p.bottom <= window.innerHeight && p.left >= 0 && p.right <= window.innerWidth, big: b.every((x) => x.getBoundingClientRect().width >= 120 && x.getBoundingClientRect().height >= 120), hints: b.every((x) => x.querySelector('.h') && x.querySelector('.h').textContent.trim().length > 0) }; });
  R.check(fit.fits && fit.big && fit.hints, 'the chooser fits the iPad screen: big buttons, each with a picture hint of the job', 'chooser layout wrong ' + JSON.stringify(fit));
  await page.waitForTimeout(400); await shot(page, 'quidditch-positions-ipad.png');

  const play = async (role) => {            // (re)open the chooser and pick a position with a real tap
    if (!(await state()).pick) { await Q(() => { const q = window.HPFun.mods.quidditch; if (q.state().on) q.quit(); document.getElementById('qEnd').classList.remove('on'); }); await page.waitForTimeout(900); await Q(() => window.HPFun.mods.quidditch.openPick()); await until(page, () => window.HPFun.mods.quidditch.state().pick, 8000); }
    await tapEl(page, '#qPick .qR[data-r="' + role + '"]');
    return until(page, (r) => { const s = window.HPFun.mods.quidditch.state(); return s.on && s.role === r && !window.__game.modal; }, 10000, role);
  };

  // 🧤 Keeper — real touch stick slides you along the hoops; covering the ringed hoop saves the shot
  R.check(await play('keeper'), '🧤 Keeper starts from the chooser', 'keeper did not start');
  const cdp = await ctx.newCDPSession(page), tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const jx = IPAD.width * 0.22, jy = IPAD.height * 0.72, z0 = (await state()).me.z;
  await tp('touchStart', [{ x: jx, y: jy, id: 1 }]); await tp('touchMove', [{ x: jx + 40, y: jy, id: 1 }]); await tp('touchMove', [{ x: jx + 80, y: jy, id: 1 }]);
  const slid = await until(page, (z) => window.HPFun.mods.quidditch.state().me.z > z + 2.5, 12000, z0); await tp('touchEnd', []);
  R.check(slid, 'Keeper: the touch stick slides you along the hoops', 'keeper did not slide (z ' + z0 + ' → ' + (await state()).me.z + ')');
  await Q(() => { const q = window.HPFun.mods.quidditch, s = q.state(); q._shoot(0); q._place(s.me.x, s.me.y, q.hoopZ[0]); });
  const saved = await until(page, () => window.HPFun.mods.quidditch.state().shots >= 1, 20000); let s = await state();
  R.check(saved && s.saves === 1 && s.a === 10, 'Keeper: in front of the ringed hoop → save, +10', 'save failed ' + JSON.stringify({ saves: s.saves, a: s.a, b: s.b }));
  await shot(page, 'quidditch-keeper-ipad.png');

  // 🏏 Beater — reach the Bludger before it reaches your team-mate
  R.check(await play('beater'), '🏏 Beater starts from the chooser', 'beater did not start');
  await Q(() => window.HPFun.mods.quidditch._attack());
  const whacked = await until(page, () => { const q = window.HPFun.mods.quidditch, b = q._bludgerPos(); if (q.state().whacks >= 1) return true; if (b.state === 'aim' || b.state === 'charge') q._place(b.x - 1, b.y - 1, b.z); return false; }, 20000); s = await state();
  R.check(whacked && s.a === 10, 'Beater: getting to the Bludger whacks it away, +10', 'whack failed ' + JSON.stringify({ whacks: s.whacks, a: s.a }));

  // after dark the Bludgers glow red so they stay visible against the night sky
  const glow = await Q(async () => { const g = window.__game, q = window.HPFun.mods.quidditch, wait = (ms) => new Promise((r) => setTimeout(r, ms)); g.setClock(13); await wait(700); const day = q._bludgerPos().glow; g.setClock(23); await wait(700); const night = q._bludgerPos().glow; g.setClock(null); return { day, night }; });
  R.check(glow.night > glow.day + 0.5, 'Bludgers smoulder red at night (glow ' + glow.day.toFixed(2) + ' by day → ' + glow.night.toFixed(2) + ' at night)', 'night Bludger glow wrong ' + JSON.stringify(glow));
  // ✨ Seeker — the Snitch comes out and catching it wins
  R.check(await play('seeker'), '✨ Seeker starts from the chooser', 'seeker did not start');
  R.check(await until(page, () => window.HPFun.mods.quidditch.state().snitch, 40000), 'Seeker: the Golden Snitch is released', 'no Snitch');
  const caught = await until(page, () => { const q = window.HPFun.mods.quidditch, st = q.state(); if (st.over) return true; q._snitchTo(st.me.x + 1, st.me.y + 1.2, st.me.z); return false; }, 20000); s = await state();
  R.check(caught && s.result && s.result.role === 'seeker' && s.result.win && s.a >= 150, 'Seeker: catching the Snitch ends the match with a win (+150)', 'catch failed ' + JSON.stringify(s.result));

  // 🔴 Chaser — pick up the Quaffle; the clock ends the match
  R.check(await play('chaser'), '🔴 Chaser starts from the chooser', 'chaser did not start');
  await Q(() => { const q = window.HPFun.mods.quidditch; q._calm(true); q._rivalAway(); const st = q.state(); q._quaffleAt(st.me.x + 1, st.me.y + 1, st.me.z); });
  const held = await until(page, () => window.HPFun.mods.quidditch.state().holder === 'me', 12000);
  const clock = await Q(() => document.querySelector('#qBoard .sn').textContent);
  await Q(() => window.HPFun.mods.quidditch._timeLeft(0.4));
  const ended = await until(page, () => window.HPFun.mods.quidditch.state().over, 12000); s = await state();
  R.check(held && /⏱\d+/.test(clock) && ended && s.result.role === 'chaser', 'Chaser: you carry the Quaffle, a ⏱ clock runs, time ends the match', 'chaser failed ' + JSON.stringify({ held, clock, ended, r: s.result }));

  await Q(() => { window.HPFun.mods.quidditch.quit(); document.getElementById('qEnd').classList.remove('on'); });
  R.check(await until(page, () => !window.HPFun.mods.quidditch.state().on && !window.__game.takeover && !window.__game.modal), 'afterwards you are back on your feet', 'stuck after the match');
  R.check(errors.length === 0, 'no console errors', 'errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));
  await browser.close(); R.done();
})();
