/* The lessons controller: the friendly 🔔 "שיעורים" bell + schedule, a star/sticker
 * collection, the "הפעמון מצלצל!" announcement with a glowing guide arrow to the
 * classroom, the walk-up greeting + start button, and the dispatch into each minigame
 * overlay. Self-contained like the map: injects its own CSS, only talks to window.__game. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});
  const T = window.THREE;

  // ---- the timetable: subject, chibi professor, room + a warm Hebrew greeting ----
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

  // ---- progress store (localStorage): best stars + stickers per subject ----
  const KEY = 'hpLessons1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  const store = load(); store.stars = store.stars || {}; store.got = store.got || {};
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  HPL.progress = {
    level(key) { const b = store.stars[key] || 0; return b >= 2 ? 3 : b >= 1 ? 2 : 1; },   // mastery ramps difficulty
    award(key, stars) { store.stars[key] = Math.max(store.stars[key] || 0, stars); store.got[key] = true; save(); refreshBell(); return byKey[key] ? byKey[key].sticker : '⭐'; },
    stars(key) { return store.stars[key] || 0; },
    total() { return LESSONS.reduce((s, l) => s + (store.stars[l.key] || 0), 0); },
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
  #schedOv{position:fixed;inset:0;z-index:46;display:none;align-items:center;justify-content:center;background:rgba(8,6,24,.8);font-family:'Rubik',sans-serif}
  #schedOv.on{display:flex}
  .schedP{width:min(94vw,560px);max-height:92vh;overflow:auto;background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:26px;padding:18px}
  .schedT{text-align:center;color:#ffd76a;font-size:34px;font-weight:bold;text-shadow:0 2px 0 #7a3b00;margin:0 0 6px}
  .schedTot{text-align:center;color:#ffe9a8;font-size:22px;margin-bottom:12px}
  .schedRow{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.06);border:2px solid rgba(255,215,106,.4);border-radius:18px;padding:8px 10px;margin-bottom:10px}
  .schedRow canvas{width:58px;height:58px;border-radius:50%;border:3px solid #ffd76a;background:rgba(10,6,30,.4);flex:0 0 auto}
  .schedRow .info{flex:1} .schedRow .sub{color:#fff;font-size:24px;font-weight:bold} .schedRow .st{font-size:20px;letter-spacing:2px}
  .schedGo{min-width:74px;height:60px;border-radius:16px;border:4px solid #fff;background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00;font-size:28px;font-weight:bold;cursor:pointer;font-family:inherit;touch-action:manipulation}
  .schedGo:active{transform:scale(.92)}
  .schedClose{display:block;margin:6px auto 0;padding:8px 36px;border-radius:40px;border:4px solid #fff;background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00;font-size:26px;font-weight:bold;cursor:pointer;font-family:inherit}
  #lsnAnn{position:fixed;left:50%;top:22%;transform:translate(-50%,-50%) scale(0);z-index:44;pointer-events:none;text-align:center;
    background:rgba(40,25,90,.92);border:4px solid #ffd76a;border-radius:24px;padding:14px 26px;color:#fff;font-size:34px;font-weight:bold;
    text-shadow:0 2px 0 #000;transition:transform .4s cubic-bezier(.3,1.7,.5,1)}
  #lsnAnn.on{transform:translate(-50%,-50%) scale(1)}
  #lsnArrow{position:fixed;left:50%;top:50%;z-index:13;width:84px;height:84px;margin:-42px 0 0 -42px;pointer-events:none;display:none;
    font-size:60px;filter:drop-shadow(0 0 10px #7CFC7C);color:#bfffbf;align-items:center;justify-content:center}
  #lsnArrow.on{display:flex}
  #lsnStart{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12;
    display:none;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
  #lsnStart.on{display:flex}
  #lsnStart .greet{background:rgba(255,245,220,.96);color:#2a1a12;border:3px solid #ffd76a;border-radius:18px;padding:8px 16px;font-size:24px;font-weight:bold;max-width:72vw;text-align:center}
  #lsnStart .go{pointer-events:auto;width:92px;height:92px;border-radius:50%;border:5px solid #fff;background:linear-gradient(#ffe48a,#ffb020);
    color:#5a2b00;font-size:46px;font-weight:bold;cursor:pointer;box-shadow:0 0 26px rgba(255,210,90,.9);animation:lsnPulse 1.1s infinite;font-family:inherit;touch-action:manipulation}
  @keyframes lsnPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.09)}}`;
  document.head.appendChild(style);

  // ---- DOM: bell, schedule, announcement, arrow, start prompt ----
  let bellBtn, schedOv, annEl, arrowEl, startEl, goBtn, greetEl;
  function build() {
    bellBtn = mk('button', 'bellBtn'); bellBtn.innerHTML = '🔔<span class="bd">0</span>'; bellBtn.title = 'שיעורים';
    bellBtn.addEventListener('click', (e) => { e.stopPropagation(); openSchedule(); });
    schedOv = mk('div', 'schedOv'); document.body.appendChild(schedOv);
    schedOv.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === schedOv) closeSchedule(); });
    annEl = mk('div', 'lsnAnn'); document.body.appendChild(annEl);
    arrowEl = mk('div', 'lsnArrow'); arrowEl.textContent = '➤'; document.body.appendChild(arrowEl);
    startEl = mk('div', 'lsnStart');
    greetEl = mk('div'); greetEl.className = 'greet'; startEl.appendChild(greetEl);
    goBtn = mk('button'); goBtn.className = 'go'; goBtn.textContent = '▶'; startEl.appendChild(goBtn);
    goBtn.addEventListener('click', (e) => { e.stopPropagation(); if (nearKey) startLesson(nearKey); });
    document.body.appendChild(startEl); document.body.appendChild(bellBtn);
    refreshBell();
  }
  function mk(t, id) { const e = document.createElement(t); if (id) e.id = id; return e; }
  function refreshBell() { if (bellBtn) bellBtn.querySelector('.bd').textContent = HPL.progress.total(); }

  function openSchedule() {
    setModal(true); try { HP.sfx.flip(); } catch (e) {}
    const p = document.createElement('div'); p.className = 'schedP';
    p.innerHTML = '<div class="schedT">🔔 שיעורים</div><div class="schedTot">⭐ ' + HPL.progress.total() + ' / ' + (LESSONS.length * 3) + '</div>';
    LESSONS.forEach((l) => {
      const row = document.createElement('div'); row.className = 'schedRow';
      const cv = document.createElement('canvas'); cv.width = cv.height = 96; HPL.teacherAvatar(cv.getContext('2d'), l.teacher, 96, 0);
      const info = document.createElement('div'); info.className = 'info';
      const st = HPL.progress.stars(l.key);
      info.innerHTML = '<div class="sub">' + l.icon + ' ' + l.subject + '</div><div class="st">' + ('⭐'.repeat(st) + '☆'.repeat(3 - st)) + '</div>';
      const go = document.createElement('button'); go.className = 'schedGo'; go.textContent = 'ללמוד';
      go.addEventListener('click', (e) => { e.stopPropagation(); closeSchedule(); goToLesson(l.key); });
      row.appendChild(cv); row.appendChild(info); row.appendChild(go); p.appendChild(row);
    });
    const close = document.createElement('button'); close.className = 'schedClose'; close.textContent = 'סגור';
    close.addEventListener('click', (e) => { e.stopPropagation(); closeSchedule(); });
    p.appendChild(close);
    schedOv.innerHTML = ''; schedOv.appendChild(p); schedOv.classList.add('on');
  }
  function closeSchedule() { schedOv.classList.remove('on'); setModal(false); try { HP.sfx.pop(); } catch (e) {} }

  // chosen a lesson from the schedule → ring the bell, travel there, guide to the door
  let activeKey = null;
  function goToLesson(key) {
    const l = byKey[key]; if (!l) return;
    activeKey = key;
    announce('🔔 הפעמון מצלצל!', l.subject + ' ' + l.icon);
    const dest = l.dest || { world: 'inside', key: l.room };
    try { if (__game.fastTravel) __game.fastTravel(dest); } catch (e) {}
  }
  function announce(a, b) {
    annEl.innerHTML = a + '<br><span style="font-size:26px;color:#ffe9a8">' + b + '</span>';
    annEl.classList.add('on'); try { HP.sfx.hoot(true); } catch (e) {}
    clearTimeout(announce._t); announce._t = setTimeout(() => annEl.classList.remove('on'), 2600);
  }

  // ---- proximity: find the lesson whose teacher the player is standing near ----
  function triggerPos(l) {
    if (l.world === 'outside') return l.trigger;
    const t = (__game.inside && __game.inside.teachers || []).find((x) => x.key === l.key);
    return t ? { x: t.x, z: t.z } : null;
  }
  let nearKey = null, armed = {};
  function startLesson(key) {
    const l = byKey[key]; if (!l || (__game && __game.modal)) return;
    hideStart(); arrowEl.classList.remove('on'); activeKey = null; armed[key] = false;
    HPL.overlay.open(l, () => { refreshBell(); });
  }

  function setModal(v) { try { __game && __game.setModal && __game.setModal(v); } catch (e) {} }

  // ---- per-frame loop (own rAF; reads __game) ----
  const tmp = T ? new T.Vector3() : null;
  function frame() {
    requestAnimationFrame(frame);
    const g = window.__game;
    if (!g || !g.started || g.modal) { hideStart(); arrowEl.classList.remove('on'); return; }
    const world = g.world, pp = g.player.position;
    // nearest triggerable lesson in this world
    let best = null, bd = 1e9, bpos = null;
    for (const l of LESSONS) {
      if (l.world !== world) continue;
      const tp = triggerPos(l); if (!tp) continue;
      const d = Math.hypot(pp.x - tp.x, pp.z - tp.z);
      if (d < bd) { bd = d; best = l; bpos = tp; }
    }
    const range = 4.2;
    if (best && bd < range) {
      nearKey = best.key; showStart(best);
      // scheduled-and-arrived → auto-begin once we walk right up to the professor
      if (activeKey === best.key && bd < 2.6 && armed[best.key] !== false) { startLesson(best.key); }
      if (bd > 3) armed[best.key] = true;           // re-arm after stepping back
    } else { nearKey = null; hideStart(); if (best) armed[best.key] = true; }
    // guide arrow toward the scheduled lesson's door
    updateArrow(g, world);
  }
  function showStart(l) {
    if (startEl.classList.contains('on') && greetEl.dataset.k === l.key) return;
    greetEl.dataset.k = l.key; greetEl.textContent = l.icon + ' ' + l.greet;
    startEl.classList.add('on');
  }
  function hideStart() { if (startEl) startEl.classList.remove('on'); }

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
    arrowEl.style.transform = 'rotate(' + (-ang) + 'rad)';
    arrowEl.classList.add('on');
  }

  // ---- boot once __game + overlay are ready ----
  (function boot() {
    if (!window.__game || !HPL.overlay || !HPL.teacherAvatar) { return void setTimeout(boot, 120); }
    build(); requestAnimationFrame(frame);
  })();
  HPL.start = startLesson; HPL.go = goToLesson;   // test hooks
})();
