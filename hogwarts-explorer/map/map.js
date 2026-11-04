/* map/map.js — the big friendly 🗺️ button + the illustrated map overlay.
 * Builds the parchment backdrop (mapart.js), lays tappable location markers over it
 * (Hebrew label + icon), shows a pulsing "you are here", and routes taps to travel.js.
 * Works with touch, mouse and keyboard (M to toggle, Esc to close, Enter/Space on a
 * focused marker). Self-contained: injects its own CSS, only talks to window.__game. */
(function () {
  const T = window.HPTravel, ART = window.HPMapArt;
  if (!T || !ART) { console.warn('[map] travel/art not loaded'); return; }

  injectCss();

  // ---- the map button (RTL-aware: inset-inline-start sits on the right in this RTL app) ----
  const btn = document.createElement('button');
  btn.id = 'mapBtn'; btn.type = 'button';
  btn.setAttribute('aria-label', 'פתח מפה'); btn.title = 'מפה (M)';
  btn.textContent = '🗺️';
  document.body.appendChild(btn);

  // ---- overlay shell ----
  const ov = document.createElement('div');
  ov.id = 'mapOverlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'מפת הוגוורטס');
  ov.innerHTML = '<div class="mapFrame"><div class="mapArt"></div>'
    + '<div class="mapMarks"></div>'
    + '<button class="mapClose" type="button" aria-label="סגור">✕</button>'
    + '<div class="mapHint">בחרו יעד ✨</div></div>';
  document.body.appendChild(ov);
  ov.querySelector('.mapArt').innerHTML = ART.svg();
  const marks = ov.querySelector('.mapMarks');

  // ---- build a marker for every destination ----
  const markerEls = {};
  T.DESTINATIONS.forEach(function (d) {
    const m = mkMarker(d.icon, d.he, d.mx, d.my);
    m.dataset.id = d.id;
    m.setAttribute('aria-label', 'נסיעה אל ' + d.he);
    activate(m, function () { travel(d); });
    markerEls[d.id] = m;
    marks.appendChild(m);
  });

  // ---- Hedwig: tap to fly ----
  const hw = mkMarker(T.HEDWIG.icon, T.HEDWIG.he, T.HEDWIG.mx, T.HEDWIG.my);
  hw.classList.add('mapHedwig'); hw.dataset.id = 'hedwig-fly';
  hw.setAttribute('aria-label', T.HEDWIG.he);
  activate(hw, function () { closeMap(); T.flyHedwig(); });
  marks.appendChild(hw);

  // ---- lesson state, painted straight onto the classroom markers (no floating layer, so
  //      nothing ever overlaps the title banner). Each lesson key maps to its destination. ----
  const LESSON_DEST = { potions: 'dungeon', charms: 'charms', transfiguration: 'transfiguration',
    spells: 'spells', astronomy: 'astronomy', herbology: 'greenhouse' };

  // read HPSchedule live and paint each lesson marker open (green ring) or closed (dim + lock + time)
  function refreshLessons() {
    const S = window.HPSchedule; if (!S) return;
    Object.keys(LESSON_DEST).forEach(function (key) {
      const m = markerEls[LESSON_DEST[key]]; if (!m) return;
      const open = S.isOpen ? S.isOpen(key) : false;
      m.classList.toggle('lOpen', open);
      m.classList.toggle('lShut', !open);
      const when = m.querySelector('.mwhen');
      if (open) { if (when) when.textContent = ''; }
      else {
        const nx = S.nextOpenOf ? S.nextOpenOf(key) : null;
        if (when) when.textContent = (nx && nx.time) ? nx.time : '';
      }
    });
  }

  // ---- helpers ----
  function mkMarker(icon, label, mx, my) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'mapMarker'; el.tabIndex = 0;
    el.style.left = mx + '%'; el.style.top = my + '%';
    // lesson markers reveal the lock + open-time via the .lShut/.lOpen classes (map.js)
    el.innerHTML = '<span class="micon">' + icon + '</span><span class="mlock">🔒</span>'
      + '<span class="mlabel">' + label + '</span><span class="mwhen"></span>';
    return el;
  }

  function activate(el, fn) {
    el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    el.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
    });
  }

  function travel(d) {
    closeMap();
    T.go(d);
  }

  // Pulse the marker nearest the player's current spot.
  function markHere() {
    Object.keys(markerEls).forEach(function (k) { markerEls[k].classList.remove('mapHere'); });
    const g = window.__game;
    if (!g || !g.player) return;
    const p = g.player.position, inside = g.world === 'inside';
    let best = null, bestD = Infinity;
    T.DESTINATIONS.forEach(function (d) {
      if ((d.world === 'inside') !== inside) return;
      let cx, cz;
      if (d.world === 'inside') {
        const sp = g.inside && g.inside.spawns && g.inside.spawns[d.key];
        if (!sp) return; cx = sp.x; cz = sp.z;
      } else { cx = d.x; cz = d.z; }
      const dist = Math.hypot(p.x - cx, p.z - cz);
      if (dist < bestD) { bestD = dist; best = d; }
    });
    if (best) markerEls[best.id].classList.add('mapHere');
  }

  // ---- open / close ----
  let open = false, lessonTimer = null;
  function openMap() {
    if (open) return; open = true; markHere();
    refreshLessons(); clearInterval(lessonTimer); lessonTimer = setInterval(refreshLessons, 1000);
    ov.classList.add('on'); sfx('flip');
  }
  function closeMap() {
    if (!open) return; open = false;
    clearInterval(lessonTimer); lessonTimer = null;
    ov.classList.remove('on'); sfx('pop');
  }
  function toggle() { open ? closeMap() : openMap(); }

  function sfx(n) { try { window.HP && HP.sfx && HP.sfx[n] && HP.sfx[n](); } catch (e) { /* noop */ } }

  activate(btn, toggle);
  ov.querySelector('.mapClose').addEventListener('click', function (e) { e.stopPropagation(); closeMap(); });
  // tap the dim backdrop (outside the frame) to dismiss; swallow drags so the game ignores them
  ov.addEventListener('pointerdown', function (e) { e.stopPropagation(); if (e.target === ov) closeMap(); });
  window.addEventListener('keydown', function (e) {
    const k = (e.key || '').toLowerCase();
    if (k === 'm') { e.preventDefault(); toggle(); }
    else if (k === 'escape' && open) { e.preventDefault(); closeMap(); }
  });

  window.HPMap = { open: openMap, close: closeMap, toggle: toggle, isOpen: function () { return open; } };

  function injectCss() {
    const css =
    '#mapBtn{position:fixed;top:calc(env(safe-area-inset-top,0px) + 14px);'
    + 'inset-inline-start:calc(env(safe-area-inset-left,0px) + 14px);width:66px;height:66px;'
    + 'border-radius:50%;border:4px solid #ffd76a;background:radial-gradient(circle at 35% 30%,#6a4bbf,#2a1a5e);'
    + 'color:#fff;font-size:32px;line-height:1;z-index:12;cursor:pointer;'
    + 'box-shadow:0 4px 14px rgba(0,0,0,.45);touch-action:manipulation;-webkit-tap-highlight-color:transparent;'
    + 'display:flex;align-items:center;justify-content:center;padding:0}'
    + '#mapBtn:active{transform:scale(.9)}'
    + '#mapOverlay{position:fixed;inset:0;z-index:45;display:flex;align-items:center;justify-content:center;'
    + 'background:rgba(8,6,24,.72);opacity:0;visibility:hidden;transition:opacity .22s;'
    + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}'
    + '#mapOverlay.on{opacity:1;visibility:visible}'
    + '.mapFrame{position:relative;width:min(94vw,calc(92vh * 1.389));aspect-ratio:1000/720;max-width:1100px}'
    + '.mapArt{position:absolute;inset:0}.mapArt svg{width:100%;height:100%;display:block;'
    + 'filter:drop-shadow(0 10px 26px rgba(0,0,0,.55))}'
    + '.mapMarks{position:absolute;inset:0;pointer-events:none}'
    + '.mapMarker{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;'
    + 'align-items:center;gap:2px;background:none;border:none;padding:4px;cursor:pointer;pointer-events:auto;'
    + '-webkit-tap-highlight-color:transparent;min-width:46px;font-family:inherit}'
    + '.mapMarker .micon{font-size:30px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5));'
    + 'transition:transform .12s}'
    + '.mapMarker:hover .micon,.mapMarker:focus .micon{transform:scale(1.22)}'
    + '.mapMarker:focus{outline:none}.mapMarker:focus .mlabel{box-shadow:0 0 0 2px #ffd76a}'
    + '.mapMarker .mlabel{font-size:13px;font-weight:bold;color:#3a2a12;white-space:nowrap;'
    + 'background:rgba(255,240,200,.92);border:1px solid #b9842f;border-radius:9px;padding:1px 7px;'
    + 'box-shadow:0 2px 5px rgba(0,0,0,.35)}'
    + '.mapMarker:active{transform:translate(-50%,-50%) scale(.9)}'
    + '.mapHedwig .micon{font-size:36px;animation:mapBob 2.2s ease-in-out infinite}'
    + '.mapHere::before{content:"";position:absolute;top:2px;left:50%;width:46px;height:46px;'
    + 'margin-left:-23px;border-radius:50%;border:3px solid #7CFC7C;'
    + 'box-shadow:0 0 14px #7CFC7C;animation:mapPulse 1.3s ease-out infinite;pointer-events:none}'
    // lesson state, painted onto the marker itself (OPEN = green ring, CLOSED = padlock + open-time)
    + '.mapMarker .mlock{position:absolute;top:0;inset-inline-end:4px;font-size:16px;display:none;'
    + 'filter:drop-shadow(0 1px 1px rgba(0,0,0,.6))}'
    + '.mapMarker .mwhen{display:none;margin-top:2px;font-size:11px;font-weight:bold;color:#ffe9b0;'
    + 'background:rgba(20,12,44,.85);border-radius:7px;padding:0 6px;white-space:nowrap}'
    + '.mapMarker.lOpen .micon{text-shadow:0 0 10px #7CFC7C;transform:scale(1.08);'
    + 'animation:mapLessonPulse 1.4s ease-in-out infinite}'
    + '.mapMarker.lShut .micon{filter:grayscale(.7) brightness(.78)}'
    + '.mapMarker.lShut .mlock{display:block}.mapMarker.lShut .mwhen{display:block}'
    + '@keyframes mapLessonPulse{0%,100%{text-shadow:0 0 8px #7CFC7C}50%{text-shadow:0 0 18px #7CFC7C}}'
    + '.mapClose{position:absolute;top:-6px;inset-inline-end:-6px;width:46px;height:46px;border-radius:50%;'
    + 'border:3px solid #ffd76a;background:#3a2060;color:#fff;font-size:22px;cursor:pointer;z-index:2;'
    + 'box-shadow:0 3px 10px rgba(0,0,0,.5)}'
    + '.mapHint{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);color:#ffe9b0;'
    + 'font-size:15px;font-weight:bold;text-shadow:0 2px 0 #000;pointer-events:none}'
    // swirl transition (owned by travel.js, styled here)
    + '#mapWarp{position:fixed;inset:0;z-index:60;pointer-events:none;opacity:0;'
    + 'transition:opacity .42s ease-in;display:flex;align-items:center;justify-content:center}'
    + '#mapWarp.on{opacity:1}#mapWarp.out{opacity:0;transition:opacity .42s ease-out}'
    + '#mapWarp .warpSwirl{position:absolute;width:200vmax;height:200vmax;border-radius:50%;'
    + 'background:conic-gradient(from 0deg,#2a1a5e,#6a4bbf,#ffd76a,#6a4bbf,#2a1a5e);opacity:.96;'
    + 'animation:mapSwirl 1s linear infinite}'
    + '#mapWarp .warpSpark{position:absolute;font-size:40px;animation:mapSpark 1s ease-in-out infinite}'
    + '#mapWarp .warpSpark:nth-child(2){top:22%;left:24%}#mapWarp .warpSpark:nth-child(3){top:30%;left:72%;animation-delay:.15s}'
    + '#mapWarp .warpSpark:nth-child(4){top:66%;left:30%;animation-delay:.3s}#mapWarp .warpSpark:nth-child(5){top:60%;left:70%;animation-delay:.1s}'
    + '#mapWarp .warpSpark:nth-child(6){top:46%;left:50%;font-size:64px;animation-delay:.2s}'
    + '@keyframes mapSwirl{to{transform:rotate(360deg)}}'
    + '@keyframes mapSpark{0%,100%{transform:scale(.6);opacity:.4}50%{transform:scale(1.3);opacity:1}}'
    + '@keyframes mapBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'
    + '@keyframes mapPulse{0%{transform:scale(.7);opacity:1}100%{transform:scale(1.7);opacity:0}}';
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
  }
})();
