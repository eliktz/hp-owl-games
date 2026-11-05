/* The lessons controller: the 🔔 "שיעורים" bell now opens a big, friendly LESSON PICKER —
 * a grid of the six subjects (icon + Hebrew name + a ✓/⭐ for lessons already done today)
 * and a "go there" ➤ button that travels to the classroom and aims the glowing guide arrow.
 * Every classroom is always open: the child freely picks what to attend, any time, in any
 * order, never interrupted. No timetable, no clock gating, no closed-door signs, no auto
 * bell. On arrival a walk-up greeting + ▶ start button appears, then the minigame overlay.
 * Reads window.HPSchedule only for the cosmetic day (difficulty ramp); self-contained. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});
  const T = window.THREE;
  const SCH = window.HPSchedule;

  // ---- the subjects: chibi professor, room + a warm Hebrew greeting ----
  const LESSONS = [
    { key: 'potions', subject: 'שיקויים', teacher: 'snape', icon: '⚗️', color: '#7ef0a0', sticker: '⚗️', world: 'inside', room: 'dungeon', greet: 'שב בשקט... היום נבשל שיקוי. בלי לשבור כלום!' },
    { key: 'charms', subject: 'לחשים', teacher: 'flitwick', icon: '🪶', color: '#bfa0ff', sticker: '🪶', world: 'inside', room: 'charms', greet: 'סְוִיש וּפְלִיק! בוא נרחף נוצה יחד!' },
    { key: 'herbology', subject: 'עשבים', teacher: 'sprout', icon: '🌿', color: '#8cff9e', sticker: '🌿', world: 'outside', room: 'greenhouse', trigger: { x: -34, z: -16 }, dest: { world: 'outside', x: -34, z: -10, face: Math.PI, yaw: Math.PI }, greet: 'לחממה! בוא נספור ונשתול עציצים.' },
    { key: 'spells', subject: 'הֲגַנָּה', teacher: 'defence', icon: '🪄', color: '#9fd0ff', sticker: '🪄', world: 'inside', room: 'spells', greet: 'שלוף שרביט! נלמד לומוס, וינגרדיום וחיסול.' },
    { key: 'transfiguration', subject: 'שינוי צורה', teacher: 'mcgon', icon: '🐱', color: '#ffd0a0', sticker: '🐱', world: 'inside', room: 'transfiguration', greet: 'ריכוז! נהפוך חפץ לחפץ אחר.' },
    { key: 'astronomy', subject: 'כוכבים', teacher: 'sinistra', icon: '🔭', color: '#9fb0ff', sticker: '🔭', world: 'inside', room: 'astronomy', greet: 'הלילה יפה. בוא נחבר את הכוכבים לציור.' },
  ];
  HPL.LESSONS = LESSONS;
  const byKey = {}; LESSONS.forEach((l) => (byKey[l.key] = l));

  // ---- progress store (localStorage): best stars + attendance + "done today" ----
  const KEY = 'hpLessons1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  const store = load();
  store.stars = store.stars || {}; store.got = store.got || {};
  store.att = store.att || {};        // completed-count per subject (feeds difficulty)
  store.points = store.points || 0;   // total house points (kept internal)
  store.pday = store.pday || {};      // points earned per weekday index (kept internal)
  store.done = store.done || {};      // subjects completed on the current calendar day
  store.doneDate = store.doneDate || '';
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function todayStamp() { try { return new Date().toDateString(); } catch (e) { return 'day'; } }
  // roll the "done today" set over at a real calendar-day boundary
  function doneReset() { const d = todayStamp(); if (store.doneDate !== d) { store.doneDate = d; store.done = {}; save(); } }
  doneReset();
  HPL.progress = {
    // base mastery level 1..6 from stars earned + times attended → ramps gently
    level(key) { const s = store.stars[key] || 0, a = store.att[key] || 0; return Math.max(1, Math.min(6, 1 + Math.floor((s + a) / 2))); },
    stars(key) { return store.stars[key] || 0; },
    att(key) { return store.att[key] || 0; },
    points() { return store.points; },
    pday() { return store.pday; },
    total() { return LESSONS.reduce((s, l) => s + (store.stars[l.key] || 0), 0); },
    doneToday(key) { doneReset(); return !!store.done[key]; },
    award(key, stars) { store.stars[key] = Math.max(store.stars[key] || 0, stars); store.got[key] = true; save(); refreshBell(); return byKey[key] ? byKey[key].sticker : '⭐'; },
    // a lesson finished: record attendance, mark it done today + book house points
    attend(key, stars) {
      store.att[key] = (store.att[key] || 0) + 1;
      doneReset(); store.done[key] = true;
      const day = (SCH && SCH.state) ? SCH.state().day : 0;
      const pts = stars * 10 + 5;    // 15–35 points per attended lesson
      store.points += pts; store.pday[day] = (store.pday[day] || 0) + pts;
      this.award(key, stars); return pts;
    },
  };

  // ---- CSS ----
  const style = document.createElement('style');
  style.textContent = `
  #bellBtn{position:fixed;top:calc(env(safe-area-inset-top,0px) + 88px);inset-inline-start:calc(env(safe-area-inset-left,0px) + 14px);
    width:66px;height:66px;border-radius:50%;border:4px solid #ffd76a;background:radial-gradient(circle at 35% 30%,#ffcf6a,#b9651a);
    color:#fff;font-size:34px;z-index:12;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;
    touch-action:manipulation;-webkit-tap-highlight-color:transparent}
  #bellBtn:active{transform:scale(.9)} #bellBtn .bd{position:absolute;top:-4px;inset-inline-end:-4px;background:#7CFC7C;color:#13351a;
    font-size:15px;font-weight:bold;min-width:22px;height:22px;border-radius:12px;border:2px solid #13351a;display:flex;align-items:center;justify-content:center;padding:0 3px}
  /* ---- the friendly lesson picker ---- */
  #pickOv{position:fixed;inset:0;z-index:46;display:none;align-items:center;justify-content:center;background:rgba(8,6,24,.82);font-family:'Rubik',sans-serif;direction:rtl}
  #pickOv.on{display:flex}
  .pickP{width:min(94vw,620px);max-height:92vh;overflow:auto;background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:28px;padding:18px 18px 20px}
  .pickT{text-align:center;color:#ffd76a;font-size:30px;font-weight:bold;text-shadow:0 2px 0 #7a3b00;margin:0 0 4px}
  .pickSub{text-align:center;color:#eadcff;font-size:17px;margin:0 0 12px}
  .pickGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  @media (max-width:520px){.pickGrid{grid-template-columns:repeat(2,1fr)}}
  .pickCard{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(255,255,255,.07);
    border:3px solid rgba(255,215,106,.45);border-radius:20px;padding:12px 8px 10px;cursor:pointer;font-family:inherit;
    touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:transform .1s}
  .pickCard:active{transform:scale(.94)} .pickCard:focus{outline:none;border-color:#9effa0;box-shadow:0 0 14px rgba(120,240,160,.5)}
  .pickCard .ic{font-size:46px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
  .pickCard .nm{color:#fff;font-size:20px;font-weight:bold}
  .pickCard .st{font-size:16px;letter-spacing:1px;min-height:20px;color:#ffe9a8}
  .pickCard .st .done{color:#9effa0;font-weight:bold}
  .pickCard .go{margin-top:2px;display:inline-flex;align-items:center;gap:6px;background:linear-gradient(#ffe48a,#ffb020);
    color:#5a2b00;font-size:17px;font-weight:bold;border:3px solid #fff;border-radius:40px;padding:4px 14px}
  .pickCard .go .ar{font-size:18px}
  .pickClose{display:block;margin:14px auto 0;padding:8px 40px;border-radius:40px;border:4px solid #fff;background:linear-gradient(#b5a0ff,#7a52d6);color:#fff;font-size:22px;font-weight:bold;cursor:pointer;font-family:inherit}
  #lsnArrow{position:fixed;left:50%;top:50%;z-index:13;width:96px;height:96px;margin:-48px 0 0 -48px;pointer-events:none;display:none;
    flex-direction:column;align-items:center;justify-content:center;color:#bfffbf}
  #lsnArrow.on{display:flex}
  #lsnArrow .ic{font-size:26px;width:44px;height:44px;border-radius:50%;background:rgba(20,53,26,.92);border:3px solid #7CFC7C;
    display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px #7CFC7C;position:relative;animation:lsnPulse 1.2s infinite}
  #lsnArrow .ar{font-size:54px;line-height:1;filter:drop-shadow(0 0 10px #7CFC7C);margin-top:-2px}
  #lsnStart{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12;
    display:none;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
  #lsnStart.on{display:flex}
  #lsnStart .greet{background:rgba(255,245,220,.96);color:#2a1a12;border:3px solid #ffd76a;border-radius:18px;padding:8px 16px;font-size:24px;font-weight:bold;max-width:72vw;text-align:center}
  #lsnStart .go{pointer-events:auto;width:92px;height:92px;border-radius:50%;border:5px solid #fff;background:linear-gradient(#ffe48a,#ffb020);
    color:#5a2b00;font-size:46px;font-weight:bold;cursor:pointer;box-shadow:0 0 26px rgba(255,210,90,.9);animation:lsnPulse 1.1s infinite;font-family:inherit;touch-action:manipulation}
  @keyframes lsnPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.09)}}
  #lsnTip{position:fixed;left:50%;bottom:calc(240px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(12px);
    z-index:14;max-width:86vw;background:rgba(40,25,90,.96);border:3px solid #ffd76a;border-radius:18px;padding:11px 18px;
    color:#fff;font-size:19px;font-weight:bold;text-align:center;line-height:1.5;opacity:0;pointer-events:none;
    box-shadow:0 6px 20px rgba(0,0,0,.5);transition:opacity .45s,transform .45s}
  #lsnTip.on{opacity:1;transform:translateX(-50%) translateY(0)}
  #lsnTip b{color:#9effa0} #lsnTip .k{color:#ffe9a8}`;
  document.head.appendChild(style);

  // ---- DOM: bell, picker, guide arrow, start prompt ----
  let bellBtn, pickOv, arrowEl, arrowEm, arrowArr, startEl, goBtn, greetEl;
  function build() {
    bellBtn = mk('button', 'bellBtn'); bellBtn.innerHTML = '🔔<span class="bd">0</span>';
    bellBtn.title = 'בחרו שיעור'; bellBtn.setAttribute('aria-label', 'בחרו שיעור');
    bellBtn.addEventListener('click', (e) => { e.stopPropagation(); openPicker(); });
    pickOv = mk('div', 'pickOv'); document.body.appendChild(pickOv);
    pickOv.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === pickOv) closePicker(); });
    arrowEl = mk('div', 'lsnArrow');
    arrowEl.innerHTML = '<div class="ic"><span class="em">✨</span></div><div class="ar">➤</div>';
    arrowEm = arrowEl.querySelector('.em'); arrowArr = arrowEl.querySelector('.ar');
    document.body.appendChild(arrowEl);
    startEl = mk('div', 'lsnStart');
    greetEl = mk('div'); greetEl.className = 'greet'; startEl.appendChild(greetEl);
    goBtn = mk('button'); goBtn.className = 'go'; goBtn.textContent = '▶'; startEl.appendChild(goBtn);
    goBtn.addEventListener('click', (e) => { e.stopPropagation(); if (nearKey) startLesson(nearKey); });
    document.body.appendChild(startEl);
    document.body.appendChild(bellBtn);
    tipEl = mk('div', 'lsnTip');
    tipEl.innerHTML = 'הַקֵּשׁ עַל הַ<span class="k">🔔</span> וּבְחַר אֵיזֶה שִׁעוּר תִּרְצֶה<br>'
      + 'וְאָז עֲקֹב אַחֲרֵי הַחֵץ הַיָּרֹק <b>➤</b> אֶל הַכִּתָּה';
    document.body.appendChild(tipEl);
    refreshBell();
  }
  // a gentle one-time coach tip, the first time a child actually starts playing
  let tipEl = null, tipDone = false;
  function maybeTip() {
    if (tipDone) return; tipDone = true;
    try { if (localStorage.getItem('hpLsnTip1')) return; } catch (e) {}
    if (!tipEl) return;
    tipEl.classList.add('on');
    try { localStorage.setItem('hpLsnTip1', '1'); } catch (e) {}
    setTimeout(() => tipEl && tipEl.classList.remove('on'), 8000);
  }
  function mk(t, id) { const e = document.createElement(t); if (id) e.id = id; return e; }
  function refreshBell() { if (bellBtn) bellBtn.querySelector('.bd').textContent = HPL.progress.total(); }

  // ---- the lesson picker: a big friendly icon menu, no timetable ----
  function openPicker() {
    setModal(true); try { HP.sfx.flip(); } catch (e) {}
    renderPicker();
    pickOv.classList.add('on');
  }
  function closePicker() { pickOv.classList.remove('on'); setModal(false); try { HP.sfx.pop(); } catch (e) {} }

  function renderPicker() {
    const p = document.createElement('div'); p.className = 'pickP';
    const head = document.createElement('div');
    head.innerHTML = '<div class="pickT">✨ בחרו שיעור ✨</div><div class="pickSub">כל הכיתות פתוחות — בחרו מה שבא לכם!</div>';
    p.appendChild(head);
    const grid = document.createElement('div'); grid.className = 'pickGrid';
    LESSONS.forEach((l) => {
      const done = HPL.progress.doneToday(l.key);
      const stn = HPL.progress.stars(l.key);
      const card = document.createElement('button'); card.type = 'button'; card.className = 'pickCard'; card.dataset.k = l.key;
      card.setAttribute('aria-label', 'ללכת לשיעור ' + l.subject);
      const status = done
        ? '<span class="done">✓ ' + ('⭐'.repeat(Math.max(1, stn))) + '</span>'
        : ('⭐'.repeat(stn) + '☆'.repeat(3 - stn));
      card.innerHTML = '<div class="ic">' + l.icon + '</div>'
        + '<div class="nm">' + l.subject + '</div>'
        + '<div class="st">' + status + '</div>'
        + '<div class="go"><span class="ar">➤</span> ללכת</div>';
      card.addEventListener('click', (e) => { e.stopPropagation(); pick(l.key); });
      grid.appendChild(card);
    });
    p.appendChild(grid);
    const close = document.createElement('button'); close.className = 'pickClose'; close.textContent = 'סגור';
    close.addEventListener('click', (e) => { e.stopPropagation(); closePicker(); });
    p.appendChild(close);
    pickOv.innerHTML = ''; pickOv.appendChild(p);
  }

  // the child picked a lesson → aim the guide arrow at it + travel to its classroom
  let activeKey = null;
  function pick(key) {
    const l = byKey[key]; if (!l) return;
    activeKey = key;
    closePicker();
    goToLesson(key);
  }
  // travel to a classroom (used by the picker + the HPLessons.go test hook)
  function goToLesson(key) {
    const l = byKey[key]; if (!l) return;
    activeKey = key;
    const dest = l.dest || { world: 'inside', key: l.room };
    try {
      if (window.HPTravel && HPTravel.go) HPTravel.go(dest);
      else if (__game.fastTravel) __game.fastTravel(dest);
    } catch (e) {}
  }

  // ---- proximity: find the lesson whose teacher the player is standing near ----
  function triggerPos(l) {
    if (l.world === 'outside') return l.trigger;
    const t = (__game.inside && __game.inside.teachers || []).find((x) => x.key === l.key);
    return t ? { x: t.x, z: t.z } : null;
  }
  let nearKey = null, armed = {}, lastPos = null;
  function startLesson(key) {
    const l = byKey[key]; if (!l || (__game && __game.modal)) return;   // every room is always open now
    hideStart(); arrowEl.classList.remove('on'); armed[key] = false;
    if (activeKey === key) activeKey = null;      // arrived — retire the guide arrow
    HPL.overlay.open(l, () => { refreshBell(); });   // reward() books attendance + marks done today
  }

  function setModal(v) { try { __game && __game.setModal && __game.setModal(v); } catch (e) {} }

  // ---- per-frame loop (own rAF; reads __game) ----
  const tmp = T ? new T.Vector3() : null;
  function frame() {
    requestAnimationFrame(frame);
    const g = window.__game;
    if (!g || !g.started) { hideStart(); arrowEl.classList.remove('on'); return; }
    const world = g.world, pp = g.player.position;
    // detect a fast-travel teleport (big jump / world change): on arrival we show the ▶
    // start prompt rather than auto-begin, so landing on a teacher is a calm choice, not a
    // jarring instant start. A physical walk-up (small steps) still auto-begins.
    const teleported = !lastPos || lastPos.world !== world || Math.hypot(pp.x - lastPos.x, pp.z - lastPos.z) > 6;
    lastPos = { x: pp.x, z: pp.z, world };
    if (g.modal) { hideStart(); arrowEl.classList.remove('on'); return; }
    if (!tipDone) maybeTip();   // first frame of real play → show the coach tip once
    // nearest triggerable lesson in this world
    let best = null, bd = 1e9;
    for (const l of LESSONS) {
      if (l.world !== world) continue;
      const tp = triggerPos(l); if (!tp) continue;
      const d = Math.hypot(pp.x - tp.x, pp.z - tp.z);
      if (d < bd) { bd = d; best = l; }
    }
    const range = 4.2;
    if (best && bd < range) {
      nearKey = best.key;
      showStart(best);
      if (teleported && bd < 3) armed[best.key] = false;   // just warped in → wait for a tap, don't auto-start
      // walked right up → auto-begin (classrooms are always open)
      if (!teleported && bd < 2.6 && armed[best.key] !== false) startLesson(best.key);
      if (bd > 3) armed[best.key] = true;           // re-arm after stepping back
    } else { nearKey = null; hideStart(); if (best) armed[best.key] = true; }
    updateArrow(g, world);
  }
  function showStart(l) {
    if (startEl.classList.contains('on') && greetEl.dataset.k === l.key) return;
    greetEl.dataset.k = l.key; greetEl.textContent = l.icon + ' ' + l.greet;
    startEl.classList.add('on');
  }
  function hideStart() { if (startEl) startEl.classList.remove('on'); }

  // the glowing guide arrow points to whichever lesson the child picked from the menu
  function updateArrow(g, world) {
    const l = activeKey && byKey[activeKey];
    if (!l || l.world !== world || !tmp) { arrowEl.classList.remove('on'); return; }
    const tp = triggerPos(l); if (!tp) { arrowEl.classList.remove('on'); return; }
    if (Math.hypot(g.player.position.x - tp.x, g.player.position.z - tp.z) < 4) { arrowEl.classList.remove('on'); return; }
    const fy = (world === 'inside' && g.inside) ? g.inside.floorH(tp.x, tp.z) + 1.6 : 1.6;
    tmp.set(tp.x, fy, tp.z).project(g.camera);
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let sx = tmp.x, sy = tmp.y; if (tmp.z > 1) { sx = -sx; sy = -sy; }       // behind camera → flip
    const ang = Math.atan2(-sy, sx);
    const rad = Math.min(window.innerWidth, window.innerHeight) * 0.3;
    arrowEl.style.left = (cx + Math.cos(ang) * rad) + 'px';
    arrowEl.style.top = (cy - Math.sin(ang) * rad) + 'px';
    // the icon chip stays upright so kids can read "this way to [subject]"; only the ➤ turns.
    if (arrowEm) arrowEm.textContent = l.icon;
    if (arrowArr) arrowArr.style.transform = 'rotate(' + (-ang) + 'rad)';
    arrowEl.classList.add('on');
  }

  // ---- boot once __game + overlay are ready ----
  (function boot() {
    if (!window.__game || !HPL.overlay || !HPL.teacherAvatar) { return void setTimeout(boot, 120); }
    build(); requestAnimationFrame(frame);
  })();
  HPL.start = startLesson; HPL.go = goToLesson; HPL.pick = pick;   // test hooks
  HPL.openPicker = openPicker;
})();
