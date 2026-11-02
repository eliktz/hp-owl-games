/* map/travel.js — fast-travel destinations + the magical transition.
 * Owns the canonical destination list (map position % + game-world target) and the
 * swirl/fade/sparkle effect. The actual teleport is delegated to window.__game
 * (fastTravel / flyTo), so this file never touches Three.js directly. */
(function () {
  // mx/my: marker position in % of the map canvas. Interior rooms carry `key`
  // (an inside.spawns name); outdoor spots carry world x/z (+ optional facing).
  const DESTINATIONS = [
    { id: 'commonRoom', he: 'חדר המועדון', icon: '🔥', mx: 50, my: 16, world: 'inside', key: 'commonRoom', yaw: 0 },
    { id: 'stairs', he: 'מדרגות נעות', icon: '🪜', mx: 59, my: 21, world: 'inside', key: 'gallery', yaw: 0 },
    { id: 'greatHall', he: 'האולם הגדול', icon: '🍽️', mx: 40, my: 25, world: 'inside', key: 'greatHall', yaw: Math.PI / 2 },
    { id: 'entrance', he: 'אולם הכניסה', icon: '🚪', mx: 50, my: 29, world: 'inside', key: 'entrance', yaw: 0 },
    { id: 'corridor', he: 'מסדרון הדיוקנאות', icon: '🖼️', mx: 64, my: 30, world: 'inside', key: 'corridor', yaw: Math.PI / 2 },
    { id: 'library', he: 'הספרייה', icon: '📚', mx: 74, my: 25, world: 'inside', key: 'library', yaw: 0 },
    { id: 'courtyard', he: 'החצר', icon: '⛲', mx: 50, my: 45, world: 'outside', x: 0, z: -42, face: Math.PI, yaw: Math.PI },
    { id: 'greenhouse', he: 'החממה', icon: '🌿', mx: 24, my: 42, world: 'outside', x: -34, z: -16, yaw: 0.6 },
    { id: 'lake', he: 'האגם', icon: '🌊', mx: 16, my: 60, world: 'outside', x: -60, z: 6, yaw: -0.9 },
    { id: 'hagrid', he: 'בקתת האגריד', icon: '🏠', mx: 80, my: 55, world: 'outside', x: 54, z: 22, yaw: 2.2 },
    { id: 'quidditch', he: 'מגרש הקווידיץ׳', icon: '🧹', mx: 70, my: 78, world: 'outside', x: 44, z: 60, yaw: 0 },
    { id: 'forest', he: 'שולי היער', icon: '🌲', mx: 26, my: 76, world: 'outside', x: -52, z: -58, yaw: -0.4 },
  ];
  // Hedwig's perch on the map → tap her to take a flight instead of a jump.
  const HEDWIG = { mx: 88, my: 14, icon: '🦉', he: 'עוף עם הֶדְוִיג' };

  let overlay; // reused swirl element
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'mapWarp';
    overlay.innerHTML = '<div class="warpSwirl"></div>'
      + '<div class="warpSpark">✨</div><div class="warpSpark">⭐</div><div class="warpSpark">🌟</div>'
      + '<div class="warpSpark">✨</div><div class="warpSpark">💫</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function sfx(name) { try { window.HP && HP.sfx && HP.sfx[name] && HP.sfx[name](); } catch (e) { /* audio optional */ } }

  // Fade a swirl in, teleport at the peak (while the screen is covered), fade out.
  // onArrive runs the actual jump; onDone fires after the swirl clears.
  function swirl(onArrive, onDone, flavour) {
    const el = ensureOverlay();
    el.classList.remove('out');
    sfx('whoosh'); sfx('sparkle');
    // force reflow so the transition always plays from 0
    void el.offsetWidth;
    el.classList.add('on');
    const coverMs = 430;
    setTimeout(function () {
      try { onArrive && onArrive(); } catch (e) { console && console.warn && console.warn('[map] travel failed', e); }
      sfx(flavour === 'fly' ? 'hoot' : 'boom');
      el.classList.add('out');
      setTimeout(function () {
        el.classList.remove('on', 'out');
        try { onDone && onDone(); } catch (e) { /* noop */ }
      }, 420);
    }, coverMs);
  }

  // Jump to a destination marker.
  function go(dest, onDone) {
    if (!dest) return;
    swirl(function () {
      if (window.__game && typeof __game.fastTravel === 'function') __game.fastTravel(dest);
    }, onDone, 'jump');
  }

  // Tap Hedwig: a short cinematic flight. We rise into fly-mode above the grounds,
  // orbit the camera for a beat, then glide down to the courtyard.
  function flyHedwig(onDone) {
    const vantage = { world: 'outside', x: 0, z: 2, yaw: Math.PI, pitch: 0.5 };
    swirl(function () {
      if (window.__game && typeof __game.flyTo === 'function') __game.flyTo(vantage);
    }, function () {
      cinematicOrbit(2400, function () {
        // settle back onto the ground in the courtyard once the fly-over ends
        if (window.__game && typeof __game.fastTravel === 'function') {
          __game.fastTravel({ world: 'outside', x: 0, z: -42, face: Math.PI, yaw: Math.PI });
        }
        onDone && onDone();
      });
    }, 'fly');
  }

  // Slowly swing the follow-camera for `ms`, using __game's camYaw accessor.
  function cinematicOrbit(ms, done) {
    const g = window.__game;
    if (!g || typeof g.camYaw !== 'number') { setTimeout(done, ms); return; }
    const start = g.camYaw, span = Math.PI * 0.9;
    let t0 = null;
    function tick(ts) {
      if (t0 === null) t0 = ts;
      const k = Math.min(1, (ts - t0) / ms);
      try { g.camYaw = start + span * k; } catch (e) { /* noop */ }
      if (k < 1) requestAnimationFrame(tick); else done && done();
    }
    requestAnimationFrame(tick);
  }

  window.HPTravel = { DESTINATIONS: DESTINATIONS, HEDWIG: HEDWIG, go: go, flyHedwig: flyHedwig };
})();
