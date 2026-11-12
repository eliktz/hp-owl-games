// Day/night: the lighting phase follows the device's (mocked) clock, and the manual controls still work —
// __game.setClock(h) pins an hour, setClock(null) hands back to the device clock, ?hour= pins from the URL.
const { open, reporter, shot } = require('./ipad');
const lum = (hex) => (0.299 * ((hex >> 16) & 255) + 0.587 * ((hex >> 8) & 255) + 0.114 * (hex & 255)) / 255;
(async () => {
  const R = reporter('day/night');
  const errs = [];
  const outside = (page) => page.evaluate(async () => { window.__game.fastTravel({ world: 'outside', x: 0, z: 6, face: Math.PI, yaw: Math.PI, pitch: 0.05 }); await new Promise((r) => setTimeout(r, 1200)); return window.__game.clock(); });
  // the device clock decides the phase: four mocked iPad times → four phases
  const seen = {};
  for (const [hour, phase] of [[8, 'morning'], [13, 'day'], [18.5, 'evening'], [23, 'night']]) {
    const { browser, page, errors } = await open({ deviceHour: hour });
    const c = await outside(page); seen[phase] = c; errs.push(...errors);
    R.check(!c.pinned && Math.abs(c.hour - hour) < 0.02 && c.phase === phase, 'device clock ' + hour + ':00 → ' + phase, 'phase wrong at ' + hour + ': ' + JSON.stringify({ hour: c.hour, phase: c.phase, pinned: c.pinned }));
    if (phase === 'night') {
      await page.evaluate(() => document.querySelectorAll('.funToast,#lsnTip').forEach((e) => (e.style.display = 'none')));
      await shot(page, 'daynight-night-ipad.png');
      // manual control still works: pin midday on a night-time device, then hand back
      const pinned = await page.evaluate(async () => { window.__game.setClock(13); await new Promise((r) => setTimeout(r, 800)); return window.__game.clock(); });
      R.check(pinned.pinned && pinned.phase === 'day' && pinned.stars < 0.1 && !pinned.moon, 'manual: setClock(13) pins daytime even though the device says night', 'pin failed ' + JSON.stringify({ phase: pinned.phase, stars: pinned.stars, moon: pinned.moon }));
      await shot(page, 'daynight-day-ipad.png');
      const back = await page.evaluate(async () => { window.__game.setClock(null); await new Promise((r) => setTimeout(r, 800)); return window.__game.clock(); });
      R.check(!back.pinned && back.phase === 'night' && back.stars > 0.9, 'manual: setClock(null) hands back to the device clock (night again)', 'un-pin failed ' + JSON.stringify({ phase: back.phase, pinned: back.pinned }));
    }
    await browser.close();
  }
  R.check(lum(seen.day.sky.top) > lum(seen.evening.sky.top) && lum(seen.evening.sky.top) > lum(seen.night.sky.top) && seen.day.hemi > seen.evening.hemi && seen.evening.hemi > seen.night.hemi,
    'sky and light get darker day → evening → night', 'brightness order wrong ' + JSON.stringify(Object.keys(seen).map((k) => [k, seen[k].sky.top.toString(16), seen[k].hemi])));
  R.check(seen.night.stars > 0.9 && seen.night.moon && seen.day.stars < 0.1 && !seen.day.moon && seen.night.hemi >= 0.6, 'night has stars and a moon and is still bright enough to play; day has neither', 'stars/moon wrong ' + JSON.stringify({ night: [seen.night.stars, seen.night.moon, seen.night.hemi], day: [seen.day.stars, seen.day.moon] }));
  // the URL control
  const { browser, page, errors } = await open({ deviceHour: 13, query: '?hour=21.5' });
  const u = await outside(page); errs.push(...errors);
  R.check(u.pinned && u.phase === 'night' && Math.abs(u.hour - 21.5) < 0.02, 'manual: ?hour=21.5 pins night from the URL on a midday device', 'URL hour failed ' + JSON.stringify({ hour: u.hour, phase: u.phase, pinned: u.pinned }));
  await browser.close();
  R.check(errs.length === 0, 'no console errors', 'errors: ' + [...new Set(errs)].slice(0, 3).join(' | '));
  R.done();
})();
